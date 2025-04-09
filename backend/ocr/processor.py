import os
import cv2
import pytesseract
import numpy as np
import logging
import re
import subprocess
import unicodedata
from PIL import Image, ImageEnhance
from dotenv import load_dotenv
from typing import List, Tuple, Dict, Any, Optional, Union, Set
from functools import lru_cache
import tempfile

try:
    from utils.translation import detect_language
except ImportError:
    try:
        from ..utils.translation import detect_language
    except ImportError:
        detect_language = None
        logging.warning("translation 모듈을 가져올 수 없습니다. 언어 감지 기능이 제한됩니다.")

load_dotenv()

logger = logging.getLogger(__name__)

class OCRConfig:
    MAX_IMAGE_DIMENSION = 2000
    THRESH_BINARY = cv2.THRESH_BINARY
    THRESH_OTSU = cv2.THRESH_OTSU
    
    MIN_REGION_HEIGHT = 8
    MIN_REGION_WIDTH = 3
    MAX_REGION_HEIGHT = 100
    MAX_REGION_WIDTH = 100
    MAX_ASPECT_RATIO = 10
    
    CONFIDENCE_THRESHOLD = 30
    
    DEFAULT_LANG = 'kor+eng'
    DEFAULT_CONFIG = '--oem 1 --psm 3 -c preserve_interword_spaces=1'
    
    SUPPORTED_LANGUAGES = {
        'kor': '한국어',
        'eng': '영어',
        'jpn': '일본어',
        'chi_sim': '중국어 간체',
        'chi_tra': '중국어 번체',
        'deu': '독일어',
        'fra': '프랑스어',
        'spa': '스페인어',
        'rus': '러시아어',
        'ita': '이탈리아어',
        'por': '포르투갈어',
        'ara': '아랍어',
        'hin': '힌디어',
        'vie': '베트남어',
        'tha': '태국어'
    }
    
    LANGDETECT_TO_TESSERACT = {
        'ko': 'kor',
        'en': 'eng',
        'ja': 'jpn',
        'zh-CN': 'chi_sim',
        'zh-TW': 'chi_tra',
        'de': 'deu',
        'fr': 'fra',
        'es': 'spa',
        'ru': 'rus',
        'it': 'ita',
        'pt': 'por',
        'ar': 'ara',
        'hi': 'hin',
        'vi': 'vie',
        'th': 'tha'
    }
    
    COMMON_LANGUAGE_COMBINATIONS = {
        'kor': 'kor',
        'eng': 'eng',
        'kor+eng': 'kor+eng',
        'jpn': 'jpn',
        'jpn+eng': 'jpn+eng',
        'chi_sim': 'chi_sim',
        'chi_sim+eng': 'chi_sim+eng',
        'kor+eng+jpn': 'kor+eng+jpn',
        'kor+eng+jpn+chi_sim': 'kor+eng+jpn+chi_sim',
        'deu+eng': 'deu+eng',
        'fra+eng': 'fra+eng',
        'spa+eng': 'spa+eng',
        'rus+eng': 'rus+eng',
        'multi': 'kor+eng+jpn+chi_sim+deu+fra+spa'
    }
    
    PSM_MODES = {
        0: 'OSD 전용',
        1: '자동 페이지 분할 + OSD',
        2: '자동 페이지 분할 (OSD 없음)',
        3: '전체 자동 페이지 분할 (기본값)',
        4: '단일 열 가변 크기 텍스트',
        5: '세로 정렬된 단일 블록 텍스트',
        6: '단일 블록 텍스트',
        7: '한 줄의 텍스트',
        8: '한 단어',
        9: '둥근 모양의 한 단어',
        10: '한 글자',
        11: '문자 단위로 분리된 텍스트',
        12: '문자 단위로 분리된 텍스트 + OSD',
        13: '가로 텍스트 행'
    }
    
    MAX_WIDTH = 1200
    MAX_HEIGHT = 1200
    BINARY_THRESHOLD = 128
    HSV_V_THRESHOLD = 180
    
    MIN_TEXT_LENGTH = 10
    KOREAN_RATIO_WEIGHT = 2.0
    
    @classmethod
    def get_language_name(cls, lang_code: str) -> str:
        if '+' in lang_code:
            lang_parts = lang_code.split('+')
            lang_names = [cls.SUPPORTED_LANGUAGES.get(part, part) for part in lang_parts]
            return ' + '.join(lang_names)
        else:
            return cls.SUPPORTED_LANGUAGES.get(lang_code, lang_code)
    
    @classmethod
    def get_optimal_psm(cls, lang_code: str) -> int:
        lang_to_psm = {
            'kor': 6,
            'eng': 3,
            'jpn': 6,
            'chi_sim': 6,
            'chi_tra': 6
        }
        
        if '+' in lang_code:
            lang_parts = lang_code.split('+')
            primary_lang = lang_parts[0]
            return lang_to_psm.get(primary_lang, 3)
        
        return lang_to_psm.get(lang_code, 3)


