import os
import logging
import uuid
import secrets
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional, Union, List
from flask import Flask, request, jsonify, send_from_directory, Response, session, url_for
import werkzeug.utils
from werkzeug.utils import secure_filename
from werkzeug.exceptions import BadRequest, Unauthorized, NotFound, InternalServerError
from dotenv import load_dotenv
import pytesseract
import subprocess
import google.generativeai as genai
from PIL import Image
import re
import time
from functools import wraps
from concurrent.futures import ThreadPoolExecutor, TimeoutError
import cx_Oracle
from werkzeug.security import generate_password_hash, check_password_hash
from utils.translation import detect_language, translate_text, TranslationConfig
from utils.table_extraction import extract_table_from_image, extract_and_save_table, save_table_to_csv, save_table_to_excel, TableConfig, extract_table_data_as_content, generate_excel_in_memory, generate_csv_in_memory
from utils.business_card import parse_business_card, extract_text_from_card, BusinessCardConfig
from database.user_extractions import get_user_extractions
from database.extractions import save_extraction, update_extraction_text, update_extraction_filename, delete_extraction, get_extraction_by_id, toggle_extraction_bookmark
from database.users import authenticate_user, create_user, get_user_by_email, update_password, get_user_by_id
from database.connection import (
    get_db_connection,
    execute_query, 
    execute_insert, 
    execute_update, 
    execute_delete, 
    can_connect_to_db,
    ensure_serializable
)
from database import (
    UPDATE_USER_PASSWORD,
)
from utils import parse_receipt, extract_text_from_receipt, ReceiptConfig
from ocr.processor import process_image, check_tesseract_availability, OCRConfig
import base64
import io
import json
from flask_cors import CORS
from werkzeug.datastructures import FileStorage
from utils.file_utils import is_valid_image, is_pdf_file
import jwt # jwt 라이브러리 임포트
from jwt import ExpiredSignatureError, InvalidTokenError # JWT 오류 타입 임포트
from utils.pdf_utils import extract_text_from_pdf, convert_pdf_to_images, is_pdf_file, PDFConfig
from utils.summarization import summarize_text, summarize_text_with_gemini, summarize_text_with_transformers, SummarizationConfig

# .env 파일에서 환경 변수 로드
load_dotenv()

# 익명 사용자 ID 정의 (예: 0 또는 특정 문자열)
ANONYMOUS_USER_ID = os.environ.get('ANONYMOUS_USER_ID', '0')
# 익명 사용자 허용 여부 - 기본값을 false로 설정
ALLOW_ANONYMOUS_USAGE = False

class AppConfig:
    # 기본 설정
    SECRET_KEY = os.environ.get('SECRET_KEY', secrets.token_hex(32))
    UPLOAD_FOLDER = os.environ.get('UPLOAD_FOLDER', 'uploads')
    MAX_CONTENT_LENGTH = int(os.environ.get('MAX_CONTENT_LENGTH', 16 * 1024 * 1024))  # 16MB
    
    # 허용된 파일 유형
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'pdf', 'tiff', 'tif'}
    ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff', 'tif'}
    
    # Tesseract 설정
    TESSERACT_PATH = os.environ.get('TESSERACT_PATH', '')
    
    # CORS 설정
    CORS_ORIGINS = os.environ.get('CORS_ORIGINS', '*').split(',')
    
    # JWT 설정
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', SECRET_KEY)
    JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
    JWT_EXPIRATION_MINUTES = int(os.environ.get('JWT_EXPIRATION_MINUTES', 60 * 24 * 7))  # 1주일
    
    # Gemini 설정
    GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')
    GEMINI_MODEL = os.environ.get('GEMINI_MODEL', 'gemini-2.0-flash-exp-image-generation')
    GEMINI_MAX_IMAGE_SIZE = int(os.environ.get('GEMINI_MAX_IMAGE_SIZE', 1024))
    
    @staticmethod
    def setup_tesseract():
        """Tesseract 경로 설정"""
        if AppConfig.TESSERACT_PATH:
            pytesseract.pytesseract.tesseract_cmd = AppConfig.TESSERACT_PATH

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # JWT 토큰 기반 인증 확인
        token = get_auth_token()
        if not token:
            logger.warning("인증 실패: JWT 토큰이 없습니다")
            return jsonify({'success': False, 'error': '로그인이 필요합니다.'}), 401
            
        try:
            # JWT 토큰 디코딩 및 검증
            payload = jwt.decode(token, AppConfig.JWT_SECRET_KEY, algorithms=[AppConfig.JWT_ALGORITHM])
            user_id = payload.get('user_id')
            if not user_id:
                logger.warning("JWT 토큰 유효하지만 user_id가 없습니다")
                return jsonify({'success': False, 'error': '유효하지 않은 인증 정보입니다.'}), 401
                
            # 여기서 user_id를 request 객체에 저장하여 다른 함수에서 사용할 수 있게 함
            request.user_id = user_id
            return f(*args, **kwargs)
        except ExpiredSignatureError:
            logger.warning("만료된 JWT 토큰")
            return jsonify({'success': False, 'error': '세션이 만료되었습니다. 다시 로그인해주세요.', 'code': 'TOKEN_EXPIRED'}), 401
        except InvalidTokenError as e:
            logger.warning(f"유효하지 않은 JWT 토큰: {str(e)}")
            return jsonify({'success': False, 'error': '유효하지 않은 인증 정보입니다.'}), 401
            
    return decorated_function

from ocr.processor import process_image
from utils.file_utils import is_valid_image, clean_old_files, FileConfig
from utils.email_utils import send_password_reset_email
from utils.pdf_utils import extract_text_from_pdf, convert_pdf_to_images, is_pdf_file, PDFConfig
from utils.summarization import summarize_text, summarize_text_with_gemini, summarize_text_with_transformers, SummarizationConfig
from utils.translation import detect_language, translate_text, TranslationConfig
from database.user_extractions import get_user_extractions
from database.extractions import save_extraction, update_extraction_text, update_extraction_filename, delete_extraction, get_extraction_by_id
from database.users import authenticate_user, create_user, get_user_by_email, update_password
from database.connection import (
    get_db_connection, 
    execute_query, 
    execute_insert, 
    execute_update, 
    execute_delete, 
    can_connect_to_db,
    ensure_serializable
)
from database import (
    UPDATE_USER_PASSWORD,
)

LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO').upper()
LOG_FORMAT = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
LOG_FILE = os.environ.get('LOG_FILE', 'app.log')

# 로깅 레벨을 조정하여 불필요한 로그 감소
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format=LOG_FORMAT,
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(LOG_FILE, encoding='utf-8')
    ]
)

# 특정 로거들의 레벨을 조정하여 불필요한 로그 출력 감소
logging.getLogger('database.connection').setLevel(logging.WARNING)
logging.getLogger('database.user_extractions').setLevel(logging.WARNING)
logging.getLogger('urllib3').setLevel(logging.WARNING)
logging.getLogger('PIL').setLevel(logging.WARNING)

logger = logging.getLogger(__name__)

genai.configure(api_key=AppConfig.GEMINI_API_KEY)

def extract_text_with_gemini(image_path: str, model_name: str = AppConfig.GEMINI_MODEL, detect_language_only: bool = False) -> Union[str, Dict[str, Any]]:
    if not AppConfig.GEMINI_API_KEY:
        raise RuntimeError("Gemini API 키가 설정되지 않았습니다")
    
    try:
        img = Image.open(image_path)
        
        max_size = AppConfig.GEMINI_MAX_IMAGE_SIZE
        if max(img.size) > max_size:
            ratio = max_size / max(img.size)
            new_size = (int(img.size[0] * ratio), int(img.size[1] * ratio))
            img = img.resize(new_size, Image.LANCZOS)
        
        model = genai.GenerativeModel(model_name)
        
        if detect_language_only:
            # 언어 감지 전용 프롬프트
            prompt = """
            이미지에 있는 텍스트의 언어를 감지해주세요.
            응답은 다음과 같은 JSON 형식으로만 제공해주세요:
            {
              "language_code": "ko", // 감지된 언어 코드 (ko, en, ja, zh-CN, de, fr, es, ru, it, pt, ar, hi, vi, th 중 하나)
              "language_name": "한국어", // 언어 이름
              "confidence": 0.95 // 감지 신뢰도 (0~1 사이)
            }
            
            만약 여러 언어가 섞여 있다면, 가장 많이 사용된 언어를 선택하고 confidence를 그에 맞게 조정해주세요.
            JSON 형식 외의 다른 설명이나 텍스트는 절대 포함하지 마세요.
            """
            
            response = model.generate_content([prompt, img])
            result_text = response.text.strip()
            
            # JSON 부분만 추출
            if '{' in result_text and '}' in result_text:
                start = result_text.find('{')
                end = result_text.rfind('}') + 1
                json_text = result_text[start:end]
                
                try:
                    import json
                    result = json.loads(json_text)
                    
                    # 언어 코드 정규화
                    if 'language_code' in result:
                        result['language'] = result['language_code']
                        result['success'] = True
                    
                    return result
                except Exception as e:
                    logger.error(f"Gemini 언어 감지 결과 파싱 오류: {str(e)}")
            
            # JSON 파싱 실패 시 기본값 반환
            return {
                'success': False,
                'error': '언어 감지 결과를 파싱할 수 없습니다.'
            }
            
        else:
            # 개선된 OCR 텍스트 추출 프롬프트
            prompt = """
            이미지에서 모든 텍스트를 정확하게 추출해주세요. 이미지의 모든 텍스트를 원래 형식과 레이아웃을 최대한 유지하면서 높은 정확도로 추출하는 것이 중요합니다.

            다음 지침을 정확히 따라주세요:
            1. 한글, 영문, 숫자 등 모든 문자를 원본 그대로 정확하게 추출합니다.
            2. 문서의 구조와 레이아웃을 최대한 유지합니다 (줄바꿈, 들여쓰기 등).
            3. 표 구조는 텍스트 형태로 적절히 배치합니다.
            4. 작은 글씨, 흐릿한 텍스트, 기울어진 텍스트 등 모든 텍스트를 주의깊게 판독합니다.
            5. 특수 기호, 전문 용어, 고유명사 등도 정확하게 추출합니다.
            6. 도형이나 아이콘 내부의 텍스트도 포함합니다.
            7. 문자 사이의 간격을 실수로 띄워 쓰지 않도록 주의합니다.
            8. 분석이나 설명 없이 텍스트만 제공합니다.

            최대한 정확하게 모든 텍스트를 추출하세요. 
            절대로 텍스트를 추가하거나 생략하지 마세요.
            """
            
            response = model.generate_content([prompt, img])
            
            extracted_text = response.text
            
            # 불필요한 설명 문구 제거
            if "다음은 이미지에서 추출한 텍스트입니다:" in extracted_text:
                extracted_text = extracted_text.split("다음은 이미지에서 추출한 텍스트입니다:", 1)[1].strip()
            
            if "여기 이미지에서 추출한 텍스트입니다:" in extracted_text:
                extracted_text = extracted_text.split("여기 이미지에서 추출한 텍스트입니다:", 1)[1].strip()
                
            # 마크다운 코드 블록 표시 제거
            extracted_text = re.sub(r'^```.*\n|```$', '', extracted_text, flags=re.MULTILINE)
            
            return extracted_text.strip()
        
    except Exception as e:
        if detect_language_only:
            logger.error(f"Gemini를 사용한 언어 감지 실패: {str(e)}")
            return {
                'success': False,
                'error': f"언어 감지 실패: {str(e)}"
            }
        else:
            logger.error(f"Gemini를 사용한 텍스트 추출 실패: {str(e)}")
            raise RuntimeError(f"Gemini 텍스트 추출 실패: {str(e)}")

app = Flask(__name__, static_folder='../build', static_url_path='/')
CORS(app, origins=AppConfig.CORS_ORIGINS, supports_credentials=True, allow_headers=["Cache-Control", "Content-Type", "Authorization", "X-Requested-With", "Accept"])

app.secret_key = AppConfig.SECRET_KEY # Flask 세션용 키 설정

app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SECURE'] = False
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=30)
app.config['SESSION_REFRESH_EACH_REQUEST'] = True

