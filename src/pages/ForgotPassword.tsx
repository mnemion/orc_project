import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import LoadingSpinner from '../components/LoadingSpinner';
import { isValidEmail } from '../utils/helpers';
import { useToast } from '../contexts/ToastContext';
import { requestPasswordReset } from '../services/api';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 이메일 유효성 검사
    if (!email) {
      showToast('이메일을 입력해주세요.', 'warning');
      return;
    }

    if (!isValidEmail(email)) {
      showToast('유효한 이메일 주소를 입력해주세요.', 'warning');
      return;
    }

    setIsSubmitting(true);

    try {
      // 실제 비밀번호 재설정 요청 API 호출
      await requestPasswordReset(email);
      setIsSuccess(true);
      showToast('비밀번호 재설정 이메일이 발송되었습니다.', 'success');
    } catch (err) {
      showToast('비밀번호 재설정 요청 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout showFooter={false}>
      <div className="flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12 min-h-[calc(100vh-64px)]">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
              비밀번호 찾기
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-300">
              계정에 등록된 이메일로 비밀번호 재설정 링크를 보내드립니다.
            </p>
          </div>

          {isSuccess ? (
            <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded relative">
              <p>
                <strong>비밀번호 재설정 이메일이 발송되었습니다.</strong>
              </p>
              <p className="mt-2">
                {email}로 발송된 이메일을 확인하여 비밀번호 재설정을 완료해주세요.
                이메일이 도착하지 않았다면 스팸 폴더를 확인해보세요.
              </p>
              <div className="mt-4 text-center">
                <Link
                  to="/login"
                  className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  로그인 페이지로 돌아가기
                </Link>
              </div>
            </div>
          ) : (
            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="email-address" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  이메일 주소
                </label>
                <div className="mt-1">
                  <input
                    id="email-address"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isSubmitting}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                    placeholder="example@email.com"
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                    isSubmitting
                      ? 'bg-blue-400 dark:bg-blue-500'
                      : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800'
                  }`}
                >
                  {isSubmitting ? (
                    <span className="flex items-center">
                      <LoadingSpinner size="small" className="mr-2" />
                      처리 중...
                    </span>
                  ) : (
                    '비밀번호 재설정 이메일 보내기'
                  )}
                </button>
              </div>

              <div className="text-center">
                <Link
                  to="/login"
                  className="font-medium text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  로그인 페이지로 돌아가기
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default ForgotPassword; 