def segment_text_by_color(img: np.ndarray) -> np.ndarray:
    try:
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        
        lower_black = np.array([0, 0, 0])
        upper_black = np.array([180, 255, 80])
        
        mask1 = cv2.inRange(hsv, lower_black, upper_black)
        
        lower_white = np.array([0, 0, 200])
        upper_white = np.array([180, 30, 255])
        
        mask2 = cv2.inRange(hsv, lower_white, upper_white)
        
        combined_mask = cv2.bitwise_or(mask1, mask2)
        
        kernel = np.ones((1, 1), np.uint8)
        combined_mask = cv2.morphologyEx(combined_mask, cv2.MORPH_OPEN, kernel)
        combined_mask = cv2.morphologyEx(combined_mask, cv2.MORPH_CLOSE, kernel)
        
        segmented_img = cv2.bitwise_and(img, img, mask=combined_mask)
        
        white_bg = np.ones_like(img) * 255
        mask_inv = cv2.bitwise_not(combined_mask)
        background = cv2.bitwise_and(white_bg, white_bg, mask=mask_inv)
        
        result = cv2.add(segmented_img, background)
        
        return result
    except Exception as e:
        logger.error(f"색상 기반 텍스트 영역 분리 중 오류: {str(e)}")
        return img


def detect_mser_regions(img: np.ndarray) -> Tuple[np.ndarray, List[Tuple[int, int, int, int]]]:
    try:
        if len(img.shape) == 3:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        else:
            gray = img
            
        mser = cv2.MSER_create()
        
        regions, _ = mser.detectRegions(gray)
        
        image_with_boxes = img.copy() if len(img.shape) == 3 else cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
        
        text_regions = []
        
        for region in regions:
            x, y, w, h = cv2.boundingRect(region)
            
            aspect_ratio_w = w/h if h > 0 else float('inf')
            aspect_ratio_h = h/w if w > 0 else float('inf')
            
            if (h > OCRConfig.MIN_REGION_HEIGHT and 
                w > OCRConfig.MIN_REGION_WIDTH and 
                h < OCRConfig.MAX_REGION_HEIGHT and 
                w < OCRConfig.MAX_REGION_WIDTH and 
                aspect_ratio_w < OCRConfig.MAX_ASPECT_RATIO and 
                aspect_ratio_h < OCRConfig.MAX_ASPECT_RATIO):
                
                cv2.rectangle(image_with_boxes, (x, y), (x+w, y+h), (0, 255, 0), 1)
                text_regions.append((x, y, w, h))
        
        return image_with_boxes, text_regions
    except Exception as e:
        logger.error(f"MSER 텍스트 영역 감지 중 오류: {str(e)}")
        if len(img.shape) == 3:
            return img.copy(), []
        else:
            return cv2.cvtColor(img, cv2.COLOR_GRAY2BGR), []


def deskew_image(img: np.ndarray) -> np.ndarray:
    try:
        if len(img.shape) == 3:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        else:
            gray = img.copy()
        
        thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]
        
        coords = np.column_stack(np.where(thresh > 0))
        
        if len(coords) == 0:
            logger.warning("기울기 감지를 위한 좌표를 찾을 수 없습니다.")
            return img
        
        rect = cv2.minAreaRect(coords)
        angle = rect[-1]
        
        if angle < -45:
            angle = 90 + angle
        
        if abs(angle) <= 0.5:
            return img
        
        (h, w) = img.shape[:2]
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, angle, 1.0)
        
        if len(img.shape) == 3:
            deskewed = cv2.warpAffine(img, M, (w, h), 
                                      flags=cv2.INTER_CUBIC, 
                                      borderMode=cv2.BORDER_REPLICATE)
        else:
            deskewed = cv2.warpAffine(img, M, (w, h), 
                                      flags=cv2.INTER_CUBIC, 
                                      borderMode=cv2.BORDER_REPLICATE)
        
        logger.debug(f"이미지 기울기 보정 완료: {angle:.2f}도")
        return deskewed
    
    except Exception as e:
        logger.error(f"이미지 기울기 보정 중 오류: {str(e)}")
        return img


def remove_noise_improved(img: np.ndarray) -> np.ndarray:
    try:
        if len(img.shape) == 3:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        else:
            gray = img.copy()
        
        blurred = cv2.GaussianBlur(gray, (3, 3), 0)
        
        _, binary = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        denoised = cv2.fastNlMeansDenoising(binary, None, h=15, templateWindowSize=7, searchWindowSize=21)
        
        kernel = np.ones((1, 1), np.uint8)
        opening = cv2.morphologyEx(denoised, cv2.MORPH_OPEN, kernel)
        
        kernel_dilate = np.ones((1, 1), np.uint8)
        final = cv2.dilate(opening, kernel_dilate, iterations=1)
        
        return final
    
    except Exception as e:
        logger.error(f"개선된 노이즈 제거 중 오류: {str(e)}")
        return img


