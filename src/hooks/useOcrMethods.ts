import { useCallback, useState } from 'react';
import { 
  SUPPORTED_LANGUAGES, 
  DEFAULT_LANGUAGE, 
  DEFAULT_IMAGE_QUALITY,
  DEFAULT_IMAGE_ZOOM,
  DEFAULT_OCR_MODEL,
  MAX_IMAGE_WIDTH,
  MAX_IMAGE_HEIGHT
} from '../constants/ocr';
import { OcrResult } from '../types';
import { ToastType, ToastTypeParam } from './useToast';

/**
 * 이미지 전처리 함수
 */
const preprocessImage = async (
  imageFile: File, 
  quality: number, 
  zoom: number, 
  maxWidth: number, 
  maxHeight: number
): Promise<File> => {
  // 이미지가 정해진 크기보다 크면 리사이징 적용
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          try {
            let width = img.width;
            let height = img.height;
            
            // 원본 크기 저장
            const originalWidth = width;
            const originalHeight = height;
            
            // 줌 적용
            if (zoom !== 100) {
              width = Math.round(width * (zoom / 100));
              height = Math.round(height * (zoom / 100));
            }
            
            // 최대 크기 제한 적용
            if (width > maxWidth || height > maxHeight) {
              const ratio = Math.min(maxWidth / width, maxHeight / height);
              width = Math.round(width * ratio);
              height = Math.round(height * ratio);
            }
            
            // 캔버스 생성 및 이미지 그리기
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
              throw new Error('Canvas 컨텍스트를 생성할 수 없습니다.');
            }
            
            // 이미지 그리기
            ctx.drawImage(img, 0, 0, width, height);
            
            // 품질 적용 (낮은 품질은 대비를 높임)
            if (quality < 100) {
              const imageData = ctx.getImageData(0, 0, width, height);
              const data = imageData.data;
              
              // 컨트라스트 적용 (품질 값에 따라 강도 조절)
              const contrast = 1 + (0.5 * (100 - quality) / 100); // 품질 50이면 컨트라스트 1.25
              const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
              
              for (let i = 0; i < data.length; i += 4) {
                // RGB 채널에 대해 컨트라스트 적용
                data[i] = factor * (data[i] - 128) + 128;     // R
                data[i + 1] = factor * (data[i + 1] - 128) + 128; // G
                data[i + 2] = factor * (data[i + 2] - 128) + 128; // B
              }
              
              ctx.putImageData(imageData, 0, 0);
            }
            
            // 캔버스를 Blob으로 변환
            canvas.toBlob((blob) => {
              if (!blob) {
                reject(new Error('이미지 변환에 실패했습니다.'));
                return;
              }
              
              // Blob을 File 객체로 변환
              const processedFile = new File([blob], imageFile.name, {
                type: blob.type,
                lastModified: Date.now()
              });
              
              // 처리된 파일 반환
              console.log(`이미지 전처리 완료: ${originalWidth}x${originalHeight} -> ${width}x${height}, 품질=${quality}%, 줌=${zoom}%`);
              resolve(processedFile);
            }, imageFile.type, quality / 100);
          } catch (error) {
            console.error('이미지 처리 오류:', error);
            // 오류 발생 시 원본 파일 반환
            resolve(imageFile);
          }
        };
        
        img.onerror = () => {
          console.error('이미지 로드 오류');
          // 이미지 로드 실패 시 원본 파일 반환
          resolve(imageFile);
        };
        
        img.src = e.target?.result as string;
      };
      
      reader.onerror = () => {
        console.error('파일 읽기 오류');
        // 파일 읽기 실패 시 원본 파일 반환
        resolve(imageFile);
      };
      
      reader.readAsDataURL(imageFile);
    } catch (error) {
      console.error('이미지 전처리 오류:', error);
      // 오류 발생 시 원본 파일 반환
      resolve(imageFile);
    }
  });
};

/**
 * IndexedDB에 이미지 저장 함수
 */
