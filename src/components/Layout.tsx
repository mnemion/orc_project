import React from 'react';
import Header from './Header';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

interface LayoutProps {
    children: React.ReactNode;
    showHeader?: boolean;
    showFooter?: boolean;
}

const Layout: React.FC<LayoutProps> = ({
    children,
    showHeader = true,
    showFooter = true,
}) => {
    const { user, signOut } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const isDark = theme === 'dark';

    const colors = {
        background: isDark ? '#1e1e1e' : '#3f51b5',
        buttonBg: isDark ? '#333333' : '#3949ab',
        textPrimary: isDark ? '#ffffff' : '#ffffff',
        textSecondary: isDark ? '#e0e0e0' : '#f5f5f5',
        shadow: isDark ? '0 2px 8px rgba(0,0,0,0.5)' : '0 2px 4px rgba(0,0,0,0.2)'
    };

    return (
        <div className={`min-h-screen flex flex-col ${isDark ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
            {showHeader && (
                <Header
                    user={user || undefined}
                    onLogout={signOut}
                    showLogout={true}
                    isDark={isDark}
                    onToggleDarkMode={toggleTheme}
                />
            )}

            <main className="flex-grow">
                {children}
            </main>

            {showFooter && (
                <footer style={{
                    backgroundColor: colors.background,
                    boxShadow: colors.shadow,
                    width: '100%',
                    height: '64px',
                    display: 'flex',
                    alignItems: 'center'
                }}>
                    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center">
                                <p style={{ 
                                    color: colors.textPrimary, 
                                    fontWeight: 500,
                                    fontSize: '1rem'
                                }}>
                                    이미지 텍스트 추출기
                                </p>
                            </div>
                            <p style={{ 
                                color: colors.textSecondary, 
                                fontSize: '0.875rem'
                            }}>
                                © {new Date().getFullYear()} All rights reserved.
                            </p>
                        </div>
                    </div>
                </footer>
            )}
        </div>
    );
};

export default Layout;