def enhance_image_quality(img: np.ndarray) -> np.ndarray:
    try:
        if len(img.shape) == 3:
            pil_img = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
        else:
            pil_img = Image.fromarray(img)
        
        enhancer = ImageEnhance.Contrast(pil_img)
        enhanced_contrast = enhancer.enhance(1.5)
        
        enhancer = ImageEnhance.Sharpness(enhanced_contrast)
        enhanced_sharpness = enhancer.enhance(1.5)
        
        enhancer = ImageEnhance.Brightness(enhanced_sharpness)
        enhanced_brightness = enhancer.enhance(1.2)
        
        if len(img.shape) == 3:
            result = cv2.cvtColor(np.array(enhanced_brightness), cv2.COLOR_RGB2BGR)
        else:
            result = np.array(enhanced_brightness.convert('L'))
            
        return result
    
    except Exception as e:
        logger.error(f"이미지 품질 향상 중 오류: {str(e)}")
        return img


def preprocess_image(image_path: str) -> List[np.ndarray]:
    try:
        abs_image_path = os.path.abspath(image_path)
        logger.info(f"이미지 전처리 시작: {abs_image_path}")
        
        if not os.path.exists(abs_image_path):
            logger.error(f"파일이 존재하지 않음: {abs_image_path}")
            raise FileNotFoundError(f"파일이 존재하지 않음: {abs_image_path}")
            
        try:
            img = cv2.imread(abs_image_path)
            if img is None:
                logger.error(f"이미지 로드 실패: {abs_image_path}")
                raise ValueError(f"이미지를 로드할 수 없습니다: {abs_image_path}")
        except Exception as e:
            logger.error(f"이미지 로드 오류: {abs_image_path}, {str(e)}")
            raise
        
        height, width = img.shape[:2]
        if max(height, width) > OCRConfig.MAX_IMAGE_DIMENSION:
            scale_factor = OCRConfig.MAX_IMAGE_DIMENSION / max(height, width)
            new_width = int(width * scale_factor)
            new_height = int(height * scale_factor)
            img = cv2.resize(img, (new_width, new_height), interpolation=cv2.INTER_AREA)
        
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        preprocessed_images = []
        
        preprocessed_images.append(gray)
        
        gray_blur = cv2.GaussianBlur(gray, (3, 3), 0)
        _, binary = cv2.threshold(gray_blur, 0, 255, 
                                OCRConfig.THRESH_BINARY + OCRConfig.THRESH_OTSU)
        preprocessed_images.append(binary)
        
        segmented = segment_text_by_color(img)
        segmented_gray = cv2.cvtColor(segmented, cv2.COLOR_BGR2GRAY)
        _, segmented_binary = cv2.threshold(segmented_gray, 0, 255, 
                                          OCRConfig.THRESH_BINARY + OCRConfig.THRESH_OTSU)
        preprocessed_images.append(segmented_binary)
        
        adaptive_binary = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                               cv2.THRESH_BINARY, 11, 2)
        preprocessed_images.append(adaptive_binary)
        
        enhanced = cv2.equalizeHist(gray)
        _, enhanced_binary = cv2.threshold(enhanced, 0, 255, 
                                         OCRConfig.THRESH_BINARY + OCRConfig.THRESH_OTSU)
        preprocessed_images.append(enhanced_binary)
        
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        clahe_img = clahe.apply(gray)
        _, clahe_binary = cv2.threshold(clahe_img, 0, 255, 
                                      OCRConfig.THRESH_BINARY + OCRConfig.THRESH_OTSU)
        preprocessed_images.append(clahe_binary)
        
        kernel = np.array([[-1,-1,-1], [-1,9,-1], [-1,-1,-1]])
        sharpened = cv2.filter2D(gray, -1, kernel)
        _, sharp_binary = cv2.threshold(sharpened, 0, 255, 
                                      OCRConfig.THRESH_BINARY + OCRConfig.THRESH_OTSU)
        preprocessed_images.append(sharp_binary)
        
        denoised = cv2.fastNlMeansDenoising(gray, None, 10, 7, 21)
        _, denoised_binary = cv2.threshold(denoised, 0, 255, 
                                         OCRConfig.THRESH_BINARY + OCRConfig.THRESH_OTSU)
        preprocessed_images.append(denoised_binary)
        
        kernel = np.ones((1, 1), np.uint8)
        opening = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)
        preprocessed_images.append(opening)
        
        deskewed = deskew_image(gray)
        _, deskewed_binary = cv2.threshold(deskewed, 0, 255, 
                                         OCRConfig.THRESH_BINARY + OCRConfig.THRESH_OTSU)
        preprocessed_images.append(deskewed_binary)
        
        improved_denoised = remove_noise_improved(gray)
        preprocessed_images.append(improved_denoised)
        
        enhanced_img = enhance_image_quality(gray)
        _, enhanced_quality_binary = cv2.threshold(enhanced_img, 0, 255, 
                                                 OCRConfig.THRESH_BINARY + OCRConfig.THRESH_OTSU)
        preprocessed_images.append(enhanced_quality_binary)
        
        deskewed_denoised = remove_noise_improved(deskewed)
        preprocessed_images.append(deskewed_denoised)
        
        return preprocessed_images
        
    except ValueError as ve:
        raise ve
    except Exception as e:
        logger.error(f"이미지 전처리 중 오류: {str(e)}")
        raise RuntimeError(f"이미지 전처리 중 오류: {str(e)}")