if os.environ.get('FLASK_ENV') != 'production':
    app.config['SESSION_COOKIE_DOMAIN'] = None
    app.config['SESSION_COOKIE_PATH'] = '/'

AppConfig.setup_tesseract()

app.config['UPLOAD_FOLDER'] = AppConfig.UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = AppConfig.MAX_CONTENT_LENGTH

if not os.path.exists(AppConfig.UPLOAD_FOLDER):
    os.makedirs(AppConfig.UPLOAD_FOLDER)

def cleanup_old_files():
    try:
        upload_dir = app.config['UPLOAD_FOLDER']
        
        if os.path.exists(upload_dir) and os.path.isdir(upload_dir):
            deleted_count = clean_old_files(upload_dir)
            if deleted_count > 0:
                logger.info(f"오래된 파일 {deleted_count}개 정리 완료")
    except Exception as e:
        logger.error(f"오래된 파일 정리 중 오류 발생: {str(e)}")

try:
    cleanup_old_files()
except Exception as e:
    logger.error(f"앱 시작 시 정리 작업 실패: {str(e)}")

@app.after_request
def add_cors_headers(response: Response) -> Response:
    origins = AppConfig.CORS_ORIGINS
    origin = request.headers.get('Origin')
    
    # 오리진 헤더 확인 및 설정
    if origin and (origins[0] == '*' or origin in origins):
        response.headers['Access-Control-Allow-Origin'] = origin
    elif origins[0] == '*':
        response.headers['Access-Control-Allow-Origin'] = '*'
    
    # OPTIONS 요청인 경우 모든 CORS 헤더 추가
    if request.method == 'OPTIONS':
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        requested_headers = request.headers.get('Access-Control-Request-Headers')
        if requested_headers:
            response.headers['Access-Control-Allow-Headers'] = requested_headers
        else:
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With, Accept, Cache-Control'
        response.headers['Access-Control-Max-Age'] = '3600'
    
    # 인증 관련 헤더 항상 추가
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    response.headers['Vary'] = 'Origin'
    
    return response

def allowed_file(filename: Optional[str], allowed_extensions: Optional[set] = None) -> bool:
    """
    파일 확장자가 허용된 목록에 있는지 확인합니다.
    
    Args:
        filename: 확인할 파일명
        allowed_extensions: 허용된 확장자 목록 (없으면 AppConfig.ALLOWED_EXTENSIONS 사용)
        
    Returns:
        파일 확장자가 허용되는지 여부
    """
    if not filename:
        return False
    
    # 기본 허용 확장자 설정
    extensions = allowed_extensions or AppConfig.ALLOWED_EXTENSIONS
    
    try:
        # 파일명에서 마지막 점 이후를 확장자로 간주
        file_extension = filename.rsplit('.', 1)[1].lower()
        return file_extension in extensions
    except (IndexError, AttributeError):
        # 파일명에 점이 없거나 filename이 문자열이 아닌 경우
        return False

def allowed_image_file(filename: Optional[str]) -> bool:
    if not filename:
        return False
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in AppConfig.ALLOWED_IMAGE_EXTENSIONS

def get_auth_token() -> Optional[str]:
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None
    return auth_header.split(' ')[1]


def get_current_user() -> Optional[Dict[str, Any]]:
    # JWT 토큰 확인
    token = get_auth_token()
    if not token:
        logger.debug("get_current_user: 토큰이 없습니다")
        return None
        
    try:
        # JWT 토큰 디코딩 및 검증
        payload = jwt.decode(token, AppConfig.JWT_SECRET_KEY, algorithms=[AppConfig.JWT_ALGORITHM])
        user_id = payload.get('user_id')
        if user_id:
            user = get_user_by_id(user_id)
            if user:
                logger.debug(f"get_current_user: JWT 토큰으로 사용자 찾음 {user_id}")
                return user
            logger.warning(f"get_current_user: 토큰의 user_id({user_id})에 해당하는 사용자를 찾을 수 없음")
        else:
            logger.warning("get_current_user: 토큰에 user_id가 없음")
    except ExpiredSignatureError:
        logger.warning("get_current_user: 만료된 JWT 토큰")
    except InvalidTokenError as e:
        logger.warning(f"get_current_user: 유효하지 않은 JWT 토큰: {str(e)}")
    
    # 인증 실패
    return None

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'ok',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/extract', methods=['POST', 'OPTIONS'])
def extract():
    """이미지에서 텍스트를 추출하는 API"""
    # OPTIONS 요청 처리
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        response.headers.add('Access-Control-Allow-Origin', request.headers.get('Origin', '*'))
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response
        
    # 변수 선언 (후에 예외 처리에서 참조할 수 있도록)
    file_path = None
    
    try:
        # 로그인 체크 (POST 요청일 때만)
        token = get_auth_token()
        if not token:
            logger.warning("인증 실패: JWT 토큰이 없습니다")
            return jsonify({'success': False, 'error': '로그인이 필요합니다.'}), 401
            
        # JWT 토큰 디코딩 및 검증
        payload = jwt.decode(token, AppConfig.JWT_SECRET_KEY, algorithms=[AppConfig.JWT_ALGORITHM])
        user_id = payload.get('user_id')
        if not user_id:
            logger.warning("JWT 토큰 유효하지만 user_id가 없습니다")
            return jsonify({'success': False, 'error': '유효하지 않은 인증 정보입니다.'}), 401
            
        # user_id를 request 객체에 저장하여 다른 함수에서 사용할 수 있게 함
        request.user_id = user_id
        
        # 기존 코드 계속 진행
        if not request.files or 'file' not in request.files:
            return jsonify({
                'success': False,
                'error': '파일이 업로드되지 않았습니다.'
            }), 400
        
        file: FileStorage = request.files['file']
        if not file or not file.filename:
            return jsonify({
                'success': False,
                'error': '선택된 파일이 없거나 파일명이 유효하지 않습니다.'
            }), 400
        
        # 요청에서 처리 방식 확인
        file_type = request.form.get('file_type', '')
        source_type = request.form.get('source_type', '')
        process_as = request.form.get('process_as', '')
        selected_model = request.form.get('model', 'auto')
        
        # PDF 처리 여부 판단
        force_pdf_processing = (
            file_type.lower() == 'pdf' or 
            source_type.lower() == 'pdf' or 
            process_as.lower() == 'pdf' or
            selected_model.lower() == 'pdf_extract'
        )
        
        logger.info(f"파일 처리 설정: file_type={file_type}, source_type={source_type}, process_as={process_as}, model={selected_model}, force_pdf={force_pdf_processing}")
        
        # --- 유효성 검사 수정 ---
        # 파일 객체를 직접 전달하여 검사
        is_valid = is_valid_image(file)
        is_pdf = is_pdf_file(file) or force_pdf_processing
    
        if not is_valid and not is_pdf:
            # 검사 후 파일 포인터 리셋 (is_valid_image 등에서 seek/read 했을 수 있음)
            file.seek(0)
            return jsonify({
                'success': False,
                'error': '지원되지 않는 파일 형식입니다. 이미지 또는 PDF 파일을 업로드하세요.'
            }), 400
        # 검사 후 파일 포인터 리셋
        file.seek(0)
        # --- 유효성 검사 수정 끝 ---
        
        # 파일 저장
        filename = secure_filename(file.filename) # secure_filename은 유지
        unique_filename = f"{uuid.uuid4()}_{filename}"
        
        # 원본 파일명 가져오기 (프론트엔드에서 전송한 경우)
        original_filename = request.form.get('original_filename', filename)
        
        # 업로드 디렉토리 생성 (절대 경로 보장)
        upload_folder = os.path.abspath(AppConfig.UPLOAD_FOLDER)
        os.makedirs(upload_folder, exist_ok=True)
        
        # 절대 경로 사용
        file_path = os.path.join(upload_folder, unique_filename)
        
        logger.info(f"파일 저장 시도: 원본={original_filename}, 저장={filename} -> {file_path}")
        logger.info(f"업로드 폴더 상태: 존재={os.path.exists(upload_folder)}, 쓰기 권한={os.access(upload_folder, os.W_OK)}")
        
        file.save(file_path)
        logger.info(f"파일 저장 완료: {file_path}, 크기: {os.path.getsize(file_path)} 바이트")
        
        # 파일이 실제로 존재하는지 확인
        if not os.path.exists(file_path):
            logger.error(f"파일이 저장되지 않았습니다: {file_path}")
            return jsonify({
                'success': False,
                'error': '파일 저장에 실패했습니다.'
            }), 500
        
        # PDF 파일 처리
        if is_pdf:
            logger.info(f"PDF 파일 처리 시작: {file_path}, 모델: {selected_model}")
            
            # 선택된 모델에 따라 다르게 처리
            if selected_model == 'tesseract':
                # PDF를 이미지로 변환 후 Tesseract OCR 처리
                try:
                    logger.info(f"Tesseract OCR을 사용한 PDF 처리 시작: {file_path}")
                    images_folder = os.path.join(upload_folder, f"pdf_images_{timestamp}")
                    os.makedirs(images_folder, exist_ok=True)
                    
                    # PDF를 이미지로 변환
                    image_result = convert_pdf_to_images(file_path)
                    if not image_result['success']:
                        raise ValueError(f"PDF를 이미지로 변환할 수 없습니다: {image_result.get('error', '')}")
                    
                    image_paths = image_result['images']
                    if not image_paths:
                        raise ValueError("PDF를 이미지로 변환할 수 없습니다.")
                    
                    # 각 이미지에 OCR 적용
                    all_texts = []
                    for img_path in image_paths:
                        page_text = process_image(img_path, lang='auto')
                        all_texts.append(page_text)
                    
                    # 모든 페이지 텍스트 합치기
                    extracted_text = "\n\n--- 페이지 구분선 ---\n\n".join(all_texts)
                    model_used = 'tesseract'
                except Exception as e:
                    logger.error(f"Tesseract를 사용한 PDF 처리 실패: {str(e)}")
                    extracted_text = extract_text_from_pdf(file_path)  # 기본 방식으로 폴백
                    model_used = 'pdf_extract'
                    
                    # 딕셔너리 형태의 결과를 문자열로 변환
                    if isinstance(extracted_text, dict):
                        if 'success' in extracted_text and extracted_text['success'] and 'text' in extracted_text:
                            extracted_text = extracted_text['text']
                        else:
                            extracted_text = str(extracted_text)
            
            elif selected_model == 'gemini':
                # Gemini를 사용한 PDF 처리
                try:
                    logger.info(f"Gemini AI를 사용한 PDF 처리 시작: {file_path}")
                    timestamp = str(int(time.time() * 1000))  # timestamp 변수 정의
                    images_folder = os.path.join(upload_folder, f"pdf_images_{timestamp}")
                    os.makedirs(images_folder, exist_ok=True)
                    
                    # PDF를 이미지로 변환 - poppler_path 명시적 지정
                    poppler_path = "C:\\Program Files\\poppler\\Library\\bin"
                    
                    # 임시로 환경 변수에 poppler 경로 추가
                    os.environ['PATH'] = f"{poppler_path};{os.environ['PATH']}"
                    
                    # PDF Config에 Poppler 경로 명시적 설정
                    PDFConfig.POPPLER_PATH = poppler_path
                    
                    # 이미지 변환 옵션 지정
                    image_result = convert_pdf_to_images(file_path)
                    if not image_result['success']:
                        raise ValueError(f"PDF를 이미지로 변환할 수 없습니다: {image_result.get('error', '')}")
                    
                    image_paths = image_result['images']
                    if not image_paths:
                        raise ValueError("PDF를 이미지로 변환할 수 없습니다.")
                    
                    # 각 이미지에 Gemini OCR 적용
                    all_texts = []
                    for img_path in image_paths:
                        try:
                            page_text = extract_text_with_gemini(img_path)
                            all_texts.append(page_text)
                        except Exception as page_error:
                            logger.error(f"Gemini로 페이지 처리 실패: {str(page_error)}")
                            # 한 페이지 실패시 Tesseract로 시도
                            try:
                                page_text = process_image(img_path, lang='auto')
                                all_texts.append(page_text)
                            except:
                                all_texts.append(f"[이 페이지 텍스트 추출 실패]")
                    
                    # 모든 페이지 텍스트 합치기
                    extracted_text = "\n\n--- 페이지 구분선 ---\n\n".join(all_texts)
                    model_used = 'gemini'
                except Exception as e:
                    logger.error(f"Gemini를 사용한 PDF 처리 실패: {str(e)}")
                    extracted_text = extract_text_from_pdf(file_path)  # 기본 방식으로 폴백
                    model_used = 'pdf_extract'
                    
                    # 딕셔너리 형태의 결과를 문자열로 변환
                    if isinstance(extracted_text, dict):
                        if 'success' in extracted_text and extracted_text['success'] and 'text' in extracted_text:
                            extracted_text = extracted_text['text']
                        else:
                            extracted_text = str(extracted_text)
            
            else:  # pdf_extract 또는 기본
                # 기본 PDF 텍스트 추출 방식
                extracted_text = extract_text_from_pdf(file_path)
                model_used = 'pdf_extract'
            
            file_type = 'pdf'
            
            # 딕셔너리 형태의 결과를 문자열로 변환
            if isinstance(extracted_text, dict):
                if 'success' in extracted_text and extracted_text['success'] and 'text' in extracted_text:
                    text_content = extracted_text['text']
                else:
                    text_content = str(extracted_text)
            else:
                text_content = extracted_text
            
            # 데이터베이스에 저장
            extraction_id = save_extraction(
                user_id=user_id,
                filename=original_filename,
                extracted_text=text_content,
                file_path=file_path,
                language='auto',
                ocr_model=model_used,
                source_type='pdf',
                file_type=file_type
            )
            
            # 캐시 무효화 처리 - 새로운 추출 결과가 저장된 후
            cache_key = f"extractions_{user_id}"
            if 'extraction_cache' in globals() and cache_key in extraction_cache:
                del extraction_cache[cache_key]
                logger.info(f"사용자 '{user_id}'의 추출 이력 캐시 무효화됨 (PDF 추출 저장)")
            
            return jsonify({
                'success': True,
                'text': extracted_text,
                'extracted_text': extracted_text,
                'id': extraction_id,
                'file_type': file_type,
                'model': model_used,
                'source_type': 'pdf'
            })
            
        else:  # 이미지 파일 처리
            # 요청에서 언어 및 OCR 모델 설정 가져오기
            lang = request.form.get('language', 'auto')
            model = request.form.get('model', 'tesseract')
            
            # Tesseract 설치 여부 확인
            tesseract_installed, language_installed = False, False
            
            if model == 'tesseract' or model == 'auto':
                tesseract_installed, language_installed = check_tesseract_availability(lang if lang != 'auto' else OCRConfig.DEFAULT_LANG)
            
            # OCR 수행
            if model == 'gemini' or (model == 'auto' and AppConfig.GEMINI_API_KEY):
                # Gemini API 키가 설정되어 있으면 먼저 Gemini 사용
                try:
                    logger.info(f"Gemini API로 OCR 처리 시작: {file_path}")
                    # 파일 존재 여부 다시 확인
                    if not os.path.exists(file_path):
                        raise FileNotFoundError(f"파일을 찾을 수 없습니다: {file_path}")
                        
                    extracted_text = extract_text_with_gemini(file_path)
                    used_model = 'gemini'
                    logger.info(f"Gemini API로 텍스트 추출 완료: 텍스트 길이 {len(extracted_text)}")
                except Exception as e:
                    logger.error(f"Gemini API 처리 오류: {str(e)}")
                    if tesseract_installed:
                        # Gemini 실패 시 Tesseract로 폴백
                        logger.info(f"Tesseract로 폴백하여 OCR 처리 시작: {file_path}")
                        # 파일 존재 여부 다시 확인
                        if not os.path.exists(file_path):
                            raise FileNotFoundError(f"파일을 찾을 수 없습니다: {file_path}")
                            
                        extracted_text = process_image(file_path, lang if lang != 'auto' else None)
                        used_model = 'tesseract'
                        logger.info(f"Tesseract로 폴백하여 텍스트 추출 완료: 텍스트 길이 {len(extracted_text)}")
                    else:
                        return jsonify({
                            'success': False,
                            'error': f'Gemini API 처리 오류: {str(e)}',
                            'tesseract_installed': tesseract_installed
                        }), 500
            else:
                # Tesseract 사용
                logger.info(f"Tesseract로 OCR 처리 시작: {file_path}")
                # 파일 존재 여부 다시 확인
                if not os.path.exists(file_path):
                    raise FileNotFoundError(f"파일을 찾을 수 없습니다: {file_path}")
                    
                extracted_text = process_image(file_path, lang if lang != 'auto' else None)
                used_model = 'tesseract'
                logger.info(f"Tesseract로 텍스트 추출 완료: 텍스트 길이 {len(extracted_text)}")
            
            # 추출된 텍스트가 너무 짧으면 로그 기록
            if len(extracted_text.strip()) < 5:
                logger.warning(f"추출된 텍스트가 너무 짧습니다: '{extracted_text}', OCR 품질 문제 의심")
            
            # 파일 확장자로 파일 타입 결정
            file_ext = os.path.splitext(file_path)[1].lower()
            file_type = 'image'
            if file_ext in ['.jpg', '.jpeg']:
                file_type = 'jpg'
            elif file_ext in ['.png']:
                file_type = 'png'
            elif file_ext in ['.tif', '.tiff']:
                file_type = 'tiff'
            elif file_ext in ['.gif']:
                file_type = 'gif'
            elif file_ext in ['.bmp']:
                file_type = 'bmp'
            
            # 데이터베이스에 저장
            extraction_id = save_extraction(
                user_id=user_id,
                filename=original_filename,  # 원본 파일명 사용
                extracted_text=extracted_text,
                source_type='image',
                ocr_model=used_model,
                file_type=file_type
            )
            
            # 캐시 무효화 처리 - 새로운 추출 결과가 저장된 후
            cache_key = f"extractions_{user_id}"
            if 'extraction_cache' in globals() and cache_key in extraction_cache:
                del extraction_cache[cache_key]
                logger.info(f"사용자 '{user_id}'의 추출 이력 캐시 무효화됨 (이미지 OCR 추출 저장)")
            
            # 파일 URL 생성
            file_url = url_for('serve_file', filename=unique_filename, _external=True)
            
            logger.debug(f"추출된 텍스트 (처음 100자): {extracted_text[:100] if extracted_text else '(없음)'}")
            logger.info(f"추출 ID: {extraction_id}, 모델: {used_model}, 텍스트 길이: {len(extracted_text)}")
            
            # 결과 반환
            return jsonify({
                'success': True,
                'extracted_text': extracted_text,
                'id': extraction_id,
                'model': used_model,
                'file_url': file_url,
                'language': lang,
                'source_type': 'image',
                'file_type': file_type,
                'filename': original_filename
            })
            
    except Exception as e:
        logger.exception(f"텍스트 추출 중 오류 발생: {str(e)}")
        
        # 파일이 저장되었지만 처리에 실패한 경우, 해당 파일 삭제 시도
        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
                logger.info(f"처리 실패로 파일 삭제됨: {file_path}")
            except Exception as del_err:
                logger.error(f"처리 실패 후 파일 삭제 중 오류: {str(del_err)}")
        
        return jsonify({
            'success': False,
            'error': f'텍스트 추출 중 오류가 발생했습니다: {str(e)}'
        }), 500

