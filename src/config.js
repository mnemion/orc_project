/**
 * API 기본 URL 설정
 * 개발 환경에서는 로컬 서버 주소를 사용하고
 * 프로덕션 환경에서는 환경 변수에서 가져오거나 기본값을 사용합니다.
 */
export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

/**
 * 애플리케이션 설정 관련 상수
 */
export const AppConfig = {
  // 파일 업로드 관련 설정
  MAX_FILE_SIZE_MB: 10,
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/bmp', 'image/tiff', 'image/webp'],
  ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'image/bmp', 'image/tiff', 'image/webp', 'application/pdf'],
  
  // 페이지네이션 관련 설정
  DEFAULT_PAGE_SIZE: 10,
  
  // 토큰 관련 설정
  TOKEN_STORAGE_KEY: 'auth_token',
  
  // 기타 설정
  DEFAULT_LANGUAGE: 'ko',
  DATE_FORMAT: 'YYYY-MM-DD',
  TIME_FORMAT: 'HH:mm:ss',
};

export default AppConfig; 