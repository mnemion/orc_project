import React, { createContext, useContext, useState, useCallback } from 'react';
import { ToastType, ToastTypeParam, toToastType } from '../hooks/useToast';

// 컨텍스트 타입 정의
interface ToastContextProps {
  isOpen: boolean;
  message: string;
  type: ToastType;
  autoHideDuration: number;
  showToast: (message: string, type: ToastTypeParam, duration?: number) => void;
  hideToast: () => void;
}

// 기본값으로 컨텍스트 생성
export const ToastContext = createContext<ToastContextProps>({
  isOpen: false,
  message: '',
  type: ToastType.INFO,
  autoHideDuration: 3000,
  showToast: () => {},
  hideToast: () => {}
});

interface ToastProviderProps {
  children: React.ReactNode;
}

// Toast 제공자 컴포넌트
export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toast, setToast] = useState({
    isOpen: false,
    message: '',
    type: ToastType.INFO,
    autoHideDuration: 3000
  });

  // 토스트 메시지 표시
  const showToast = useCallback((
    message: string, 
    type: ToastTypeParam = ToastType.INFO, 
    duration: number = 3000
  ) => {
    setToast({
      isOpen: true,
      message,
      type: toToastType(type),
      autoHideDuration: duration
    });
  }, []);

  // 토스트 메시지 숨기기
  const hideToast = useCallback(() => {
    setToast(prev => ({ ...prev, isOpen: false }));
  }, []);

  return (
    <ToastContext.Provider value={{ ...toast, showToast, hideToast }}>
      {children}
    </ToastContext.Provider>
  );
};

// 커스텀 훅
export const useToast = () => {
  const context = useContext(ToastContext);
  
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  
  return context;
};