@app.route('/api/extract/base64', methods=['POST'])
@login_required
def extract_base64():
    """Base64 인코딩된 이미지에서 텍스트를 추출하는 API"""
    logger.info("=== Base64 이미지 추출 API 호출 ===")
    
    try:
        data = request.json
        
        if not data or 'file_data' not in data:
            return jsonify({
                'success': False,
                'error': 'Base64 인코딩된 이미지 데이터가 없습니다.'
            }), 400
        
        # Base64 데이터 처리
        base64_data = data['file_data']
        if ',' in base64_data:
            # data:image/jpeg;base64, 부분 제거
            base64_data = base64_data.split(',', 1)[1]
        
        # 기타 파라미터 가져오기
        filename = data.get('filename', f"image_{uuid.uuid4()}.png")
        lang = data.get('language', 'auto')
        model = data.get('model', 'tesseract')
        
        # 파일명 보안 처리
        safe_filename = secure_filename(filename)
        unique_filename = f"{uuid.uuid4().hex}_{safe_filename}"
        file_path = os.path.join(AppConfig.UPLOAD_FOLDER, unique_filename)
        
        # 업로드 디렉토리 생성
        os.makedirs(AppConfig.UPLOAD_FOLDER, exist_ok=True)
        
        # Base64 데이터를 이미지로 변환하여 저장
        try:
            image_data = base64.b64decode(base64_data)
            image = Image.open(io.BytesIO(image_data))
            image.save(file_path)
            logger.info(f"Base64 이미지 저장 완료: {file_path}")
        except Exception as e:
            logger.error(f"Base64 이미지 변환 오류: {str(e)}")
            return jsonify({
                'success': False,
                'error': f'이미지 처리 중 오류가 발생했습니다: {str(e)}'
            }), 400
        
        # 세션에서 사용자 ID 가져오기
        user_id = session.get('user_id', ANONYMOUS_USER_ID)
        
        # Tesseract 설치 여부 확인
        tesseract_installed, language_installed = False, False
        
        if model == 'tesseract' or model == 'auto':
            tesseract_installed, language_installed = check_tesseract_availability(lang if lang != 'auto' else OCRConfig.DEFAULT_LANG)
        
        # OCR 수행
        if model == 'gemini' or (model == 'auto' and AppConfig.GEMINI_API_KEY):
            # Gemini API 키가 설정되어 있으면 먼저 Gemini 사용
            try:
                logger.info(f"Gemini API로 OCR 처리 시작: {file_path}")
                # 파일 존재 여부 다시 확인
                if not os.path.exists(file_path):
                    raise FileNotFoundError(f"파일을 찾을 수 없습니다: {file_path}")
                        
                extracted_text = extract_text_with_gemini(file_path)
                used_model = 'gemini'
                logger.info(f"Gemini API로 텍스트 추출 완료: 텍스트 길이 {len(extracted_text)}")
            except Exception as e:
                logger.error(f"Gemini API 처리 오류: {str(e)}")
                if tesseract_installed:
                    # Gemini 실패 시 Tesseract로 폴백
                    logger.info(f"Tesseract로 폴백하여 OCR 처리 시작: {file_path}")
                    # 파일 존재 여부 다시 확인
                    if not os.path.exists(file_path):
                        raise FileNotFoundError(f"파일을 찾을 수 없습니다: {file_path}")
                        
                    extracted_text = process_image(file_path, lang if lang != 'auto' else None)
                    used_model = 'tesseract'
                    logger.info(f"Tesseract로 폴백하여 텍스트 추출 완료: 텍스트 길이 {len(extracted_text)}")
                else:
                    return jsonify({
                        'success': False,
                        'error': f'Gemini API 처리 오류: {str(e)}',
                        'tesseract_installed': tesseract_installed
                    }), 500
        else:
            # Tesseract 사용
            logger.info(f"Tesseract로 OCR 처리 시작: {file_path}")
            # 파일 존재 여부 다시 확인
            if not os.path.exists(file_path):
                raise FileNotFoundError(f"파일을 찾을 수 없습니다: {file_path}")
                
            extracted_text = process_image(file_path, lang if lang != 'auto' else None)
            used_model = 'tesseract'
            logger.info(f"Tesseract로 텍스트 추출 완료: 텍스트 길이 {len(extracted_text)}")
        
        # 추출된 텍스트가 너무 짧으면 로그 기록
        if len(extracted_text.strip()) < 5:
            logger.warning(f"추출된 텍스트가 너무 짧습니다: '{extracted_text}', OCR 품질 문제 의심")
        
        # 파일 확장자로 파일 타입 결정
        file_ext = os.path.splitext(file_path)[1].lower()
        file_type = 'image'
        if file_ext in ['.jpg', '.jpeg']:
            file_type = 'jpg'
        elif file_ext in ['.png']:
            file_type = 'png'
        elif file_ext in ['.tif', '.tiff']:
            file_type = 'tiff'
        elif file_ext in ['.gif']:
            file_type = 'gif'
        elif file_ext in ['.bmp']:
            file_type = 'bmp'
        
        # 데이터베이스에 저장
        extraction_id = save_extraction(
            user_id=user_id,
            filename=safe_filename,
            extracted_text=extracted_text,
            source_type='image',
            ocr_model=used_model,
            file_type=file_type
        )
        
        # 캐시 무효화 처리 - 새로운 추출 결과가 저장된 후
        cache_key = f"extractions_{user_id}"
        if cache_key in extraction_cache:
            del extraction_cache[cache_key]
            logger.info(f"사용자 '{user_id}'의 추출 이력 캐시 무효화됨 (Base64 이미지 추출 저장)")
        
        # 개선된 ID 타입 로깅 - 더 간결하게
        logger.debug(f"추출 ID 반환 타입: {type(extraction_id)}, 값: {extraction_id}")
        
        # 추출 ID가 완전히 유효하지 않은 경우 처리
        if extraction_id is None:
            logger.error("추출 ID가 None입니다. 저장 과정에서 오류가 발생했을 수 있습니다.")
            return jsonify({
                'success': False,
                'error': '추출 결과를 저장하는 중 오류가 발생했습니다.'
            }), 500
        
        # 파일 URL 생성
        file_url = url_for('serve_file', filename=unique_filename, _external=True)
        
        # 추출된 텍스트 로깅 (개발 디버깅용)
        logger.debug(f"추출된 텍스트 (처음 100자): {extracted_text[:100] if extracted_text else '(없음)'}")
        logger.info(f"추출 ID: {extraction_id}, 모델: {used_model}, 텍스트 길이: {len(extracted_text)}")
        
        try:
            # 응답 생성 - 명시적인 숫자 ID로 반환 (안전하게 변환)
            id_value = 0
            
            # ID 처리 로직 개선
            def safe_int_conversion(value):
                """값을 안전하게 정수로 변환"""
                if value is None:
                    return 0
                    
                if isinstance(value, int):
                    return value
                    
                if isinstance(value, dict) and 'id' in value:
                    return safe_int_conversion(value['id'])
                    
                if isinstance(value, list) and value:
                    return safe_int_conversion(value[0])
                    
                try:
                    return int(value)
                except (ValueError, TypeError) as e:
                    logger.warning(f"값을 정수로 변환할 수 없습니다: {value}, 타입: {type(value)}, 오류: {str(e)}")
                    return 0
            
            # 안전한 변환 함수 사용
            id_value = safe_int_conversion(extraction_id)
            
            logger.info(f"최종 ID 값: {id_value} (타입: {type(id_value)})")
            
            return jsonify({
                'success': True,
                'text': extracted_text,
                'extracted_text': extracted_text,
                'image_url': file_url,
                'id': id_value,
                'model': used_model,
                'tesseract_installed': tesseract_installed,
                'language_installed': language_installed
            })
        except Exception as e:
            logger.error(f"JSON 응답 생성 중 오류: {str(e)}")
            return jsonify({
                'success': False,
                'error': f'응답 생성 중 오류가 발생했습니다: {str(e)}'
            }), 500
        
    except Exception as e:
        logger.error(f"Base64 이미지 처리 중 오류: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'텍스트 추출 중 오류가 발생했습니다: {str(e)}',
            'tesseract_installed': hasattr(pytesseract.pytesseract, 'tesseract_cmd') and os.path.exists(pytesseract.pytesseract.tesseract_cmd)
        }), 500

