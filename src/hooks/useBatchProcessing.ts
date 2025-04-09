import { useState, useCallback } from 'react';
import { Extraction } from '../types';
import { ToastType, ToastTypeParam } from './useToast';

export interface BatchResult {
  id: string | number | {id: number};
  text: string;
  filename?: string;
}

const isValidId = (id: string | number | {id: number}): boolean => {
  if (id === undefined || id === null) return false;
  if (typeof id === 'object' && 'id' in id) return isValidId(id.id);
  if (typeof id === 'string') return id.trim() !== '';
  return true;
};

export const useBatchProcessing = (
  setExtractedText: React.Dispatch<React.SetStateAction<string>>,
  setTextId: React.Dispatch<React.SetStateAction<number | null>>,
  setShowEditor: React.Dispatch<React.SetStateAction<boolean>>,
  addExtraction: (extraction: Extraction) => void,
  fetchExtractions: (ignoreCache?: boolean) => Promise<void>,
  showToast: (message: string, type: ToastTypeParam, duration?: number) => void,
  selectedLanguage: string,
  setIsEditMode?: React.Dispatch<React.SetStateAction<boolean>>
) => {
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);
  const [currentBatchIndex, setCurrentBatchIndex] = useState<number>(0);

  const extractIdValue = useCallback((id: string | number | {id: number}): number => {
    if (typeof id === 'object' && id !== null && 'id' in id) {
      return typeof id.id === 'string' ? parseInt(id.id, 10) : id.id;
    }
    return typeof id === 'string' ? parseInt(id, 10) : (id as number);
  }, []);

  const moveToNextBatchItem = useCallback(() => {
    if (!batchResults || batchResults.length <= 1 || currentBatchIndex >= batchResults.length - 1) return;
    
    const nextIndex = currentBatchIndex + 1;
    const nextItem = batchResults[nextIndex];
    
    setExtractedText(nextItem.text);
    setTextId(extractIdValue(nextItem.id));
    setCurrentBatchIndex(nextIndex);
    setShowEditor(true);
    if (setIsEditMode) setIsEditMode(false);
  }, [batchResults, currentBatchIndex, setExtractedText, setTextId, setShowEditor, setIsEditMode, extractIdValue]);

  const moveToPrevBatchItem = useCallback(() => {
    if (!batchResults || batchResults.length <= 1 || currentBatchIndex <= 0) return;
    
    const prevIndex = currentBatchIndex - 1;
    const prevItem = batchResults[prevIndex];
    
    setExtractedText(prevItem.text);
    setTextId(extractIdValue(prevItem.id));
    setCurrentBatchIndex(prevIndex);
    setShowEditor(true);
    if (setIsEditMode) setIsEditMode(false);
  }, [batchResults, currentBatchIndex, setExtractedText, setTextId, setShowEditor, setIsEditMode, extractIdValue]);

  const moveToBatchItem = useCallback((index: number) => {
    if (!batchResults || index < 0 || index >= batchResults.length) return;
    
    const item = batchResults[index];
    setExtractedText(item.text);
    setTextId(extractIdValue(item.id));
    setCurrentBatchIndex(index);
    setShowEditor(true);
    if (setIsEditMode) setIsEditMode(false);
  }, [batchResults, setExtractedText, setTextId, setShowEditor, setIsEditMode, extractIdValue]);

  const handleBatchComplete = useCallback(async (results: BatchResult[]) => {
    if (results.length === 0) {
      console.warn('일괄 업로드 결과가 없습니다');
      showToast('처리된 결과가 없습니다. 파일 업로드를 다시 시도해주세요.', ToastType.WARNING);
      return;
    }
    
    console.log('일괄 업로드 결과:', 
      results.map(r => ({id: r.id, hasValidId: isValidId(r.id), textLength: r.text?.length || 0, filename: r.filename})));
    
    const validResults = results.filter(r => isValidId(r.id));
    
    if (validResults.length === 0) {
      console.error('유효한 ID가 없는 결과가 전달되었습니다:', results);
      showToast('처리된 파일의 ID가 유효하지 않습니다. 다시 시도해주세요.', ToastType.ERROR);
      return;
    }
    
    const currentDate = new Date().toISOString();
    const timestamp = Date.now();
    
    const newExtractions: Extraction[] = validResults.map(result => ({
      id: extractIdValue(result.id),
      text: result.text || '',
      extracted_text: result.text || '',
      filename: result.filename || `이미지_${extractIdValue(result.id)}`,
      created_at: currentDate,
      updated_at: currentDate,
      timestamp: timestamp,
      isBookmarked: false,
      is_bookmarked: false,
      source_type: 'image',
      ocr_model: 'gemini-2.0-flash-exp-image-generation',
      language: selectedLanguage,
      batch_upload: true
    }));
    
    const hasValidTextResults = validResults.some(r => r.text && r.text.trim() !== '');
    
    const firstValidResult = hasValidTextResults
      ? validResults.find(r => r.text && r.text.trim() !== '') || validResults[0]
      : validResults[0];
    
    setExtractedText(firstValidResult.text || '');
    setTextId(extractIdValue(firstValidResult.id));
    setShowEditor(true);
    if (setIsEditMode) setIsEditMode(false);
    
    setBatchResults(validResults);
    setCurrentBatchIndex(0);
    
    newExtractions.forEach(extraction => {
      addExtraction(extraction);
    });
    
    if (hasValidTextResults) {
      showToast(`${validResults.length}개 파일의 텍스트 추출이 완료되었습니다.`, ToastType.SUCCESS);
    } else {
      showToast('텍스트 추출은 완료되었으나 일부 내용이 비어있습니다. 이미지를 확인해주세요.', ToastType.WARNING);
    }
    
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      await fetchExtractions(true);
      await new Promise(resolve => setTimeout(resolve, 1000));
      await fetchExtractions(true);
    } catch (refreshError) {
      console.error("일괄 업로드 후 추출 이력 새로고침 실패:", refreshError);
    }
  }, [fetchExtractions, setExtractedText, setShowEditor, setTextId, showToast, selectedLanguage, addExtraction, setIsEditMode, extractIdValue]);

  return {
    batchResults,
    setBatchResults,
    currentBatchIndex,
    setCurrentBatchIndex,
    moveToNextBatchItem,
    moveToPrevBatchItem,
    moveToBatchItem,
    handleBatchComplete
  };
}; 