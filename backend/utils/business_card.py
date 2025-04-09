"""
명함 인식 관련 유틸리티 함수
"""

import os
import re
import logging
import pytesseract
import cv2
import numpy as np
from PIL import Image
from typing import Dict, Any, List, Optional, Tuple, Union

logger = logging.getLogger(__name__)

class BusinessCardConfig:
    OCR_LANG = 'kor+eng'
    OCR_CONFIG = '--oem 1 --psm 4'
    
    MAX_WIDTH = 1600
    MIN_WIDTH = 800
    
    FIELD_TYPES = {
        'name': '이름',
        'position': '직위',
        'company': '회사',
        'address': '주소',
        'phone': '전화번호',
        'mobile': '휴대전화',
        'email': '이메일',
        'website': '웹사이트',
        'fax': '팩스'
    }


def preprocess_card_image(image_path: str) -> np.ndarray:
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError(f"이미지를 불러올 수 없습니다: {image_path}")
    
    height, width = image.shape[:2]
    
    if width < BusinessCardConfig.MIN_WIDTH:
        scale = BusinessCardConfig.MIN_WIDTH / width
        new_width = int(width * scale)
        new_height = int(height * scale)
        image = cv2.resize(image, (new_width, new_height), interpolation=cv2.INTER_CUBIC)
    
    elif width > BusinessCardConfig.MAX_WIDTH:
        scale = BusinessCardConfig.MAX_WIDTH / width
        new_width = int(width * scale)
        new_height = int(height * scale)
        image = cv2.resize(image, (new_width, new_height), interpolation=cv2.INTER_AREA)
    
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    
    denoised = cv2.fastNlMeansDenoising(enhanced, h=10)
    
    _, binary = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    return binary


def extract_text_from_card(image_path: str, use_gemini: bool = False) -> str:
    try:
        if use_gemini:
            try:
                from app import extract_text_with_gemini
                logger.info("명함 텍스트 추출에 Gemini API 사용")
                text = extract_text_with_gemini(image_path)
                if text:
                    return text
                logger.warning("Gemini API 텍스트 추출 실패, Tesseract로 대체")
            except Exception as e:
                logger.error(f"Gemini API 텍스트 추출 중 오류 발생: {str(e)}")
                logger.warning("Tesseract OCR로 대체하여 진행")
        
        preprocessed = preprocess_card_image(image_path)
        
        text = pytesseract.image_to_string(
            preprocessed, 
            lang=BusinessCardConfig.OCR_LANG,
            config=BusinessCardConfig.OCR_CONFIG
        )
        
        return text.strip()
        
    except Exception as e:
        logger.error(f"명함 이미지 텍스트 추출 중 오류 발생: {str(e)}")
        return ""


def extract_email(text: str) -> List[str]:
    email_pattern = r'\b[A-Za-z0-9._%+\-=]{1,64}@(?:[A-Za-z0-9-]{1,63}\.){1,125}[A-Za-z]{2,63}\b'
    
    emails = re.findall(email_pattern, text)
    
    cleaned_emails = []
    for email in emails:
        clean_email = email.strip('.,;:()[]{}"\' ')
        if re.match(r'^[A-Za-z0-9._%+\-=]{1,64}@(?:[A-Za-z0-9-]{1,63}\.){1,125}[A-Za-z]{2,63}$', clean_email):
            if clean_email not in cleaned_emails:
                cleaned_emails.append(clean_email)
    
    return cleaned_emails


def extract_phone_numbers(text: str) -> Dict[str, List[str]]:
    kr_mobile_pattern = r'(?:(?:\+82|0)[ -.]?1[0-9][ -.]?[0-9]{3,4}[ -.]?[0-9]{4})'
    
    kr_phone_pattern = r'(?:(?:\+82|0)[ -.]?[2-9][0-9]{1,2}[ -.]?[0-9]{3,4}[ -.]?[0-9]{4})'
    
    fax_indicator = r'(?:F|FAX|팩스|Fax|[Ff]ax)[\s:.\-]*(\+?[0-9][ -.]?[0-9]{1,4}[ -.]?[0-9]{1,4}[ -.]?[0-9]{1,4})'
    
    intl_pattern = r'\+[0-9]{1,4}[ -.]?[0-9]{1,5}[ -.]?[0-9]{1,5}(?:[ -.]?[0-9]{1,5})*'
    
    prefixes = r'(?:전화|연락처|[Tt]el|[Tt]elephone|[Pp]hone|[Mm]obile|휴대폰|휴대전화|핸드폰|전화번호|폰번호|모바일|☎|📞|✆)[\s:]*'
    
    mobiles = []
    combined_mobile_pattern = f'{prefixes}({kr_mobile_pattern})'
    mobiles.extend(re.findall(combined_mobile_pattern, text))
    mobiles.extend(re.findall(kr_mobile_pattern, text))
    
    phones = []
    combined_phone_pattern = f'{prefixes}({kr_phone_pattern})'
    phones.extend(re.findall(combined_phone_pattern, text))
    phones.extend(re.findall(kr_phone_pattern, text))
    
    faxes = re.findall(fax_indicator, text)
    intl_phones = re.findall(intl_pattern, text)
    
    def clean_number(number):
        cleaned = re.sub(r'[ \-.]', '', number)
        if cleaned.startswith('+82'):
            cleaned = '0' + cleaned[3:]
        return cleaned
    
    result = {
        'mobile': [],
        'phone': [],
        'fax': [],
        'international': []
    }
    
    mobile_set = set()
    for mobile in mobiles:
        if isinstance(mobile, (list, tuple)) and mobile:
            mobile = mobile[-1]
        
        cleaned = clean_number(mobile)
        if cleaned and len(cleaned) >= 10 and cleaned not in mobile_set:
            mobile_set.add(cleaned)
            result['mobile'].append(mobile)
    
    phone_set = set()
    for phone in phones:
        if isinstance(phone, (list, tuple)) and phone:
            phone = phone[-1]
            
        cleaned = clean_number(phone)
        if cleaned and len(cleaned) >= 9 and cleaned not in phone_set and cleaned not in mobile_set:
            phone_set.add(cleaned)
            result['phone'].append(phone)
    
    fax_set = set()
    for fax in faxes:
        cleaned = clean_number(fax)
        if cleaned and len(cleaned) >= 9 and cleaned not in fax_set:
            fax_set.add(cleaned)
            result['fax'].append(fax)
    
    intl_set = set()
    for intl in intl_phones:
        cleaned = clean_number(intl)
        if cleaned and len(cleaned) >= 7 and cleaned not in intl_set and cleaned not in mobile_set and cleaned not in phone_set and cleaned not in fax_set:
            intl_set.add(cleaned)
            result['international'].append(intl)
    
    return result