@app.route('/api/text/<int:text_id>', methods=['GET', 'PUT'])
@login_required
def manage_text(text_id):
    current_user = get_current_user()
    
    if not current_user:
        return jsonify({"error": "인증이 필요합니다."}), 401
    
    user_id = get_user_id(current_user)
    
    # 캐시 무효화 파라미터 확인
    invalidate_cache = request.args.get('invalidate_cache', 'false').lower() == 'true'
    if invalidate_cache and user_id:
        # 캐시 무효화 로직
        cache_key = f"extractions_{user_id}"
        if cache_key in extraction_cache:
            del extraction_cache[cache_key]
            logger.info(f"사용자 '{user_id}'의 추출 이력 캐시 무효화됨")
    
    if request.method == 'GET':
        try:
            extraction = get_extraction_by_id(text_id)
            
            if not extraction:
                return jsonify({
                    "success": False,
                    "error": "요청한 추출 정보를 찾을 수 없습니다."
                }), 404
            
            return jsonify({
                "success": True,
                "data": extraction
            }), 200
            
        except Exception as e:
            logger.error(f"텍스트 조회 중 오류: {str(e)}")
            return jsonify({
                "success": False,
                "error": "텍스트 조회 중 오류가 발생했습니다."
            }), 500
    
    elif request.method == 'PUT':
        try:
            data = request.get_json()
            
            if not data or 'text' not in data:
                return jsonify({
                    "success": False,
                    "error": "업데이트할 텍스트가 제공되지 않았습니다."
                }), 400
            
            text = data['text']
            
            success = update_extraction_text(text_id, text)
            
            if success:
                # 텍스트 업데이트 후 항상 캐시 무효화
                cache_key = f"extractions_{user_id}"
                if cache_key in extraction_cache:
                    del extraction_cache[cache_key]
                    logger.info(f"텍스트 업데이트 후 사용자 '{user_id}'의 추출 이력 캐시 무효화됨")
                
                return jsonify({
                    "success": True,
                    "message": "텍스트가 성공적으로 업데이트되었습니다."
                }), 200
            else:
                return jsonify({
                    "success": False,
                    "error": "텍스트 업데이트에 실패했습니다."
                }), 500
                
        except Exception as e:
            logger.error(f"텍스트 업데이트 중 오류: {str(e)}")
            return jsonify({
                "success": False,
                "error": "텍스트 업데이트 중 오류가 발생했습니다."
            }), 500

extraction_cache = {}
CACHE_TIMEOUT = 10

def get_user_id(user):
    if isinstance(user, dict):
        return user.get('id')
    elif hasattr(user, 'id'):
        return user.id
    else:
        return str(user)

@app.route('/api/extractions', methods=['GET'])
@login_required
def get_extractions_route():
    """사용자의 추출 이력 목록을 반환하는 API (JWT 검증 추가)"""
    # 제거: logger.critical("!!!!!! /api/extractions 핸들러 진입 확인 !!!!!!")
    
    user_id = None
    token = None
    auth_header = request.headers.get('Authorization')
    user_email_header = request.headers.get('X-User-Email') # 참고용으로 로깅

    # 줄임: 요청 헤더 전체 로깅 대신 필요 정보만
    logger.info(f"/api/extractions 호출: {request.remote_addr}")

    if auth_header and auth_header.startswith('Bearer '):
        token = auth_header.split(' ')[1]
    else:
        logger.warning("Authorization 헤더가 없거나 'Bearer ' 형식이 아님")
        # 토큰이 없어도 익명 사용 허용 시 아래 로직으로 넘어갈 수 있음
        # return jsonify({'success': False, 'error': '인증 토큰이 필요합니다.'}), 401

    if token:
        try:
            payload = jwt.decode(
                token,
                AppConfig.JWT_SECRET_KEY,
                algorithms=[AppConfig.JWT_ALGORITHM]
            )
            user_id = payload.get('user_id')
            user_email_token = payload.get('email')
            logger.info(f"JWT 검증 성공: user_id={user_id}")

        except ExpiredSignatureError:
            logger.warning("JWT 토큰 만료됨")
            return jsonify({'success': False, 'error': '세션이 만료되었습니다. 다시 로그인해주세요.', 'code': 'TOKEN_EXPIRED'}), 401
        except InvalidTokenError as e:
            logger.error(f"잘못된 JWT 토큰: {e}")
            return jsonify({'success': False, 'error': '잘못된 인증 정보입니다.', 'code': 'INVALID_TOKEN'}), 401
        except Exception as e:
            logger.error(f"JWT 검증 중 알 수 없는 오류: {e}", exc_info=True)
            return jsonify({'success': False, 'error': '인증 처리 중 오류가 발생했습니다.'}), 500
    # --- 사용자 ID 최종 확인 ---
    if not user_id:
        logger.error("최종 인증 실패, user_id 없음")
        return jsonify({'success': False, 'error': '로그인이 필요합니다.'}), 401
    else:
        try:
            user_id_int = int(user_id)
            # 제거: logger.info(f"user_id를 정수로 변환: 원본='{user_id}', 변환 후={user_id_int} (타입: {type(user_id_int)})")
            user_id = user_id_int
        except ValueError:
            logger.error(f"user_id '{user_id}'를 정수로 변환할 수 없습니다.")
            return jsonify({'success': False, 'error': '잘못된 사용자 ID 형식입니다.'}), 400
        

    # 제거: logger.info(f"추출 이력 조회 요청 시작: user_id={user_id} (타입: {type(user_id)})")

    try:
        # 데이터베이스에서 데이터 조회
        extractions_data: List[Dict[str, Any]] = get_user_extractions(user_id)
        # 줄임: 상세한 로그 대신 개수만 로깅
        logger.info(f"추출 이력 조회 결과: {len(extractions_data)}개 항목")

        # --- 수정: 데이터 가공 로직 (임시로 조회된 데이터를 그대로 사용) ---
        # 이 부분에 날짜 형식 변환 등 필요한 가공 로직 추가 가능
        formatted_data = extractions_data # 조회된 데이터를 그대로 formatted_data에 할당
        # 예시: 날짜 필드를 ISO 형식 문자열로 변환하는 경우
        # formatted_data = []
        # for item in extractions_data:
        #     new_item = item.copy()
        #     if 'created_at' in new_item and isinstance(new_item['created_at'], datetime):
        #         new_item['created_at'] = new_item['created_at'].isoformat()
        #     if 'updated_at' in new_item and isinstance(new_item['updated_at'], datetime):
        #         new_item['updated_at'] = new_item['updated_at'].isoformat()
        #     formatted_data.append(new_item)
        # --- 데이터 가공 로직 끝 ---

        # 제거: logger.info(f"데이터 가공 완료, 최종 {len(formatted_data)}개 데이터 반환 예정.")
        return jsonify({'success': True, 'data': formatted_data}) # 가공된 데이터 반환

    except Exception as e:
        logger.error(f"추출 이력 조회 API 처리 중 오류 발생 (user_id: {user_id}): {str(e)}", exc_info=True)
        return jsonify({'success': False, 'error': '추출 이력 조회 중 오류가 발생했습니다.'}), 500

@app.route('/uploads/<filename>', methods=['GET'])
def serve_file(filename):
    try:
        safe_path = os.path.normpath(filename)
        if ".." in safe_path or safe_path.startswith(os.sep):
            return jsonify({
                "error": "잘못된 파일 경로입니다"
            }), 400
            
        return send_from_directory(app.config['UPLOAD_FOLDER'], safe_path)
        
    except FileNotFoundError:
        return jsonify({
            "error": "파일을 찾을 수 없습니다"
        }), 404
    except Exception as e:
        logger.error(f"파일 제공 중 오류: {str(e)}")
        return jsonify({
            "error": "파일 제공 중 오류가 발생했습니다"
        }), 500


