"""
영수증 분석 관련 유틸리티 함수
"""

import os
import re
import logging
import json
import pytesseract
import cv2
import numpy as np
from PIL import Image
from typing import Dict, Any, List, Optional, Tuple, Union
from datetime import datetime

logger = logging.getLogger(__name__)

class ReceiptConfig:
    OCR_LANG = 'kor+eng'
    OCR_CONFIG = '--oem 1 --psm 6'
    
    MAX_WIDTH = 1600
    MIN_WIDTH = 800
    
    SIMILARITY_THRESHOLD = 0.6
    
    FIELD_KEYWORDS = {
        'date': ['날짜', '일자', '발행일', 'DATE', 'Date'],
        'time': ['시간', 'TIME', 'Time'],
        'total': ['합계', '총액', '결제금액', 'TOTAL', 'Total', '합계금액', '총합계'],
        'payment': ['결제', '지불', '카드', '현금', 'PAYMENT', 'Payment', '결제수단'],
        'store': ['상호', '매장', '가맹점', 'STORE', 'Store', '사업자'],
        'tax': ['부가세', '세금', 'TAX', 'Tax'],
        'subtotal': ['소계', '공급가액', 'SUBTOTAL', 'Subtotal'],
        'card': ['카드번호', '카드', 'CARD', 'Card'],
        'approval': ['승인번호', '승인', 'APPROVAL', 'Approval']
    }


