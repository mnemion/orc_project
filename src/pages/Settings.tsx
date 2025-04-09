import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { deleteAccount, changePassword } from '../services/api';

const Settings: React.FC = () => {
    const { user, logout } = useAuth();
    const { theme, setTheme } = useTheme();
    const { showToast } = useToast();
    const navigate = useNavigate();
    const isDark = theme === 'dark';

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);

    // 폼 상태
    const [displayName, setDisplayName] = useState<string>(
        user?.user_metadata?.name || user?.name || ''
    );
    const [language, setLanguage] = useState<string>('ko');
    const [ocrLanguage, setOcrLanguage] = useState<string>('kor+eng');
    const [darkMode, setDarkMode] = useState<boolean>(theme === 'dark');
    const [autoSave, setAutoSave] = useState<boolean>(true);

    // 비밀번호 변경 관련 State 추가
    const [currentPassword, setCurrentPassword] = useState<string>('');
    const [newPassword, setNewPassword] = useState<string>('');
    const [confirmPassword, setConfirmPassword] = useState<string>('');
    const [passwordChangeMessage, setPasswordChangeMessage] = useState<string>('');
    const [passwordChangeError, setPasswordChangeError] = useState<string>('');
    const [isChangingPassword, setIsChangingPassword] = useState<boolean>(false);

    // 사용자 설정 로드
    useEffect(() => {
        // 테마 설정
        if (isDark !== darkMode) {
            setDarkMode(isDark);
        }
        
        const savedSettings = localStorage.getItem('userSettings');
        if (savedSettings) {
            try {
                const settings = JSON.parse(savedSettings);
                setDisplayName(settings.displayName || '');
                setLanguage(settings.language || 'ko');
                setOcrLanguage(settings.ocrLanguage || 'kor+eng');
                setAutoSave(settings.autoSave !== undefined ? settings.autoSave : true);
            } catch (error) {
                console.error('설정 로드 중 오류:', error);
            }
        }
    }, [isDark, darkMode]);

    const handleSaveSettings = async () => {
        setIsLoading(true);
        
        try {
            const userSettings = {
                displayName,
                language,
                ocrLanguage,
                darkMode,
                autoSave
            };
            
            localStorage.setItem('userSettings', JSON.stringify(userSettings));
            
            setTheme(darkMode ? 'dark' : 'light');
            
            showToast('설정이 저장되었습니다.', 'success');
        } catch (error) {
            console.error('설정 저장 중 오류:', error);
            showToast('설정 저장 중 오류가 발생했습니다.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setPasswordChangeError('');
        setPasswordChangeMessage('');
        setIsChangingPassword(true);

        if (!currentPassword || !newPassword || !confirmPassword) {
            setPasswordChangeError('모든 비밀번호 필드를 입력해주세요.');
            setIsChangingPassword(false);
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordChangeError('새 비밀번호가 일치하지 않습니다.');
            setIsChangingPassword(false);
            return;
        }

        if (newPassword.length < 8) {
            setPasswordChangeError('새 비밀번호는 최소 8자 이상이어야 합니다.');
            setIsChangingPassword(false);
            return;
        }

        try {
             // apiClient.post 대신 changePassword 서비스 함수 호출
            const response = await changePassword(currentPassword, newPassword);

            if (response.success) { // api.ts에서 반환된 success 필드 확인
                setPasswordChangeMessage('비밀번호가 성공적으로 변경되었습니다.');
                showToast('비밀번호가 성공적으로 변경되었습니다.', 'success');
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
            } else {
                 // api.ts에서 반환된 error 필드 사용
                 const errorMessage = response.error || '비밀번호 변경 중 오류가 발생했습니다.';
                 setPasswordChangeError(errorMessage);
                 showToast(errorMessage, 'error');
            }
        } catch (err: any) {
            console.error("비밀번호 변경 처리 중 오류:", err);
            // api.ts 에서 에러를 throw 한 경우 catch 블록 실행
            // 네트워크 오류 등 api.ts 에서 처리되지 않은 에러 처리
            let errorMessage = '비밀번호 변경 중 예기치 않은 오류가 발생했습니다.';
            if (err.response) { // Axios 에러 형식 확인
                const errorData = err.response.data;
                const status = err.response.status;
                if (status === 401) {
                    errorMessage = errorData?.error || '인증 오류가 발생했습니다.';
                    if (errorData?.code === 'TOKEN_EXPIRED') {
                        errorMessage = '세션이 만료되었습니다. 다시 로그인해주세요.';
                        logout();
                        navigate('/login');
                    }
                } else {
                     errorMessage = errorData?.error || `서버 오류 (${status})`;
                }
            } else if (err.request) {
                 errorMessage = '서버 연결 오류. 네트워크를 확인해주세요.';
            } else {
                 errorMessage = err.message || '알 수 없는 오류 발생';
            }
             setPasswordChangeError(errorMessage);
             showToast(errorMessage, 'error');
        } finally {
            setIsChangingPassword(false);
        }
    };

    // 계정 삭제 (실제 기능 구현)
    const handleDeleteAccount = async () => {
        setIsLoading(true);
        
        try {
            const response = await deleteAccount();
            
            if (response.success) {
                showToast('계정이 성공적으로 삭제되었습니다.', 'success');
                setShowDeleteConfirm(false);
                
                // 로그아웃 처리
                logout();
                
                // 홈페이지로 리디렉션
                setTimeout(() => {
                    navigate('/');
                }, 2000);
            } else {
                showToast(response.error || '계정 삭제 중 오류가 발생했습니다.', 'error');
            }
        } catch (error) {
            console.error('계정 삭제 중 오류:', error);
            showToast('계정 삭제 중 오류가 발생했습니다.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Layout>
            <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <div className="px-4 py-6 sm:px-0">
                    <div className={`${isDark ? 'bg-gray-800 shadow' : 'bg-white shadow'} overflow-hidden sm:rounded-lg`}>
                        <div className="px-4 py-5 sm:px-6">
                            <h2 className={`text-lg leading-6 font-medium ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                                설정
                            </h2>
                            <p className={`mt-1 max-w-2xl text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                사용자 설정 및 계정 관리
                            </p>
                        </div>

                        <div className={`border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                            <dl>
                                {/* 개인 정보 설정 */}
                                <div className={`px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                                    <dt className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                                        개인 정보
                                    </dt>
                                    <dd className={`mt-1 text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'} sm:mt-0 sm:col-span-2`}>
                                        <div className="space-y-4">
                                            <div>
                                                <label htmlFor="displayName" className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                    이름
                                                </label>
                                                <input
                                                    type="text"
                                                    id="displayName"
                                                    value={displayName}
                                                    onChange={(e) => setDisplayName(e.target.value)}
                                                    className={`mt-1 block w-full border ${isDark ? 'bg-gray-800 border-gray-700 text-gray-300' : 'border-gray-300 text-gray-900'} rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                                                />
                                            </div>

                                            <div>
                                                <label htmlFor="email" className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                    이메일
                                                </label>
                                                <input
                                                    type="email"
                                                    id="email"
                                                    value={user?.email || ''}
                                                    disabled
                                                    className={`mt-1 block w-full border ${isDark ? 'bg-gray-700 border-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'} rounded-md shadow-sm py-2 px-3 sm:text-sm`}
                                                />
                                                <p className={`mt-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                    이메일은 변경할 수 없습니다.
                                                </p>
                                            </div>
                                        </div>
                                    </dd>
                                </div>

                                {/* 비밀번호 변경 섹션 추가 */}
                                <div className={`px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                                    <dt className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                                        비밀번호 변경
                                    </dt>
                                    <dd className={`mt-1 text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'} sm:mt-0 sm:col-span-2`}>
                                        <form onSubmit={handleChangePassword} className="space-y-4">
                                            <div>
                                                <label htmlFor="currentPassword" className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                    현재 비밀번호
                                                </label>
                                                <input
                                                    type="password"
                                                    id="currentPassword"
                                                    value={currentPassword}
                                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                                    required
                                                    disabled={isChangingPassword}
                                                    className={`mt-1 block w-full border ${isDark ? 'bg-gray-700 border-gray-600 text-gray-300' : 'border-gray-300 text-gray-900'} rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                                                />
                                            </div>
                                             <div>
                                                <label htmlFor="newPassword" className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                    새 비밀번호
                                                </label>
                                                <input
                                                    type="password"
                                                    id="newPassword"
                                                    value={newPassword}
                                                    onChange={(e) => setNewPassword(e.target.value)}
                                                    required
                                                    disabled={isChangingPassword}
                                                    className={`mt-1 block w-full border ${isDark ? 'bg-gray-700 border-gray-600 text-gray-300' : 'border-gray-300 text-gray-900'} rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                                                />
                                            </div>
                                             <div>
                                                <label htmlFor="confirmPassword" className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                    새 비밀번호 확인
                                                </label>
                                                <input
                                                    type="password"
                                                    id="confirmPassword"
                                                    value={confirmPassword}
                                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                                    required
                                                    disabled={isChangingPassword}
                                                    className={`mt-1 block w-full border ${isDark ? 'bg-gray-700 border-gray-600 text-gray-300' : 'border-gray-300 text-gray-900'} rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                                                />
                                            </div>

                                            {/* 메시지 및 오류 표시 */}
                                            {passwordChangeMessage && <p className="text-sm text-green-600 dark:text-green-400">{passwordChangeMessage}</p>}
                                            {passwordChangeError && <p className="text-sm text-red-600 dark:text-red-400">{passwordChangeError}</p>}

                                            <button
                                                type="submit"
                                                disabled={isChangingPassword}
                                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {isChangingPassword ? (
                                                    <span className="flex items-center">
                                                        <LoadingSpinner size="small" className="mr-2" />
                                                        변경 중...
                                                    </span>
                                                ) : '비밀번호 변경 확인'}
                                            </button>
                                        </form>
                                    </dd>
                                </div>

                                {/* 앱 설정 */}
                                <div className={`px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                                    <dt className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                                        앱 설정
                                    </dt>
                                    <dd className={`mt-1 text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'} sm:mt-0 sm:col-span-2`}>
                                        <div className="space-y-4">
                                            <div>
                                                <label htmlFor="language" className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                    언어
                                                </label>
                                                <select
                                                    id="language"
                                                    value={language}
                                                    onChange={(e) => setLanguage(e.target.value)}
                                                    className={`mt-1 block w-full pl-3 pr-10 py-2 text-base ${isDark ? 'bg-gray-800 border-gray-700 text-gray-300' : 'border-gray-300 text-gray-900'} focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md`}
                                                >
                                                    <option value="ko">한국어</option>
                                                    <option value="en">English</option>
                                                    <option value="ja">日本語</option>
                                                    <option value="zh">中文</option>
                                                </select>
                                            </div>

                                            <div>
                                                <label htmlFor="ocrLanguage" className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                    OCR 언어
                                                </label>
                                                <select
                                                    id="ocrLanguage"
                                                    value={ocrLanguage}
                                                    onChange={(e) => setOcrLanguage(e.target.value)}
                                                    className={`mt-1 block w-full pl-3 pr-10 py-2 text-base ${isDark ? 'bg-gray-800 border-gray-700 text-gray-300' : 'border-gray-300 text-gray-900'} focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md`}
                                                >
                                                    <option value="kor">한국어</option>
                                                    <option value="eng">영어</option>
                                                    <option value="kor+eng">한국어 + 영어</option>
                                                    <option value="jpn">일본어</option>
                                                    <option value="jpn+eng">일본어 + 영어</option>
                                                    <option value="chi_sim">중국어 간체</option>
                                                    <option value="chi_sim+eng">중국어 간체 + 영어</option>
                                                    <option value="kor+eng+jpn">한국어 + 영어 + 일본어</option>
                                                    <option value="kor+eng+jpn+chi_sim">한국어 + 영어 + 일본어 + 중국어</option>
                                                    <option value="deu+eng">독일어 + 영어</option>
                                                    <option value="fra+eng">프랑스어 + 영어</option>
                                                    <option value="spa+eng">스페인어 + 영어</option>
                                                    <option value="rus+eng">러시아어 + 영어</option>
                                                    <option value="multi">다국어 (한국어, 영어, 일본어, 중국어, 독일어, 프랑스어, 스페인어)</option>
                                                </select>
                                                <p className={`mt-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                    텍스트 추출에 사용할 언어를 선택합니다. 다국어 문서는 다국어 옵션을 선택하세요.
                                                </p>
                                            </div>

                                            <div className="flex items-start">
                                                <div className="flex items-center h-5">
                                                    <input
                                                        id="darkMode"
                                                        type="checkbox"
                                                        checked={darkMode}
                                                        onChange={(e) => setDarkMode(e.target.checked)}
                                                        className={`focus:ring-blue-500 h-4 w-4 text-blue-600 ${isDark ? 'bg-gray-800 border-gray-700' : 'border-gray-300'} rounded`}
                                                    />
                                                </div>
                                                <div className="ml-3 text-sm">
                                                    <label htmlFor="darkMode" className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                        다크 모드
                                                    </label>
                                                    <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                                                        어두운 테마를 사용합니다.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-start">
                                                <div className="flex items-center h-5">
                                                    <input
                                                        id="autoSave"
                                                        type="checkbox"
                                                        checked={autoSave}
                                                        onChange={(e) => setAutoSave(e.target.checked)}
                                                        className={`focus:ring-blue-500 h-4 w-4 text-blue-600 ${isDark ? 'bg-gray-800 border-gray-700' : 'border-gray-300'} rounded`}
                                                    />
                                                </div>
                                                <div className="ml-3 text-sm">
                                                    <label htmlFor="autoSave" className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                        자동 저장
                                                    </label>
                                                    <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                                                        텍스트 편집 시 자동으로 저장합니다.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </dd>
                                </div>

                                {/* 계정 관리 */}
                                <div className={`px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                                    <dt className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                                        계정 관리
                                    </dt>
                                    <dd className={`mt-1 text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'} sm:mt-0 sm:col-span-2`}>
                                        <div className="space-y-4">
                                            <button
                                                type="button"
                                                onClick={() => setShowDeleteConfirm(true)}
                                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                            >
                                                계정 삭제
                                            </button>
                                            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                계정을 삭제하면 모든 데이터가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
                                            </p>
                                        </div>
                                    </dd>
                                </div>
                            </dl>
                        </div>

                        {/* 저장 버튼 */}
                        <div className={`px-4 py-3 ${isDark ? 'bg-gray-700' : 'bg-gray-50'} text-right sm:px-6`}>
                            <button
                                type="button"
                                onClick={handleSaveSettings}
                                disabled={isLoading || isChangingPassword}
                                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? (
                                    <span className="flex items-center">
                                        <LoadingSpinner size="small" className="mr-2" />
                                        저장 중...
                                    </span>
                                ) : '설정 저장'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* 계정 삭제 확인 다이얼로그 */}
            <ConfirmDialog
                isOpen={showDeleteConfirm}
                title="계정 삭제"
                message="정말로 계정을 삭제하시겠습니까? 모든 데이터가 영구적으로 삭제되며, 이 작업은 되돌릴 수 없습니다."
                confirmText="삭제"
                cancelText="취소"
                onConfirm={handleDeleteAccount}
                onCancel={() => setShowDeleteConfirm(false)}
            />
        </Layout>
    );
};

export default Settings;