def extract_website(text: str) -> List[str]:
    website_pattern = r'(?:https?:\/\/)?(?:www\.)?([A-Za-z0-9]+(?:-[A-Za-z0-9]+)*(?:\.[A-Za-z]{2,})+)(?:\/[^\s]*)?'
    
    websites = re.findall(website_pattern, text)
    
    return websites


def extract_name(text: str) -> Optional[str]:
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    
    if not lines:
        return None
    
    candidate_lines = [line for line in lines[:3] if len(line) < 20 and not re.search(r'[0-9@]', line)]
    
    if candidate_lines:
        return min(candidate_lines, key=len)
    
    return lines[0] if len(lines[0]) < 30 else None


def extract_position(text: str) -> Optional[str]:
    position_keywords = [
        '대표', 'CEO', '사장', '부장', '차장', '과장', '팀장', '매니저', '이사', '상무', '전무',
        '주임', '대리', '사원', '연구원', '연구소장', '수석', '선임', '전임', '책임',
        '변호사', '의사', '교수', '강사', '컨설턴트', '디자이너', '엔지니어', '개발자'
    ]
    
    # 줄별로 분리
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    
    for line in lines[:5]:  # 주로 상단 부분에 직위가 있음
        for keyword in position_keywords:
            if keyword in line:
                # 직위만 추출 시도 (이름이 포함된 경우 제외)
                parts = re.split(r'\s+', line)
                for part in parts:
                    if keyword in part:
                        return part
                return line
    
    return None


def extract_company(text: str) -> Optional[str]:
    company_indicators = ['주식회사', '(주)', '㈜', 'Inc.', 'Corp.', 'Co.,', 'Ltd.', 'LLC', 'GmbH']
    
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    
    for line in lines:
        for indicator in company_indicators:
            if indicator in line:
                company_pattern = r'(?:주식회사|(?:\(주\)|\(\주\)))\s*([^\s]+)|([^\s]+)\s*(?:\(주\)|\(\주\))|(.+?)\s*(?:Inc\.|Corp\.|Co\.,|Ltd\.|LLC|GmbH)'
                matches = re.search(company_pattern, line)
                if matches:
                    groups = matches.groups()
                    return next((g for g in groups if g), line)
                return line
    
    if len(lines) > 1:
        return lines[1] if len(lines[1]) < 30 else None
    
    return None


def extract_address(text: str) -> Optional[str]:
    address_keywords = ['시', '구', '동', '읍', '면', '로', '길', '번지', '호']
    
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    
    address_candidates = []
    for line in lines:
        keyword_count = sum(1 for kw in address_keywords if kw in line)
        if keyword_count >= 2:
            address_candidates.append((line, keyword_count, len(line)))
    
    if address_candidates:
        address_candidates.sort(key=lambda x: (x[1], x[2]), reverse=True)
        return address_candidates[0][0]
    
    return None


def parse_business_card(image_path: str, use_gemini: bool = False) -> Dict[str, Any]:
    try:
        full_text = extract_text_from_card(image_path, use_gemini)
        
        if not full_text or len(full_text.strip()) < 10:
            return {
                'success': False,
                'error': '명함에서 충분한 텍스트를 추출할 수 없습니다'
            }
        
        emails = extract_email(full_text)
        phones = extract_phone_numbers(full_text)
        websites = extract_website(full_text)
        name = extract_name(full_text)
        position = extract_position(full_text)
        company = extract_company(full_text)
        address = extract_address(full_text)
        
        return {
            'success': True,
            'full_text': full_text,
            'name': name,
            'position': position,
            'company': company,
            'email': emails,
            'phone': phones,
            'address': address,
            'website': websites,
            'ocr_model': 'gemini' if use_gemini else 'tesseract'
        }
        
    except Exception as e:
        logger.error(f"명함 분석 중 오류 발생: {str(e)}")
        return {
            'success': False,
            'error': f"명함 분석 중 오류가 발생했습니다: {str(e)}"
        } 