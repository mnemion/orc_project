import { useCallback, useState } from 'react';

// 토스트 타입을 enum으로 정의
export enum ToastType {
  SUCCESS = 'success',
  ERROR = 'error',
  INFO = 'info',
  WARNING = 'warning'
}

// ToastType enum 또는 문자열을 허용하는 타입
export type ToastTypeParam = ToastType | 'success' | 'error' | 'info' | 'warning';

// 문자열을 ToastType enum으로 변환하는 유틸리티 함수
export const toToastType = (type: ToastTypeParam): ToastType => {
  if (typeof type === 'string') {
    switch (type) {
      case 'success': return ToastType.SUCCESS;
      case 'error': return ToastType.ERROR;
      case 'info': return ToastType.INFO;
      case 'warning': return ToastType.WARNING;
      default: return ToastType.INFO;
    }
  }
  return type;
};

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  duration: number;
}

export const useToast = () => {
  const [toast, setToast] = useState<Toast | null>(null);

  // 토스트 메시지 표시 - 문자열과 enum을 모두 허용
  const showToast = useCallback((message: string, type: ToastTypeParam, duration = 3000) => {
    setToast({
      id: Date.now(),
      message,
      type: toToastType(type),
      duration
    });
  }, []);

  // 성공 토스트
  const showSuccessToast = useCallback((message: string, duration = 3000) => {
    showToast(message, ToastType.SUCCESS, duration);
  }, [showToast]);

  // 에러 토스트
  const showErrorToast = useCallback((message: string, duration = 3000) => {
    showToast(message, ToastType.ERROR, duration);
  }, [showToast]);

  // 정보 토스트
  const showInfoToast = useCallback((message: string, duration = 3000) => {
    showToast(message, ToastType.INFO, duration);
  }, [showToast]);

  // 경고 토스트
  const showWarningToast = useCallback((message: string, duration = 3000) => {
    showToast(message, ToastType.WARNING, duration);
  }, [showToast]);

  // 토스트 숨기기
  const hideToast = useCallback(() => {
    setToast(null);
  }, []);

  return {
    toast,
    showToast,
    showSuccessToast,
    showErrorToast,
    showInfoToast,
    showWarningToast,
    hideToast
  };
}; 