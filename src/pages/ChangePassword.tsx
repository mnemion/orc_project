import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import LoadingSpinner from '../components/LoadingSpinner';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { changePassword } from '../services/api';
import { validatePassword, validatePasswordMatch } from '../utils/helpers';

// 오류 메시지 상수화
const ERROR_MESSAGES = {
  INVALID_CURRENT_PASSWORD: '현재 비밀번호가 일치하지 않습니다.',
  SERVER_ERROR: '비밀번호 변경에 실패했습니다. 다시 시도해주세요.',
  SUCCESS: '비밀번호가 성공적으로 변경되었습니다.'
};

const ChangePassword: React.FC = () => {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [countdown, setCountdown] = useState(3);
  
  // 로그인 상태 체크
  useEffect(() => {
    if (!isAuthenticated) {
      showToast('로그인이 필요합니다.', 'error');
      navigate('/login');
    }
  }, [isAuthenticated, navigate, showToast]);
  
  // 성공 시 카운트다운 후 로그인 페이지로 이동
  useEffect(() => {
    let timer: number;
    if (isSuccess && countdown > 0) {
      timer = window.setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    } else if (isSuccess && countdown === 0) {
      logout();
      navigate('/login');
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isSuccess, countdown, navigate, logout]);
  
  // 비밀번호 입력 시 유효성 검사
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewPassword(value);
    
    if (value) {
      const validation = validatePassword(value);
      setPasswordError(validation.message);
      
      // 확인 비밀번호가 있으면 일치 여부도 검사
      if (confirmPassword) {
        const matchValidation = validatePasswordMatch(value, confirmPassword);
        setConfirmError(matchValidation.message);
      }
    } else {
      setPasswordError('');
    }
  };
  
  // 확인 비밀번호 입력 시 일치 여부 검사
  const handleConfirmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setConfirmPassword(value);
    
    if (value) {
      const matchValidation = validatePasswordMatch(newPassword, value);
      setConfirmError(matchValidation.message);
    } else {
      setConfirmError('');
    }
  };
  
  // 비밀번호 변경 처리
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentPassword) {
      showToast('현재 비밀번호를 입력해주세요.', 'warning');
      return;
    }
    
    // 비밀번호 유효성 검사
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      showToast(passwordValidation.message, 'error');
      setPasswordError(passwordValidation.message);
      return;
    }
    
    // 비밀번호 일치 검사
    const matchValidation = validatePasswordMatch(newPassword, confirmPassword);
    if (!matchValidation.isValid) {
      showToast(matchValidation.message, 'error');
      setConfirmError(matchValidation.message);
      return;
    }
    
    setIsLoading(true);
    
    try {
      await changePassword(currentPassword, newPassword);
      setIsSuccess(true);
      showToast(ERROR_MESSAGES.SUCCESS, 'success');
      
      // 비밀번호 입력값 초기화
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('비밀번호 변경 오류:', error);
      
      // 오류 메시지 처리
      if (error?.message?.includes('401') || error?.message?.includes('로그인이 필요합니다')) {
        showToast('로그인 세션이 만료되었습니다. 다시 로그인해주세요.', 'error');
        navigate('/login'); // 로그인 페이지로 리디렉션
      } else if (error?.message?.includes('현재 비밀번호가 일치하지 않습니다')) {
        showToast(ERROR_MESSAGES.INVALID_CURRENT_PASSWORD, 'error');
      } else {
        showToast(error?.message || ERROR_MESSAGES.SERVER_ERROR, 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Layout>
      <div className="flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12 min-h-[calc(100vh-64px)]">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
              비밀번호 변경
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-300">
              현재 비밀번호 확인 후 새로운 비밀번호를 설정해주세요.
            </p>
          </div>
          
          {isSuccess && (
            <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded relative">
              <p>
                <strong>비밀번호가 성공적으로 변경되었습니다.</strong>
              </p>
              <p className="mt-2 text-sm">
                {countdown}초 후 자동으로 로그인 페이지로 이동합니다.
              </p>
            </div>
          )}
          
          <form className="mt-8 space-y-6" onSubmit={handleChangePassword}>
            <div className="rounded-md shadow-sm space-y-4">
              <div>
                <label htmlFor="current-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">현재 비밀번호</label>
                <input
                  id="current-password"
                  name="current-password"
                  type="password"
                  required
                  className="appearance-none relative block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-500 text-gray-900 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:border-gray-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="현재 비밀번호"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">새 비밀번호</label>
                <input
                  id="new-password"
                  name="new-password"
                  type="password"
                  required
                  className={`appearance-none relative block w-full px-3 py-2 border ${passwordError ? 'border-red-300' : 'border-gray-300'} rounded-md placeholder-gray-500 text-gray-900 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:border-gray-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm`}
                  placeholder="새 비밀번호"
                  value={newPassword}
                  onChange={handlePasswordChange}
                />
                {passwordError && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{passwordError}</p>
                )}
              </div>
              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">비밀번호 확인</label>
                <input
                  id="confirm-password"
                  name="confirm-password"
                  type="password"
                  required
                  className={`appearance-none relative block w-full px-3 py-2 border ${confirmError ? 'border-red-300' : 'border-gray-300'} rounded-md placeholder-gray-500 text-gray-900 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:border-gray-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm`}
                  placeholder="비밀번호 확인"
                  value={confirmPassword}
                  onChange={handleConfirmChange}
                />
                {confirmError && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{confirmError}</p>
                )}
              </div>
            </div>
            
            <div>
              <button
                type="submit"
                disabled={isLoading || !!passwordError || !!confirmError || isSuccess}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {isLoading ? <LoadingSpinner size="small" /> : '비밀번호 변경'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default ChangePassword; 