def detect_ocr_language(image_path: str) -> str:
    default_lang = OCRConfig.DEFAULT_LANG
    
    try:
        gemini_api_key_exists = False
        try:
            try:
                from ..app import extract_text_with_gemini, AppConfig
                gemini_api_key_exists = bool(AppConfig.GEMINI_API_KEY)
            except (ImportError, AttributeError):
                try:
                    import sys
                    from app import extract_text_with_gemini, AppConfig
                    gemini_api_key_exists = bool(AppConfig.GEMINI_API_KEY)
                except (ImportError, AttributeError):
                    pass
            
            if gemini_api_key_exists:
                logger.info("Gemini API를 통한 언어 감지 시도")
                lang_result = extract_text_with_gemini(image_path, detect_language_only=True)
                
                if lang_result and lang_result.get('success', False) and 'language' in lang_result:
                    detected_lang = lang_result['language']
                    logger.info(f"Gemini 감지 언어: {detected_lang}")
                    
                    tesseract_lang = OCRConfig.LANGDETECT_TO_TESSERACT.get(detected_lang)
                    
                    if tesseract_lang:
                        if tesseract_lang != 'eng':
                            lang_code = f"{tesseract_lang}+eng"
                        else:
                            lang_code = tesseract_lang
                            
                        _, lang_installed = check_tesseract_availability(lang_code)
                        
                        if lang_installed:
                            logger.info(f"Gemini: OCR에 {lang_code} 언어 설정을 사용합니다.")
                            return lang_code
        except Exception as e:
            logger.warning(f"Gemini 언어 감지 오류: {str(e)}")
        
        sample_texts = []
        
        for lang_sample in ['eng', 'kor', 'jpn', 'chi_sim']:
            for psm in [3, 6]:
                try:
                    sample_config = f'--psm {psm} --oem 1'
                    sample_text = pytesseract.image_to_string(
                        image_path, 
                        lang=lang_sample,
                        config=sample_config
                    ).strip()
                    
                    if sample_text and len(sample_text) > 20:
                        sample_texts.append(sample_text)
                        break
                except Exception as e:
                    logger.debug(f"{lang_sample} 샘플링 오류: {str(e)}")
                    continue
        
        combined_text = " ".join(sample_texts)
        
        if combined_text:
            if detect_language:
                lang_result = detect_language(combined_text)
                
                if lang_result and lang_result.get('success', False):
                    detected_lang = lang_result['language']
                    logger.info(f"감지된 언어: {lang_result['language_name']} ({detected_lang})")
                    
                    tesseract_lang = OCRConfig.LANGDETECT_TO_TESSERACT.get(detected_lang)
                    
                    if tesseract_lang:
                        if tesseract_lang != 'eng':
                            lang_code = f"{tesseract_lang}+eng"
                        else:
                            lang_code = tesseract_lang
                            
                        _, lang_installed = check_tesseract_availability(lang_code)
                        
                        if lang_installed:
                            logger.info(f"OCR에 {lang_code} 언어 설정을 사용합니다.")
                            return lang_code
                        else:
                            logger.warning(f"{lang_code} 언어 팩이 설치되어 있지 않습니다. 기본 설정 사용.")
            
            pattern_counts = {
                'kor': len(re.findall(r'[가-힣]', combined_text)),
                'eng': len(re.findall(r'[a-zA-Z]', combined_text)),
                'jpn': len(re.findall(r'[\u3040-\u309F\u30A0-\u30FF]', combined_text)),
                'chi_sim': len(re.findall(r'[\u4E00-\u9FFF]', combined_text))
            }
            
            if any(pattern_counts.values()):
                main_lang = max(pattern_counts.items(), key=lambda x: x[1])[0]
                
                eng_ratio = pattern_counts['eng'] / max(sum(pattern_counts.values()), 1)
                
                if main_lang != 'eng' and eng_ratio > 0.2:
                    lang_code = f"{main_lang}+eng"
                else:
                    lang_code = main_lang
                
                _, lang_installed = check_tesseract_availability(lang_code)
                if lang_installed:
                    logger.info(f"패턴 기반 감지: OCR에 {lang_code} 언어 설정을 사용합니다.")
                    return lang_code
        
        if not sample_texts:
            try:
                img = cv2.imread(image_path)
                if img is None:
                    logger.warning(f"이미지를 읽을 수 없습니다: {image_path}")
                    return default_lang
                
                gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
                
                temp_path = f"{os.path.splitext(image_path)[0]}_temp_lang.png"
                cv2.imwrite(temp_path, binary)
                
                processed_text = pytesseract.image_to_string(temp_path, lang='eng+kor+jpn', config='--psm 3')
                
                if os.path.exists(temp_path):
                    os.remove(temp_path)
                
                if processed_text and detect_language:
                    lang_result = detect_language(processed_text)
                    if lang_result and lang_result.get('success', False):
                        detected_lang = lang_result['language']
                        tesseract_lang = OCRConfig.LANGDETECT_TO_TESSERACT.get(detected_lang)
                        
                        if tesseract_lang:
                            if tesseract_lang != 'eng':
                                lang_code = f"{tesseract_lang}+eng"
                            else:
                                lang_code = tesseract_lang
                                
                            _, lang_installed = check_tesseract_availability(lang_code)
                            if lang_installed:
                                logger.info(f"전처리 후 감지: OCR에 {lang_code} 언어 설정을 사용합니다.")
                                return lang_code
                            
            except Exception as e:
                logger.error(f"전처리 후 언어 감지 오류: {str(e)}")
        
        logger.info(f"언어 자동 감지 실패 또는 사용할 수 없음. 기본 언어 ({default_lang}) 사용.")
        return default_lang
        
    except Exception as e:
        logger.error(f"OCR 언어 감지 중 오류 발생: {str(e)}")
        return default_lang


