# Oracle SQL 쿼리 상수들

# 추출 목록 조회 (사용자별)
GET_EXTRACTIONS_BY_USER = """
SELECT 
    id, 
    user_id, 
    filename, 
    extracted_text, 
    created_at, 
    updated_at, 
    is_bookmarked, 
    source_type, 
    ocr_model
FROM 
    extractions 
WHERE 
    user_id = :user_id
ORDER BY 
    created_at DESC
"""

# 특정 ID의 추출 정보 조회
GET_EXTRACTION_BY_ID = """
SELECT 
    id, 
    user_id, 
    filename, 
    extracted_text, 
    created_at, 
    updated_at, 
    is_bookmarked, 
    source_type, 
    ocr_model
FROM 
    extractions 
WHERE 
    id = :extraction_id
"""

# 새 추출 정보 삽입
INSERT_EXTRACTION = """
INSERT INTO extractions (
    user_id, 
    filename, 
    extracted_text, 
    source_type, 
    ocr_model
) VALUES (
    :user_id, 
    :filename, 
    :extracted_text, 
    :source_type, 
    :ocr_model
) RETURNING 
    id, 
    user_id, 
    filename, 
    extracted_text, 
    created_at, 
    updated_at, 
    is_bookmarked, 
    source_type, 
    ocr_model
    INTO 
    :out_id, 
    :out_user_id, 
    :out_filename, 
    :out_extracted_text, 
    :out_created_at, 
    :out_updated_at, 
    :out_is_bookmarked, 
    :out_source_type, 
    :out_ocr_model
"""

# 추출 텍스트 업데이트
UPDATE_EXTRACTION_TEXT = """
UPDATE 
    extractions 
SET 
    extracted_text = :extracted_text,
    updated_at = CURRENT_TIMESTAMP
WHERE 
    id = :extraction_id
"""

# 추출 파일명 업데이트
UPDATE_EXTRACTION_FILENAME = """
UPDATE 
    extractions 
SET 
    filename = :filename,
    updated_at = CURRENT_TIMESTAMP
WHERE 
    id = :extraction_id
"""

# 북마크 상태 토글
TOGGLE_EXTRACTION_BOOKMARK = """
UPDATE 
    extractions 
SET 
    is_bookmarked = CASE WHEN is_bookmarked = 1 THEN 0 ELSE 1 END,
    updated_at = CURRENT_TIMESTAMP
WHERE 
    id = :extraction_id
"""

# 추출 정보 삭제
DELETE_EXTRACTION = """
DELETE FROM 
    extractions 
WHERE 
    id = :extraction_id
""" 

# 이메일로 사용자 조회
GET_USER_BY_EMAIL = """
SELECT 
    id, 
    email, 
    password_hash, 
    role, 
    created_at, 
    updated_at
FROM 
    users 
WHERE 
    email = :email
"""

# 새 사용자 등록
INSERT_USER = """
INSERT INTO users (
    email, 
    password_hash, 
    role
) VALUES (
    :email, 
    :password_hash, 
    :role
) RETURNING 
    id, 
    email, 
    role, 
    created_at, 
    updated_at
    INTO 
    :out_id, 
    :out_email, 
    :out_role, 
    :out_created_at, 
    :out_updated_at
"""

# 비밀번호 재설정 토큰 생성 및 저장
CREATE_RESET_TOKEN = """
INSERT INTO password_reset_tokens (
    user_id, 
    token, 
    expires_at
) VALUES (
    :user_id, 
    :token, 
    :expires_at
) RETURNING 
    id, 
    user_id, 
    token, 
    expires_at
    INTO 
    :out_id, 
    :out_user_id, 
    :out_token, 
    :out_expires_at
"""

# 유효한 토큰으로 사용자 조회
GET_USER_BY_TOKEN = """
SELECT 
    u.id, 
    u.email, 
    u.role
FROM 
    users u
JOIN 
    password_reset_tokens t ON u.id = t.user_id
WHERE 
    t.token = :token
    AND t.expires_at > CURRENT_TIMESTAMP
    AND t.used = 0
"""

# 사용자 비밀번호 업데이트
UPDATE_USER_PASSWORD = """
UPDATE 
    users 
SET 
    password_hash = :password_hash,
    updated_at = CURRENT_TIMESTAMP
WHERE 
    id = :user_id
"""

# 토큰 사용 처리
MARK_TOKEN_USED = """
UPDATE 
    password_reset_tokens 
SET 
    used = 1,
    used_at = CURRENT_TIMESTAMP
WHERE 
    token = :token
"""

# 사용자 삭제
DELETE_USER = """
DELETE FROM 
    users 
WHERE 
    id = :user_id
"""

# ID로 사용자 조회
GET_USER_BY_ID = """
SELECT 
    id, 
    email, 
    password_hash, 
    role, 
    created_at, 
    updated_at
FROM 
    users 
WHERE 
    id = :user_id
"""

# 만료된 토큰 삭제
DELETE_EXPIRED_TOKENS = """
DELETE FROM 
    password_reset_tokens 
WHERE 
    expires_at < CURRENT_TIMESTAMP
    OR used = 1
"""