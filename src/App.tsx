import React, { useMemo, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { createTheme, ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import ToastProvider from './components/ToastProvider';
import { useAuth } from './contexts/AuthContext';
import { jwtDecode } from 'jwt-decode';
import { useToast } from './hooks/useToast';
import { useTheme as useAppTheme } from './contexts/ThemeContext';

// 페이지 컴포넌트
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ChangePassword from './pages/ChangePassword';
import History from './pages/History';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import NotFound from './pages/NotFound';
import ReceiptAnalysisPage from './pages/ReceiptAnalysisPage';
import OcrPage from './pages/OcrPage';
import PdfExtractionPage from './pages/PdfExtractionPage';
import SummarizePage from './pages/SummarizePage';
import TranslationPage from './pages/TranslationPage';
import TableExtractionPage from './pages/TableExtractionPage';
import BusinessCardPage from './pages/BusinessCardPage';

// 컴포넌트 및 컨텍스트
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { ToastProvider as AppToastProvider } from './contexts/ToastContext';

// Material UI 테마 설정을 위한 컴포넌트
const MaterialUITheme: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    
    // 테마 모드에 따라 Material UI 테마 생성
    const muiTheme = useMemo(() => 
        createTheme({
            palette: {
                mode: isDark ? 'dark' : 'light',
                primary: {
                    main: '#3b82f6',
                },
                secondary: {
                    main: '#10b981',
                },
                background: {
                    default: isDark ? '#0a0e14' : '#f9fafb',
                    paper: isDark ? '#111827' : '#ffffff',
                },
                text: {
                    primary: isDark ? '#e5e7eb' : '#1f2937',
                    secondary: isDark ? '#9ca3af' : '#6b7280',
                },
                error: {
                    main: '#ef4444',
                },
                warning: {
                    main: '#f59e0b',
                },
                info: {
                    main: '#3b82f6',
                },
                success: {
                    main: '#10b981',
                },
            },
            typography: {
                fontFamily: '"Pretendard", -apple-system, BlinkMacSystemFont, system-ui, Roboto, "Helvetica Neue", Arial, sans-serif',
            },
            components: {
                MuiButton: {
                    styleOverrides: {
                        root: {
                            textTransform: 'none',
                            borderRadius: '0.375rem',
                        },
                    },
                },
                MuiPaper: {
                    styleOverrides: {
                        root: {
                            borderRadius: '0.375rem',
                        },
                    },
                },
                MuiCssBaseline: {
                    styleOverrides: {
                        body: {
                            backgroundColor: isDark ? '#0a0e14' : '#f9fafb',
                            transition: 'background-color 0.3s ease',
                        }
                    }
                }
            },
        }),
    [isDark]);
    
    return (
        <MuiThemeProvider theme={muiTheme}>
            <CssBaseline />
            {children}
        </MuiThemeProvider>
    );
};

// 토큰 유효성 검사 컴포넌트
const TokenValidator: React.FC = () => {
    const { signOut } = useAuth();
    const { showErrorToast } = useToast();
    
    // 앱 시작 시 토큰 유효성 검사
    useEffect(() => {
        const validateToken = () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) return;
                
                // JWT 토큰 디코딩
                const decoded = jwtDecode<{ exp?: number }>(token);
                
                // 만료 시간 확인
                if (decoded.exp) {
                    const currentTime = Date.now() / 1000;
                    
                    // 토큰이 이미 만료되었거나 5분 이내에 만료될 예정
                    if (decoded.exp < currentTime) {
                        console.warn('토큰이 만료되었습니다. 자동으로 로그아웃 처리합니다.');
                        signOut();
                        showErrorToast('세션이 만료되어 로그아웃 되었습니다. 다시 로그인해주세요.');
                    } else if (decoded.exp - currentTime < 300) { // 5분 이내
                        console.warn(`토큰이 곧 만료됩니다 (${Math.floor(decoded.exp - currentTime)}초 남음)`);
                        // 여기에 토큰 갱신 로직을 추가할 수 있습니다.
                    }
                }
            } catch (error) {
                console.error('토큰 검증 오류:', error);
                localStorage.removeItem('token');
            }
        };
        
        // 앱 로드 시 1회 실행
        validateToken();
        
        // 일정 간격으로 토큰 유효성 검사 (5분마다)
        const tokenCheckInterval = setInterval(validateToken, 5 * 60 * 1000);
        
        return () => clearInterval(tokenCheckInterval);
    }, [signOut, showErrorToast]);
    
    return null; // 이 컴포넌트는 UI를 렌더링하지 않습니다
};

// 앱 내부 라우팅 컴포넌트
const AppRoutes: React.FC = () => {
    return (
        <>
            <TokenValidator />
            <Routes>
                {/* 홈 및 공개 라우트 */}
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />

                {/* 인증이 필요한 라우트 - 중첩 라우트 방식 수정 */}
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/dashboard/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
                <Route path="/dashboard/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

                {/* OCR 기능 라우트 */}
                <Route path="/ocr" element={
                    <ProtectedRoute>
                        <OcrPage />
                    </ProtectedRoute>
                } />
                <Route path="/ocr/:id" element={
                    <ProtectedRoute>
                        <OcrPage />
                    </ProtectedRoute>
                } />

                {/* PDF 추출 라우트 */}
                <Route path="/pdf-extraction" element={
                    <ProtectedRoute>
                        <PdfExtractionPage />
                    </ProtectedRoute>
                } />

                {/* 텍스트 요약 라우트 */}
                <Route path="/summarize" element={
                    <ProtectedRoute>
                        <SummarizePage />
                    </ProtectedRoute>
                } />

                {/* 언어 감지 및 번역 라우트 */}
                <Route path="/translation" element={
                    <ProtectedRoute>
                        <TranslationPage />
                    </ProtectedRoute>
                } />

                {/* 표 데이터 추출 라우트 */}
                <Route path="/table-extraction" element={
                    <ProtectedRoute>
                        <TableExtractionPage />
                    </ProtectedRoute>
                } />

                {/* 명함 인식 라우트 */}
                <Route path="/business-card" element={
                    <ProtectedRoute>
                        <BusinessCardPage />
                    </ProtectedRoute>
                } />

                {/* 영수증 분석 페이지 */}
                <Route path="/receipt-analysis" element={
                    <ProtectedRoute>
                        <ReceiptAnalysisPage />
                    </ProtectedRoute>
                } />

                {/* 404 페이지 */}
                <Route path="*" element={<NotFound />} />
            </Routes>
        </>
    );
};

const App: React.FC = () => {
    return (
        <ErrorBoundary>
            <AuthProvider>
                <ThemeProvider>
                    <MaterialUITheme>
                        <AppToastProvider>
                            <ToastProvider>
                                <Router>
                                    <AppRoutes />
                                </Router>
                            </ToastProvider>
                        </AppToastProvider>
                    </MaterialUITheme>
                </ThemeProvider>
            </AuthProvider>
        </ErrorBoundary>
    );
};

export default App;