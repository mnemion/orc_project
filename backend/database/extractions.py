import logging
from typing import Any, Dict, Optional, Union
from .connection import execute_query, execute_insert, execute_update, execute_delete
from .queries import (
    GET_EXTRACTION_BY_ID, 
    INSERT_EXTRACTION, 
    UPDATE_EXTRACTION_TEXT, 
    UPDATE_EXTRACTION_FILENAME,
    TOGGLE_EXTRACTION_BOOKMARK,
    DELETE_EXTRACTION
)

logger = logging.getLogger(__name__)

def get_extraction_by_id(extraction_id: Union[str, int]) -> Optional[Dict[str, Any]]:
    try:
        if extraction_id is None:
            logger.error("추출 정보 조회 오류: extraction_id가 None입니다")
            return None
            
        try:
            extraction_id_int = int(extraction_id)
            logger.debug(f"추출 ID {extraction_id} -> 정수형 {extraction_id_int}로 변환됨")
        except (ValueError, TypeError):
            logger.warning(f"ID를 정수로 변환할 수 없습니다: {extraction_id}, 타입: {type(extraction_id)}")
            extraction_id_int = extraction_id
        
        params = {'extraction_id': extraction_id_int}
        logger.debug(f"추출 정보 조회 시도: {extraction_id_int} (타입: {type(extraction_id_int)})")
        
        result = execute_query(GET_EXTRACTION_BY_ID, params, fetch_one=True)
        
        if result:
            if isinstance(result, dict):
                if 'id' in result:
                    logger.debug(f"추출 정보 조회 성공: ID {result['id']}")
                else:
                    logger.warning(f"추출 정보에 ID가 없습니다: {result}")
            else:
                logger.warning(f"추출 정보가 딕셔너리 형태가 아닙니다: {type(result)}")
            
            return result
        else:
            logger.warning(f"추출 정보를 찾을 수 없습니다: ID {extraction_id}")
            return None
    except Exception as e:
        logger.error(f"추출 정보 조회 오류: {str(e)}, extraction_id: {extraction_id}")
        return None

def save_extraction(
    user_id: str, 
    filename: str, 
    extracted_text: str, 
    source_type: str = "image", 
    ocr_model: str = "tesseract",
    file_path: str = None,
    language: str = 'auto',
    file_type: str = None
) -> Optional[Dict[str, Any]]:
    try:
        if not user_id:
            logger.error("추출 정보 저장 실패: 사용자 ID가 제공되지 않았습니다")
            return None
            
        logger.debug(f"추출 정보 저장 시작 - 사용자: {user_id}, 파일: {filename}, 모델: {ocr_model}")
        
        try:
            logger.debug(f"user_id 변환 전 타입: {type(user_id)}, 값: {user_id}")
            
            user_id_str = str(user_id)
            logger.debug(f"user_id 문자열로 변환됨: {user_id_str}")
        except (ValueError, TypeError):
            user_id_str = user_id
            logger.warning(f"user_id 변환 실패, 원본 값 사용: {user_id_str}")
        
        params = {
            'user_id': user_id_str,
            'filename': filename,
            'extracted_text': extracted_text,
            'source_type': source_type,
            'ocr_model': ocr_model,
            'out_id': None,
            'out_user_id': None,
            'out_filename': None,
            'out_extracted_text': None,
            'out_created_at': None,
            'out_updated_at': None,
            'out_is_bookmarked': None,
            'out_source_type': None,
            'out_ocr_model': None
        }
        
        log_params = {k: v if k != 'extracted_text' else '[텍스트 내용]' for k, v in params.items()}
        logger.debug(f"INSERT_EXTRACTION 쿼리 파라미터: {log_params}")
        
        result = execute_insert(INSERT_EXTRACTION, params, return_inserted=True)
        
        if not result:
            logger.error(f"추출 정보 저장 결과가 없음: user_id={user_id}, filename={filename}")
            return None
        
        processed_result = {}
        for key, value in result.items():
            if isinstance(value, list) and len(value) > 0:
                processed_result[key] = value[0]
            else:
                processed_result[key] = value
                
        logger.info(f"추출 정보 저장 성공 - ID: {processed_result.get('id')}, 사용자: {user_id}, 파일: {filename}")
        logger.debug(f"처리된 결과: {processed_result}")
        
        return processed_result
    except Exception as e:
        logger.error(f"추출 정보 저장 오류: {str(e)}, user_id: {user_id}, filename: {filename}")
        logger.exception("상세 오류 정보:")
        return None

