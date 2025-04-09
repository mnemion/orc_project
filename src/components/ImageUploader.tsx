import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { uploadImage } from '../services/api';
import { SUPPORTED_LANGUAGES } from '../constants/ocr';

interface ImageUploaderProps {
    onExtractComplete?: (text: string, id: number, model: string) => void;
    onFileSelected?: (file: File) => void;
    className?: string;
    progressCallback?: (status: string, progress: number) => void;
    modelName?: string;
    onModelChange?: React.Dispatch<React.SetStateAction<string>>;
    language?: string;
}

interface OcrProgress {
    status: string;
    progress: number;
}

// 언어 코드로 언어 이름 가져오기
const getLanguageName = (code: string): string => {
    const language = SUPPORTED_LANGUAGES.find(lang => lang.code === code);
    return language ? language.name : '알 수 없음';
};

const ImageUploader: React.FC<ImageUploaderProps> = ({ 
    onExtractComplete, 
    onFileSelected,
    className, 
    modelName = 'gemini-2.0-flash-exp-image-generation',
    onModelChange,
    language = 'kor' // 기본값 한국어
}) => {
    // 다크 모드 컴포넌트
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [ocrProgress, setOcrProgress] = useState<OcrProgress | null>(null);
    const [selectedModel, setSelectedModel] = useState<string>(modelName);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // modelName prop이 변경되면 내부 상태 업데이트
    useEffect(() => {
        setSelectedModel(modelName);
    }, [modelName]);

    // 파일 유효성 검사 함수
    const validateFile = (selectedFile: File): string | null => {
        // 파일 크기 검증 (10MB 이하)
        if (selectedFile.size > 10 * 1024 * 1024) {
            return '파일 크기는 10MB 이하여야 합니다.';
        }

        // 파일 형식 검증
        const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
        if (!validTypes.includes(selectedFile.type)) {
            return 'JPG, JPEG 또는 PNG 이미지만 업로드 가능합니다.';
        }
        
        return null;
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];

            // 파일 유효성 검사
            const validationError = validateFile(selectedFile);
            if (validationError) {
                setError(validationError);
                return;
            }

            setFile(selectedFile);
            setError(null);

            // 미리보기 생성
            const reader = new FileReader();
            reader.onload = () => {
                setPreview(reader.result as string);
            };
            reader.readAsDataURL(selectedFile);
            
            // 파일 선택 콜백이 있으면 호출
            if (onFileSelected) {
                onFileSelected(selectedFile);
            }
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const droppedFile = e.dataTransfer.files[0];

            // 파일 유효성 검사
            const validationError = validateFile(droppedFile);
            if (validationError) {
                setError(validationError);
                return;
            }

            setFile(droppedFile);
            setError(null);

            // 미리보기 생성
            const reader = new FileReader();
            reader.onload = () => {
                setPreview(reader.result as string);
            };
            reader.readAsDataURL(droppedFile);
            
            // 파일 선택 콜백이 있으면 호출
            if (onFileSelected) {
                onFileSelected(droppedFile);
            }
        }
    };

    const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newModel = e.target.value;
        setSelectedModel(newModel);
        if (onModelChange) {
            onModelChange(newModel);
        }
    };

    const handleUpload = async () => {
        if (!file) {
            setError('이미지를 선택해주세요.');
            return;
        }

        setIsLoading(true);
        setError(null);
        
        // 초기 진행 상태 설정
        setOcrProgress({ status: '준비 중...', progress: 0 });
        
        try {
            const formData = new FormData();
            formData.append('file', file);
            // 언어 정보 추가
            formData.append('language', language);
            
            // 진행 상황 콜백 함수 추가
            const response = await uploadImage(
                formData, 
                selectedModel,
                (status, progress) => {
                    setOcrProgress({ status, progress });
                }
            );
    
            if (response.success) {
                // 응답 데이터 안전하게 추출
                const extractedText = (response as any).data?.text || '';
                const extractionId = (response as any).data?.id || 0;
                const usedModel = (response as any).data?.model || selectedModel;
                
                // 추출된 텍스트와 ID 전달
                if (onExtractComplete) {
                    onExtractComplete(extractedText, extractionId, usedModel);
                }
                
                // 추가 메시지가 있으면 표시
                if ('message' in response && response.message) {
                    setError(response.message as string);
                }
            } else {
                setError(response.error || '이미지 처리 중 오류가 발생했습니다.');
            }
        } catch (err) {
            // 오류 시 진행 상태 정리
            setOcrProgress(null);
            
            // 오류 메시지 설정
            const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류';
            console.error('OCR 처리 오류:', errorMessage);
            setError('서버 연결 오류가 발생했습니다. 다시 시도해주세요.');
        } finally {
            // 약간의 지연 후 로딩 상태 해제 (완료 애니메이션을 위해)
            setTimeout(() => {
                setIsLoading(false);
                setOcrProgress(null);
            }, 1000);
        }
    };

    const triggerFileInput = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleRemoveImage = () => {
        setPreview(null);
        setFile(null);
        setError(null);
        setOcrProgress(null);
    };

    return (
        <div className={`w-full ${className || ''}`}>
            <div
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
                  ${preview ? (isDark ? 'border-gray-700' : 'border-gray-300') : (isDark ? 'border-blue-700 hover:border-blue-600' : 'border-blue-300 hover:border-blue-500')}
                  ${isDark ? 'bg-gray-800' : 'bg-white'} transition-colors duration-200`}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={!preview ? triggerFileInput : undefined}
            >
                {!preview ? (
                    <>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept="image/jpeg,image/png,image/jpg"
                            className="hidden"
                        />
                        <svg
                            className={`mx-auto h-12 w-12 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1}
                                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                            />
                        </svg>
                        <p className={`mt-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            클릭하여 이미지 선택 또는 여기로 파일을 끌어다 놓으세요
                        </p>
                        <p className={`mt-1 text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>PNG, JPG, JPEG (최대 10MB)</p>
                    </>
                ) : (
                    <div className="relative">
                        <img
                            src={preview}
                            alt="이미지 미리보기"
                            className="max-h-96 mx-auto rounded-md"
                        />
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveImage();
                            }}
                            className={`absolute top-2 right-2 p-1 rounded-full ${isDark ? 'bg-gray-900 text-gray-300 hover:bg-gray-700' : 'bg-white text-gray-600 hover:bg-gray-100'} shadow`}
                        >
                            <svg
                                className="h-5 w-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            </svg>
                        </button>

                        {/* 파일 이름 표시 */}
                        <div className={`mt-3 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {file && file.name}
                        </div>
                    </div>
                )}

                {/* 오류 메시지 */}
                {error && (
                    <div className={`mt-3 p-2 ${isDark ? 'bg-red-900 text-red-200' : 'bg-red-50 text-red-500'} rounded text-sm`}>
                        {error}
                    </div>
                )}

                {/* OCR 진행 상태 */}
                {ocrProgress && (
                    <div className="mt-4">
                        <div className={`overflow-hidden h-2 ${isDark ? 'bg-gray-700' : 'bg-gray-200'} rounded-full`}>
                            <div
                                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                                style={{ width: `${ocrProgress.progress}%` }}
                            />
                        </div>
                        <div className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {ocrProgress.status} ({Math.round(ocrProgress.progress)}%)
                        </div>
                    </div>
                )}
            </div>

            {/* 파일 선택 후 컨트롤 */}
            {preview && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="w-full">
                        <label
                            htmlFor="ocr-model"
                            className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}
                        >
                            OCR 모델 선택
                        </label>
                        <select
                            id="ocr-model"
                            value={selectedModel}
                            onChange={handleModelChange}
                            className={`block w-full px-3 py-2 border ${isDark ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900'} rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
                        >
                            <option value="tesseract">Tesseract OCR</option>
                            <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                            <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                            <option value="gemini-2.0-flash">Gemini 2.0</option>
                            <option value="gemini-2.0-flash-lite">Gemini 2.0 Lite</option>
                            <option value="gemini-2.0-pro-exp-02-05">Gemini 2.0 Pro</option>
                            <option value="gemini-2.0-flash-thinking-exp-01-21">Gemini 2.0 Thinking</option>
                            <option value="gemini-2.0-flash-exp-image-generation">Gemini 2.0 IMG (기본)</option>
                        </select>
                        
                        {/* 선택된 언어 정보 표시 */}
                        <div className={`mt-2 text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            인식 언어: {getLanguageName(language)}
                        </div>
                    </div>

                    <div className="flex items-end">
                        <button
                            onClick={handleUpload}
                            disabled={isLoading}
                            className={`w-full ${
                                isLoading
                                    ? (isDark ? 'bg-blue-800 cursor-not-allowed' : 'bg-blue-400 cursor-not-allowed')
                                    : (isDark ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-600 hover:bg-blue-700')
                            } text-white font-medium rounded-md py-2 px-4 flex justify-center items-center transition-colors`}
                        >
                            {isLoading ? (
                                <>
                                    <svg
                                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                    >
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                        ></circle>
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                        ></path>
                                    </svg>
                                    텍스트 추출 중...
                                </>
                            ) : (
                                '텍스트 추출하기'
                            )}
                        </button>
                    </div>
                </div>
            )}
            
            {/* 추출 버튼은 onExtractComplete가 제공된 경우에만 표시 */}
            {file && onExtractComplete && (
                <div className="mt-4 flex justify-end">
                    <button
                        className={`px-4 py-2 rounded-md font-medium text-sm focus:outline-none
                            ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-opacity-80'}
                            ${isDark 
                                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                                : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
                        onClick={handleUpload}
                        disabled={isLoading}
                    >
                        {isLoading ? '처리 중...' : '텍스트 추출'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default ImageUploader;