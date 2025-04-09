export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;

    return function(...args: Parameters<T>): void {
        const later = () => {
            timeout = null;
            func(...args);
        };

        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

export function throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
): (...args: Parameters<T>) => void {
    let inThrottle: boolean = false;

    return function(...args: Parameters<T>): void {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
}

export function formatFileSize(bytes: number, decimals: number = 2): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function formatDate(date: Date | string, format: string = 'YYYY-MM-DD'): string {
    const d = typeof date === 'string' ? new Date(date) : date;

    if (isNaN(d.getTime())) {
        return 'Invalid Date';
    }

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');

    return format
        .replace('YYYY', String(year))
        .replace('MM', month)
        .replace('DD', day)
        .replace('HH', hours)
        .replace('mm', minutes)
        .replace('ss', seconds);
}

export function truncateText(text: string, maxLength: number, suffix: string = '...'): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + suffix;
}

export function removeEmptyValues<T extends Record<string, any>>(obj: T): Partial<T> {
    return Object.entries(obj)
        .filter(([_, value]) => value !== null && value !== undefined && value !== '')
        .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {}) as Partial<T>;
}

export function getFileNameFromUrl(url: string | null): string {
    if (!url) return '새 추출';
    
    try {
      let filename = '';
      
      if (url.startsWith('blob:')) {
        return `추출_${new Date().toISOString().replace(/[-:.]/g, '')}_${Math.floor(Math.random() * 1000)}`;
      }
      
      filename = url.split('/').pop() || '';
      
      filename = filename.split('?')[0].split('#')[0];
      
      return filename || '새 추출';
    } catch (error) {
      console.error('파일명 추출 중 오류:', error);
      return '새 추출';
    }
}

export function getFileExtension(fileName: string): string {
    return fileName.split('.').pop()?.toLowerCase() || '';
}

export function isImageFile(fileName: string): boolean {
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
    const extension = getFileExtension(fileName);

    if (fileName.startsWith('image/')) return true;

    return imageExtensions.includes(extension);
}

export function adjustColor(color: string, amount: number): string {
    let hex = color.replace('#', '');

    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);

    r = Math.max(0, Math.min(255, r + Math.round(255 * amount)));
    g = Math.max(0, Math.min(255, g + Math.round(255 * amount)));
    b = Math.max(0, Math.min(255, b + Math.round(255 * amount)));

    const rr = r.toString(16).padStart(2, '0');
    const gg = g.toString(16).padStart(2, '0');
    const bb = b.toString(16).padStart(2, '0');

    return `#${rr}${gg}${bb}`;
}

export function setLocalStorage<T>(key: string, value: T): void {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.error('로컬 스토리지 저장 오류:', e);
    }
}

export function getLocalStorage<T>(key: string, defaultValue: T): T {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
        console.error('Local storage error:', error);
        return defaultValue;
    }
}

export function deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
}

export function generateUniqueId(prefix: string = 'id'): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function extractErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    if (typeof error === 'object' && error !== null && 'message' in error) {
        return String((error as {message: unknown}).message);
    }
    return '알 수 없는 오류가 발생했습니다.';
}

export function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const todayOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
  
  if (dateOnly.getTime() === todayOnly.getTime()) {
    return '오늘';
  }
  
  if (dateOnly.getTime() === yesterdayOnly.getTime()) {
    return '어제';
  }
  
  const daysDiff = Math.floor((todayOnly.getTime() - dateOnly.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff < 7) {
    const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    return days[date.getDay()];
  }
  
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

export function formatTime(dateString: string | undefined | null): string {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (error) {
    console.error('시간 형식 변환 오류:', error);
    return '';
  }
}

export function groupByDate<T extends { created_at: string }>(extractions: T[]): { [date: string]: T[] } {
  const grouped: { [date: string]: T[] } = {};
  
  for (const extraction of extractions) {
    if (!extraction.created_at) continue;
    
    const dateKey = formatRelativeDate(extraction.created_at);
    
    if (!grouped[dateKey]) {
      grouped[dateKey] = [];
    }
    
    grouped[dateKey].push(extraction);
  }
  
  return grouped;
}

export function isValidEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
}

export const validatePassword = (password: string): { isValid: boolean; message: string } => {
    if (!password || password.length < 8) {
        return { isValid: false, message: '비밀번호는 최소 8자 이상이어야 합니다.' };
    }    
    return { isValid: true, message: '' };
};

export const validatePasswordMatch = (
    password: string,
    confirmPassword: string
): { isValid: boolean; message: string } => {
    if (password !== confirmPassword) {
        return { isValid: false, message: '비밀번호가 일치하지 않습니다.' };
    }
    return { isValid: true, message: '' };
};

export function adaptColorToTheme(color: string, isDark: boolean): string {
    let hex = color.replace('#', '');
    
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);
    
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    
    if (isDark) {
        if (brightness > 128) {
            r = Math.max(0, r - Math.round((r - 40) * 0.7));
            g = Math.max(0, g - Math.round((g - 40) * 0.7));
            b = Math.max(0, b - Math.round((b - 40) * 0.7));
        } else {
            r = Math.min(255, r + Math.round((255 - r) * 0.5));
            g = Math.min(255, g + Math.round((255 - g) * 0.5));
            b = Math.min(255, b + Math.round((255 - b) * 0.5));
        }
    } else {
        return `#${hex}`;
    }
    
    const rr = r.toString(16).padStart(2, '0');
    const gg = g.toString(16).padStart(2, '0');
    const bb = b.toString(16).padStart(2, '0');
    
    return `#${rr}${gg}${bb}`;
}

export function detectSystemDarkMode(): boolean {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function addDarkModeListener(callback: (isDarkMode: boolean) => void): () => void {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
        callback(e.matches);
    };
    
    if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleChange);
    } else {
        mediaQuery.addListener(handleChange as any);
    }
    
    return () => {
        if (mediaQuery.removeEventListener) {
            mediaQuery.removeEventListener('change', handleChange);
        } else {
            mediaQuery.removeListener(handleChange as any);
        }
    };
}

export function fileToBase64(file: File | Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result);
            } else {
                reject(new Error('FileReader did not return a string'));
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
}

export function base64ToBlob(base64: string, mimeType: string = 'image/jpeg'): Blob {
    const base64Data = base64.split(',')[1];
    
    const byteCharacters = atob(base64Data);
    const byteArrays = [];
    
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
        const slice = byteCharacters.slice(offset, offset + 512);
        
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }
        
        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
    }
    
    return new Blob(byteArrays, { type: mimeType });
}