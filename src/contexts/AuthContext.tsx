import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { loginUser, registerUser } from '../services/api';
import { jwtDecode } from 'jwt-decode';

interface JwtPayload {
  user_id: number;
  email: string;
  role?: string;
  name?: string;
  username?: string;
  exp?: number;
  iat?: number;
}

interface LoginResponseData {
  token: string;
  user?: User;
}

interface RegisterResponseData {
  token?: string;
  user?: User;
}

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    error: string | null;
    isAuthenticated: boolean;
    signIn: (email: string, password: string) => Promise<boolean>;
    signUp: (email: string, password: string, name?: string) => Promise<boolean>;
    signOut: () => Promise<void>;
    logout: () => Promise<void>;
    clearError: () => void;
    updateUserInfo: (userData: User) => void;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    isLoading: true,
    error: null,
    isAuthenticated: false,
    signIn: async () => false,
    signUp: async () => false,
    signOut: async () => {},
    logout: async () => {},
    clearError: () => {},
    updateUserInfo: () => {}
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const initializeAuth = () => {
            setIsLoading(true);
            try {
                const token = localStorage.getItem('token');
                console.log('저장된 토큰 확인:', token ? '토큰 있음' : '토큰 없음');
                
                if (token) {
                    try {
                        const decodedPayload = jwtDecode<JwtPayload>(token);
                        console.log('토큰 디코딩 성공:', decodedPayload);
                        
                        const now = Date.now() / 1000;
                        const expTime = decodedPayload.exp || 0;
                        const timeLeft = expTime - now;
                        
                        console.log('토큰 만료 정보:', {
                            현재시간: new Date(now * 1000).toLocaleString(),
                            만료시간: new Date(expTime * 1000).toLocaleString(),
                            남은시간: `${Math.floor(timeLeft / 60)}분 ${Math.floor(timeLeft % 60)}초`
                        });
                        
                        if (decodedPayload.exp && timeLeft > 0) {
                            setUser({
                                id: String(decodedPayload.user_id),
                                email: decodedPayload.email,
                                name: decodedPayload.name,
                                username: decodedPayload.username,
                                role: decodedPayload.role
                            });
                            console.log('토큰에서 사용자 정보 복원 완료:', decodedPayload);
                            
                            // 토큰 만료 30분 전에 자동 로그아웃 설정
                            if (timeLeft < 1800) {
                                console.warn(`토큰 만료 임박: ${Math.floor(timeLeft / 60)}분 ${Math.floor(timeLeft % 60)}초 남음`);
                            }
                        } else {
                            console.warn('저장된 토큰 만료됨:', {
                                만료시간: new Date(expTime * 1000).toLocaleString(),
                                현재시간: new Date(now * 1000).toLocaleString()
                            });
                            localStorage.removeItem('token');
                            setUser(null);
                        }
                    } catch (decodeError) {
                        console.error('토큰 디코딩 실패:', decodeError);
                        localStorage.removeItem('token');
                        setUser(null);
                    }
                } else {
                    console.log('저장된 토큰 없음');
                    setUser(null);
                }
            } catch (e) {
                console.error('토큰 처리 또는 디코딩 오류:', e);
                localStorage.removeItem('token');
                setUser(null);
            } finally {
                setIsLoading(false);
            }
        };

        initializeAuth();

        // 스토리지 이벤트 리스너 (다른 탭에서 로그인/로그아웃 시 상태 동기화)
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'token') {
                initializeAuth();
            }
        };

        // API에서 발생시키는 인증 오류 이벤트 리스너
        const handleAuthError = (e: Event) => {
            const customEvent = e as CustomEvent<{reason: string, message: string}>;
            console.warn('인증 오류 이벤트 수신:', customEvent.detail);
            
            if (customEvent.detail.reason === 'TOKEN_EXPIRED') {
                setError('세션이 만료되었습니다. 다시 로그인해주세요.');
            } else {
                setError(customEvent.detail.message || '인증에 문제가 발생했습니다.');
            }
            
            // 사용자 상태 초기화
            localStorage.removeItem('token');
            setUser(null);
        };

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('auth:error', handleAuthError as EventListener);
        
        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('auth:error', handleAuthError as EventListener);
        };
    }, []);

    const signIn = async (email: string, password: string): Promise<boolean> => {
        if (!email || !password) {
            setError("이메일과 비밀번호를 입력해주세요.");
            return false;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await loginUser(email, password);

            const responseData = response.data as LoginResponseData | undefined;

            if (response && response.success && responseData?.token) {
                const token = responseData.token;

                localStorage.setItem('token', token);
                console.log('로그인 성공, 토큰 저장:', token);

                try {
                    const decodedPayload = jwtDecode<JwtPayload>(token);
                    setUser({
                        id: String(decodedPayload.user_id ?? responseData.user?.id),
                        email: decodedPayload.email ?? responseData.user?.email,
                        name: decodedPayload.name ?? responseData.user?.name,
                        username: decodedPayload.username ?? responseData.user?.username,
                        role: decodedPayload.role
                    });
                    console.log('로그인 후 사용자 상태 설정 완료:', decodedPayload);
                    setIsLoading(false);
                    return true;
                } catch (decodeError) {
                    console.error("로그인 성공 후 JWT 디코딩 오류:", decodeError);
                    setError("로그인 처리 중 오류가 발생했습니다.");
                    localStorage.removeItem('token');
                    setUser(null);
                    setIsLoading(false);
                    return false;
                }
            } else {
                const errorMsg = response?.error || '아이디 또는 비밀번호가 잘못되었습니다.';
                setError(errorMsg);
                setUser(null);
                localStorage.removeItem('token');
                setIsLoading(false);
                return false;
            }
        } catch (err) {
            console.error("로그인 API 호출 오류:", err);
            const errorMessage = err instanceof Error ? err.message : '로그인 중 서버 오류가 발생했습니다.';
            setError(errorMessage);
            setUser(null);
            localStorage.removeItem('token');
            setIsLoading(false);
            return false;
        }
    };

    const signUp = async (email: string, password: string, name?: string): Promise<boolean> => {
        if (!email || !password) {
            setError("이메일과 비밀번호를 입력해주세요.");
            return false;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await registerUser(email, password, name);

            const responseData = response.data as RegisterResponseData | undefined;

            if (response && response.success && responseData) {
                if (responseData.token) {
                    const token = responseData.token;
                    localStorage.setItem('token', token);
                    try {
                        const decodedPayload = jwtDecode<JwtPayload>(token);
                        setUser({
                            id: String(decodedPayload.user_id),
                            email: decodedPayload.email,
                            name: decodedPayload.name,
                            username: decodedPayload.username,
                            role: decodedPayload.role
                        });
                        console.log('회원가입 및 자동 로그인 성공');
                        setIsLoading(false);
                        return true;
                    } catch (decodeError) {
                        console.error("회원가입 성공 후 JWT 디코딩 오류:", decodeError);
                        setError("회원가입 처리 중 오류가 발생했습니다.");
                        localStorage.removeItem('token');
                        setUser(null);
                        setIsLoading(false);
                        return false;
                    }
                } else if (responseData.user) {
                    console.log('회원가입 성공 (자동 로그인 없음):', responseData.user);
                    setIsLoading(false);
                    return true;
                } else {
                    setError("회원가입 응답 형식이 올바르지 않습니다.");
                    setIsLoading(false);
                    return false;
                }
            } else {
                const errorMsg = response?.error || '회원가입 중 오류가 발생했습니다';
                setError(errorMsg);
                setIsLoading(false);
                return false;
            }
        } catch (err) {
            console.error("회원가입 API 호출 오류:", err);
            const errorMessage = err instanceof Error ? err.message : '회원가입 중 서버 오류가 발생했습니다.';
            setError(errorMessage);
            setIsLoading(false);
            return false;
        }
    };

    const signOut = async (): Promise<void> => {
        console.log('로그아웃 실행');
        setIsLoading(true);
        setError(null);
        setUser(null);
        localStorage.removeItem('token');
        localStorage.removeItem('unsaved_text');
        localStorage.removeItem('unsaved_image');
        localStorage.removeItem('userSettings');

        try {
            sessionStorage.clear();
        } catch (cleanupErr) {
            console.error('로그아웃 추가 정리 오류:', cleanupErr);
        }
        setIsLoading(false);
    };

    const clearError = () => setError(null);
    
    const updateUserInfo = (userData: User) => {
        setUser(userData);
    };

    const value: AuthContextType = {
        user,
        isLoading,
        error,
        isAuthenticated: !!user && !isLoading,
        signIn,
        signUp,
        signOut,
        logout: signOut,
        clearError,
        updateUserInfo
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);

    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }

    return context;
};