@app.route('/api/extractions/<int:extraction_id>/filename', methods=['PUT'])
@login_required
def update_extraction_filename_route(extraction_id):
    """추출 정보의 파일명을 업데이트하는 API"""
    logger.info(f"PUT /api/extractions/{extraction_id}/filename 요청 시작")

    # 1. JWT 토큰 검증 및 사용자 ID 가져오기
    user_id = None
    user_email = None
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            raise InvalidTokenError("Authorization 헤더가 없거나 Bearer 형식이 아님")
        token = auth_header.split(' ')[1]
        payload = jwt.decode(token, AppConfig.JWT_SECRET_KEY, algorithms=[AppConfig.JWT_ALGORITHM])
        user_id = payload.get('user_id')
        user_email = payload.get('email')
        if not user_id:
            raise InvalidTokenError("JWT 페이로드에 user_id 없음")
        user_id = int(user_id)
        logger.info(f"JWT 검증 완료: user_id={user_id}, email={user_email}")
    except ExpiredSignatureError:
        logger.warning(f"JWT 토큰 만료됨 (요청: PUT /api/extractions/{extraction_id}/filename)")
        return jsonify({'success': False, 'error': '세션이 만료되었습니다. 다시 로그인해주세요.', 'code': 'TOKEN_EXPIRED'}), 401
    except (InvalidTokenError, ValueError, Exception) as e:
        logger.error(f"JWT 검증 또는 사용자 ID 변환 실패 (요청: PUT /api/extractions/{extraction_id}/filename): {e}")
        return jsonify({'success': False, 'error': '인증 실패 또는 잘못된 요청입니다.', 'code': 'AUTH_FAILED'}), 401

    # 2. 요청 본문에서 새 파일명 가져오기
    data = request.get_json()
    if not data or 'filename' not in data or not isinstance(data['filename'], str):
        return jsonify({'success': False, 'error': '변경할 파일명을 올바른 형식으로 제공해야 합니다.'}), 400
    new_filename = data['filename'].strip()
    if not new_filename:
         return jsonify({'success': False, 'error': '파일명은 비워둘 수 없습니다.'}), 400

    # 3. 해당 추출 내역이 현재 사용자의 것인지 확인 (보안 강화)
    existing_extraction = None # 핸들러 범위에서 사용하기 위해 초기화
    try:
        existing_extraction = get_extraction_by_id(extraction_id)
        if not existing_extraction:
            return jsonify({'success': False, 'error': '해당 추출 내역을 찾을 수 없습니다.'}), 404
        db_user_id_str = str(existing_extraction.get('user_id'))
        request_user_id_str = str(user_id)
        if db_user_id_str != request_user_id_str:
            return jsonify({'success': False, 'error': '자신의 추출 내역만 수정할 수 있습니다.'}), 403
    except Exception as e:
        logger.error(f"추출 내역 소유권 확인 중 오류 (ID: {extraction_id}): {str(e)}")
        return jsonify({'success': False, 'error': '소유권 확인 중 오류 발생'}), 500

    # 4. 데이터베이스 업데이트 함수 호출
    try:
        success = update_extraction_filename(extraction_id, new_filename)
        
        if success:
            # 파일명 업데이트 성공
            cache_key = f"extractions_{user_id}"
            if cache_key in extraction_cache:
                del extraction_cache[cache_key]
                logger.info(f"파일명 업데이트 후 사용자 {user_id}의 추출 이력 캐시 무효화됨")
            return jsonify({'success': True, 'message': '파일명이 성공적으로 변경되었습니다.'}), 200
        else:
            # 업데이트 실패 또는 변경 없음 (affected_rows == 0)
            logger.warning(f"update_extraction_filename 함수가 False 반환 (ID: {extraction_id})")
            # 원본 파일명과 비교하여 실제 변경이 없었는지 확인
            if existing_extraction and existing_extraction.get('filename') == new_filename:
                logger.info(f"파일명 변경 없음 (ID: {extraction_id}, 파일명: '{new_filename}') - 성공으로 간주")
                # 캐시 무효화는 필요 없을 수 있으나, 일관성을 위해 수행 가능
                # cache_key = f"extractions_{user_id}"
                # if cache_key in extraction_cache: del extraction_cache[cache_key]
                return jsonify({'success': True, 'message': '파일명이 이미 해당 이름입니다.'}), 200 # 200 OK 또는 304 Not Modified
            else:
                # 실제 DB 업데이트 실패 (ID는 존재했으나 업데이트 안됨)
                logger.error(f"DB 파일명 업데이트 실패 추정 (ID: {extraction_id}, 원본: '{existing_extraction.get('filename')}', 시도: '{new_filename}')")
                return jsonify({'success': False, 'error': '파일명 변경 중 데이터베이스 오류가 발생했습니다.'}), 500 # 500 또는 400

    except Exception as e:
        logger.error(f"파일명 업데이트 처리 중 오류 발생 (ID: {extraction_id}): {str(e)}", exc_info=True)
        return jsonify({'success': False, 'error': '파일명 업데이트 중 서버 오류가 발생했습니다.'}), 500

@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({
        'success': False,
        'error': f'파일 크기가 너무 큽니다. 최대 허용 크기: {AppConfig.MAX_CONTENT_LENGTH / (1024 * 1024)}MB'
    }), 413


@app.route('/api/extractions/<extraction_id>', methods=['DELETE'])
@login_required
def delete_extraction_record(extraction_id):
    try:
        success = delete_extraction(extraction_id)
        
        if success:
            logger.info(f"추출 ID {extraction_id} 삭제 성공")
            return jsonify({
                'success': True,
                'message': '추출 정보가 성공적으로 삭제되었습니다.'
            })
        else:
            logger.warning(f"추출 ID {extraction_id} 삭제 실패")
            return jsonify({
                'success': False,
                'error': '추출 정보 삭제 실패',
                'message': '해당 ID의 추출 정보를 찾을 수 없거나 삭제할 수 없습니다.'
            }), 404
    except Exception as e:
        logger.error(f"추출 삭제 중 오류 발생: {str(e)}")
        return jsonify({
            'success': False,
            'error': '서버 오류',
            'message': f'추출 정보 삭제 중 오류가 발생했습니다: {str(e)}'
        }), 500

@app.route('/api/extractions/bookmark/<int:extraction_id>', methods=['PUT', 'POST', 'OPTIONS'])
def toggle_bookmark(extraction_id):
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Methods', 'PUT, POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        response.headers.add('Access-Control-Allow-Origin', request.headers.get('Origin', '*'))
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response
        
    # OPTIONS 요청이 아닌 경우에만 로그인 체크
    token = get_auth_token()
    if not token:
        logger.warning("인증 실패: JWT 토큰이 없습니다")
        return jsonify({'success': False, 'error': '로그인이 필요합니다.'}), 401
        
    try:
        # JWT 토큰 디코딩 및 검증
        payload = jwt.decode(token, AppConfig.JWT_SECRET_KEY, algorithms=[AppConfig.JWT_ALGORITHM])
        user_id = payload.get('user_id')
        if not user_id:
            logger.warning("JWT 토큰 유효하지만 user_id가 없습니다")
            return jsonify({'success': False, 'error': '유효하지 않은 인증 정보입니다.'}), 401
            
        # 여기서 user_id를 request 객체에 저장하여 다른 함수에서 사용할 수 있게 함
        request.user_id = user_id
            
        # 토글 로직 실행
        try:
            success = toggle_extraction_bookmark(extraction_id)
            
            if success:
                # 북마크 상태 가져오기
                extraction = get_extraction_by_id(extraction_id)
                is_bookmarked = extraction.get('is_bookmarked', 0) == 1
                
                logger.info(f"추출 ID {extraction_id} 북마크 토글 성공: {is_bookmarked}")
                return jsonify({
                    'success': True,
                    'message': '북마크 상태가 성공적으로 변경되었습니다.',
                    'data': {
                        'is_bookmarked': is_bookmarked
                    }
                })
            else:
                logger.warning(f"추출 ID {extraction_id} 북마크 토글 실패")
                return jsonify({
                    'success': False,
                    'error': '북마크 상태 변경 실패',
                    'message': '해당 ID의 추출 정보를 찾을 수 없거나 업데이트할 수 없습니다.'
                }), 404
        except Exception as e:
            logger.error(f"북마크 토글 중 오류 발생: {str(e)}")
            return jsonify({
                'success': False,
                'error': '서버 오류',
                'message': f'북마크 상태 변경 중 오류가 발생했습니다: {str(e)}'
            }), 500
    except ExpiredSignatureError:
        logger.warning("만료된 JWT 토큰")
        return jsonify({'success': False, 'error': '세션이 만료되었습니다. 다시 로그인해주세요.', 'code': 'TOKEN_EXPIRED'}), 401
    except InvalidTokenError as e:
        logger.warning(f"유효하지 않은 JWT 토큰: {str(e)}")
        return jsonify({'success': False, 'error': '유효하지 않은 인증 정보입니다.'}), 401

def check_tesseract_korean_support():
    try:
        output = subprocess.check_output(
            [pytesseract.pytesseract.tesseract_cmd, '--list-langs'], 
            stderr=subprocess.STDOUT,
            universal_newlines=True
        )
        
        languages = output.strip().split('\n')
        
        if len(languages) > 1:
            languages = languages[1:]
            
        return 'kor' in languages
        
    except Exception as e:
        logger.error(f"Tesseract 언어 확인 중 오류: {str(e)}")
        return False

if AppConfig.TESSERACT_PATH:
    pytesseract.pytesseract.tesseract_cmd = AppConfig.TESSERACT_PATH
    has_korean_support = check_tesseract_korean_support()
    if not has_korean_support:
        logger.warning("Tesseract에 한국어 언어 팩이 설치되어 있지 않아 OCR 품질이 저하될 수 있습니다.")

@app.errorhandler(Exception)
def handle_exception(e):
    if isinstance(e, BadRequest):
        return jsonify({"success": False, "error": str(e)}), 400
    elif isinstance(e, Unauthorized):
        return jsonify({"success": False, "error": str(e)}), 401
    elif isinstance(e, NotFound):
        return jsonify({"success": False, "error": str(e)}), 404
    elif isinstance(e, InternalServerError):
        return jsonify({"success": False, "error": "서버 내부 오류가 발생했습니다"}), 500
    
    logger.exception("예상치 못한 오류 발생")
    return jsonify({
        "success": False,
        "error": "서버 오류가 발생했습니다",
        "message": str(e) if os.environ.get('FLASK_ENV') == 'development' else None
    }), 500

@app.errorhandler(404)
def not_found(e):
    return jsonify({
        "success": False,
        "error": "요청하신 리소스를 찾을 수 없습니다"
    }), 404

@app.route('/api/auth/login', methods=['POST'])
def login():
    """사용자 로그인 및 JWT 발급 API"""
    data = request.json
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({'success': False, 'error': '이메일과 비밀번호를 입력해주세요.'}), 400

    # 데이터베이스에서 사용자 인증 시도
    user = authenticate_user(email, password) # 이 함수는 사용자 정보를 담은 dict 또는 None 반환 가정

    if user:
        # 로그인 성공: JWT 생성
        try:
            # 토큰 만료 시간 설정
            expiration = datetime.now(timezone.utc) + timedelta(minutes=AppConfig.JWT_EXPIRATION_MINUTES)

            # 토큰에 포함될 정보
            payload = {
                'user_id': str(user.get('id')),
                'email': user.get('email'),
                'exp': expiration,
                'name': user.get('name', ''),
                'username': user.get('username', '')
            }

            # JWT 생성
            token = jwt.encode(payload, AppConfig.JWT_SECRET_KEY, algorithm=AppConfig.JWT_ALGORITHM)
            logger.info(f"로그인 성공 및 JWT 발급: email={email}, user_id={payload['user_id']}")
            
            # 사용자 정보와 함께 토큰 반환 (프론트엔드에서 저장하여 사용)
            return jsonify({
                'success': True,
                'message': '로그인 성공',
                'token': token, # 생성된 JWT
                'user': { # 필요한 사용자 정보만 선별하여 반환
                    'id': str(user.get('id')),
                    'email': user.get('email'),
                    'name': user.get('name', ''), # 이름이 없을 경우 대비
                    'username': user.get('username', '') # 아이디가 없을 경우 대비
                }
            })
        except Exception as e:
             logger.error(f"JWT 생성 오류: {e}", exc_info=True)
             return jsonify({'success': False, 'error': '로그인 처리 중 오류가 발생했습니다.'}), 500

    else:
        # 로그인 실패
        logger.warning(f"로그인 실패: email={email}")
        return jsonify({'success': False, 'error': '이메일 또는 비밀번호가 올바르지 않습니다.'}), 401

