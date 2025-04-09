import { ReceiptAnalysisResult } from '../types/receipt';

export const analyzeReceipt = async (file: File, ocrModel: string = 'auto'): Promise<ReceiptAnalysisResult> => {
  try {
    const formData = new FormData();
    formData.append('file', file);

    // 파일 확장자 추출
    const getFileExtension = (filename: string): string => {
      const parts = filename.split('.');
      return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
    };
    
    // 확장자 명시적으로 추가
    const fileExtension = getFileExtension(file.name);
    formData.append('file_extension', fileExtension);
    
    // OCR 모델 선택 전달
    formData.append('ocr_model', ocrModel);

    // 타임아웃 처리를 위한 컨트롤러 추가
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30초 타임아웃
    
    const response = await fetch('/api/parse-receipt', {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId); // 응답이 오면 타임아웃 제거

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '영수증 분석 중 오류가 발생했습니다');
    }

    return data as ReceiptAnalysisResult;
  } catch (error) {
    console.error('영수증 분석 오류:', error);
    
    // AbortError는 타임아웃 발생
    if (error instanceof DOMException && error.name === 'AbortError') {
      return {
        success: false,
        full_text: '',
        items: [],
        error: '영수증 분석 시간이 초과되었습니다. 다시 시도해주세요.'
      };
    }
    
    return {
      success: false,
      full_text: '',
      items: [],
      error: error instanceof Error ? error.message : '영수증 분석 중 오류가 발생했습니다'
    };
  }
}; 