def preprocess_receipt_image(image_path: str) -> np.ndarray:
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError(f"이미지를 불러올 수 없습니다: {image_path}")
    
    height, width = image.shape[:2]
    
    if width < ReceiptConfig.MIN_WIDTH:
        scale = ReceiptConfig.MIN_WIDTH / width
        new_width = int(width * scale)
        new_height = int(height * scale)
        image = cv2.resize(image, (new_width, new_height), interpolation=cv2.INTER_CUBIC)
    
    elif width > ReceiptConfig.MAX_WIDTH:
        scale = ReceiptConfig.MAX_WIDTH / width
        new_width = int(width * scale)
        new_height = int(height * scale)
        image = cv2.resize(image, (new_width, new_height), interpolation=cv2.INTER_AREA)
    
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    
    denoised = cv2.fastNlMeansDenoising(enhanced, h=10)
    
    _, binary = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    coords = np.column_stack(np.where(binary > 0))
    angle = cv2.minAreaRect(coords)[-1]
    
    if angle < -45:
        angle = -(90 + angle)
    else:
        angle = -angle
    
    if abs(angle) > 1:
        (h, w) = binary.shape[:2]
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, angle, 1.0)
        rotated = cv2.warpAffine(binary, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
        return rotated
    
    return binary


def extract_text_from_receipt(image_path: str, use_gemini: bool = False) -> str:
    try:
        if use_gemini:
            try:
                from app import extract_text_with_gemini
                logger.info("영수증 텍스트 추출에 Gemini API 사용")
                text = extract_text_with_gemini(image_path)
                if text:
                    return text
                logger.warning("Gemini API 텍스트 추출 실패, Tesseract로 대체")
            except Exception as e:
                logger.error(f"Gemini API 텍스트 추출 중 오류 발생: {str(e)}")
                logger.warning("Tesseract OCR로 대체하여 진행")
        
        preprocessed = preprocess_receipt_image(image_path)
        
        text = pytesseract.image_to_string(
            Image.fromarray(preprocessed),
            lang=ReceiptConfig.OCR_LANG,
            config=ReceiptConfig.OCR_CONFIG
        )
        
        return text
        
    except Exception as e:
        logger.error(f"영수증 텍스트 추출 중 오류 발생: {str(e)}")
        return ""


def extract_date(text: str) -> Optional[str]:
    date_patterns = [
        r'(20\d{2})[-./년 ]+([0-1]?\d)[-./월 ]+([0-3]?\d)일?',
        r'([0-3]?\d)[-./] ?([0-1]?\d)[-./] ?(20\d{2})',
        r'(\d{2})[-./] ?([0-1]?\d)[-./] ?([0-3]?\d)',
        r'(20\d{2})년\s*([0-1]?\d)월\s*([0-3]?\d)일',
        r'(20\d{2})([0-1]\d)([0-3]\d)'
    ]
    
    date_keywords = ['날짜', '일자', 'DATE', 'Date', '거래일']
    
    for keyword in date_keywords:
        idx = text.find(keyword)
        if idx >= 0:
            search_range = text[max(0, idx-10):min(len(text), idx+40)]
            
            for pattern in date_patterns:
                matches = re.search(pattern, search_range)
                if matches:
                    try:
                        if len(matches.groups()) == 3:
                            year, month, day = matches.groups()
                            
                            if len(year) == 2:
                                year = '20' + year
                                
                            month = month.zfill(2)
                            day = day.zfill(2)
                            
                            return f"{year}-{month}-{day}"
                    except:
                        pass
    
    for pattern in date_patterns:
        matches = re.search(pattern, text)
        if matches:
            try:
                if len(matches.groups()) == 3:
                    year, month, day = matches.groups()
                    
                    if len(year) == 2:
                        year = '20' + year
                        
                    month = month.zfill(2)
                    day = day.zfill(2)
                    
                    return f"{year}-{month}-{day}"
            except:
                pass
    
    return None


def extract_time(text: str) -> Optional[str]:
    time_patterns = [
        r'(\d{1,2}:\d{2}:\d{2})',
        r'(\d{1,2}:\d{2})',
        r'(\d{1,2}시\s*\d{1,2}분)'
    ]
    
    for keyword in ReceiptConfig.FIELD_KEYWORDS['time']:
        idx = text.find(keyword)
        if idx >= 0:
            search_range = text[max(0, idx-10):min(len(text), idx+20)]
            
            for pattern in time_patterns:
                matches = re.search(pattern, search_range)
                if matches:
                    return matches.group(1)
    
    for pattern in time_patterns:
        matches = re.search(pattern, text)
        if matches:
            return matches.group(1)
    
    return None


def extract_total_amount(text: str) -> Optional[int]:
    total_keywords = ['합계', '결제금액', '총액', '총 금액', '총계', 'Total', 'TOTAL', '최종금액', '청구금액', '결제 금액']
    
    amount_pattern = r'(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)'
    
    lines = text.strip().split('\n')
    
    for line in lines:
        if any(keyword in line for keyword in total_keywords):
            matches = re.findall(amount_pattern, line)
            if matches:
                try:
                    amounts = [int(m.replace(',', '')) for m in matches]
                    return max(amounts)
                except (ValueError, IndexError):
                    continue
    
    matches = re.findall(amount_pattern, text)
    if matches:
        try:
            amounts = [int(m.replace(',', '')) for m in matches if int(m.replace(',', '')) > 0]
            if amounts:
                return max(amounts)
        except (ValueError, IndexError):
            pass
    
    return None


def extract_payment_method(text: str) -> Optional[str]:
    payment_keywords = {
        '신용카드': ['신용', '신용카드', '카드', 'CARD', '체크카드', '삼성카드', '현대카드', '롯데카드', '국민카드', 'KB카드', 'BC카드'],
        '현금': ['현금', 'CASH', '계산'],
        '간편결제': ['삼성페이', '애플페이', '카카오페이', '네이버페이', '제로페이', '페이코'],
        '상품권': ['상품권', '문화상품권', '도서상품권'],
        '포인트': ['포인트', '마일리지', '적립금']
    }
    
    payment_section_keywords = ['결제', '지불', 'PAY', 'PAYMENT']
    
    payment_section = text
    for keyword in payment_section_keywords:
        idx = text.find(keyword)
        if idx >= 0:
            payment_section = text[idx:idx+100]
            break
    
    for payment_type, keywords in payment_keywords.items():
        for keyword in keywords:
            if keyword in payment_section:
                return payment_type
    
    for payment_type, keywords in payment_keywords.items():
        for keyword in keywords:
            if keyword in text:
                return payment_type
    
    return None


def extract_store_info(text: str) -> Optional[Dict[str, str]]:
    business_number_pattern = r'사업자(?:등록)?번호\s*:?\s*(\d{3}-\d{2}-\d{5}|\d{10})'
    
    store_name_pattern = r'상호\s*:?\s*(.+?)(?:\n|$)'
    
    phone_pattern = r'(?:전화|연락처|TEL|Tel)\s*:?\s*(\d{2,4}-\d{3,4}-\d{4}|\d{10,11})'
    
    store_info = {}
    
    business_match = re.search(business_number_pattern, text)
    if business_match:
        business_number = business_match.group(1)
        if '-' not in business_number and len(business_number) == 10:
            business_number = f"{business_number[:3]}-{business_number[3:5]}-{business_number[5:]}"
        store_info['business_number'] = business_number
    
    store_match = re.search(store_name_pattern, text)
    if store_match:
        store_info['name'] = store_match.group(1).strip()
    else:
        first_line = text.split('\n', 1)[0].strip()
        if first_line and len(first_line) < 30:
            store_info['name'] = first_line
    
    phone_match = re.search(phone_pattern, text)
    if phone_match:
        store_info['phone'] = phone_match.group(1)
    
    return store_info if store_info else None


def extract_receipt_items(text: str) -> List[Dict[str, Any]]:
    lines = text.strip().split('\n')
    items = []
    
    item_patterns = [
        r'(.+?)\s+(\d+)\s+(\d{1,3}(?:,\d{3})*)\s+(\d{1,3}(?:,\d{3})*)',           # 상품명 수량 단가 금액
        r'(.+?)\s+(\d+)\s*(?:개|EA)?(?:\s*x|\*)\s*(\d{1,3}(?:,\d{3})*)\s+(\d{1,3}(?:,\d{3})*)',  # 상품명 수량x단가 금액
        r'(.+?)\s+(\d+)(?:개|EA)?\s+(?:@\s*)?(\d{1,3}(?:,\d{3})*)\s*(?:=|→)?\s*(\d{1,3}(?:,\d{3})*)',  # 상품명 수량 @ 단가 = 금액
        r'(.+?)(?:\s*x|\*)\s*(\d+)\s*(?:개|EA|)\s*(\d{1,3}(?:,\d{3})*)\s+(\d{1,3}(?:,\d{3})*)',  # 상품명 x 수량 단가 금액
    ]
    
    non_item_keywords = ['합계', '부가세', '할인', '소계', '총액', '결제금액', '총 금액', '과세', '면세', 'TOTAL']
    
    for line in lines:
        line = line.strip()
        if not line or len(line) < 5:
            continue
            
        if any(keyword in line for keyword in non_item_keywords):
            continue
            
        for pattern in item_patterns:
            match = re.search(pattern, line)
            if match:
                try:
                    name = match.group(1).strip()
                    quantity = int(match.group(2))
                    unit_price = int(match.group(3).replace(',', ''))
                    price = int(match.group(4).replace(',', ''))
                    
                    if name and quantity > 0 and unit_price > 0 and price > 0:
                        items.append({
                            'name': name,
                            'quantity': quantity,
                            'unit_price': unit_price,
                            'price': price
                        })
                        break
                except (ValueError, IndexError):
                    continue
    
    return items


def parse_receipt(image_path: str, use_gemini: bool = False) -> Dict[str, Any]:
    try:
        text = extract_text_from_receipt(image_path, use_gemini)
        
        if not text:
            return {
                'success': False,
                'error': '영수증에서 텍스트를 추출할 수 없습니다'
            }
        
        result = {
            'success': True,
            'full_text': text,
            'items': [],
            'total_amount': None,
            'date': None,
            'time': None,
            'payment_method': None,
            'store': None,
            'ocr_model': 'gemini' if use_gemini else 'tesseract'
        }
        
        result['items'] = extract_receipt_items(text)
        result['total_amount'] = extract_total_amount(text)
        result['date'] = extract_date(text)
        result['time'] = extract_time(text)
        result['store'] = extract_store_info(text)
        result['payment_method'] = extract_payment_method(text)
        
        return result
        
    except Exception as e:
        logger.error(f"영수증 분석 중 오류 발생: {str(e)}")
        return {
            'success': False,
            'error': f"영수증 분석 중 오류가 발생했습니다: {str(e)}"
        } 