@app.route('/api/auth/register', methods=['POST'])
def register():
    try:
        data = request.json
        if not data or 'email' not in data or 'password' not in data:
            return jsonify({
                "success": False,
                "error": "이메일과 비밀번호를 제공해주세요"
            }), 400
            
        email = data['email']
        password = data['password']
        role = data.get('role', 'user')
        
        existing_user = get_user_by_email(email)
        if existing_user:
            return jsonify({
                "success": False,
                "error": "이미 등록된 이메일입니다"
            }), 409
            
        user = create_user(email, password, role)
        
        if not user:
            return jsonify({
                "success": False,
                "error": "사용자 생성 중 오류가 발생했습니다"
            }), 500
            
        user_data = {k: v for k, v in user.items() if k != 'password_hash'}
        
        return jsonify({
            "success": True,
            "data": user_data
        }), 201
        
    except Exception as e:
        logger.error(f"회원가입 중 오류: {str(e)}")
        return jsonify({
            "success": False,
            "error": "회원가입 처리 중 오류가 발생했습니다"
        }), 500

@app.route('/api/auth/reset_password_request', methods=['POST'])
def reset_password_request():
    try:
        data = request.get_json()
        if not data or 'email' not in data:
            return jsonify({'success': False, 'error': '이메일을 입력해주세요.'}), 400
        
        email = data['email']
        logger.info(f"비밀번호 재설정 요청: {email}")
        
        user = get_user_by_email(email)
        if not user:
            # 사용자가 없더라도 성공 메시지를 반환하여 이메일 존재 여부 노출 방지
            logger.info(f"존재하지 않는 이메일로 재설정 요청: {email}")
            return jsonify({'success': True, 'message': '비밀번호 재설정 안내가 이메일로 발송되었습니다.'}), 200
        
        # 임시 비밀번호 생성 (더 안전한 방법 사용 권장: 예: URL 토큰)
        temp_password = ''.join(secrets.choice('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') for _ in range(10)) # 길이 10으로 증가
        
        from werkzeug.security import generate_password_hash
        password_hash = generate_password_hash(temp_password)
        
        # 개발 환경에서는 임시 비밀번호 로깅 (실제 운영 환경에서는 제거 필요)
        if os.environ.get('FLASK_ENV') == 'development':
            logger.info(f"개발 환경 - 생성된 임시 비밀번호: {temp_password} (사용자: {email})")
        
        # 데이터베이스에 임시 비밀번호 해시 업데이트
        # UPDATE_USER_PASSWORD 쿼리가 password_hash와 user_id를 받는지 확인 필요
        success = execute_update(
            UPDATE_USER_PASSWORD, # 이 쿼리가 정확한지 확인 필요
            {'password_hash': password_hash, 'user_id': user['id']} # user_id 키 이름 확인 필요 ('id'가 맞는지)
        )
        
        if not success:
            logger.error(f"DB 비밀번호 업데이트 실패 - 사용자 ID: {user.get('id', 'N/A')}") # user 딕셔너리 키 확인
            return jsonify({'success': False, 'error': '비밀번호 업데이트 중 오류가 발생했습니다.'}), 500
        
        # 이메일 발송 로직 호출
        email_sent = send_password_reset_email(email, temp_password)
        
        if not email_sent:
            logger.warning(f"임시 비밀번호 이메일 전송 실패 - 사용자: {email}")
            # 개발 환경에서는 계속 임시 비밀번호 로깅 (운영에서는 제거)
            if os.environ.get('FLASK_ENV') == 'development':
                logger.info(f"개발 환경 - 이메일 발송 실패, 임시 비밀번호: {temp_password}")
        
        # 이메일 발송 성공 여부와 관계없이 사용자에게는 동일한 메시지 반환
        return jsonify({'success': True, 'message': '비밀번호 재설정 안내가 이메일로 발송되었습니다.'}), 200
            
    except Exception as e:
        logger.error(f"비밀번호 재설정 처리 오류: {str(e)}", exc_info=True) # exc_info=True 추가
        return jsonify({'success': False, 'error': '서버 오류가 발생했습니다.'}), 500

@app.route('/api/auth/delete_account', methods=['DELETE'])
def delete_user_account():
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'error': '인증 오류가 발생했습니다.'}), 401
        
        user_id = user['id']
        
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            
            cursor.execute(
                """
                DELETE FROM 
                    extractions 
                WHERE 
                    user_id = :user_id
                """,
                {'user_id': user_id}
            )
            
            cursor.execute(
                """
                DELETE FROM 
                    password_reset_tokens 
                WHERE 
                    user_id = :user_id
                """,
                {'user_id': user_id}
            )
            
            cursor.execute(
                """
                DELETE FROM 
                    users 
                WHERE 
                    id = :user_id
                """,
                {'user_id': user_id}
            )
            
            conn.commit()
            
            if 'user_id' in request.cookies:
                response = jsonify({'success': True, 'message': '계정이 성공적으로 삭제되었습니다.'})
                response.delete_cookie('user_id')
                return response, 200
            
            return jsonify({'success': True, 'message': '계정이 성공적으로 삭제되었습니다.'}), 200
            
        except cx_Oracle.Error as e:
            conn.rollback()
            logger.error(f"계정 삭제 중 데이터베이스 오류: {str(e)}")
            return jsonify({'success': False, 'error': '서버 오류가 발생했습니다.'}), 500
        finally:
            if conn:
                conn.close()
                
    except Exception as e:
        logger.error(f"계정 삭제 처리 중 오류: {str(e)}")
        return jsonify({'success': False, 'error': '서버 오류가 발생했습니다.'}), 500

@app.route('/api/auth/change_password', methods=['POST'])
def change_password():
    # --- JWT 토큰 검증 로직 추가 ---
    token = None
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        token = auth_header.split(' ')[1]

    if not token:
        logger.warning("비밀번호 변경: 토큰 없음")
        return jsonify({'success': False, 'error': '인증 토큰이 필요합니다.'}), 401

    try:
        payload = jwt.decode(
            token,
            AppConfig.JWT_SECRET_KEY,
            algorithms=[AppConfig.JWT_ALGORITHM]
        )
        user_id = payload.get('user_id')
        user_email = payload.get('email') # 토큰에서 이메일 가져오기

        if not user_id or not user_email:
             logger.error("비밀번호 변경: 토큰에 user_id 또는 email 없음")
             return jsonify({'success': False, 'error': '잘못된 인증 토큰입니다.'}), 401
        logger.info(f"비밀번호 변경 요청 인가됨: user_id={user_id}")

    except ExpiredSignatureError:
        logger.warning("비밀번호 변경: JWT 토큰 만료됨")
        return jsonify({'success': False, 'error': '세션이 만료되었습니다. 다시 로그인해주세요.', 'code': 'TOKEN_EXPIRED'}), 401
    except InvalidTokenError as e:
        logger.error(f"비밀번호 변경: 잘못된 JWT 토큰: {e}")
        return jsonify({'success': False, 'error': '잘못된 인증 정보입니다.', 'code': 'INVALID_TOKEN'}), 401
    except Exception as e:
        logger.error(f"비밀번호 변경: JWT 검증 중 알 수 없는 오류: {e}", exc_info=True)
        return jsonify({'success': False, 'error': '인증 처리 중 오류가 발생했습니다.'}), 500
    # --- JWT 토큰 검증 로직 끝 ---

    try:
        # user_id = session.get('user_id') # 세션 대신 토큰에서 가져온 user_id 사용
        # user_email = session.get('user_email') # 세션 대신 토큰에서 가져온 user_email 사용

        # if not user_id or not user_email: # 이미 위에서 검증함
        #     logger.error("세션에 사용자 정보가 없음") # 이 로그는 이제 발생하지 않음
        #     return jsonify({'success': False, 'error': '로그인이 필요합니다.'}), 401

        data = request.get_json()
        if not data or 'current_password' not in data or 'new_password' not in data:
            return jsonify({'success': False, 'error': '필수 항목(현재 비밀번호, 새 비밀번호)이 누락되었습니다.'}), 400

        current_password = data['current_password']
        new_password = data['new_password']

        # 사용자 정보 조회 (토큰의 email 사용)
        user = get_user_by_email(user_email)

        if not user:
            logger.error(f"사용자 정보를 찾을 수 없음 (토큰 기준): email={user_email}")
            # 토큰이 유효했으나 DB에 사용자가 없는 경우 (계정 삭제 등)
            return jsonify({'success': False, 'error': '사용자 계정을 찾을 수 없습니다.'}), 404 # 404 Not Found가 더 적절할 수 있음

        # 현재 비밀번호 확인
        if 'password_hash' not in user or not user['password_hash']:
             logger.error(f"사용자 DB 정보에 password_hash 없음: user_id={user_id}")
             return jsonify({'success': False, 'error': '사용자 정보 오류입니다. 관리자에게 문의하세요.'}), 500

        if not check_password_hash(user['password_hash'], current_password):
            logger.warning(f"현재 비밀번호 불일치: user_id={user_id}")
            return jsonify({'success': False, 'error': '현재 비밀번호가 일치하지 않습니다.'}), 400

        # 새 비밀번호 해싱 및 업데이트
        new_password_hash = generate_password_hash(new_password)
        success = update_password(user_id, new_password_hash) # update_password 함수가 user_id와 해시된 비밀번호를 받는지 확인

        if not success:
            logger.error(f"DB 비밀번호 업데이트 실패: user_id={user_id}")
            return jsonify({'success': False, 'error': '비밀번호 변경 처리 중 오류가 발생했습니다.'}), 500

        logger.info(f"비밀번호 변경 성공: user_id={user_id}")
        return jsonify({'success': True, 'message': '비밀번호가 성공적으로 변경되었습니다.'}), 200

    except Exception as e:
        logger.exception(f"비밀번호 변경 처리 중 예외 발생: {str(e)}")
        return jsonify({'success': False, 'error': '비밀번호 변경 중 서버 오류가 발생했습니다.'}), 500

@app.route('/api/summarize', methods=['POST'])
def summarize_text_api():
    try:
        request_data = request.get_json()
        
        if not request_data or 'text' not in request_data:
            return jsonify({
                "success": False,
                "error": "요약할 텍스트가 제공되지 않았습니다."
            }), 400
        
        text = request_data.get('text', '')
        engine = request_data.get('engine', 'gemini')
        max_length = request_data.get('maxLength', SummarizationConfig.HF_MAX_LENGTH)
        min_length = request_data.get('min_length', SummarizationConfig.HF_MIN_LENGTH)
        style = request_data.get('style', 'concise')
        
        if not text or len(text.strip()) < 100:
            return jsonify({
                "success": False,
                "error": "요약할 텍스트가 너무 짧습니다. 최소 100자 이상이어야 합니다."
            }), 400
        
        if len(text) > SummarizationConfig.MAX_TEXT_LENGTH:
            logger.warning(f"텍스트가 너무 깁니다 ({len(text)} 문자). 처음 {SummarizationConfig.MAX_TEXT_LENGTH} 문자만 요약합니다.")
            text = text[:SummarizationConfig.MAX_TEXT_LENGTH]
        
        if engine not in ['gemini', 'huggingface']:
            return jsonify({
                "success": False,
                "error": "지원되지 않는 요약 엔진입니다. 'gemini' 또는 'huggingface'를 사용하세요."
            }), 400
        
        if style not in ['concise', 'detailed', 'bullet', 'academic']:
            logger.warning(f"지원되지 않는 요약 스타일: {style}. 기본값인 'concise'로 대체합니다.")
            style = 'concise'
        
        if engine == 'gemini' and not SummarizationConfig.GEMINI_API_KEY:
            return jsonify({
                "success": False,
                "error": "Gemini API 키가 설정되지 않았습니다. 다른 엔진을 사용하거나 API 키를 설정하세요.",
                "suggestion": "huggingface 엔진을 대신 사용해 보세요."
            }), 400
            
        logger.info(f"텍스트 요약 시작: {len(text)} 문자, 엔진: {engine}, 스타일: {style}")
        result = summarize_text(text, engine, max_length, min_length, style)
        
        if not result['success']:
            logger.error(f"텍스트 요약 실패: {result.get('error', '알 수 없는 오류')}")
            return jsonify({
                "success": False,
                "error": result.get('error', '요약 중 오류가 발생했습니다.')
            }), 500
        
        current_user = get_current_user()
        user_id = None
        
        if current_user:
            user_id = current_user.get('id') if isinstance(current_user, dict) else getattr(current_user, 'id', None)
        
        response_data = {
            "success": True,
            "data": {
                "summary": result['summary'],
                "original_length": result['original_length'],
                "summary_length": result['summary_length'],
                "ratio": result['ratio'],
                "engine": engine,
                "style": style,
                "model_name": result.get('model_name', '')
            }
        }
        
        return jsonify(response_data), 200
        
    except Exception as e:
        logger.error(f"요약 API 오류: {str(e)}")
        return jsonify({
            "success": False,
            "error": "요약 처리 중 오류가 발생했습니다.",
            "message": str(e)
        }), 500