def update_extraction_text(extraction_id: Union[str, int], updated_text: str) -> bool:
    try:
        extraction_id = int(extraction_id)
        params = {
            'extraction_id': extraction_id,
            'extracted_text': updated_text
        }
        
        affected_rows = execute_update(UPDATE_EXTRACTION_TEXT, params)
        return affected_rows > 0
    except Exception as e:
        logger.error(f"추출 텍스트 업데이트 오류: {str(e)}, extraction_id: {extraction_id}")
        return False

def update_extraction_filename(extraction_id: Union[str, int], new_filename: str) -> bool:
    """특정 추출 정보의 파일명을 업데이트합니다."""
    try:
        try:
            extraction_id_int = int(extraction_id)
        except (ValueError, TypeError):
            logger.error(f"파일명 업데이트 오류: 유효하지 않은 ID 형식 - {extraction_id} (타입: {type(extraction_id)})")
            return False
            
        if not new_filename or not isinstance(new_filename, str):
            logger.error(f"파일명 업데이트 오류: 유효하지 않은 파일명 - {new_filename}")
            return False

        params = {
            'extraction_id': extraction_id_int,
            'filename': new_filename.strip()
        }
        logger.info(f"파일명 업데이트 시도: ID={extraction_id_int}, 새 파일명='{params['filename']}'")
        
        affected_rows = execute_update(UPDATE_EXTRACTION_FILENAME, params)
        
        success = affected_rows > 0
        if success:
            logger.info(f"파일명 업데이트 성공: ID={extraction_id_int} (영향받은 행: {affected_rows})")
        else:
            logger.warning(f"파일명 업데이트 DB 작업 결과: 변경 없음 또는 실패 (ID={extraction_id_int}, 영향받은 행={affected_rows})") 

        return success
    except Exception as e:
        logger.error(f"추출 파일명 업데이트 중 예상치 못한 오류: {str(e)}, extraction_id: {extraction_id}")
        return False

def toggle_extraction_bookmark(extraction_id: Union[str, int]) -> bool:
    try:
        extraction_id = int(extraction_id)
        params = {'extraction_id': extraction_id}
        
        affected_rows = execute_update(TOGGLE_EXTRACTION_BOOKMARK, params)
        return affected_rows > 0
    except Exception as e:
        logger.error(f"추출 북마크 토글 오류: {str(e)}, extraction_id: {extraction_id}")
        return False

def delete_extraction(extraction_id: Union[str, int]) -> bool:
    try:
        try:
            extraction_id = int(extraction_id)
        except (ValueError, TypeError):
            if not isinstance(extraction_id, (int, str)):
                logger.error(f"추출 정보 삭제 오류: 유효하지 않은 ID 형식 - {type(extraction_id)}")
                return False
        
        logger.info(f"추출 정보 삭제 시도: ID {extraction_id} (타입: {type(extraction_id)})")
        
        params = {'extraction_id': extraction_id}
        
        affected_rows = execute_delete(DELETE_EXTRACTION, params)
        
        success = affected_rows > 0
        logger.info(f"추출 정보 삭제 결과: {'성공' if success else '실패'} (영향받은 행: {affected_rows})")
        
        return success
    except Exception as e:
        logger.error(f"추출 정보 삭제 오류: {str(e)}, extraction_id: {extraction_id}")
        return False 