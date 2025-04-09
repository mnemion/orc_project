import logging
from typing import List, Dict, Any, Optional
from .connection import execute_query # DB 함수 임포트

logger = logging.getLogger(__name__)

EXTRACTION_COLUMNS = [
    "id", "user_id", "filename", "extracted_text",
    "created_at", "updated_at", "is_bookmarked",
    "source_type", "ocr_model"
]

def get_user_extractions(user_id: str) -> List[Dict[str, Any]]:
    """특정 사용자의 추출 이력을 조회합니다. (쿼리 복구, 단순 처리 유지)"""
    if not user_id:
        logger.error("get_user_extractions 호출 시 user_id가 제공되지 않았습니다.")
        return []

    query_user_id = str(user_id)

    query = f"""
        SELECT {", ".join(EXTRACTION_COLUMNS)}
        FROM extractions
        WHERE user_id = :user_id
        ORDER BY created_at DESC
    """
    params = {'user_id': query_user_id}

    try:
        results = execute_query(query, params)

        if not results or not isinstance(results, list):
             return []

        extractions_list = []
        for i, row_dict in enumerate(results):
            try:
                if not isinstance(row_dict, dict):
                     logger.warning(f"행 {i}: 딕셔너리가 아님 (타입: {type(row_dict)}). 건너뜀.")
                     continue

                simple_dict = dict(row_dict)

                extractions_list.append(simple_dict)
            except Exception as processing_error:
                logger.error(f"행 {i} 처리 중 오류 발생(단순): {processing_error}.", exc_info=True)

        return extractions_list

    except Exception as e:
        logger.error(f"get_user_extractions 쿼리 중 오류 발생: {e}", exc_info=True)
        return []