@app.route('/api/detect-language', methods=['POST'])
def detect_language_api():
    try:
        request_data = request.get_json()
        
        if not request_data or 'text' not in request_data:
            return jsonify({
                "success": False,
                "error": "언어를 감지할 텍스트가 제공되지 않았습니다."
            }), 400
        
        text = request_data.get('text', '')
        
        if not text or len(text.strip()) < 5:
            return jsonify({
                "success": False,
                "error": "언어를 감지할 텍스트가 너무 짧습니다. 최소 5자 이상이어야 합니다."
            }), 400
        
        logger.info(f"언어 감지 시작: {len(text)} 문자")
        result = detect_language(text)
        
        if not result['success']:
            logger.error(f"언어 감지 실패: {result.get('error', '알 수 없는 오류')}")
            return jsonify({
                "success": False,
                "error": result.get('error', '언어 감지 중 오류가 발생했습니다.')
            }), 500
        
        response_data = {
            "success": True,
            "data": {
                "language": result['language'],
                "language_name": result['language_name']
            }
        }
        
        return jsonify(response_data), 200
        
    except Exception as e:
        logger.error(f"언어 감지 API 오류: {str(e)}")
        return jsonify({
            "success": False,
            "error": "언어 감지 중 오류가 발생했습니다.",
            "message": str(e)
        }), 500


@app.route('/api/translate', methods=['POST'])
def translate_text_api():
    try:
        request_data = request.get_json()
        
        if not request_data or 'text' not in request_data:
            logger.warning("번역할 텍스트가 제공되지 않음")
            return jsonify({
                "success": False,
                "error": "번역할 텍스트가 제공되지 않았습니다."
            }), 400
        
        text = request_data.get('text', '')
        target_lang = request_data.get('target_lang', TranslationConfig.DEFAULT_TARGET_LANG)
        source_lang = request_data.get('source_lang')
        
        if not text or len(text.strip()) < 2:
            logger.warning("번역할 텍스트가 너무 짧음")
            return jsonify({
                "success": False,
                "error": "번역할 텍스트가 너무 짧습니다. 최소 2자 이상이어야 합니다."
            }), 400
        
        if not TranslationConfig.is_supported_language(target_lang):
            logger.warning(f"지원되지 않는 대상 언어: {target_lang}")
            return jsonify({
                "success": False,
                "error": f"지원되지 않는 대상 언어입니다: {target_lang}"
            }), 400
        
        if source_lang and not TranslationConfig.is_supported_language(source_lang):
            logger.warning(f"지원되지 않는 원본 언어: {source_lang}")
            return jsonify({
                "success": False,
                "error": f"지원되지 않는 원본 언어입니다: {source_lang}"
            }), 400
            
        logger.info(f"번역 시작: {len(text)} 문자, 대상 언어: {target_lang}, 원본 언어: {source_lang or '자동 감지'}")
        result = translate_text(text, target_lang, source_lang)
        
        if not result['success']:
            logger.error(f"번역 실패: {result.get('error', '알 수 없는 오류')}")
            return jsonify({
                "success": False,
                "error": result.get('error', '번역 중 오류가 발생했습니다.')
            }), 500
        
        response_data = {
            "success": True,
            "data": {
                "original_text": text,
                "translated_text": result['translated_text'],
                "source_language": result['source_language'],
                "source_language_name": result['source_language_name'],
                "target_language": result['target_language'],
                "target_language_name": result['target_language_name']
            }
        }
        
        if 'message' in result:
            response_data['data']['message'] = result['message']
        
        logger.info(f"번역 완료: {result['source_language_name']} -> {result['target_language_name']}")
        
        return jsonify(response_data), 200
        
    except Exception as e:
        logger.error(f"번역 API 오류: {str(e)}", exc_info=True)
        return jsonify({
            "success": False,
            "error": "번역 중 오류가 발생했습니다.",
            "message": str(e)
        }), 500

@app.route('/api/extract-table', methods=['POST'])
def extract_table_api():
    try:
        if 'file' not in request.files:
            return jsonify({
                "success": False,
                "error": "파일이 제공되지 않았습니다"
            }), 400
        
        file = request.files['file']
        original_filename = werkzeug.utils.secure_filename(file.filename)
        
        if not original_filename:
            return jsonify({
                "success": False,
                "error": "파일이 선택되지 않았거나 파일명이 유효하지 않습니다"
            }), 400
        
        # 클라이언트가 제공한 확장자 확인
        client_extension = request.form.get('file_extension', '').lower()
        
        # 파일명에서 확장자 추출 시도
        try:
            filename_extension = original_filename.rsplit('.', 1)[1].lower()
        except IndexError:
            filename_extension = ''
        
        # 클라이언트 제공 확장자 우선, 없으면 파일명에서 추출한 확장자 사용
        file_extension = client_extension if client_extension else filename_extension
        
        # 그래도 확장자가 없으면 기본값 'png' 설정 (이미지 파일로 간주)
        if not file_extension:
            file_extension = 'png'
            logger.info(f"확장자 없음, 기본값 'png' 사용: 파일명={original_filename}")
            
        # 허용된 확장자 - 이미지와 PDF 모두 허용
        allowed_exts = set(AppConfig.ALLOWED_IMAGE_EXTENSIONS) | {'pdf'}
        
        if file_extension not in allowed_exts:
            logger.warning(f"지원되지 않는 파일 형식(표 추출): 파일명={original_filename}, 확장자={file_extension}")
            supported_formats = ", ".join(sorted(list(allowed_exts)))
            return jsonify({
                "success": False,
                "error": f"지원되지 않는 파일 형식입니다. 지원 형식: {supported_formats}"
            }), 400
        # --- 검증 끝 ---
        
        output_format = request.form.get('format', TableConfig.DEFAULT_OUTPUT_FORMAT).strip().lower()
        
        if output_format not in ['csv', 'excel']:
            return jsonify({
                "success": False,
                "error": "'csv' 또는 'excel' 형식을 선택하세요."
            }), 400
        
        save_path = None
        
        try:
            # 확장자에 점을 추가하여 파일명 생성
            random_filename = f"{uuid.uuid4().hex}.{file_extension}"
            upload_folder = app.config['UPLOAD_FOLDER']
            if not os.path.exists(upload_folder):
                os.makedirs(upload_folder)
            save_path = os.path.join(upload_folder, random_filename)
            
            file.save(save_path)
            logger.info(f"임시 파일 저장됨: {save_path} (확장자: {file_extension})")
            
            if not os.path.exists(save_path):
                return jsonify({
                    "success": False,
                    "error": "파일 저장에 실패했습니다"
                }), 500
            
            logger.info(f"표 추출 및 컨텐츠 생성 시작: 원본={original_filename}, format={output_format}")
            result = extract_table_data_as_content(save_path, original_filename, output_format)
            
            # 대체 정보가 제공된 경우 (is_fallback=True)
            if result.get('success') and result.get('is_fallback'):
                logger.info("대체 정보가 제공되었습니다 (JVM 오류 또는 추출 실패)")
                
                # 대체 정보를 표 파일로 변환
                table_data = result.get('table_data', [])
                base_name = os.path.splitext(original_filename)[0]
                
                if output_format.lower() == 'excel':
                    file_content = generate_excel_in_memory(table_data)
                    mime_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                    filename = f"{base_name}_table_info.xlsx"
                else:  # 기본값 CSV
                    file_content = generate_csv_in_memory(table_data)
                    mime_type = 'text/csv; charset=utf-8-sig'
                    filename = f"{base_name}_table_info.csv"
                
                # 대체 정보와 함께 파일 다운로드 제공
                response = Response(
                    file_content,
                    mimetype=mime_type
                )
                
                encoded_filename = werkzeug.utils.quote(filename)
                response.headers['Content-Disposition'] = f"attachment; filename*=UTF-8''{encoded_filename}"
                response.headers['Content-Length'] = str(len(file_content))
                response.headers['X-Is-Fallback'] = 'true'
                
                logger.info(f"대체 정보 파일 전송: {filename}")
                return response
            
            if not result or not result.get('success'):
                error_msg = result.get('error', '표 추출/변환 중 오류 발생') if result else '결과 없음'
                logger.error(f"표 추출/변환 실패: {error_msg}, 파일={original_filename}")
                return jsonify({
                    "success": False,
                    "error": error_msg
                }), 500
            
            file_content = result['file_content']
            filename = result['filename']
            mime_type = result['mime_type']
            
            logger.info(f"표 데이터 파일 전송 준비: 파일명={filename}, 타입={mime_type}")
            
            response = Response(
                file_content,
                mimetype=mime_type
            )
            
            encoded_filename = werkzeug.utils.quote(filename)
            response.headers['Content-Disposition'] = f"attachment; filename*=UTF-8''{encoded_filename}"
            response.headers['Content-Length'] = str(len(file_content))
            
            logger.info(f"응답 헤더 설정 완료: Content-Disposition={response.headers['Content-Disposition']}")
            return response
            
        except Exception as e:
            logger.exception(f"표 추출 API 오류: {str(e)}, 파일={original_filename}")
            return jsonify({
                "success": False,
                "error": "표 추출 중 오류가 발생했습니다",
                "message": str(e)
            }), 500
            
        finally:
            if save_path and os.path.exists(save_path):
                try:
                    os.remove(save_path)
                except Exception as e_clean:
                    logger.error(f"임시 파일 삭제 실패: {str(e_clean)}")
    
    except Exception as global_e:
        error_msg = str(global_e)
        logger.exception(f"표 추출 API 예기치 않은 오류: {error_msg}")
        
        # Java 관련 오류 감지
        if ("JVM mismatch" in error_msg or 
            "UnsupportedClassVersionError" in error_msg or
            "Java" in error_msg and ("version" in error_msg or "VM" in error_msg)):
            
            # 좀 더 친절한 오류 메시지 제공
            return jsonify({
                "success": False,
                "error": "표 추출 기능을 위한 Java 설정 오류",
                "message": "64비트 Java 8 이상이 필요합니다. Eclipse Temurin 또는 Oracle JDK를 설치해주세요.",
                "solution": [
                    "1. Eclipse Temurin 또는 Oracle JDK 8 이상(64비트) 설치",
                    "2. 설치 후 서버 재시작",
                    "3. JAVA_HOME 환경 변수가 올바르게 설정되었는지 확인"
                ],
                "code": "JAVA_ERROR"
            }), 500
        
        return jsonify({
            "success": False,
            "error": "서버 처리 중 예기치 않은 오류가 발생했습니다",
            "message": error_msg
        }), 500

