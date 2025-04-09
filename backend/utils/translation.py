"""
언어 감지 및 번역 관련 유틸리티 함수
"""

import os
import logging
import time
import asyncio
import re
import concurrent.futures
from typing import Dict, Any, Optional, List, Tuple, Union
from langdetect import detect, DetectorFactory, LangDetectException
from deep_translator import GoogleTranslator
from dotenv import load_dotenv

# 언어 감지 결과 일관성을 위한 시드 설정
DetectorFactory.seed = 0

# 로깅 설정
logger = logging.getLogger(__name__)

# 환경 변수 로드
load_dotenv()

# 번역 관련 상수
class TranslationConfig:
    # 지원하는 언어 코드
    SUPPORTED_LANGUAGES = {
        'ko': '한국어',
        'en': '영어',
        'ja': '일본어',
        'zh-cn': '중국어 간체',
        'zh-tw': '중국어 번체',
        'de': '독일어',
        'fr': '프랑스어',
        'es': '스페인어',
        'ru': '러시아어',
        'it': '이탈리아어',
        'pt': '포르투갈어',
        'ar': '아랍어',
        'hi': '힌디어',
        'vi': '베트남어',
        'th': '태국어'
    }
    
    # langdetect와 deep-translator 간의 언어 코드 매핑
    LANG_CODE_MAPPING = {
        'ko': 'ko',
        'en': 'en',
        'ja': 'ja',
        'zh-cn': 'zh-CN',
        'zh-tw': 'zh-TW',
        'de': 'de',
        'fr': 'fr',
        'es': 'es',
        'ru': 'ru',
        'it': 'it',
        'pt': 'pt',
        'ar': 'ar',
        'hi': 'hi',
        'vi': 'vi',
        'th': 'th'
    }
    
    # deep-translator에서 langdetect로의 역매핑
    REVERSE_LANG_CODE_MAPPING = {v: k for k, v in LANG_CODE_MAPPING.items()}
    
    # 기본 번역 설정
    DEFAULT_TARGET_LANG = 'ko'
    MAX_TEXT_LENGTH = 5000
    CHUNK_SIZE = 4500
    
    # 번역 요청 제한
    REQUEST_LIMIT = 5
    REQUEST_TIMEOUT = 10
    
    # 언어 감지 관련 설정
    MIN_TEXT_LENGTH_FOR_RELIABLE_DETECTION = 10
    LANGUAGE_PATTERN_CONFIDENCE_THRESHOLD = 0.6
    
    # 언어별 특징적인 문자 패턴
    LANGUAGE_PATTERNS = {
        'ko': r'[가-힣]',
        'ja': r'[\u3040-\u309F\u30A0-\u30FF]',
        'zh-CN': r'[\u4E00-\u9FFF]',
        'zh-TW': r'[\u4E00-\u9FFF]',
        'en': r'[a-zA-Z]',
        'es': r'[áéíóúüñ¿¡]',
        'de': r'[äöüß]',
        'fr': r'[àâçéèêëîïôùûüÿ]',
        'ru': r'[а-яА-Я]',
        'it': r'[àèéìíîòóùú]',
        'pt': r'[áàâãçéêíóôõú]',
        'ar': r'[\u0600-\u06FF]',
        'hi': r'[\u0900-\u097F]',
        'vi': r'[àáâãèéêìíòóôõùúýăđĩũơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]',
        'th': r'[\u0E00-\u0E7F]'
    }
    
    # 언어 전용 단어 사전 (짧은 텍스트 감지용)
    COMMON_WORDS = {
        'ko': ['안녕', '하세요', '감사', '입니다', '니다', '아요', '어요', '이', '그', '저', '우리', '너', '당신'],
        'en': ['hello', 'hi', 'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'i', 'you', 'he', 'she'],
        'ja': ['こんにちは', 'おはよう', 'ありがとう', 'です', 'ます', 'わたし', 'あなた', 'これ', 'それ', 'あれ'],
        'es': ['hola', 'gracias', 'buenos', 'días', 'el', 'la', 'los', 'las', 'es', 'son', 'yo', 'tú', 'él', 'ella'],
        'de': ['hallo', 'danke', 'guten', 'tag', 'der', 'die', 'das', 'ist', 'sind', 'ich', 'du', 'er', 'sie'],
        'fr': ['bonjour', 'merci', 'le', 'la', 'les', 'est', 'sont', 'je', 'tu', 'il', 'elle'],
        'zh-CN': ['你好', '谢谢', '再见', '是', '我', '你', '他', '她', '们', '这', '那'],
    }
    
    @classmethod
    def get_language_name(cls, lang_code: str) -> str:
        """
        언어 코드에 해당하는 언어 이름 반환
        """
        if lang_code in cls.REVERSE_LANG_CODE_MAPPING:
            lang_code = cls.REVERSE_LANG_CODE_MAPPING[lang_code]
            
        return cls.SUPPORTED_LANGUAGES.get(lang_code, lang_code)
    
    @classmethod
    def is_supported_language(cls, lang_code: str) -> bool:
        """
        지원하는 언어인지 확인
        """
        if lang_code in cls.SUPPORTED_LANGUAGES or lang_code in cls.LANG_CODE_MAPPING.values():
            return True
        return False
    
    @classmethod
    def normalize_lang_code(cls, lang_code: str) -> str:
        """
        언어 코드 정규화 (langdetect -> deep-translator)
        """
        return cls.LANG_CODE_MAPPING.get(lang_code, lang_code)


def _detect_language_by_pattern(text: str) -> Optional[str]:
    """
    문자 패턴 기반 언어 감지 (짧은 텍스트나 혼합 언어에 효과적)
    """
    if not text or len(text.strip()) == 0:
        return None
    
    text = text.lower()
    total_length = len(text)
    
    # 각 언어별 문자 패턴 매칭 비율 계산
    lang_scores = {}
    
    for lang, pattern in TranslationConfig.LANGUAGE_PATTERNS.items():
        matches = re.findall(pattern, text)
        if matches:
            match_ratio = len(''.join(matches)) / total_length
            lang_scores[lang] = match_ratio
    
    # 언어별 단어 사전 매칭 확인
    for lang, words in TranslationConfig.COMMON_WORDS.items():
        word_score = 0
        for word in words:
            if word.lower() in text:
                word_score += len(word) / total_length
        
        if lang in lang_scores:
            lang_scores[lang] += word_score
        else:
            lang_scores[lang] = word_score
    
    # 가장 높은 점수의 언어 선택
    if lang_scores:
        best_lang = max(lang_scores.items(), key=lambda x: x[1])
        
        # 임계값을 넘으면 해당 언어 반환
        if best_lang[1] >= TranslationConfig.LANGUAGE_PATTERN_CONFIDENCE_THRESHOLD:
            return best_lang[0]
    
    return None


def detect_language(text: str) -> Dict[str, Any]:
    """
    텍스트의 언어 감지
    """
    if not text or not isinstance(text, str) or len(text.strip()) == 0:
        return {
            'success': False,
            'error': '언어를 감지할 텍스트가 없습니다.'
        }
    
    try:
        lang_code = None
        confidence = 0
        detection_method = "standard"
        
        # 텍스트가 너무 짧으면 패턴 기반 감지 사용
        if len(text.strip()) < TranslationConfig.MIN_TEXT_LENGTH_FOR_RELIABLE_DETECTION:
            # 패턴 기반 감지 시도
            pattern_lang = _detect_language_by_pattern(text)
            
            if pattern_lang:
                lang_code = pattern_lang
                detection_method = "pattern"
            else:
                # 패턴 감지 실패 시 표준 감지 시도
                try:
                    lang_code = detect(text[:1000])
                except LangDetectException as e:
                    return {
                        'success': False,
                        'error': f"언어 감지에 실패했습니다: {str(e)}"
                    }
        else:
            # 일반적인 길이의 텍스트는 표준 감지 사용
            lang_code = detect(text[:1000])
            
            # 혼합 언어 텍스트에 대한 추가 검증
            pattern_lang = _detect_language_by_pattern(text)
            
            if pattern_lang and pattern_lang != lang_code:
                # 한국어, 일본어, 중국어가 포함된 경우 패턴 감지가 더 정확할 수 있음
                asian_langs = ['ko', 'ja', 'zh-CN', 'zh-TW']
                if pattern_lang in asian_langs:
                    lang_code = pattern_lang
                    detection_method = "pattern"
        
        # googletrans 형식으로 변환
        normalized_code = TranslationConfig.normalize_lang_code(lang_code)
        language_name = TranslationConfig.get_language_name(lang_code)
        
        return {
            'success': True,
            'language': normalized_code,
            'language_name': language_name,
            'detection_method': detection_method
        }
        
    except Exception as e:
        logger.error(f"언어 감지 중 오류 발생: {str(e)}")
        return {
            'success': False,
            'error': f"언어 감지 중 오류가 발생했습니다: {str(e)}"
        }


def translate_text(text: str, target_lang: str = TranslationConfig.DEFAULT_TARGET_LANG, 
                 source_lang: Optional[str] = None) -> Dict[str, Any]:
    """
    텍스트 번역
    """
    if not text or not isinstance(text, str) or len(text.strip()) == 0:
        return {
            'success': False,
            'error': '번역할 텍스트가 없습니다.'
        }
    
    # 대상 언어 검증
    if not target_lang or not isinstance(target_lang, str):
        target_lang = TranslationConfig.DEFAULT_TARGET_LANG
        
    if not TranslationConfig.is_supported_language(target_lang):
        target_lang = TranslationConfig.DEFAULT_TARGET_LANG
    
    # 원본 언어 자동 감지 (필요한 경우)
    detected_lang = None
    if not source_lang:
        lang_result = detect_language(text)
        
        if lang_result['success']:
            detected_lang = lang_result['language']
            source_lang = detected_lang
            
            # 원본 언어와 대상 언어가 같으면 번역 불필요
            if source_lang == target_lang:
                return {
                    'success': True,
                    'translated_text': text,
                    'source_language': source_lang,
                    'source_language_name': TranslationConfig.get_language_name(source_lang),
                    'target_language': target_lang,
                    'target_language_name': TranslationConfig.get_language_name(target_lang),
                    'message': '원본 언어와 대상 언어가 동일하여 번역하지 않았습니다.'
                }
        else:
            source_lang = 'auto'
    
    try:
        # 번역 수행
        # 긴 텍스트 분할 처리
        if len(text) > TranslationConfig.MAX_TEXT_LENGTH:
            chunks = [text[i:i+TranslationConfig.CHUNK_SIZE] 
                     for i in range(0, len(text), TranslationConfig.CHUNK_SIZE)]
            
            # ThreadPoolExecutor를 사용하여 청크 병렬 처리
            translated_chunks = []
            
            def translate_chunk(chunk_index, chunk):
                max_retries = 3
                for attempt in range(max_retries):
                    try:
                        translator = GoogleTranslator(source=source_lang, target=target_lang)
                        result = translator.translate(chunk)
                        return chunk_index, result
                    except Exception as e:
                        if attempt < max_retries - 1:
                            time.sleep(2)
                        else:
                            raise
            
            # 병렬 처리로 각 청크 번역
            chunk_results = []
            with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
                futures = [executor.submit(translate_chunk, i, chunk) for i, chunk in enumerate(chunks)]
                for future in concurrent.futures.as_completed(futures):
                    try:
                        chunk_index, result = future.result()
                        chunk_results.append((chunk_index, result))
                    except Exception as e:
                        raise
            
            # 청크 순서 유지를 위한 정렬
            chunk_results.sort(key=lambda x: x[0])
            translated_chunks = [result for _, result in chunk_results]
            
            translated_text = ''.join(translated_chunks)
            
        else:
            # 단일 텍스트 번역 (작은 텍스트)
            try:
                translator = GoogleTranslator(source=source_lang, target=target_lang)
                translated_text = translator.translate(text)
            except Exception as e:
                raise
            
            # 자동 감지 모드에서 감지된 언어 가져오기
            if source_lang == 'auto' and not detected_lang:
                try:
                    detected_lang = detect(text[:100])
                    detected_lang = TranslationConfig.normalize_lang_code(detected_lang)
                except Exception:
                    detected_lang = 'unknown'
        
        # 감지된 언어가 없으면 'auto'로 설정
        if not detected_lang:
            detected_lang = source_lang if source_lang != 'auto' else 'unknown'
        
        # 감지된 언어의 이름
        detected_lang_name = TranslationConfig.get_language_name(detected_lang)
        target_lang_name = TranslationConfig.get_language_name(target_lang)
        
        result = {
            'success': True,
            'translated_text': translated_text,
            'source_language': detected_lang,
            'source_language_name': detected_lang_name,
            'target_language': target_lang,
            'target_language_name': target_lang_name
        }
        
        return result
        
    except Exception as e:
        logger.error(f"번역 중 오류 발생: {str(e)}")
        return {
            'success': False,
            'error': f"번역 중 오류가 발생했습니다: {str(e)}"
        }