const storeImageInIndexedDB = async (imageFile: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      // 고유 ID 생성
      const imageId = `img_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      
      // IndexedDB 열기
      const request = indexedDB.open('OcrImagesDB', 1);
      
      // 데이터베이스 생성 또는 업그레이드 필요 시 호출
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // 객체 저장소가 없으면 생성
        if (!db.objectStoreNames.contains('images')) {
          db.createObjectStore('images', { keyPath: 'id' });
        }
      };
      
      // 에러 처리
      request.onerror = (event) => {
        console.error('IndexedDB 오류:', (event.target as IDBOpenDBRequest).error);
        // 실패해도 처리는 계속 진행
        resolve(imageId);
      };
      
      // 데이터베이스 열기 성공
      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // 파일을 ArrayBuffer로 변환
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const transaction = db.transaction(['images'], 'readwrite');
            const store = transaction.objectStore('images');
            
            // 이미지 데이터 저장
            const imageData = {
              id: imageId,
              data: e.target?.result,
              name: imageFile.name,
              type: imageFile.type,
              size: imageFile.size,
              timestamp: Date.now()
            };
            
            const storeRequest = store.put(imageData);
            
            storeRequest.onsuccess = () => {
              console.log(`이미지 저장 완료: ${imageId}`);
              db.close();
              resolve(imageId);
            };
            
            storeRequest.onerror = (error) => {
              console.error('이미지 저장 오류:', error);
              db.close();
              // 저장 실패해도 ID는 반환
              resolve(imageId);
            };
            
          } catch (error) {
            console.error('IndexedDB 트랜잭션 오류:', error);
            // 오류 발생해도 ID는 반환
            resolve(imageId);
          }
        };
        
        reader.onerror = (error) => {
          console.error('파일 읽기 오류:', error);
          // 읽기 실패해도 ID는 반환
          resolve(imageId);
        };
        
        reader.readAsArrayBuffer(imageFile);
      };
    } catch (error) {
      console.error('IndexedDB 초기화 오류:', error);
      // 전체 프로세스 실패해도 임시 ID 반환
      const fallbackId = `img_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      resolve(fallbackId);
    }
  });
};

/**
 * OCR 관련 기능을 제공하는 훅
 */