@app.route('/api/parse-business-card', methods=['POST'])
def parse_business_card_api():
    save_path = None
    
    try:
        if 'file' not in request.files:
            return jsonify({
                "success": False,
                "error": "파일이 제공되지 않았습니다"
            }), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({
                "success": False,
                "error": "파일이 선택되지 않았습니다"
            }), 400
        
        original_filename = secure_filename(file.filename)
        
        # --- 확장자 추출 및 검증 개선 ---
        # 클라이언트가 전송한 확장자 확인
        client_extension = request.form.get('file_extension', '').lower()
        
        # 파일명에서 확장자 추출 시도
        try:
            filename_extension = original_filename.rsplit('.', 1)[1].lower()
        except IndexError:
            filename_extension = ''
        
        # 클라이언트 제공 확장자 우선, 없으면 파일명에서 추출한 확장자 사용
        file_extension = client_extension if client_extension else filename_extension
        
        # 확장자가 없을 경우 기본값 설정
        if not file_extension:
            file_extension = 'png'  # 기본 확장자
            logger.warning(f"명함 분석: 확장자 없음. 기본값(png) 사용: {original_filename}")
            
        # 확장자 검증
        if file_extension not in AppConfig.ALLOWED_EXTENSIONS:
            logger.warning(f"지원되지 않는 파일 형식(명함 분석): 파일명={original_filename}, 확장자={file_extension}")
            supported_formats = ", ".join(sorted(list(AppConfig.ALLOWED_EXTENSIONS)))
            return jsonify({
                "success": False,
                "error": f"지원되지 않는 파일 형식입니다. 지원 형식: {supported_formats}"
            }), 400
        # --- 검증 끝 ---
        
        # 확장자에 점을 추가하여 파일명 생성
        random_filename = f"{uuid.uuid4().hex}.{file_extension}"
        save_path = os.path.join(app.config['UPLOAD_FOLDER'], random_filename)
        
        # 임시 파일 저장 및 로깅
        file.save(save_path)
        logger.info(f"명함 분석: 임시 파일 저장됨: {save_path}")
        
        if not os.path.exists(save_path):
            return jsonify({
                "success": False,
                "error": "파일 저장에 실패했습니다"
            }), 500
        
        if not is_valid_image(save_path):
            if save_path and os.path.exists(save_path):
                try:
                    os.remove(save_path)
                except Exception as e:
                    logger.error(f"임시 파일 삭제 실패: {str(e)}")
                    
            return jsonify({
                "success": False,
                "error": "유효하지 않은 이미지 파일입니다"
            }), 400
        
        logger.info(f"명함 분석 시작: {original_filename}")
        
        # OCR 모델 선택 (Gemini 우선, 아니면 Tesseract)
        ocr_model = request.form.get('ocr_model', 'auto').strip().lower()
        
        # 한국어 인식률 향상을 위해 Gemini 우선 사용
        use_gemini = (ocr_model == 'gemini' or ocr_model == 'auto') and AppConfig.GEMINI_API_KEY
        
        # Gemini 사용 불가능하고 Tesseract 한국어 지원이 없는 경우 경고
        has_korean_support = check_tesseract_korean_support()
        
        if not use_gemini and not has_korean_support:
            logger.warning("한국어 OCR 품질 저하 가능성: Gemini API 사용 불가 & Tesseract 한국어 지원 없음")
        
        result = parse_business_card(save_path, use_gemini=use_gemini)
        
        if not result['success']:
            logger.error(f"명함 분석 실패: {result.get('error', '알 수 없는 오류')}")
            
            if save_path and os.path.exists(save_path):
                try:
                    os.remove(save_path)
                except Exception as e:
                    logger.error(f"임시 파일 삭제 실패: {str(e)}")
                    
            return jsonify({
                "success": False,
                "error": result.get('error', '명함 분석 중 오류가 발생했습니다.')
            }), 500
        
        response_data = {
            "success": True,
            "name": result.get('name'),
            "position": result.get('position'),
            "company": result.get('company'),
            "email": result.get('email'),
            "phone": result.get('phone'),
            "address": result.get('address'),
            "website": result.get('website'),
            "full_text": result.get('full_text'),
            "ocr_model": result.get('ocr_model', 'tesseract')
        }
        
        for key, value in list(response_data.items()):
            if value is None or (isinstance(value, (list, dict)) and not value):
                response_data[key] = None
        
        try:
            if save_path and os.path.exists(save_path):
                os.remove(save_path)
                save_path = None
        except Exception as e:
            logger.error(f"임시 파일 삭제 실패: {str(e)}")
        
        return jsonify(response_data), 200
            
    except Exception as e:
        logger.error(f"명함 분석 API 오류: {str(e)}")
        
        if save_path and os.path.exists(save_path):
            try:
                os.remove(save_path)
            except Exception as clean_error:
                logger.error(f"예외 처리 중 임시 파일 삭제 실패: {str(clean_error)}")
        
        return jsonify({
            "success": False,
            "error": "명함 분석 중 오류가 발생했습니다",
            "message": str(e)
        }), 500

def upload_and_validate_file(file_request, allowed_extensions, upload_folder):
    """
    파일을 업로드하고 검증합니다.
    
    Args:
        file_request: 업로드된 파일 객체
        allowed_extensions: 허용된 확장자 목록
        upload_folder: 파일을 저장할 디렉토리
        
    Returns:
        (성공 여부, (파일 경로, 파일명) 또는 (오류 메시지, 상태 코드))
    """
    if file_request.filename == '':
        return False, ("파일명이 비어있습니다", 400)
    
    # 원본 파일명 정리
    original_filename = secure_filename(file_request.filename)
    
    # 클라이언트가 제공한 확장자 확인
    client_extension = request.form.get('file_extension', '').lower()
    
    # 파일명에서 확장자 추출 시도
    try:
        filename_extension = original_filename.rsplit('.', 1)[1].lower()
    except IndexError:
        filename_extension = ''
    
    # 클라이언트 제공 확장자 우선, 없으면 파일명에서 추출한 확장자 사용
    file_extension = client_extension if client_extension else filename_extension
    
    # 확장자가 없을 경우 기본값 설정
    if not file_extension:
        file_extension = 'png'  # 기본 확장자
        logger.warning(f"파일 업로드: 확장자 없음. 기본값(png) 사용: {original_filename}")
    
    # 확장자 검증
    if file_extension not in allowed_extensions:
        supported_formats = ", ".join(sorted(list(allowed_extensions)))
        return False, (f"지원하지 않는 파일 형식입니다. 지원 형식: {supported_formats}", 400)
    
    # 고유한 파일명 생성 (UUID + 확장자)
    unique_filename = f"{uuid.uuid4().hex}.{file_extension}"
    file_path = os.path.join(upload_folder, unique_filename)
    
    # 파일 저장
    file_request.save(file_path)
    logger.info(f"파일 업로드 성공: {file_path} (확장자: {file_extension})")
    
    return True, (file_path, unique_filename)

@app.route('/api/parse-receipt', methods=['POST'])
def parse_receipt_api():
    logger.info("영수증 분석 API 요청 받음")
    
    try:
        if 'file' not in request.files:
            logger.error("요청에 파일이 없음")
            return jsonify({
                'success': False,
                'error': '이미지 파일이 제공되지 않았습니다'
            }), 400
        
        file = request.files['file']
        
        upload_success, upload_result = upload_and_validate_file(
            file, 
            AppConfig.ALLOWED_IMAGE_EXTENSIONS, 
            app.config['UPLOAD_FOLDER']
        )
        
        if not upload_success:
            error_msg, status_code = upload_result
            logger.error(f"파일 검증 실패: {error_msg}")
            return jsonify({'success': False, 'error': error_msg}), status_code
        
        file_path, filename = upload_result
        logger.info(f"파일 저장됨: {file_path}")
        
        # OCR 모델 선택 (Gemini 우선, 아니면 Tesseract)
        ocr_model = request.form.get('ocr_model', 'auto').strip().lower()
        
        # 한국어 인식률 향상을 위해 Gemini 우선 사용
        use_gemini = (ocr_model == 'gemini' or ocr_model == 'auto') and AppConfig.GEMINI_API_KEY
        
        # Gemini 사용 불가능하고 Tesseract 한국어 지원이 없는 경우 경고
        has_korean_support = check_tesseract_korean_support()
        
        if not use_gemini and not has_korean_support:
            logger.warning("한국어 OCR 품질 저하 가능성: Gemini API 사용 불가 & Tesseract 한국어 지원 없음")
        
        result = parse_receipt(file_path, use_gemini=use_gemini)
        
        if not result['success']:
            logger.error(f"영수증 분석 실패: {result.get('error', '알 수 없는 오류')}")
            return jsonify(result), 400
        
        file_url = url_for('serve_file', filename=filename, _external=True)
        result['file_url'] = file_url
        result['filename'] = filename
        
        logger.info(f"영수증 분석 성공: {filename}")
        
        return jsonify(result), 200
        
    except Exception as e:
        logger.exception("영수증 분석 중 예외 발생")
        return jsonify({
            'success': False,
            'error': f"서버 오류: {str(e)}"
        }), 500

@app.route('/api/auth/profile', methods=['GET'])
@login_required
def get_user_profile():
    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({'success': False, 'error': '인증 오류가 발생했습니다.'}), 401

        # 비밀번호 해시는 제외하고 반환
        profile_data = {k: v for k, v in current_user.items() if k != 'password_hash'}
        
        # 사용자 이름 기본값 설정
        if 'name' not in profile_data or not profile_data.get('name'):
            email = profile_data.get('email', '')
            profile_data['name'] = email.split('@')[0] if '@' in email else email
            
        # 사용자 아이디(username) 기본값 설정
        if 'username' not in profile_data or not profile_data.get('username'):
            email = profile_data.get('email', '')
            profile_data['username'] = email.split('@')[0] if '@' in email else email
            
        return jsonify({
            'success': True,
            'data': profile_data
        }), 200
        
    except Exception as e:
        logger.error(f"프로필 정보 조회 중 오류: {str(e)}")
        return jsonify({'success': False, 'error': '서버 오류가 발생했습니다.'}), 500

@app.route('/api/auth/profile', methods=['PUT'])
@login_required
def update_user_profile():
    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({'success': False, 'error': '인증 오류가 발생했습니다.'}), 401

        user_id = current_user['id']
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': '프로필 데이터가 제공되지 않았습니다.'}), 400
            
        # 업데이트 가능한 필드: 이름, 아이디(username)
        if 'name' not in data and 'username' not in data:
            return jsonify({'success': False, 'error': '업데이트할 필드가 제공되지 않았습니다.'}), 400
            
        name = data.get('name', current_user.get('name', ''))
        username = data.get('username', current_user.get('username', ''))
        
        # 데이터베이스 연결 및 사용자 정보 업데이트
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            # 이제 name과 username 모두 업데이트합니다
            cursor.execute(
                """
                UPDATE users 
                SET name = :name, username = :username, updated_at = CURRENT_TIMESTAMP 
                WHERE id = :user_id
                """,
                {'name': name, 'username': username, 'user_id': user_id}
            )
            conn.commit()
            
            if cursor.rowcount > 0:
                # 프로필 업데이트 후 최신 사용자 정보 조회
                updated_user = get_user_by_id(user_id)
                
                if not updated_user:
                    logger.error(f"사용자 프로필 업데이트 후 사용자 정보를 찾을 수 없음: {user_id}")
                    return jsonify({'success': False, 'error': '사용자 정보를 찾을 수 없습니다.'}), 404
                
                # 프로필 업데이트 후 새 토큰 발급
                # 토큰 만료 시간 설정
                expiration = datetime.now(timezone.utc) + timedelta(minutes=AppConfig.JWT_EXPIRATION_MINUTES)
                
                # 업데이트된 사용자 정보로 새 토큰 페이로드 생성
                payload = {
                    'user_id': str(user_id),
                    'email': updated_user.get('email'),
                    'exp': expiration,
                    'name': updated_user.get('name', ''),
                    'username': updated_user.get('username', '')
                }
                
                # 새 JWT 토큰 생성
                token = jwt.encode(payload, AppConfig.JWT_SECRET_KEY, algorithm=AppConfig.JWT_ALGORITHM)
                
                return jsonify({
                    'success': True,
                    'message': '프로필이 성공적으로 업데이트되었습니다.',
                    'token': token,
                    'data': {
                        'name': name, 
                        'username': username
                    }
                }), 200
            else:
                return jsonify({'success': False, 'error': '프로필 업데이트에 실패했습니다.'}), 500
                
        except Exception as db_error:
            conn.rollback()
            logger.error(f"프로필 업데이트 중 DB 오류: {str(db_error)}")
            return jsonify({'success': False, 'error': f"DB 오류: {str(db_error)}"}), 500
        finally:
            if conn:
                conn.close()
        
    except Exception as e:
        logger.error(f"프로필 업데이트 중 오류: {str(e)}")
        return jsonify({'success': False, 'error': '서버 오류가 발생했습니다.'}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', '0') == '1'
    
    app.config['TIMEOUT'] = 300
    
    app.run(host='0.0.0.0', port=port, debug=debug, threaded=True)