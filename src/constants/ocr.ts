/**
 * OCR 관련 상수값
 */

// 지원하는 언어 목록
export const SUPPORTED_LANGUAGES = [
  { code: 'kor', name: '한국어' },
  { code: 'eng', name: '영어' },
  { code: 'jpn', name: '일본어' },
  { code: 'chi_sim', name: '중국어 (간체)' },
  { code: 'chi_tra', name: '중국어 (번체)' },
  { code: 'deu', name: '독일어' },
  { code: 'fra', name: '프랑스어' },
  { code: 'spa', name: '스페인어' },
  { code: 'rus', name: '러시아어' }
];

// 기본 이미지 최적화 설정
export const DEFAULT_IMAGE_QUALITY = 70;
export const DEFAULT_IMAGE_ZOOM = 100;
export const MAX_IMAGE_WIDTH = 1920;
export const MAX_IMAGE_HEIGHT = 1080;

// 기본 OCR 모델
export const DEFAULT_OCR_MODEL = 'tesseract';

// 기본 언어
export const DEFAULT_LANGUAGE = 'kor'; 