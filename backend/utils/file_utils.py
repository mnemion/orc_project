"""
파일 관련 유틸리티 함수
"""

import os
import time
import logging
import re
import magic
from datetime import datetime, timedelta
from typing import Set, Optional, List, Dict, Any, Tuple, Union
import io
from werkzeug.datastructures import FileStorage

logger = logging.getLogger(__name__)

class FileConfig:
    ALLOWED_EXTENSIONS: Set[str] = {'png', 'jpg', 'jpeg', 'bmp', 'tiff', 'webp', 'pdf'}
    
    ALLOWED_MIME_TYPES: Set[str] = {
        'image/jpeg',
        'image/png',
        'image/bmp',
        'image/tiff',
        'image/webp',
        'application/pdf'
    }
    
    MAX_FILE_SIZE_MB: int = int(os.environ.get('MAX_FILE_SIZE_MB', 10))
    MAX_FILE_SIZE: int = MAX_FILE_SIZE_MB * 1024 * 1024
    
    DEFAULT_RETENTION_DAYS: int = int(os.environ.get('FILE_RETENTION_DAYS', 7))
    
    TIMESTAMP_FORMAT: str = '%Y%m%d_%H%M%S_%f'
    INVALID_CHARS_PATTERN: str = r'[<>:"/\\|?*]'


def get_file_extension(filename: str) -> str:
    if not filename or not isinstance(filename, str):
        logger.warning(f"유효하지 않은 파일명: {filename}")
        return ""
        
    basename = os.path.basename(filename)
    
    return basename.rsplit('.', 1)[1].lower() if '.' in basename else ''


def get_mime_type(file_input: Union[str, FileStorage, io.BytesIO]) -> Optional[str]:
    try:
        if isinstance(file_input, str):
            if not os.path.exists(file_input):
                logger.warning(f"MIME 타입 확인 실패: 파일 없음 - {file_input}")
                return None
            return magic.from_file(file_input, mime=True)
        elif hasattr(file_input, 'read') and hasattr(file_input, 'seek'):
            original_position = file_input.tell()
            file_input.seek(0)
            buffer = file_input.read(2048)
            file_input.seek(original_position)
            if not buffer:
                logger.warning("MIME 타입 확인 실패: 파일 객체가 비어 있음")
                return None
            return magic.from_buffer(buffer, mime=True)
        else:
            logger.warning(f"MIME 타입 확인 실패: 지원되지 않는 입력 타입 - {type(file_input)}")
            return None
    except magic.MagicException as e:
        logger.error(f"MIME 타입 확인 중 오류 발생 (magic): {str(e)}")
        return None
    except Exception as e:
        logger.error(f"MIME 타입 확인 중 예외 발생: {str(e)}")
        return None


def is_valid_image(file_input: Union[str, FileStorage]) -> bool:
    filename = None
    file_size = 0
    is_file_storage = isinstance(file_input, FileStorage)

    if is_file_storage:
        filename = file_input.filename
        current_pos = file_input.tell()
        file_input.seek(0, os.SEEK_END)
        file_size = file_input.tell()
        file_input.seek(current_pos)

        if not filename:
            logger.warning("유효성 검사 실패: FileStorage 객체에 파일 이름이 없습니다.")
            return False
    elif isinstance(file_input, str):
        filename = file_input
        if not os.path.exists(filename):
            logger.warning(f"파일이 존재하지 않음: {filename}, 절대 경로: {os.path.abspath(filename)}")
            dir_path = os.path.dirname(filename)
            if not os.path.exists(dir_path):
                logger.warning(f"디렉토리도 존재하지 않음: {dir_path}")
            elif os.access(dir_path, os.W_OK):
                logger.warning(f"디렉토리는 존재하지만 쓰기 권한이 없음: {dir_path}")
            else:
                logger.warning(f"디렉토리는 존재하고 쓰기 권한 있음, 그러나 파일이 없음: {os.listdir(dir_path)[:10]}")
            return False
        if not os.path.isfile(filename):
            logger.warning(f"디렉토리가 아닌 파일이어야 함: {filename}")
            return False
        file_size = os.path.getsize(filename)
    else:
        logger.warning(f"유효하지 않은 입력 타입: {type(file_input)}")
        return False

    if not filename:
         logger.warning("유효성 검사 실패: 파일 이름이 없습니다.")
         return False

    if file_size > FileConfig.MAX_FILE_SIZE:
        logger.warning(
            f"파일 크기 초과 ({file_size/1024/1024:.1f}MB > {FileConfig.MAX_FILE_SIZE_MB}MB): {filename}"
        )
        return False

    if file_size == 0:
        logger.warning(f"빈 파일: {filename}")
        return False

    file_type = get_mime_type(file_input)
    if not file_type:
        logger.warning(f"MIME 타입을 확인할 수 없음: {filename}")
        ext = get_file_extension(filename)
        if ext in FileConfig.ALLOWED_EXTENSIONS:
            logger.warning(f"MIME 확인 불가, 확장자 ({ext}) 기준으로 유효 처리: {filename}")
            return True
        return False

    if is_pdf_file(file_input):
        return True

    if file_type in FileConfig.ALLOWED_MIME_TYPES:
        logger.debug(f"유효한 MIME 타입 ({file_type}) 확인: {filename}")
        return True

    ext = get_file_extension(filename)
    if ext in FileConfig.ALLOWED_EXTENSIONS:
        logger.warning(f"허용되지 않는 MIME 타입({file_type})이지만, 확장자 ({ext})가 허용되어 유효 처리: {filename}")
        return True

    logger.warning(f"지원되지 않는 파일 타입: MIME={file_type}, 확장자={ext}, 파일명={filename}")
    return False


