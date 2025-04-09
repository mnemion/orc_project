import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Layout from '../components/Layout';
import LoadingSpinner from '../components/LoadingSpinner';
import { useToast } from '../contexts/ToastContext';
import { resetPassword } from '../services/api';
import { validatePassword, validatePasswordMatch } from '../utils/helpers';

// 오류 메시지 상수화
const ERROR_MESSAGES = {
  INVALID_TOKEN: '유효하지 않은 비밀번호 재설정 링크입니다.',
  SERVER_ERROR: '비밀번호 재설정에 실패했습니다. 다시 시도해주세요.',
  SUCCESS: '비밀번호가 성공적으로 재설정되었습니다.'
};

const ResetPassword: React.FC = () => {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  
  // URL에서 토큰 추출
  const queryParams = new URLSearchParams(location.search);
  const token = queryParams.get('token');
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  
  // 토큰이 없는 경우 처리
  useEffect(() => {
    if (!token) {
      showToast(ERROR_MESSAGES.INVALID_TOKEN, 'error');
      navigate('/forgot-password');
    }
  }, [token, navigate, showToast]);
  
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
  
  // 비밀번호 재설정 처리
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
      if (token) {
        await resetPassword(token, newPassword);
        setIsSuccess(true);
        showToast(ERROR_MESSAGES.SUCCESS, 'success');
        
        // 3초 후 로그인 페이지로 리디렉션
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      }
    } catch (error) {
      showToast(ERROR_MESSAGES.SERVER_ERROR, 'error');
      console.error('비밀번호 재설정 오류:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Layout showFooter={false}>
      <div className="flex items-center justify-center min-h-screen px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md">
          {isSuccess ? (
            <div className="text-center">
              <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
                비밀번호 재설정 완료
              </h2>
              <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-300">
                비밀번호가 성공적으로 재설정되었습니다.
              </p>
              <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-300">
                잠시 후 로그인 페이지로 이동합니다.
              </p>
              <div className="mt-6">
                <LoadingSpinner />
              </div>
            </div>
          ) : (
            <div>
              <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
                비밀번호 재설정
              </h2>
              <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-300">
                새로운 비밀번호를 입력해주세요.
              </p>
              <form className="mt-8 space-y-6" onSubmit={handleResetPassword}>
                <div className="rounded-md shadow-sm space-y-4">
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
                    disabled={isLoading || !!passwordError || !!confirmError}
                    className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {isLoading ? <LoadingSpinner size="small" /> : '비밀번호 재설정'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default ResetPassword; 