@lru_cache(maxsize=32)
def check_tesseract_availability(lang: str = OCRConfig.DEFAULT_LANG) -> Tuple[bool, bool]:
    tesseract_installed = False
    lang_installed = False
    
    try:
        pytesseract.get_tesseract_version()
        tesseract_installed = True
        
        try:
            output = subprocess.check_output(
                [pytesseract.pytesseract.tesseract_cmd, '--list-langs'], 
                stderr=subprocess.STDOUT,
                universal_newlines=True,
                timeout=5
            )
            
            langs = lang.split('+')
            lang_installed = all(l in output for l in langs)
            
        except (subprocess.SubprocessError, subprocess.TimeoutExpired) as e:
            logger.warning(f"Tesseract 언어 확인 중 오류: {str(e)}")
            lang_installed = False
            
    except pytesseract.TesseractNotFoundError:
        tesseract_installed = False
        lang_installed = False
    
    return tesseract_installed, lang_installed


def evaluate_preprocessing_quality(images: List[np.ndarray], lang: str) -> Tuple[np.ndarray, Dict[str, Any]]:
    if not images:
        raise ValueError("평가할 이미지가 없습니다.")
        
    image_scores = []
    
    tesseract_installed, _ = check_tesseract_availability(lang)
    if not tesseract_installed:
        logger.warning("Tesseract OCR이 설치되어 있지 않아 이미지 품질 평가를 건너뜁니다.")
        return images[0], {"reason": "tesseract_not_installed", "score": 0}
    
    try:
        psm = OCRConfig.get_optimal_psm(lang)
        config = f'--oem 1 --psm {psm} -c preserve_interword_spaces=1'
        
        temp_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'temp_eval.png')
        
        for i, img in enumerate(images):
            try:
                cv2.imwrite(temp_file, img)
                
                ocr_result = pytesseract.image_to_string(temp_file, lang=lang, config=config)
                ocr_data = pytesseract.image_to_data(temp_file, lang=lang, config=config, output_type=pytesseract.Output.DICT)
                
                text_length = len(ocr_result.strip())
                
                conf_scores = [int(conf) for conf in ocr_data['conf'] if conf != '-1']
                avg_confidence = sum(conf_scores) / len(conf_scores) if conf_scores else 0
                
                korean_chars = len(re.findall(r'[가-힣]', ocr_result))
                total_chars = len(re.sub(r'\s', '', ocr_result))
                korean_ratio = korean_chars / total_chars if total_chars > 0 else 0
                
                weight_length = min(1.0, text_length / 100)
                weight_confidence = avg_confidence / 100.0
                weight_korean = korean_ratio * OCRConfig.KOREAN_RATIO_WEIGHT
                
                image_contrast = np.std(img)
                contrast_score = min(1.0, image_contrast / 80.0)
                
                if 'kor' in lang:
                    total_score = (weight_length * 0.3 + weight_confidence * 0.3 + 
                                  weight_korean * 0.3 + contrast_score * 0.1)
                else:
                    total_score = (weight_length * 0.4 + weight_confidence * 0.4 + 
                                  contrast_score * 0.2)
                
                if text_length < OCRConfig.MIN_TEXT_LENGTH:
                    total_score *= 0.5
                
                image_scores.append({
                    'index': i,
                    'score': total_score,
                    'text_length': text_length,
                    'avg_confidence': avg_confidence,
                    'korean_ratio': korean_ratio,
                    'contrast_score': contrast_score
                })
                
                logger.debug(f"이미지 {i} 평가: 점수={total_score:.2f}, 길이={text_length}, 신뢰도={avg_confidence:.1f}")
                
            except Exception as e:
                logger.error(f"이미지 {i} 평가 중 오류: {str(e)}")
                image_scores.append({
                    'index': i,
                    'score': 0,
                    'error': str(e)
                })
        
        if os.path.exists(temp_file):
            os.remove(temp_file)
        
        if not image_scores:
            return images[0], {"reason": "evaluation_failed", "score": 0}
        
        best_score = max(image_scores, key=lambda x: x['score'])
        best_index = best_score['index']
        
        logger.info(f"최적 이미지 선택: 인덱스={best_index}, 점수={best_score['score']:.2f}")
        
        return images[best_index], best_score
        
    except Exception as e:
        logger.error(f"이미지 품질 평가 중 오류: {str(e)}")
        return images[0], {"reason": "evaluation_error", "error": str(e), "score": 0}


