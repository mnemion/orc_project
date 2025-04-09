"""
OCR 유틸리티 모듈

OCR 처리를 위한 다양한 유틸리티 함수를 제공합니다.
"""

import os
import re
import cv2
import numpy as np
import logging
from PIL import Image, ImageFilter, ImageEnhance
from typing import List, Tuple, Dict, Any, Optional, Union

# 로깅 설정
logger = logging.getLogger(__name__)

# OCR 유틸리티 상수
class OCRUtils:
    # 이미지 향상 설정
    CONTRAST_FACTOR = 2.0
    MEDIAN_FILTER_SIZE = 3
    DESKEW_ANGLE_THRESHOLD = 45.0
    
    # 텍스트 언어 감지 설정
    KOREAN_CHAR_PATTERN = r'[가-힣]'
    ENGLISH_CHAR_PATTERN = r'[a-zA-Z]'
    JAPANESE_CHAR_PATTERN = r'[\u3040-\u309F\u30A0-\u30FF]'
    CHINESE_CHAR_PATTERN = r'[\u4E00-\u9FFF]'
    
    # 언어 감지 임계값
    LANGUAGE_THRESHOLD = 0.2
    
    # 텍스트 추출 설정
    DEFAULT_OCR_CONFIG = '--psm 6'
    DEFAULT_LANG = 'kor+eng'
    
    # 이미지 처리 설정
    MAX_WIDTH = 1200
    MAX_HEIGHT = 1200
    BINARY_THRESHOLD = 128
    HSV_V_THRESHOLD = 180


def enhance_image_contrast(image: np.ndarray) -> np.ndarray:
    """
    이미지 대비 향상
    
    Args:
        image: 원본 이미지
        
    Returns:
        대비가 향상된 이미지
    """
    try:
        # NumPy 배열을 PIL 이미지로 변환
        pil_img = Image.fromarray(image)
    
        # 이미지 향상
        enhancer = ImageEnhance.Contrast(pil_img)
        enhanced_img = enhancer.enhance(OCRUtils.CONTRAST_FACTOR)
    
        # PIL 이미지를 NumPy 배열로 변환
        return np.array(enhanced_img)
    except Exception as e:
        logger.error(f"이미지 대비 향상 중 오류: {str(e)}")
        return image


def remove_noise(image: np.ndarray) -> np.ndarray:
    """
    이미지 노이즈 제거
    
    Args:
        image: 원본 이미지
        
    Returns:
        노이즈가 제거된 이미지
    """
    try:
        # NumPy 배열을 PIL 이미지로 변환
        pil_img = Image.fromarray(image)
    
        # 미디안 필터로 노이즈 제거
        filtered_img = pil_img.filter(ImageFilter.MedianFilter(size=OCRUtils.MEDIAN_FILTER_SIZE))
    
        # PIL 이미지를 NumPy 배열로 변환
        return np.array(filtered_img)
    except Exception as e:
        logger.error(f"이미지 노이즈 제거 중 오류: {str(e)}")
        return image