def is_pdf_file(file_input: Union[str, FileStorage]) -> bool:
    filename = None
    if isinstance(file_input, FileStorage):
        filename = file_input.filename
        if not filename: return False
        
        mime_type = get_mime_type(file_input)
        if mime_type == 'application/pdf':
            return True
        
        return get_file_extension(filename) == 'pdf'
    elif isinstance(file_input, str):
        filename = file_input
        
        if not os.path.exists(filename) or not os.path.isfile(filename):
            return False
        
        mime_type = get_mime_type(filename)
        if mime_type == 'application/pdf':
            return True
        
        return get_file_extension(filename) == 'pdf'
    else:
        return False


def clean_old_files(directory: str, days: Optional[int] = None) -> int:
    try:
        if days is None:
            days = FileConfig.DEFAULT_RETENTION_DAYS
        
        if not isinstance(days, int) or days < 0:
            logger.warning(f"유효하지 않은 보관 기간: {days}일, 기본값 {FileConfig.DEFAULT_RETENTION_DAYS}일로 대체")
            days = FileConfig.DEFAULT_RETENTION_DAYS
            
        if not os.path.exists(directory):
            logger.warning(f"디렉토리가 존재하지 않음: {directory}")
            return 0
            
        if not os.path.isdir(directory):
            logger.warning(f"디렉토리가 아님: {directory}")
            return 0

        cutoff_time = time.time() - (days * 24 * 60 * 60)
        deleted_count = 0
        deleted_files: List[str] = []
        error_files: List[Tuple[str, str]] = []

        logger.debug(f"{directory} 내 {days}일 이상 된 파일 정리 시작")

        for filename in os.listdir(directory):
            file_path = os.path.join(directory, filename)

            if os.path.isfile(file_path):
                try:
                    mod_time = os.path.getmtime(file_path)

                    if mod_time < cutoff_time:
                        os.remove(file_path)
                        deleted_count += 1
                        deleted_files.append(filename)
                        logger.debug(f"오래된 파일 삭제: {filename}")
                except PermissionError as pe:
                    error_message = f"파일 삭제 권한 없음: {str(pe)}"
                    logger.error(f"{error_message}: {filename}")
                    error_files.append((filename, error_message))
                except Exception as e:
                    error_message = f"파일 삭제 중 오류: {str(e)}"
                    logger.error(f"{error_message}: {filename}")
                    error_files.append((filename, error_message))

        if deleted_count > 0:
            file_list = ', '.join(deleted_files[:10])
            if len(deleted_files) > 10:
                file_list += f' 외 {len(deleted_files) - 10}개'
                
            logger.debug(f"총 {deleted_count}개 파일 삭제 완료: {file_list}")
        else:
            logger.debug(f"삭제할 파일이 없습니다 (보관 기간: {days}일)")
            
        if error_files:
            error_list = ', '.join([f"{f[0]} ({f[1]})" for f in error_files[:5]])
            if len(error_files) > 5:
                error_list += f' 외 {len(error_files) - 5}개'
                
            logger.warning(f"파일 삭제 실패: {error_list}")
            
        return deleted_count

    except PermissionError as pe:
        logger.error(f"디렉토리 접근 권한 없음: {directory}, {str(pe)}")
        return 0
    except Exception as e:
        logger.error(f"파일 정리 중 오류 발생: {str(e)}")
        return 0


def rename_file_with_timestamp(original_filename: str) -> str:
    if not original_filename:
        timestamp = datetime.now().strftime(FileConfig.TIMESTAMP_FORMAT)[:19]
        return f"file_{timestamp}"
        
    try:
        if '.' in original_filename:
            name, ext = original_filename.rsplit('.', 1)
            ext = '.' + ext.lower()
        else:
            name = original_filename
            ext = ''

        name = re.sub(FileConfig.INVALID_CHARS_PATTERN, '_', name)
        name = name.replace(' ', '_')
        
        if len(name) > 50:
            name = name[:50]
        
        timestamp = datetime.now().strftime(FileConfig.TIMESTAMP_FORMAT)[:19]
        new_filename = f"{name}_{timestamp}{ext}"

        return new_filename

    except Exception as e:
        logger.error(f"파일명 변경 중 오류 발생: {str(e)}")
        
        timestamp = datetime.now().strftime(FileConfig.TIMESTAMP_FORMAT)[:19]
        return f"file_{timestamp}"