def process_image(image_path: str, lang: Optional[str] = None) -> str:
    try:
        abs_image_path = os.path.abspath(image_path)
        logger.info(f"OCR 처리 시작: 원본 경로={image_path}, 절대 경로={abs_image_path}")
        
        if not os.path.exists(abs_image_path):
            error_msg = f"파일이 존재하지 않음: 원본 경로={image_path}, 절대 경로={abs_image_path}"
            logger.error(error_msg)
            raise FileNotFoundError(error_msg)
            
        file_size = os.path.getsize(abs_image_path)
        if file_size == 0:
            raise ValueError(f"빈 파일입니다: {abs_image_path}")
            
        logger.info(f"파일 확인 완료: {abs_image_path}, 크기: {file_size} 바이트")
        
        tesseract_installed, _ = check_tesseract_availability()
        if not tesseract_installed:
            logger.warning("Tesseract OCR이 설치되지 않아 Gemini API로 텍스트 추출을 시도합니다.")
            try:
                from app import extract_text_with_gemini
                gemini_text = extract_text_with_gemini(abs_image_path)
                if gemini_text and isinstance(gemini_text, str) and len(gemini_text.strip()) > 0:
                    return gemini_text
            except ImportError:
                logger.error("app.py에서 extract_text_with_gemini 함수를 가져올 수 없습니다")
            except Exception as e:
                logger.error(f"Gemini API로 텍스트 추출 실패: {str(e)}")
        
        if not lang:
            lang = detect_ocr_language(abs_image_path)
            logger.info(f"자동 감지된 OCR 언어: {lang}")
        
        if "+" in lang:
            languages = lang.split("+")
            for l in languages:
                if l not in OCRConfig.SUPPORTED_LANGUAGES:
                    logger.warning(f"지원되지 않는 언어 코드: {l}, 기본 설정 사용")
                    lang = OCRConfig.DEFAULT_LANG
        elif lang not in OCRConfig.SUPPORTED_LANGUAGES:
            logger.warning(f"지원되지 않는 언어 코드: {lang}, 기본 설정 사용")
            lang = OCRConfig.DEFAULT_LANG
        
        if lang in OCRConfig.COMMON_LANGUAGE_COMBINATIONS:
            lang = OCRConfig.COMMON_LANGUAGE_COMBINATIONS[lang]
        
        psm = OCRConfig.get_optimal_psm(lang)
        
        preprocessed_images = preprocess_image(abs_image_path)
        
        best_image, _ = evaluate_preprocessing_quality(preprocessed_images, lang)
        
        if tesseract_installed:
            tesseract_data = pytesseract.image_to_data(
                best_image, 
                lang=lang, 
                config=OCRConfig.DEFAULT_CONFIG, 
                output_type=pytesseract.Output.DATAFRAME
            )
            
            if 'text' in tesseract_data.columns:
                tesseract_data = tesseract_data.dropna(subset=['text'])
                tesseract_data = tesseract_data[tesseract_data['text'].str.strip() != '']
                
                if len(tesseract_data) > 0:
                    result = {
                        'full_text': ' '.join(tesseract_data['text'].tolist()),
                        'blocks': []
                    }
                    
                    if 'block_num' in tesseract_data.columns and 'conf' in tesseract_data.columns:
                        for block_num in tesseract_data['block_num'].unique():
                            block_df = tesseract_data[tesseract_data['block_num'] == block_num]
                            
                            block_df = block_df[block_df['conf'] > OCRConfig.CONFIDENCE_THRESHOLD]
                            
                            if len(block_df) == 0:
                                continue
                                
                            lines = []
                            if 'line_num' in block_df.columns:
                                for line_num in block_df['line_num'].unique():
                                    line_df = block_df[block_df['line_num'] == line_num]
                                    line_text = ' '.join(line_df['text'].tolist())
                                    if line_text.strip():
                                        lines.append(line_text)
                            else:
                                line_text = ' '.join(block_df['text'].tolist())
                                if line_text.strip():
                                    lines.append(line_text)
                            
                            if lines:
                                left = int(block_df['left'].min())
                                top = int(block_df['top'].min())
                                right = int(block_df['left'].max() + block_df['width'].max())
                                bottom = int(block_df['top'].max() + block_df['height'].max())
                                
                                avg_conf = float(block_df['conf'].mean())
                                
                                block_info = {
                                    'text': '\n'.join(lines),
                                    'rect': {
                                        'x': left,
                                        'y': top,
                                        'width': right - left,
                                        'height': bottom - top
                                    },
                                    'confidence': avg_conf
                                }
                                
                                result['blocks'].append(block_info)
                    
                    return result
        
        return result
        
    except Exception as e:
        logger.error(f"OCR 처리 중 오류 발생: {str(e)}")
        return f"[OCR 오류: {str(e)}]"


