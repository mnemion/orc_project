import { useState, useCallback, useEffect } from 'react';
import { Extraction } from '../types';
import { ToastTypeParam } from './useToast';

type ToastFunction = (message: string, type: ToastTypeParam, duration?: number) => void;

// 이미지 최적화를 위한 함수
const optimizeImage = async (imageBlob: Blob, quality = 0.7, maxWidth = 1920): Promise<Blob> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      
      // 너비 조정
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            resolve(blob as Blob);
          },
          'image/jpeg',
          quality
        );
      } else {
        // Context를 얻지 못한 경우 원본 blob 반환
        resolve(imageBlob);
      }
    };
    
    img.src = URL.createObjectURL(imageBlob);
  });
};

/**
 * 이미지 관리를 위한 커스텀 훅
 */
export const useImageManager = (
  showToast: ToastFunction,
  setProcessingOcr?: React.Dispatch<React.SetStateAction<boolean>>,
  handleExtractComplete?: Function,
  selectedExtraction?: Extraction | null,
  selectedLanguage?: string,
  setExtractedText?: React.Dispatch<React.SetStateAction<string>>,
  setShowEditor?: React.Dispatch<React.SetStateAction<boolean>>,
  setTextId?: React.Dispatch<React.SetStateAction<number | null>>
) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [imageQuality, setImageQuality] = useState<number>(70);
  const [imageZoom, setImageZoom] = useState<number>(1.0);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isImageEditorOpen, setIsImageEditorOpen] = useState<boolean>(false);
  
  // previewUrl이 변경되면 previewUrls 배열도 업데이트
  useEffect(() => {
    if (previewUrl) {
      setPreviewUrls([previewUrl]);
    } else {
      setPreviewUrls([]);
    }
  }, [previewUrl]);

  // selectedFile이 변경되면 selectedFiles 배열도 업데이트
  useEffect(() => {
    if (selectedFile) {
      setSelectedFiles([selectedFile]);
    } else {
      setSelectedFiles([]);
    }
  }, [selectedFile]);
  
  // Blob URL 정리 함수
  const cleanupBlobUrls = useCallback(() => {
    try {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
      previewUrls.forEach(url => {
        if (url && url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    } catch (error) {
      console.error('Blob URL 정리 중 오류:', error);
    }
  }, [previewUrl, previewUrls]);
  
  // 컴포넌트 언마운트 시 URL 정리
  useEffect(() => {
    return () => {
      cleanupBlobUrls();
    };
  }, [cleanupBlobUrls]);
  
  // 이미지 로드 함수
  const loadImage = useCallback(async (extractionId: string) => {
    try {
      console.log(`이미지 Data URL 로드 시작: ID=${extractionId}`);
      
      // 현재 URL 초기화 (로딩 상태 표시용)
      setPreviewUrl(null);
      setPreviewUrls([]);
      
      // IndexedDB에서 이미지를 가져오는 로직
      // 실제 구현은 프로젝트의 기존 코드에 맞게 조정 필요
      // 임시로 목업 구현
      const mockDataUrl = `data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD+/iiiigD/2Q==`;
      
      setTimeout(() => {
        setPreviewUrl(mockDataUrl);
        setPreviewUrls([mockDataUrl]);
        console.log(`이미지 Data URL 로드 성공: ${extractionId}`);
      }, 300);
      
      return mockDataUrl;
    } catch (error) {
      console.error('저장된 이미지 로드 중 오류:', error);
      setPreviewUrl(''); // 오류 시에도 초기화
      setPreviewUrls([]);
      return null;
    }
  }, []);
  
  // 파일 선택 핸들러
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) {
      return;
    }
    
    // 기존 URL 정리
    cleanupBlobUrls();
    
    const file = event.target.files[0];
    const fileUrl = URL.createObjectURL(file);
    
    setSelectedFile(file);
    setSelectedFiles([file]);
    setPreviewUrl(fileUrl);
    setPreviewUrls([fileUrl]);
  }, [cleanupBlobUrls]);
  
  // 이미지 품질 변경
  const changeImageQuality = useCallback(async (newQuality: number, extractionId?: string) => {
    setImageQuality(newQuality);
    
    // 기존 파일이 있는 경우 품질 조정
    if (selectedFile) {
      try {
        const reader = new FileReader();
        reader.onload = async (event) => {
          if (event.target && event.target.result) {
            const arrayBuffer = event.target.result as ArrayBuffer;
            const blob = new Blob([arrayBuffer]);
            
            // 기존 URL 정리
            cleanupBlobUrls();
            
            const optimizedBlob = await optimizeImage(blob, newQuality / 100);
            const optimizedUrl = URL.createObjectURL(optimizedBlob);
            
            setPreviewUrl(optimizedUrl);
            setPreviewUrls([optimizedUrl]);
          }
        };
        reader.readAsArrayBuffer(selectedFile);
      } catch (error) {
        console.error('이미지 품질 변경 중 오류:', error);
        showToast('이미지 품질 변경 중 오류가 발생했습니다.', 'error');
      }
    }
    // extractionId가 있는 경우 저장된 이미지 처리
    else if (extractionId) {
      // 실제 구현에서는 IndexedDB에서 이미지를 가져와 최적화 수행
      // 여기서는 임시로 품질만 설정
      console.log(`이미지 품질 변경: ${newQuality}%, ID=${extractionId}`);
    }
  }, [selectedFile, cleanupBlobUrls, showToast]);
  
  // 이미지 줌 변경
  const changeImageZoom = useCallback((newZoom: number) => {
    setImageZoom(newZoom);
  }, []);
  
  // 이미지 편집기 열기
  const openImageEditor = useCallback((imageUrl: string, file: File) => {
    setSelectedImage(imageUrl);
    setIsImageEditorOpen(true);
  }, []);
  
  // 이미지 편집기 닫기
  const closeImageEditor = useCallback(() => {
    setIsImageEditorOpen(false);
    setSelectedImage(null);
  }, []);
  
  // 크롭된 이미지 처리
  const handleCropComplete = useCallback((croppedImageUrl: string) => {
    if (!selectedFile) return;
    
    // 기존 URL 정리
    cleanupBlobUrls();
    
    // Base64 이미지 URL 설정
    setPreviewUrl(croppedImageUrl);
    setPreviewUrls([croppedImageUrl]);
    
    // 필요한 경우 이미지 처리 로직 추가
    if (setProcessingOcr && handleExtractComplete && selectedLanguage) {
      setProcessingOcr(true);
      
      // 실제 구현에서는 이미지 처리 및 OCR 로직 호출
      // 여기서는 임시로 로그만 출력
      console.log('크롭된 이미지 처리: ', croppedImageUrl.substring(0, 50) + '...');
      
      // 작업 완료 후 editor 닫기
      setIsImageEditorOpen(false);
    } else {
      // 단순 이미지 편집 모드인 경우 editor 닫기
      setIsImageEditorOpen(false);
    }
  }, [selectedFile, cleanupBlobUrls, setProcessingOcr, handleExtractComplete, selectedLanguage]);
  
  return {
    previewUrl,
    previewUrls,
    selectedFile,
    selectedFiles,
    imageQuality,
    imageZoom,
    isImageEditorOpen,
    isEditorOpen: isImageEditorOpen,
    setIsImageEditorOpen,
    setIsEditorOpen: setIsImageEditorOpen,
    loadImage,
    handleFileSelect,
    changeImageQuality,
    changeImageZoom,
    handleCropComplete,
    cleanupBlobUrls,
    selectedImage,
    openImageEditor,
    closeImageEditor
  };
}; 