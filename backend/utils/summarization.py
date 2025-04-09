"""
텍스트 요약 관련 유틸리티 함수
"""

import os
import logging
import time
import google.generativeai as genai
from typing import Dict, Any, Optional, List, Tuple, Union
from dotenv import load_dotenv

# 로깅 설정
logger = logging.getLogger(__name__)

# 환경 변수 로드
load_dotenv()

# 요약 관련 상수
class SummarizationConfig:
    # Hugging Face 모델 설정
    HF_MODEL_NAME = "facebook/bart-large-cnn"
    HF_MAX_LENGTH = 150
    HF_MIN_LENGTH = 30
    HF_DO_SAMPLE = False
    
    # Gemini API 설정
    GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')
    GEMINI_MODEL = os.environ.get('GEMINI_MODEL', 'gemini-1.5-pro')
    
    # 요약 설정
    MAX_TEXT_LENGTH = 50000
    DEFAULT_RATIO = 0.3
    
    # 캐싱
    CACHE_TIMEOUT = 24 * 60 * 60  # 24시간


# Hugging Face Transformers 지연 로드 (필요할 때만 임포트하여 메모리 절약)
def _load_transformers():
    try:
        from transformers import pipeline
        return pipeline("summarization", model=SummarizationConfig.HF_MODEL_NAME)
    except ImportError:
        logger.error("transformers 패키지가 설치되어 있지 않습니다. 'pip install transformers torch' 명령으로 설치하세요.")
        return None
    except Exception as e:
        logger.error(f"Hugging Face 모델 로드 중 오류 발생: {str(e)}")
        return None


def summarize_text_with_transformers(text: str, max_length: int = SummarizationConfig.HF_MAX_LENGTH, 
                                   min_length: int = SummarizationConfig.HF_MIN_LENGTH, 
                                   style: str = "concise") -> Dict[str, Any]:
    """
    Hugging Face Transformers를 사용하여 텍스트 요약
    
    Args:
        text: 요약할 텍스트
        max_length: 최대 요약 길이 (문자 수)
        min_length: 최소 요약 길이
        style: 요약 스타일 ('concise', 'detailed', 'bullet', 'academic')
        
    Returns:
        Dict: 요약 결과 정보
        {
            'success': 요약 성공 여부 (bool),
            'summary': 요약 텍스트 (str),
            'original_length': 원본 텍스트 길이 (int),
            'summary_length': 요약 텍스트 길이 (int),
            'ratio': 요약 비율 (float),
            'error': 오류 메시지 (str, 실패 시에만)
        }
    """
    if not text or not isinstance(text, str) or len(text.strip()) < 100:
        return {
            'success': False,
            'error': '요약할 텍스트가 너무 짧거나 없습니다. 최소 100자 이상이어야 합니다.'
        }
    
    # 너무 긴 텍스트 처리
    if len(text) > SummarizationConfig.MAX_TEXT_LENGTH:
        logger.warning(f"텍스트가 너무 깁니다 ({len(text)} 문자). 처음 {SummarizationConfig.MAX_TEXT_LENGTH} 문자만 요약합니다.")
        text = text[:SummarizationConfig.MAX_TEXT_LENGTH]
    
    try:
        # 시작 시간 기록
        start_time = time.time()
        
        # Hugging Face 모델 로드
        summarizer = _load_transformers()
        if not summarizer:
            return {
                'success': False,
                'error': 'Hugging Face 모델을 로드할 수 없습니다.'
            }
        
        # 모델의 최대 입력 길이에 맞게 텍스트 조정
        # (참고: 실제 모델의 최대 길이에 따라 조정 필요)
        max_input_length = 1024
        if len(text) > max_input_length:
            logger.warning(f"모델의 최대 입력 길이({max_input_length})를 초과하는 텍스트입니다. 텍스트를 잘라서 처리합니다.")
            text = text[:max_input_length]
        
        # 요약 생성
        # Transformers는 스타일을 직접 조정하기 어려우므로, max_length와 min_length를 활용하여 간접적으로 조정
        # concise: 짧게, detailed: 길게, 나머지는 중간 정도로 처리
        actual_max_length = max_length
        actual_min_length = min_length
        
        if style == "concise":
            actual_max_length = int(max_length * 0.7)  # 더 짧게
            actual_min_length = min_length
        elif style == "detailed":
            actual_max_length = max_length
            actual_min_length = int(min_length * 1.5)  # 더 길게
        
        result = summarizer(text, max_length=actual_max_length, min_length=actual_min_length, 
                           do_sample=SummarizationConfig.HF_DO_SAMPLE)
        
        # 요약 텍스트 추출
        summary = result[0]['summary_text']
        
        # 스타일에 따른 후처리
        if style == "bullet" and len(summary) > 0:
            # 문장 단위로 나누어 글머리 기호 추가
            sentences = summary.split('. ')
            bullet_points = []
            for sentence in sentences:
                if sentence:
                    cleaned = sentence.strip()
                    if cleaned and not cleaned.endswith('.'):
                        cleaned += '.'
                    if cleaned:
                        bullet_points.append(f"• {cleaned}")
            summary = '\n'.join(bullet_points)
        
        # 학술적 스타일 처리는 BART 모델로는 직접적인 구현이 어려우므로 생략 
        # (이는 Gemini와 같은 LLM이 더 잘 처리함)
        
        # 요약이 너무 길 경우 자르기
        if len(summary) > max_length:
            summary = summary[:max_length]
        
        # 소요 시간 계산
        elapsed_time = time.time() - start_time
        logger.info(f"Hugging Face 요약 완료: {len(text)} 문자 -> {len(summary)} 문자, 소요 시간: {elapsed_time:.2f}초")
        
        return {
            'success': True,
            'summary': summary,
            'original_length': len(text),
            'summary_length': len(summary),
            'ratio': len(summary) / len(text) if len(text) > 0 else 0,
            'model': 'huggingface',
            'model_name': SummarizationConfig.HF_MODEL_NAME
        }
        
    except Exception as e:
        logger.error(f"Hugging Face 요약 중 오류 발생: {str(e)}")
        return {
            'success': False,
            'error': f"요약 중 오류가 발생했습니다: {str(e)}"
        }


