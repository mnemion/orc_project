"""
PDF 관련 유틸리티 함수
"""

import os
import logging
import tempfile
import PyPDF2
from pdf2image import convert_from_path
from typing import List, Optional, Dict, Any, Tuple, Union
from PIL import Image
import pytesseract
import shutil
import pdf2image

logger = logging.getLogger(__name__)

class PDFConfig:
    DPI = 300
    FORMAT = 'jpg'
    THREAD_COUNT = 1
    MAX_PAGES = 50
    POPPLER_PATH = None


def extract_text_from_pdf(pdf_path: str) -> Dict[str, Any]:
    try:
        if not os.path.exists(pdf_path):
            return {'success': False, 'error': f"파일이 존재하지 않음: {pdf_path}"}
        
        if not pdf_path.lower().endswith('.pdf'):
            return {'success': False, 'error': "PDF 파일이 아님"}
        
        result = {
            'success': False,
            'text': '',
            'page_count': 0,
            'is_text_pdf': False
        }
        
        logger.debug(f"PyPDF2로 텍스트 추출 시도: {pdf_path}")
        text_content = ''
        page_count = 0
        
        with open(pdf_path, 'rb') as file:
            try:
                reader = PyPDF2.PdfReader(file)
                page_count = len(reader.pages)
                result['page_count'] = page_count
                
                if page_count > PDFConfig.MAX_PAGES:
                    logger.warning(f"페이지 수 제한 초과: {page_count} > {PDFConfig.MAX_PAGES}")
                    process_pages = min(page_count, PDFConfig.MAX_PAGES)
                    logger.info(f"PDF 일부만 처리 ({process_pages} 페이지)")
                    
                    
                    for i in range(process_pages):
                        page = reader.pages[i]
                        page_text = page.extract_text()
                        if page_text and page_text.strip():
                            text_content += f"\n--- 페이지 {i+1} ---\n"
                            text_content += page_text
                    
                    text_content += f"\n\n[알림: 전체 {page_count}페이지 중 처음 {process_pages}페이지만 처리되었습니다.]"
                    
                    result['text'] = text_content
                    result['success'] = True
                    result['page_count'] = page_count
                    result['is_text_pdf'] = True
                    result['truncated'] = True
                    return result
                
                for i, page in enumerate(reader.pages):
                    page_text = page.extract_text()
                    if page_text and page_text.strip():
                        text_content += f"\n--- 페이지 {i+1} ---\n"
                        text_content += page_text
            except Exception as e:
                logger.error(f"PyPDF2로 텍스트 추출 실패: {str(e)}")
                return {'success': False, 'error': f"PDF 텍스트 추출 실패: {str(e)}"}
        
        if text_content and len(text_content.strip()) > 100:
            result['text'] = text_content
            result['is_text_pdf'] = True
            result['success'] = True
            logger.debug(f"PDF에서 텍스트 추출 완료: {len(text_content)} 문자")
            return result
        
        logger.debug(f"텍스트가 적거나 없음, 이미지 기반 PDF로 처리: {pdf_path}")
        
        return convert_pdf_to_images(pdf_path)
        
    except Exception as e:
        logger.error(f"PDF 처리 중 오류 발생: {str(e)}")
        return {'success': False, 'error': f"PDF 처리 오류: {str(e)}"}


def convert_pdf_to_images(pdf_path: str) -> Dict[str, Any]:
    result = {
        'success': False,
        'images': [],
        'page_count': 0,
        'is_text_pdf': False,
        'text': ''
    }
    
    # 임시 디렉토리 대신 고정된 위치 사용 (PDF 이름 기반)
    pdf_name = os.path.basename(pdf_path)
    base_name = os.path.splitext(pdf_name)[0]
    temp_dir = os.path.join(os.path.dirname(pdf_path), f"temp_images_{base_name}")
    
    try:
        # 폴더가 이미 존재할 경우 비우고 재사용
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
        os.makedirs(temp_dir, exist_ok=True)
        
        logger.debug(f"PDF를 이미지로 변환 시작: {pdf_path}")
        
        # poppler_path 명시적 지정
        poppler_path = "C:\\Program Files\\poppler\\Library\\bin"
        
        conversion_options = {
            'dpi': PDFConfig.DPI,
            'output_folder': temp_dir,
            'fmt': 'jpg',
            'thread_count': 1,
            'output_file': 'page',
            'grayscale': False,
            'use_pdftocairo': True,
            'poppler_path': poppler_path,
            'paths_only': True
        }
        
        # 파일 존재 여부 미리 확인
        if not os.path.exists(pdf_path):
            logger.error(f"PDF 파일이 존재하지 않습니다: {pdf_path}")
            return {
                'success': False,
                'error': f"PDF 파일이 존재하지 않습니다: {pdf_path}",
                'images': []
            }
        
        # PDF를 이미지로 변환
        image_paths = convert_from_path(pdf_path, **conversion_options)
        result['page_count'] = len(image_paths)
        
        logger.debug(f"PDF 변환 완료: {len(image_paths)} 페이지")
        
        # 이미지 경로 확인
        valid_image_paths = []
        for img_path in image_paths:
            if os.path.exists(img_path):
                valid_image_paths.append(img_path)
            else:
                logger.error(f"변환된 이미지 파일이 존재하지 않습니다: {img_path}")
        
        # 유효한 이미지가 없으면 오류 반환
        if not valid_image_paths:
            return {
                'success': False,
                'error': "PDF에서 이미지를 추출할 수 없습니다",
                'images': []
            }
        
        all_text = ""
        for i, img_path in enumerate(valid_image_paths):
            try:
                # PIL을 사용하여 이미지 로드 (추가 검증)
                with Image.open(img_path) as img:
                    # OCR 처리
                    page_text = pytesseract.image_to_string(img, lang='kor+eng')
                    if page_text and page_text.strip():
                        all_text += f"\n--- 페이지 {i+1} ---\n"
                        all_text += page_text
            except Exception as e:
                logger.error(f"OCR 오류: 파일이 존재하지 않음: 원본 경로={img_path}, 절대 경로={os.path.abspath(img_path)}")
        
        result['text'] = all_text
        result['images'] = valid_image_paths
        result['success'] = True
        
        return result
        
    except Exception as e:
        logger.error(f"PDF 이미지 변환 오류: {str(e)}")
        return {
            'success': False,
            'error': f"PDF 이미지 변환 오류: {str(e)}",
            'images': []
        }
    finally:
        
        pass


def is_pdf_file(file_path: str) -> bool:
    
    if not file_path or not isinstance(file_path, str):
        return False
    
    if not file_path.lower().endswith('.pdf'):
        return False
    
    if not os.path.exists(file_path) or not os.path.isfile(file_path):
        return False
    
    try:
        with open(file_path, 'rb') as f:
            try:
                PyPDF2.PdfReader(f)
                return True
            except:
                return False
    except:
        return False