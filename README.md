# OCR 문서 관리 시스템

이 프로젝트는 OCR 기술을 활용하여 문서를 디지털화하고 관리하는 웹 애플리케이션입니다. React와 Flask를 기반으로 구축되었으며, 문서 인식, 텍스트 추출, 데이터베이스 저장 등의 기능을 제공합니다.

## 주요 기능

- OCR을 통한 문서 텍스트 추출
  - Google Gemini AI를 활용한 고급 텍스트 추출
  - Tesseract OCR을 활용한 기본 텍스트 추출
  - 자동 이미지 전처리 및 품질 최적화
- 다양한 문서 형식 지원 (이미지, PDF)
- 문서 관리 및 검색
- 사용자 인증 및 권한 관리
- 문서 데이터 분석 및 요약
- AI 기반 문서 내용 이해 및 처리

## 기술 스택

### 프론트엔드
- React 18
- TypeScript
- Material-UI
- Tailwind CSS
- React Router
- JWT 인증

### 백엔드
- Flask
- Python 3.8+
- Tesseract OCR
- OpenCV
- Google Gemini AI
- Oracle Database

## 시작하기

### 사전 요구사항
- Node.js 16.0 이상
- Python 3.8 이상
- Oracle Database
- Tesseract OCR 설치
- (Windows의 경우) Visual C++ Redistributable

### 설치 방법

1. 저장소 클론
```bash
git clone [repository-url]
cd orc_project
```

2. 프론트엔드 설정
```bash
# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env
# .env 파일을 적절히 수정
```

3. 백엔드 설정
```bash
cd backend

# 가상환경 생성 및 활성화
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 의존성 설치
pip install -r requirements.txt

# 환경 변수 설정
cp .env.example .env
# .env 파일을 적절히 수정
```

### 실행 방법

1. 백엔드 서버 실행
```bash
cd backend
python app.py
```

2. 프론트엔드 개발 서버 실행
```bash
npm start
```

## 환경 변수 설정

### 프론트엔드 (.env)
- `REACT_APP_API_URL`: 백엔드 API URL
- `DB_HOST`: Oracle 데이터베이스 호스트
- `DB_PORT`: Oracle 데이터베이스 포트
- `DB_USER`: 데이터베이스 사용자
- `DB_PASSWORD`: 데이터베이스 비밀번호
- `DB_SERVICE`: Oracle 서비스 이름

### 백엔드 (.env)
- 데이터베이스 설정
  - `DB_HOST`: Oracle 데이터베이스 호스트
  - `DB_PORT`: Oracle 데이터베이스 포트
  - `DB_USER`: 데이터베이스 사용자
  - `DB_PASSWORD`: 데이터베이스 비밀번호
  - `DB_SERVICE`: Oracle 서비스 이름

- OCR 설정
  - `OCR_UPLOAD_FOLDER`: 업로드 폴더 경로
  - `OCR_MAX_CONTENT_LENGTH`: 최대 파일 크기

- API 키
  - `GEMINI_API_KEY`: Google Gemini AI API 키
    - [Google AI Studio](https://makersuite.google.com/app/apikey)에서 발급
    - 무료 API 키: 분당 60회 요청 제한
    - API 키가 없거나 할당량 초과 시 기본 OCR 시스템으로 자동 전환
  - `JWT_SECRET_KEY`: JWT 토큰 암호화 키

- 이메일 설정
  - `EMAIL_HOST`: SMTP 서버 호스트
  - `EMAIL_PORT`: SMTP 서버 포트
  - `EMAIL_USER`: 이메일 계정
  - `EMAIL_PASSWORD`: 이메일 앱 비밀번호
  - `EMAIL_FROM`: 발신자 이메일

## OCR 처리 시스템

이 프로젝트는 이중 OCR 처리 시스템을 구현하고 있습니다:

1. 기본 처리 (Tesseract OCR)
   - 로컬에서 실행되는 오픈소스 OCR 엔진
   - 다양한 이미지 전처리 기법 적용
   - 자동 품질 평가 및 최적화

2. 고급 처리 (Google Gemini AI)
   - 더 정확한 텍스트 추출
   - 문맥 이해 및 구조화된 데이터 추출
   - API 할당량 초과 시 자동으로 기본 처리로 전환

### 이미지 전처리
- 13가지 다양한 전처리 방법 적용
- 자동 품질 평가 시스템
- 최적의 결과를 제공하는 이미지 자동 선택

## 라이선스

이 프로젝트는 MIT 라이선스 하에 있습니다.