def summarize_text_with_gemini(text: str, max_length: int = SummarizationConfig.HF_MAX_LENGTH, style: str = "concise") -> Dict[str, Any]:
    """
    Gemini API를 사용하여 텍스트 요약
    
    Args:
        text: 요약할 텍스트
        max_length: 최대 요약 길이 (문자 수)
        style: 요약 스타일 ('concise', 'detailed', 'bullet', 'academic')
        
    Returns:
        Dict: 요약 결과 정보
        {
            'success': 요약 성공 여부 (bool),
            'summary': 요약 텍스트 (str),
            'original_length': 원본 텍스트 길이 (int),
            'summary_length': 요약 텍스트 길이 (int),
            'ratio': 요약 비율 (float),
            'error': 오류 메시지 (str, 실패 시에만)
        }
    """
    if not SummarizationConfig.GEMINI_API_KEY:
        return {
            'success': False,
            'error': 'Gemini API 키가 설정되지 않았습니다.'
        }
    
    if not text or not isinstance(text, str) or len(text.strip()) < 100:
        return {
            'success': False,
            'error': '요약할 텍스트가 너무 짧거나 없습니다. 최소 100자 이상이어야 합니다.'
        }
    
    # 너무 긴 텍스트 처리
    if len(text) > SummarizationConfig.MAX_TEXT_LENGTH:
        logger.warning(f"텍스트가 너무 깁니다 ({len(text)} 문자). 처음 {SummarizationConfig.MAX_TEXT_LENGTH} 문자만 요약합니다.")
        text = text[:SummarizationConfig.MAX_TEXT_LENGTH]
    
    try:
        # 시작 시간 기록
        start_time = time.time()
        
        # Gemini API 설정
        genai.configure(api_key=SummarizationConfig.GEMINI_API_KEY)
        
        # Gemini 모델 생성
        model = genai.GenerativeModel(SummarizationConfig.GEMINI_MODEL)
        
        # 스타일에 따른 프롬프트 설정
        style_prompt = ""
        if style == "concise":
            style_prompt = "간결하고 명확하게 요약해주세요. 중요한 정보만 포함시키고 불필요한 세부 사항은 제외하세요."
        elif style == "detailed":
            style_prompt = "자세하게 요약해주세요. 중요한 세부 사항과 맥락을 포함시키세요."
        elif style == "bullet":
            style_prompt = "요점만 글머리 기호(•) 형식으로 나열해주세요. 각 요점은 간결하게 작성하세요."
        elif style == "academic":
            style_prompt = "학술적인 형식으로 요약해주세요. 전문 용어를 유지하고 객관적이고 형식적인 언어를 사용하세요."
        else:
            style_prompt = "간결하고 명확하게 요약해주세요."
        
        # 프롬프트 설정
        prompt = f"""
        다음 텍스트를 {style_prompt}
        
        요약의 총 길이는 약 {max_length}자(글자 수) 이내로 작성해주세요.
        
        원본 텍스트: 
        {text}
        
        요약:
        """
        
        # 요약 생성
        response = model.generate_content(prompt)
        
        # 요약 텍스트 추출
        summary = response.text.strip()
        
        # 요약이 너무 길 경우 자르기
        if len(summary) > max_length:
            summary = summary[:max_length]
        
        # 소요 시간 계산
        elapsed_time = time.time() - start_time
        logger.info(f"Gemini 요약 완료: {len(text)} 문자 -> {len(summary)} 문자, 소요 시간: {elapsed_time:.2f}초")
        
        return {
            'success': True,
            'summary': summary,
            'original_length': len(text),
            'summary_length': len(summary),
            'ratio': len(summary) / len(text) if len(text) > 0 else 0,
            'model': 'gemini',
            'model_name': SummarizationConfig.GEMINI_MODEL
        }
        
    except Exception as e:
        logger.error(f"Gemini 요약 중 오류 발생: {str(e)}")
        return {
            'success': False,
            'error': f"요약 중 오류가 발생했습니다: {str(e)}"
        }


def summarize_text(text: str, engine: str = "gemini", max_length: int = SummarizationConfig.HF_MAX_LENGTH, 
                  min_length: int = SummarizationConfig.HF_MIN_LENGTH, style: str = "concise") -> Dict[str, Any]:
    """
    텍스트 요약 통합 함수
    
    Args:
        text: 요약할 텍스트
        engine: 요약 엔진 ("gemini" 또는 "huggingface")
        max_length: 최대 요약 길이
        min_length: 최소 요약 길이
        style: 요약 스타일 ('concise', 'detailed', 'bullet', 'academic')
        
    Returns:
        Dict: 요약 결과 정보
    """
    if engine.lower() == "gemini":
        return summarize_text_with_gemini(text, max_length, style)
    else:
        return summarize_text_with_transformers(text, max_length, min_length, style) 