def clean_ocr_text(text: str) -> str:
    if not text:
        return ""
        
    try:
        text = unicodedata.normalize('NFC', text)
        
        text = re.sub(r'\r\n', '\n', text)
        
        text = text.strip()
        
        text = re.sub(r'\s{2,}', ' ', text)
        
        replacements = {
            '\uff0c': ',',
            '\uff0e': '.',
            '\uff1a': ':',
            '\uff1b': ';',
            '\uff01': '!',
            '\uff1f': '?',
            '\u2018': "'",
            '\u2019': "'",
            '\u201c': '"',
            '\u201d': '"',
            '\u2013': '-',
            '\u2014': '-',
            '\u00A0': ' ',
            '…': '...',
            '․': '.',
            '·': '•',
            '˜': '~',
            'ㄱ': 'ㄱ',
            'ㄴ': 'ㄴ',
            'ㄷ': 'ㄷ',
            'ㅏ': 'ㅏ',
            'ㅓ': 'ㅓ',
            'ㅗ': 'ㅗ',
            'ㅜ': 'ㅜ'
        }
        
        for old, new in replacements.items():
            if old in text:
                text = text.replace(old, new)
                
        lines = []
        for line in text.split('\n'):
            line = line.strip()
            if line:
                lines.append(line)
        
        cleaned_text = '\n'.join(lines)
        
        return cleaned_text
    except Exception as e:
        logger.error(f"OCR 텍스트 정제 중 오류: {str(e)}")
        return text


def merge_text_regions(regions: List[Tuple[int, int, int, int]]) -> List[Tuple[int, int, int, int]]:
    if not regions:
        return []
        
    merged_regions = []
    for x, y, w, h in regions:
        merged = False
        for i, (mx, my, mw, mh) in enumerate(merged_regions):
            if (x <= mx + mw and mx <= x + w and y <= my + mh and my <= y + h):
                new_x = min(x, mx)
                new_y = min(y, my)
                new_w = max(x + w, mx + mw) - new_x
                new_h = max(y + h, my + mh) - new_y
                merged_regions[i] = (new_x, new_y, new_w, new_h)
                merged = True
                break
        
        if not merged:
            merged_regions.append((x, y, w, h))
    
    return merged_regions


def detect_text_regions(image_path: str) -> List[Tuple[int, int, int, int]]:
    try:
        img = cv2.imread(image_path)
        if img is None:
            logger.error(f"이미지를 읽을 수 없습니다: {image_path}")
            return []

        east_regions = detect_text_east(img)
        if east_regions and len(east_regions) > 0:
            logger.info(f"EAST 모델로 {len(east_regions)}개 텍스트 영역 감지됨")
            return east_regions

        _, mser_regions = detect_mser_regions(img)
        if mser_regions and len(mser_regions) > 5:
            logger.info(f"MSER로 {len(mser_regions)}개 텍스트 영역 감지됨")
            return mser_regions
                
        availability, has_fast_mode = check_tesseract_availability()
        if not availability:
            logger.warning("Tesseract를 사용할 수 없어 텍스트 영역 감지를 건너뜁니다.")
            return mser_regions
            
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        custom_config = '--oem 1 --psm 3'
        data = pytesseract.image_to_data(img_rgb, config=custom_config, output_type=pytesseract.Output.DICT)
            
        tesseract_regions = []
        n_boxes = len(data['text'])
            
        for i in range(n_boxes):
            if int(data['conf'][i]) < OCRConfig.CONFIDENCE_THRESHOLD:
                continue
                
            if not data['text'][i].strip():
                continue
                
            x, y, w, h = data['left'][i], data['top'][i], data['width'][i], data['height'][i]
                
            if (w < OCRConfig.MIN_REGION_WIDTH or 
                h < OCRConfig.MIN_REGION_HEIGHT or 
                w > img.shape[1] * 0.9 or 
                h > img.shape[0] * 0.9):
                continue
                
            tesseract_regions.append((x, y, w, h))
                
        logger.info(f"Tesseract로 {len(tesseract_regions)}개 텍스트 영역 감지됨")
            
        combined_regions = mser_regions + tesseract_regions
        merged_regions = merge_text_regions(combined_regions)
            
        return merged_regions
            
    except Exception as e:
        logger.error(f"텍스트 영역 감지 중 오류: {str(e)}")
        return []


