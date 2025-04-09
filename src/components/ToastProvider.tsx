import React, { createContext, useContext } from 'react';
import { Snackbar, Alert } from '@mui/material';
import { useToast, ToastType } from '../hooks/useToast';

// Context 타입 정의
interface ToastContextType {
  showToast: (message: string, type: ToastType, duration?: number) => void;
  showSuccessToast: (message: string, duration?: number) => void;
  showErrorToast: (message: string, duration?: number) => void;
  showWarningToast: (message: string, duration?: number) => void;
}

// Context 생성
const ToastContext = createContext<ToastContextType | null>(null);

/**
 * Toast Context 훅
 */
export const useToastContext = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToastContext는 ToastProvider 내에서 사용해야 합니다');
  }
  return context;
};

interface ToastProviderProps {
  children: React.ReactNode;
}

/**
 * 애플리케이션 전체에서 사용할 토스트 메시지 Provider
 */
const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  // 토스트 훅 사용
  const { 
    toast, 
    showToast, 
    showSuccessToast, 
    showErrorToast, 
    showWarningToast, 
    hideToast 
  } = useToast();

  // 토스트 닫기 핸들러
  const handleClose = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') return;
    hideToast();
  };

  return (
    <ToastContext.Provider value={{ 
      showToast, 
      showSuccessToast, 
      showErrorToast, 
      showWarningToast 
    }}>
      {children}
      <Snackbar
        open={!!toast}
        autoHideDuration={toast?.duration || 3000}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert 
          onClose={handleClose} 
          severity={toast?.type || 'info'} 
          variant="filled"
          sx={{ width: '100%' }}
        >
          {toast?.message || ''}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
};

export default ToastProvider; 