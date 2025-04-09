import React, { createContext, useState, useEffect, useContext } from 'react';
import { getLocalStorage, setLocalStorage } from '../utils/helpers';

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 로컬 스토리지에서 테마 설정 가져오기 (기본값: 'light')
  const [theme, setThemeState] = useState<ThemeMode>(
    () => getLocalStorage<ThemeMode>('theme', 'light')
  );

  // 테마 변경 함수
  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    setLocalStorage('theme', newTheme);
    
    // HTML 문서에 다크 모드 클래스 적용
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // 테마 토글 함수
  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  // 초기 로드 시 테마 설정
  useEffect(() => {
    // 시스템 기본 테마 감지 (선택 사항)
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = getLocalStorage<ThemeMode>('theme', systemPrefersDark ? 'dark' : 'light');
    
    setTheme(savedTheme);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// 테마 컨텍스트를 사용하기 위한 커스텀 훅
export const useTheme = () => {
  const context = useContext(ThemeContext);
  
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  
  return context;
};