def detect_text_east(image: np.ndarray) -> List[Tuple[int, int, int, int]]:
    try:
        model_path = os.environ.get('EAST_MODEL_PATH', 'models/east_text_detection.pb')
        if not os.path.exists(model_path):
            logger.warning(f"EAST 모델을 찾을 수 없습니다: {model_path}")
            return []
            
        height, width = image.shape[:2]
        new_height = (height // 32) * 32
        new_width = (width // 32) * 32
        ratio_h = height / new_height
        ratio_w = width / new_width
        
        if new_width == 0 or new_height == 0:
            return []
            
        resized = cv2.resize(image, (new_width, new_height))
        
        net = cv2.dnn.readNet(model_path)
        
        blob = cv2.dnn.blobFromImage(resized, 1.0, (new_width, new_height), 
                                    (123.68, 116.78, 103.94), swapRB=True, crop=False)
        
        net.setInput(blob)
        (scores, geometry) = net.forward(["feature_fusion/Conv_7/Sigmoid", "feature_fusion/concat_3"])
        
        rectangles = []
        confidences = []
        
        for y in range(0, scores.shape[2]):
            scoresData = scores[0, 0, y]
            xData0 = geometry[0, 0, y]
            xData1 = geometry[0, 1, y]
            xData2 = geometry[0, 2, y]
            xData3 = geometry[0, 3, y]
            anglesData = geometry[0, 4, y]
            
            for x in range(0, scores.shape[3]):
                if scoresData[x] < 0.5:
                    continue
                    
                offsetX = x * 4.0
                offsetY = y * 4.0
                
                angle = anglesData[x]
                cos = np.cos(angle)
                sin = np.sin(angle)
                
                h = xData0[x] + xData2[x]
                w = xData1[x] + xData3[x]
                
                endX = int(offsetX + (cos * xData1[x]) + (sin * xData2[x]))
                endY = int(offsetY - (sin * xData1[x]) + (cos * xData2[x]))
                startX = int(endX - w)
                startY = int(endY - h)
                
                startX = int(startX * ratio_w)
                startY = int(startY * ratio_h)
                endX = int(endX * ratio_w)
                endY = int(endY * ratio_h)
                
                w = endX - startX
                h = endY - startY
                
                rectangles.append((startX, startY, w, h))
                confidences.append(scoresData[x])
        
        boxes = []
        if rectangles:
            indices = cv2.dnn.NMSBoxes(rectangles, confidences, 0.5, 0.4)
            for i in indices:
                if isinstance(i, (list, tuple)):
                    i = i[0]
                boxes.append(rectangles[i])
        
        logger.info(f"EAST 모델로 {len(boxes)}개 텍스트 영역 감지됨")
        return boxes
    
    except Exception as e:
        logger.error(f"EAST 텍스트 감지 중 오류: {str(e)}")
        return []


@lru_cache(maxsize=8)
def _get_tesseract_data(image_id: str, lang: str, config: str):
    pass


def extract_text_with_layout(image_path: str, lang: str = OCRConfig.DEFAULT_LANG) -> Dict[str, Any]:
    result = {
        'full_text': '',
        'blocks': []
    }
    
    try:
        tesseract_installed, lang_installed = check_tesseract_availability(lang)
        
        if not tesseract_installed:
            raise RuntimeError("Tesseract OCR이 설치되어 있지 않습니다.")
            
        if not lang_installed and 'kor' in lang:
            logger.warning("Tesseract에 한국어 언어 팩이 설치되어 있지 않습니다. 영어로 진행합니다.")
            lang = 'eng'
        
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError(f"이미지를 열 수 없습니다: {image_path}")
        
        preprocessed_images = preprocess_image(image_path)
        
        best_preprocessed, _ = evaluate_preprocessing_quality(preprocessed_images, lang)
        
        if tesseract_installed:
            tesseract_data = pytesseract.image_to_data(
                best_preprocessed, 
                lang=lang, 
                config=OCRConfig.DEFAULT_CONFIG, 
                output_type=pytesseract.Output.DATAFRAME
            )
            
            if 'text' in tesseract_data.columns:
                tesseract_data = tesseract_data.dropna(subset=['text'])
                tesseract_data = tesseract_data[tesseract_data['text'].str.strip() != '']
                
                if len(tesseract_data) > 0:
                    result['full_text'] = ' '.join(tesseract_data['text'].tolist())
                    
                    if 'block_num' in tesseract_data.columns and 'conf' in tesseract_data.columns:
                        for block_num in tesseract_data['block_num'].unique():
                            block_df = tesseract_data[tesseract_data['block_num'] == block_num]
                            
                            block_df = block_df[block_df['conf'] > OCRConfig.CONFIDENCE_THRESHOLD]
                            
                            if len(block_df) == 0:
                                continue
                                
                            lines = []
                            if 'line_num' in block_df.columns:
                                for line_num in block_df['line_num'].unique():
                                    line_df = block_df[block_df['line_num'] == line_num]
                                    line_text = ' '.join(line_df['text'].tolist())
                                    if line_text.strip():
                                        lines.append(line_text)
                            else:
                                line_text = ' '.join(block_df['text'].tolist())
                                if line_text.strip():
                                    lines.append(line_text)
                            
                            if lines:
                                left = int(block_df['left'].min())
                                top = int(block_df['top'].min())
                                right = int(block_df['left'].max() + block_df['width'].max())
                                bottom = int(block_df['top'].max() + block_df['height'].max())
                                
                                avg_conf = float(block_df['conf'].mean())
                                
                                block_info = {
                                    'text': '\n'.join(lines),
                                    'rect': {
                                        'x': left,
                                        'y': top,
                                        'width': right - left,
                                        'height': bottom - top
                                    },
                                    'confidence': avg_conf
                                }
                                
                                result['blocks'].append(block_info)
        
        return result
        
    except Exception as e:
        logger.error(f"레이아웃 추출 오류: {str(e)}")
        return result