def deskew_image(image: np.ndarray) -> np.ndarray:
    """
    이미지 기울기 보정
    
    Args:
        image: 원본 이미지
        
    Returns:
        기울기가 보정된 이미지
    """
    try:
        # 그레이스케일 확인 및 변환
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image.copy()
            
        # 이진화
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        
        # 외곽선 찾기
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if not contours:
            return image
            
        # 텍스트 영역으로 추정되는 외곽선만 필터링
        filtered_contours = []
        for contour in contours:
            area = cv2.contourArea(contour)
            if area > 100:  # 작은 노이즈 제외
                filtered_contours.append(contour)
                
        if not filtered_contours:
            return image
            
        # 모든 외곽선 합치기
        all_contours = np.vstack(filtered_contours)
        
        # 최소 영역 사각형 찾기
        rect = cv2.minAreaRect(all_contours)
        angle = rect[2]
        
        # 각도 조정 (-45 ~ 45 범위로)
        if angle < -OCRUtils.DESKEW_ANGLE_THRESHOLD:
            angle += 90
        elif angle > OCRUtils.DESKEW_ANGLE_THRESHOLD:
            angle -= 90
            
        # 회전 중심점, 각도, 스케일 설정
        (h, w) = image.shape[:2]
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, angle, 1.0)
        
        # 이미지 회전
        rotated = cv2.warpAffine(image, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
        
        return rotated
    except Exception as e:
        logger.error(f"이미지 기울기 보정 중 오류: {str(e)}")
        return image


def detect_text_language(text: str) -> str:
    """
    텍스트의 주요 언어 감지
    
    Args:
        text: 분석할 텍스트
        
    Returns:
        감지된 언어 코드 (ko, en, ja, zh, unknown)
    """
    if not text:
        return 'unknown'
        
    try:
        # 언어별 문자 패턴과 수
        patterns = {
            'ko': (OCRUtils.KOREAN_CHAR_PATTERN, 0),    # 한국어
            'en': (OCRUtils.ENGLISH_CHAR_PATTERN, 0),   # 영어
            'ja': (OCRUtils.JAPANESE_CHAR_PATTERN, 0),  # 일본어
            'zh': (OCRUtils.CHINESE_CHAR_PATTERN, 0)    # 중국어
        }
        
        # 총 문자 수 (공백 제외)
        total_chars = len(re.sub(r'\s', '', text))
        if total_chars == 0:
            return 'unknown'
            
        # 각 언어 패턴 매칭 수 계산
        for lang, (pattern, _) in patterns.items():
            matches = re.findall(pattern, text)
            patterns[lang] = (pattern, len(matches))
            
        # 언어별 비율 계산 및 최대 비율 언어 선택
        max_ratio = 0
        detected_lang = 'unknown'
        
        for lang, (_, count) in patterns.items():
            ratio = count / total_chars
            if ratio > max_ratio:
                max_ratio = ratio
                detected_lang = lang
                
        # 임계값 이상인 경우에만 해당 언어로 판정
        return detected_lang if max_ratio >= OCRUtils.LANGUAGE_THRESHOLD else 'unknown'
    except Exception as e:
        logger.error(f"텍스트 언어 감지 중 오류: {str(e)}")
        return 'unknown'


def clean_ocr_text(text: str) -> str:
    """
    OCR로 추출된 텍스트 정제
    
    Args:
        text: 정제할 텍스트
        
    Returns:
        정제된 텍스트
    """
    if not text:
        return ""
        
    try:
        # 줄바꿈 정규화
        text = re.sub(r'\r\n', '\n', text)
        
        # 문자열 앞뒤 공백 제거
        text = text.strip()
        
        # 연속된 공백 하나로 치환
        text = re.sub(r'\s{2,}', ' ', text)
        
        # 빈 줄 제거
        lines = [line for line in text.split('\n') if line.strip()]
        text = '\n'.join(lines)
        
        return text
    except Exception as e:
        logger.error(f"OCR 텍스트 정제 중 오류: {str(e)}")
        return text


def extract_text_by_region(image: np.ndarray, regions: List[Tuple[int, int, int, int]], 
                          lang: str = OCRUtils.DEFAULT_LANG, 
                          config: str = OCRUtils.DEFAULT_OCR_CONFIG) -> Dict[str, Any]:
    """
    이미지의 특정 영역에서 텍스트 추출
    
    Args:
        image: 원본 이미지
        regions: 텍스트 영역 좌표 리스트 [(x, y, w, h), ...]
        lang: OCR 언어 설정
        config: OCR 설정
        
    Returns:
        region_texts: 각 영역별 추출 텍스트 정보
    """
    try:
        import pytesseract
        
        # 결과 저장할 딕셔너리
        region_texts = {
            'regions': [],
            'full_text': ''
        }
        
        all_texts = []
        
        # 영역별 텍스트 추출
        for i, (x, y, w, h) in enumerate(regions):
            # 영역 자르기
            if x < 0: x = 0
            if y < 0: y = 0
            if x + w > image.shape[1]: w = image.shape[1] - x
            if y + h > image.shape[0]: h = image.shape[0] - y
            
            roi = image[y:y+h, x:x+w]
            
            if roi.size == 0:
                continue
                
            # 텍스트 추출
            text = pytesseract.image_to_string(roi, lang=lang, config=config)
            cleaned_text = clean_ocr_text(text)
            
            if cleaned_text:
                region_info = {
                    'id': i,
                    'position': {'x': x, 'y': y, 'width': w, 'height': h},
                    'text': cleaned_text
                }
                region_texts['regions'].append(region_info)
                all_texts.append(cleaned_text)
        
        # 전체 텍스트 결합
        region_texts['full_text'] = '\n'.join(all_texts)
        
        return region_texts
    except Exception as e:
        logger.error(f"영역별 텍스트 추출 중 오류: {str(e)}")
        return {'regions': [], 'full_text': ''}


def combine_image_channels(img_rgb: np.ndarray, img_binary: np.ndarray) -> np.ndarray:
    """
    RGB 이미지와 이진화 이미지 결합
    
    Args:
        img_rgb: RGB 이미지
        img_binary: 이진화된 이미지
        
    Returns:
        결합된 이미지
    """
    try:
        # 이미지 형식 및 크기 확인
        if len(img_rgb.shape) != 3 or img_rgb.shape[2] != 3:
            raise ValueError("첫 번째 인자는 3채널 RGB 이미지여야 합니다")
            
        if len(img_binary.shape) != 2:
            raise ValueError("두 번째 인자는 단일 채널 이진화 이미지여야 합니다")
            
        if img_rgb.shape[:2] != img_binary.shape[:2]:
            raise ValueError("두 이미지의 크기가 일치해야 합니다")
        
        # RGB를 HSV로 변환
        img_hsv = cv2.cvtColor(img_rgb, cv2.COLOR_BGR2HSV)
        h, s, v = cv2.split(img_hsv)
        
        # 이진화 이미지에서 텍스트 영역 마스크 생성 (흰색 배경, 검은색 텍스트 가정)
        text_mask = cv2.threshold(img_binary, OCRUtils.BINARY_THRESHOLD, 255, cv2.THRESH_BINARY_INV)[1]
        
        # V 채널에 적용 (텍스트 영역만 어둡게)
        v_new = cv2.bitwise_and(v, v, mask=cv2.bitwise_not(text_mask))
        v_text = cv2.bitwise_and(np.ones_like(v) * OCRUtils.HSV_V_THRESHOLD, np.ones_like(v), mask=text_mask)
        v = cv2.add(v_new, v_text)
        
        # HSV 채널 합치기
        img_hsv_new = cv2.merge([h, s, v])
        
        # HSV에서 RGB로 변환
        result = cv2.cvtColor(img_hsv_new, cv2.COLOR_HSV2BGR)
        
        return result
    except Exception as e:
        logger.error(f"이미지 채널 결합 중 오류: {str(e)}")
        return img_rgb


def format_extracted_text(text: str, format_type: str = 'plain') -> str:
    """
    추출된 텍스트를 지정된 형식으로 변환
    
    Args:
        text: 원본 텍스트
        format_type: 변환할 형식 (plain, html, markdown)
        
    Returns:
        변환된 텍스트
    """
    if not text:
        return ""
        
    try:
        # 텍스트 정제
        cleaned = clean_ocr_text(text)
        
        # 형식에 따라 변환
        if format_type == 'html':
            import html
            
            # HTML 이스케이프
            escaped = html.escape(cleaned)
            
            # 단락 구분
            paragraphs = []
            for p in escaped.split('\n'):
                p = p.strip()
                if not p:
                    continue
                    
                # 제목으로 보이는 텍스트 (짧고 모두 대문자)
                if len(p) < 100 and p.strip().upper() == p.strip():
                    paragraphs.append(f"<h3>{p}</h3>")
                else:
                    paragraphs.append(f"<p>{p}</p>")
                    
            return "".join(paragraphs)
            
        elif format_type == 'markdown':
            # 단락 구분
            paragraphs = []
            for p in cleaned.split('\n'):
                p = p.strip()
                if not p:
                    continue
                    
                # 제목으로 보이는 텍스트 (짧고 모두 대문자)
                if len(p) < 100 and p.strip().upper() == p.strip():
                    paragraphs.append(f"### {p}")
                else:
                    paragraphs.append(p)
                    
            return "\n\n".join(paragraphs)
            
        else:  # 기본 plain 텍스트
            return cleaned
    except Exception as e:
        logger.error(f"텍스트 형식 변환 중 오류: {str(e)}")
        return text


def get_optimal_ocr_config(image_path: str) -> Dict[str, Any]:
    """
    이미지 특성에 맞는 최적의 OCR 설정 반환
    
    Args:
        image_path: 이미지 파일 경로
        
    Returns:
        OCR 설정 정보
    """
    try:
        # 이미지 로드
        img = cv2.imread(image_path)
        if img is None:
            logger.error(f"이미지를 읽을 수 없음: {image_path}")
            return {
                'lang': OCRUtils.DEFAULT_LANG,
                'config': OCRUtils.DEFAULT_OCR_CONFIG
            }
            
        # 이미지 크기 및 속성
        height, width = img.shape[:2]
        
        # 그레이스케일 변환
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # 이미지 복잡도 분석 (표준편차)
        complexity = np.std(gray)
        
        # 이미지 크기 기반 PSM 모드 선택
        psm_mode = 3  # 기본값 (자동 페이지 분할 및 방향 감지)
        
        if complexity < 40:  # 단순한 이미지 (텍스트 적음)
            psm_mode = 6  # 단일 텍스트 블록으로 가정
        elif width > 1000 and height > 1000:  # 큰 이미지
            psm_mode = 1  # 방향 및 스크립트 감지 (OSD) 만
        elif width > height * 2:  # 넓은 이미지 (영수증 등)
            psm_mode = 4  # 단일 열의 텍스트로 가정
        elif height > width * 2:  # 긴 이미지
            psm_mode = 5  # 단일 수직 텍스트 블록으로 가정
            
        # OCR 엔진 모드 선택
        oem_mode = 1  # LSTM만 사용 (기본값)
        
        if complexity > 80:  # 복잡한 이미지
            oem_mode = 2  # LSTM + 레거시 Tesseract 결합
            
        # 설정 문자열 생성
        config_str = f"--psm {psm_mode} --oem {oem_mode} -c preserve_interword_spaces=1"
        
        # 이미지 크기가 너무 크면 스케일 팩터 추가
        scale_factor = 1.0
        if max(width, height) > 2000:
            scale_factor = 2000 / max(width, height)
            
        return {
            'lang': OCRUtils.DEFAULT_LANG,
            'config': config_str,
            'scale_factor': scale_factor,
            'complexity': complexity,
            'psm': psm_mode,
            'oem': oem_mode
        }
    except Exception as e:
        logger.error(f"OCR 설정 최적화 중 오류: {str(e)}")
        return {
            'lang': OCRUtils.DEFAULT_LANG,
            'config': OCRUtils.DEFAULT_OCR_CONFIG
        }