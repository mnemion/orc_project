from .connection import get_db_connection, execute_query, execute_insert, execute_update, execute_delete
from .queries import (
    GET_EXTRACTIONS_BY_USER,
    GET_EXTRACTION_BY_ID,
    INSERT_EXTRACTION,
    UPDATE_EXTRACTION_TEXT,
    UPDATE_EXTRACTION_FILENAME,
    DELETE_EXTRACTION,
    GET_USER_BY_EMAIL,
    GET_USER_BY_ID,
    INSERT_USER,
    UPDATE_USER_PASSWORD,
    DELETE_USER,
    TOGGLE_EXTRACTION_BOOKMARK,
    CREATE_RESET_TOKEN,
    GET_USER_BY_TOKEN,
    MARK_TOKEN_USED,
    DELETE_EXPIRED_TOKENS
)
from . import user_extractions, extractions, users

__all__ = [
    'get_db_connection',
    'execute_query',
    'execute_insert',
    'execute_update',
    'execute_delete',
    'user_extractions',
    'extractions',
    'users',
]

# 비밀번호 업데이트
UPDATE_USER_PASSWORD = """
UPDATE users
SET password_hash = :password_hash
WHERE id = :user_id
"""