export const useOcrMethods = (
  showToast: (message: string, type: ToastTypeParam, duration?: number) => void
) => {
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [extractedTexts, setExtractedTexts] = useState<OcrResult[]>([]);
  const [currentLanguage, setCurrentLanguage] = useState<string>(DEFAULT_LANGUAGE);
  const [currentModel, setCurrentModel] = useState<string>(DEFAULT_OCR_MODEL);
  const [imageQuality, setImageQuality] = useState<number>(DEFAULT_IMAGE_QUALITY);
  const [imageZoom, setImageZoom] = useState<number>(DEFAULT_IMAGE_ZOOM);

  /**
   * OCR API 호출 함수
   */
  const performOcr = useCallback(async (
    imageFile: File, 
    model: string = currentModel,
    language: string = currentLanguage,
    quality: number = imageQuality,
    zoom: number = imageZoom,
    showErrorToast: boolean = true
  ): Promise<OcrResult> => {
    try {
      setIsProcessing(true);
      setProcessingProgress(10);
      
      // 이미지 전처리
      const processedImage = await preprocessImage(imageFile, quality, zoom, MAX_IMAGE_WIDTH, MAX_IMAGE_HEIGHT);
      setProcessingProgress(30);
      
      // IndexedDB에 이미지 저장
      const imageId = await storeImageInIndexedDB(processedImage);
      setProcessingProgress(50);
      
      // OCR API 요청 준비
      const formData = new FormData();
      
      // 파일명에 한글이 있으면 인코딩 문제가 발생할 수 있으므로 고유한 이름으로 변경
      const cleanedFileName = imageFile.name.replace(/[^\w\s.-]/g, '_');
      const uniqueFileName = `ocr_${Date.now()}_${cleanedFileName}`;
      
      formData.append('file', processedImage, uniqueFileName);
      formData.append('language', language);
      formData.append('model', model);
      
      // 원본 파일명도 따로 전송
      formData.append('original_filename', imageFile.name);
      
      // 인증 토큰 가져오기
      let headers: Record<string, string> = {};
      const token = localStorage.getItem('token');
      
      // 인증 토큰이 있는 경우 헤더에 추가
      if (token) {
        headers = {
          'Authorization': `Bearer ${token}`
        };
      } else {
        console.warn('인증 토큰이 없습니다. 로그인 상태를 확인하세요.');
        if (showErrorToast) {
          showToast('로그인이 필요합니다. 로그인 후 다시 시도해주세요.', ToastType.WARNING);
        }
      }
      
      setProcessingProgress(70);
      
      // 실제 API 호출
      console.log(`OCR 요청: 언어=${language}, 모델=${model}, 품질=${quality}, 줌=${zoom}, 파일명=${uniqueFileName}`);
      
      try {
        // 실제 API 호출 구현
        const response = await fetch('/api/extract', {
          method: 'POST',
          // Content-Type을 명시적으로 설정하지 않음 (FormData가 자동으로 설정)
          headers,
          body: formData,
          // 자격 증명을 포함하여 전송
          credentials: 'include',
          mode: 'cors'
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          let errorMessage = '서버 오류가 발생했습니다.';
          
          try {
            // JSON 응답인지 확인하고 파싱
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.error || errorMessage;
          } catch {
            // JSON이 아니면 텍스트 응답 사용
            if (errorText) {
              errorMessage = `서버 오류: ${errorText.substring(0, 100)}`;
            }
          }
          
          console.error('OCR API 오류:', errorMessage);
          throw new Error(errorMessage);
        }
        
        const result = await response.json();
        setProcessingProgress(90);
        
        if (!result.success) {
          throw new Error(result.error || '텍스트 추출에 실패했습니다.');
        }
        
        const ocrResult: OcrResult = {
          id: result.id,
          text: result.text || result.extracted_text,
          language: language,
          filename: imageFile.name,
          success: true,
          model: result.model
        };
        
        setProcessingProgress(100);
        
        // 결과 저장
        setExtractedTexts(prev => [...prev, ocrResult]);
        
        return ocrResult;
      } catch (error) {
        console.error('OCR 처리 중 오류 발생:', error);
        
        const errorResult: OcrResult = {
          id: null,
          text: '',
          filename: 'error',
          success: false,
          error: error instanceof Error ? error.message : '알 수 없는 오류'
        };
        
        if (showErrorToast) {
          showToast(errorResult.error || '텍스트 추출 중 오류가 발생했습니다.', ToastType.ERROR);
        }
        
        return errorResult;
      }
    } finally {
      setIsProcessing(false);
      setProcessingProgress(0);
    }
  }, [currentLanguage, currentModel, imageQuality, imageZoom, showToast]);

  /**
   * 일괄 처리 OCR 함수
   */
  const performBatchOcr = useCallback(async (
    files: File[],
    model: string = currentModel,
    language: string = currentLanguage,
    progressCallback?: (progress: number) => void
  ): Promise<OcrResult[]> => {
    const results: OcrResult[] = [];
    let processedCount = 0;
    
    // 각 파일을 순차적으로 처리
    for (const file of files) {
      try {
        // 진행률 업데이트
        if (progressCallback) {
          progressCallback(Math.floor((processedCount / files.length) * 100));
        }
        
        // OCR 수행
        const result = await performOcr(file, model, language, imageQuality, imageZoom, false);
        
        // 결과가 성공적이면 배열에 추가
        if (result.success !== false) {
          results.push(result);
        } else {
          // 오류가 있어도 결과에 추가 (실패 정보 포함)
          results.push({
            id: null,
            text: '',
            filename: file.name,
            success: false,
            error: result.error || '알 수 없는 오류'
          });
        }
      } catch (error) {
        console.error(`파일 '${file.name}' 처리 오류:`, error);
        
        // 오류가 있어도 결과에 추가 (실패 정보 포함)
        results.push({
          id: null,
          text: '',
          filename: file.name,
          success: false,
          error: error instanceof Error ? error.message : '알 수 없는 오류'
        });
      }
      
      // 처리된 파일 수 증가
      processedCount++;
    }
    
    // 완료 진행률 업데이트
    if (progressCallback) {
      progressCallback(100);
    }
    
    return results;
  }, [currentLanguage, currentModel, imageQuality, imageZoom, performOcr]);

  // OCR 사용 가능 언어 목록 반환
  const getOcrLanguages = useCallback(() => {
    return SUPPORTED_LANGUAGES;
  }, []);

  return {
    performOcr,
    performBatchOcr,
    getOcrLanguages,
    isProcessing,
    processingProgress,
    extractedTexts,
    currentLanguage,
    setCurrentLanguage,
    currentModel,
    setCurrentModel,
    imageQuality,
    setImageQuality,
    imageZoom,
    setImageZoom
  };
}; 