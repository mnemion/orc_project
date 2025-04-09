import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Layout from '../components/Layout';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

interface LocationState {
    from?: { pathname: string };
}

const Login: React.FC = () => {
    const [email, setEmail] = useState<string>('');
    const [password, setPassword] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [localError, setLocalError] = useState<string | null>(null);
    const { signIn, user, error: authError, clearError } = useAuth();
    const { showToast } = useToast();
    const navigate = useNavigate();
    const location = useLocation();
    const locationState = location.state as LocationState;
    
    // 로그인 필요한 페이지에서 리다이렉트된 경우 메시지 표시
    useEffect(() => {
        if (locationState?.from?.pathname && !user) {
            showToast('로그인이 필요한 페이지입니다.', 'warning');
        }
    }, [locationState, showToast, user]);

    // 이미 로그인되어 있는지 확인
    useEffect(() => {
        if (user) {
            // 이전 페이지로 리디렉션 또는 대시보드로 이동
            const destination = locationState?.from?.pathname || '/dashboard';
            navigate(destination, { replace: true });
        }
    }, [user, navigate, locationState]);

    // useAuth 훅의 에러 메시지 표시
    useEffect(() => {
        if (authError) {
            showToast(authError, 'error');
            setLocalError(authError);
            clearError();
        }
    }, [authError, showToast, clearError]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setLocalError(null);
        clearError();

        if (!email || !password) {
            showToast('이메일과 비밀번호를 모두 입력해주세요.', 'warning');
            setLocalError('이메일과 비밀번호를 모두 입력해주세요.');
            setIsSubmitting(false);
            return;
        }

        try {
            const result = await signIn(email, password);
            
            if (typeof result === 'object' && result !== null && 'id' in result) {
                showToast('로그인에 성공했습니다.', 'success');
            } else {
                const errorMessage = (typeof result === 'object' && (result as any)?.error)
                                     ? (result as any).error
                                     : '로그인에 실패했습니다. 아이디와 비밀번호를 확인해주세요.';
                showToast(errorMessage, 'error');
                setLocalError(errorMessage);
            }
        } catch (err: any) {
            const errorMessage = err.message || '로그인 중 오류가 발생했습니다.';
            showToast(errorMessage, 'error');
            setLocalError(errorMessage);
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
                            계정에 로그인
                        </h2>
                        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-300">
                            아직 계정이 없으신가요?{' '}
                            <Link to="/register" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
                                회원가입 하기
                            </Link>
                        </p>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded relative dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400">
                        <p className="text-sm">
                            회원가입 후 생성한 계정으로 로그인하세요. 회원가입 시 입력한 이메일과 비밀번호를 사용합니다.
                        </p>
                    </div>

                    {localError && (
                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mt-4" role="alert">
                            <span className="block sm:inline">{localError}</span>
                        </div>
                    )}

                    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                        <input type="hidden" name="remember" value="true" />
                        <div className="rounded-md shadow-sm -space-y-px">
                            <div>
                                <label htmlFor="email-address" className="sr-only">이메일 주소</label>
                                <input
                                    id="email-address"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={isSubmitting}
                                    className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                                    placeholder="이메일 주소"
                                />
                            </div>
                            <div>
                                <label htmlFor="password" className="sr-only">비밀번호</label>
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete="current-password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={isSubmitting}
                                    className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                                    placeholder="비밀번호"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <input
                                    id="remember-me"
                                    name="remember-me"
                                    type="checkbox"
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700"
                                />
                                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                                    로그인 상태 유지
                                </label>
                            </div>

                            <div className="text-sm">
                                <Link 
                                    to="/forgot-password"
                                    className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                                >
                                    비밀번호를 잊으셨나요?
                                </Link>
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white 
                          ${isSubmitting ? 'bg-blue-400 dark:bg-blue-500' : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-600 dark:focus:ring-offset-gray-800'}`}
                            >
                                {isSubmitting ? (
                                    <span className="flex items-center">
                                        <LoadingSpinner size="small" className="mr-2" />
                                        로그인 중...
                                    </span>
                                ) : '로그인'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </Layout>
    );
};

export default Login;