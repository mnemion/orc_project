import { useState, useCallback, useEffect } from 'react';
import { ToastType, ToastTypeParam } from './useToast';
import {
  getExtractions,
  deleteExtraction as apiDeleteExtraction,
} from '../services/api';

export const useExtractionHistory = (
  showToast?: (message: string, type: ToastTypeParam, duration?: number) => void
) => {
  const [extractions, setExtractions] = useState<ExtractionFromAPI[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchExtractions = useCallback(async (ignoreCache: boolean = false) => {
    setLoading(true);
    setError(null);
    console.log('useExtractionHistory: 추출 이력 가져오기 시작...');

    try {
      const response = await getExtractions(ignoreCache);

      console.log('useExtractionHistory: getExtractions 응답 받음', response);

      if (response.success && response.data) {
        setExtractions(response.data);
      } else {
        const errorMsg = response.error || '추출 이력을 가져오는데 실패했습니다.';
        setError(errorMsg);
        if (showToast) {
          showToast(errorMsg, ToastType.ERROR);
        }
      }
    } catch (err: any) {
      const errorMsg = err.message || '추출 이력을 가져오는 중 오류가 발생했습니다.';
      setError(errorMsg);
      if (showToast) {
        showToast(errorMsg, ToastType.ERROR);
      }
      console.error('추출 이력 가져오기 오류:', err);
    } finally {
      setLoading(false);
      console.log('useExtractionHistory: 추출 이력 가져오기 완료.');
    }
  }, [showToast]);

  useEffect(() => {
    fetchExtractions();
  }, [fetchExtractions]);

  const deleteExtraction = useCallback(async (id: number): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiDeleteExtraction(id);

      if (response.success) {
        setExtractions(prev => prev.filter(e => e.id !== id));
        if (showToast) {
          showToast('추출 항목이 삭제되었습니다.', ToastType.SUCCESS);
        }
        setLoading(false);
        return true;
      } else {
        const errorMsg = response.error || '추출 항목을 삭제하는데 실패했습니다.';
        setError(errorMsg);
        if (showToast) {
          showToast(errorMsg, ToastType.ERROR);
        }
        setLoading(false);
        return false;
      }
    } catch (err: any) {
      const errorMsg = err.message || '추출 항목을 삭제하는 중 오류가 발생했습니다.';
      setError(errorMsg);
      if (showToast) {
        showToast(errorMsg, ToastType.ERROR);
      }
      console.error('추출 항목 삭제 오류:', err);
      setLoading(false);
      return false;
    }
  }, [showToast]);

  return {
    extractions,
    loading,
    error,
    fetchExtractions,
    deleteExtraction,
  };
};

export type ExtractionFromAPI = {
  id: number;
  filename?: string | null;
  text?: string | null;
  extracted_text?: string | null;
  created_at?: string;
  updated_at?: string;
  user_id?: number | string;
  source_type?: string;
  ocr_model?: string;
  file_path?: string | null;
  language?: string | null;
  is_bookmarked?: boolean | number | null;
};