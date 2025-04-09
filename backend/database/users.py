import logging
from typing import Any, Dict, List, Optional, Union
from datetime import datetime
from .connection import execute_query, execute_insert, execute_update, execute_delete, get_db_connection
from .queries import (
    GET_USER_BY_EMAIL,
    GET_USER_BY_ID,
    INSERT_USER,
    UPDATE_USER_PASSWORD,
    DELETE_USER
)
from werkzeug.security import check_password_hash, generate_password_hash

logger = logging.getLogger(__name__)

def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    try:
        params = {'email': email}
        result = execute_query(GET_USER_BY_EMAIL, params, fetch_one=True)
        
        if not result:
            return None
            
        if isinstance(result, tuple):
            columns = ['id', 'email', 'password_hash', 'role', 'created_at', 'updated_at']
            return dict(zip(columns, result))
            
        return result
    except Exception as e:
        logger.error(f"사용자 조회 오류: {str(e)}, email: {email}")
        return None

def get_user_by_id(user_id: Union[str, int]) -> Optional[Dict[str, Any]]:
    try:
        user_id = int(user_id) if not isinstance(user_id, int) else user_id
        params = {'user_id': user_id}
        result = execute_query(GET_USER_BY_ID, params, fetch_one=True)
        
        if not result:
            logger.warning(f"ID로 사용자를 찾을 수 없음: {user_id}")
            return None
            
        if isinstance(result, tuple):
            columns = ['id', 'email', 'password_hash', 'role', 'created_at', 'updated_at']
            return dict(zip(columns, result))
            
        return result
    except Exception as e:
        logger.error(f"ID로 사용자 조회 오류: {str(e)}, user_id: {user_id}")
        return None

def create_user(email: str, password: str, role: str = 'user') -> Optional[Dict[str, Any]]:
    try:
        # 이메일 중복 확인
        existing_user = get_user_by_email(email)
        if existing_user:
            logger.warning(f"이미 존재하는 이메일: {email}")
            return None
            
        # 비밀번호 해싱
        password_hash = generate_password_hash(password)
            
        # 입력 파라미터
        params = {
            'email': email,
            'password_hash': password_hash,
            'role': role,
            # Oracle RETURNING INTO 바인드 변수
            'out_id': None,
            'out_email': None,
            'out_role': None,
            'out_created_at': None,
            'out_updated_at': None
        }
        
        # 사용자 생성
        result = execute_insert(INSERT_USER, params, return_inserted=True)
        
        if not result:
            logger.error(f"사용자 생성 결과가 없음: email={email}")
            return None
            
        logger.info(f"사용자 생성 성공 - ID: {result.get('id')}, 이메일: {email}")
        return result
    except Exception as e:
        logger.error(f"사용자 생성 오류: {str(e)}, email: {email}")
        logger.exception("상세 오류 정보:")
        return None

def update_password(user_id, new_password_hash):
    """사용자 비밀번호 업데이트
    
    Args:
        user_id: 사용자 ID
        new_password_hash: 새 비밀번호 해시
        
    Returns:
        성공 여부
    """
    try:
        params = {
            'password_hash': new_password_hash,
            'user_id': user_id
        }
        
        # execute_update 함수를 사용하여 더 단순화된 구현
        updated_rows = execute_update(UPDATE_USER_PASSWORD, params)
        return updated_rows > 0
        
    except Exception as e:
        logger.error(f"비밀번호 업데이트 중 오류: {str(e)}")
        return False

def delete_user(user_id: Union[str, int]) -> bool:
    try:
        user_id = int(user_id)
        params = {'user_id': user_id}
        
        affected_rows = execute_delete(DELETE_USER, params)
        return affected_rows > 0
    except Exception as e:
        logger.error(f"사용자 삭제 오류: {str(e)}, user_id: {user_id}")
        return False

def authenticate_user(email: str, password: str) -> Optional[Dict[str, Any]]:
    try:
        user = get_user_by_email(email)
        
        if not user:
            logger.warning(f"존재하지 않는 이메일: {email}")
            return None
        
        password_hash = user.get('password_hash')
        if not password_hash:
            logger.error(f"사용자 데이터에 password_hash 필드가 없습니다: {email}")
            return None
            
        if not check_password_hash(password_hash, password):
            logger.warning(f"잘못된 비밀번호: {email}")
            return None
            
        logger.info(f"인증 성공: {email}")
            
        user_data = {k: v for k, v in user.items() if k != 'password_hash'}
        return user_data
        
    except Exception as e:
        logger.error(f"사용자 인증 오류: {str(e)}, email: {email}")
        return None