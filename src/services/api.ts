import { 
  ApiResponse, 
  Extraction, 
  ExtractResponse, 
  UpdateFilenameResponse, 
  User,
  ExtractionFromAPI
} from '../types';
import { fileToBase64 } from '../utils/helpers';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export const apiRequest = async <T>(endpoint: string, method: string = 'GET', data?: any, headers: Record<string, string> = {}): Promise<T & { success: boolean; message?: string; error?: string; data?: any }> => {
  try {
    const normalizedEndpoint = endpoint.startsWith('/api/') 
      ? endpoint 
      : endpoint.startsWith('/') 
        ? `/api${endpoint}` 
        : `/api/${endpoint}`;
        
    const cleanedEndpoint = normalizedEndpoint.replace(/\/api\/api\//g, '/api/');
    
    const apiUrl = API_BASE_URL.endsWith('/api') && cleanedEndpoint.startsWith('/api/') 
      ? `${API_BASE_URL}${cleanedEndpoint.substring(4)}`
      : `${API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL}${cleanedEndpoint}`;
    
    const requestHeaders: Record<string, string> = {
      ...headers
    };
    
    if (!(data instanceof FormData)) {
      requestHeaders['Content-Type'] = 'application/json';
    }
    
    const token = localStorage.getItem('token');
    if (token) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
    }

    const options: RequestInit = { 
      method, 
      headers: requestHeaders,
      credentials: 'include',
      mode: 'cors'
    };
    
    if (data) {
      if (data instanceof FormData) {
        options.body = data;
      } else {
        options.body = JSON.stringify(data);
      }
    }

    const response = await fetch(apiUrl, options);
    
    let responseData: any = {};
    const contentType = response.headers.get('Content-Type');
    
    try {
      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        const text = await response.text();
        try {
          responseData = JSON.parse(text);
        } catch (e) {
          responseData = { text };
        }
      }
    } catch (parseError) {
      console.error(`응답 파싱 오류:`, parseError);
      responseData = { parseError: true };
    }
    
    if (response.status === 401) {
      console.warn('인증 오류 (401) 감지 - 토큰이 만료되었거나 유효하지 않음');
      
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem('token');
        
        // 사용자에게 알림을 표시할 수 있는 전역 이벤트 발생
        const authErrorEvent = new CustomEvent('auth:error', { 
          detail: { 
            reason: responseData.code || 'UNAUTHORIZED',
            message: responseData.error || '인증이 필요하거나 만료되었습니다.' 
          } 
        });
        window.dispatchEvent(authErrorEvent);
        
        // 로그인 필요한 API를 호출한 페이지가 로그인 페이지가 아닌 경우에만 리디렉션
        const currentPath = window.location.pathname;
        if (!currentPath.startsWith('/login') && !currentPath.startsWith('/register')) {
          const redirectUrl = encodeURIComponent(currentPath);
          
          if (responseData.code === 'TOKEN_EXPIRED') {
            console.warn('세션 만료 감지, 로그인 페이지로 이동 (2초 후)');
            setTimeout(() => {
              window.location.href = `/login?expired=true&redirect=${redirectUrl}`;
            }, 2000);
          }
        }
      }
    }
    
    const result = {
      success: response.ok,
      ...responseData,
      data: responseData.data || responseData,
      error: !response.ok ? (responseData.message || responseData.error || '서버 오류가 발생했습니다.') : undefined
    };
    
    if (!response.ok) {
      console.error(`API 오류 응답 (${cleanedEndpoint}):`, result);
    }
    
    return result as T & { success: boolean; message?: string; error?: string; data?: any };
  } catch (error: any) {
    console.error(`API 오류 (${endpoint}):`, error);
    return {
      success: false,
      error: error.message || '알 수 없는 오류가 발생했습니다.'
    } as T & { success: boolean; message?: string; error?: string; data?: any };
  }
};

export const uploadImage = async (
  formData: FormData, 
  ocrModel: string = 'tesseract',
  progressCallback?: (status: string, progress: number) => void
): Promise<ExtractResponse> => {
  try {
    if (progressCallback) {
      progressCallback('업로드 준비 중...', 0);
    }
    
    formData.append('model', ocrModel);
    
    if (!formData.has('language')) {
      formData.append('language', 'kor');
    }
    
    const file = formData.get('file') as File;
    const filename = formData.get('filename') as string;
    const language = formData.get('language') as string;
    console.log(`파일 업로드 요청: 파일=${file?.name || '없음'}, 크기=${file?.size || 0}, 타입=${file?.type || '없음'}`);
    console.log(`업로드 파라미터: 명시적 파일명=${filename || '없음'}, 언어=${language}, 모델=${ocrModel}`);
    
    if (progressCallback) {
      progressCallback('서버로 업로드 중...', 30);
    }
    
    const response = await apiRequest<ExtractResponse>(`/api/extract`, 'POST', formData);
    
    const responseKeys = Object.keys(response);
    const dataKeys = response.data ? Object.keys(response.data) : [];
    
    if (!response.data) {
      response.data = {
        id: 0,
        text: '',
        model: ocrModel,
        language: language
      };
    }
    
    const data = response.data;
    
    if ('extracted_text' in data && !data.text) {
      data.text = data.extracted_text as string;
    }
    
    if (!data.text || data.text === '') {
      if ((response as any).text) {
        data.text = (response as any).text;
      } else if ((response as any).extracted_text) {
        data.text = (response as any).extracted_text;
        data.extracted_text = (response as any).extracted_text;
      }
    }
    
    if (!data.id && (response as any).id) {
      data.id = typeof (response as any).id === 'object' 
        ? (response as any).id.id || 0 
        : (response as any).id;
    }
    
    if (progressCallback) {
      progressCallback('완료!', 100);
    }
    
    return response;
  } catch (error) {
    console.error('이미지 업로드 중 오류:', error);
    throw error;
  }
};

export const uploadMultipleImages = async (
  files: File[],
  modelName: string = 'tesseract',
  language: string = 'kor',
  progressCallback?: (status: string, progress: number, currentFileIndex: number, totalFiles: number) => void
): Promise<ApiResponse<any>[]> => {
  try {
    const results: ApiResponse<any>[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const currentIndex = i + 1;
      
      if (progressCallback) {
        progressCallback(`파일 ${currentIndex}/${files.length} 처리 중...`, 0, currentIndex, files.length);
      }
      
      try {
        if (progressCallback) {
          progressCallback(`파일 인코딩 중...`, 10, currentIndex, files.length);
        }
        
        const base64Data = await fileToBase64(file);
        
        if (progressCallback) {
          progressCallback(`서버로 전송 중...`, 30, currentIndex, files.length);
        }
        
        const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
        
        const timestamp = new Date().getTime();
        const randomStr = Math.random().toString(36).substring(2, 8);
        const safeFileName = `image_${timestamp}_${randomStr}.${fileExt}`;
        
        const payload = {
          file_data: base64Data,
          filename: safeFileName,
          language: language,
          model: modelName
        };
        
        const response = await apiRequest<ExtractResponse>(
          `/api/extract/base64`, 
          'POST', 
          payload
        );
        
        const extractedText = response.data?.text || response.data?.extracted_text || '';
        if (!extractedText.trim()) {
          console.warn(`파일 "${file.name}" 텍스트가 추출되지 않았습니다. 서버 응답:`, response);
        }
        
        if (progressCallback) {
          progressCallback(`완료!`, 100, currentIndex, files.length);
        }
        
        results.push(response);
      } catch (error) {
        console.error(`파일 "${file.name}" 처리 중 오류:`, error);
        
        results.push({
          success: false,
          error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        } as ApiResponse<any>);
      }
    }
    
    return results.map(result => {
      
      if (result.success) {
        let extractedText = '';
        let resultId = 0;
        
        if (result.data) {
          extractedText = result.data.text || result.data.extracted_text || '';
          resultId = result.data.id || 0;
        }
        
        if (!extractedText && result.extracted_text) {
          extractedText = result.extracted_text;
          
          if (typeof result.id === 'object' && result.id !== null && 'id' in result.id) {
            resultId = result.id.id;
          } else if (typeof result.id === 'number') {
            resultId = result.id;
          }
          
          if (!result.data) {
            result.data = {};
          }
        }
        
        const hasValidId = resultId > 0;
        
        return {
          ...result,
          success: true,
          data: {
            ...result.data,
            text: extractedText,
            extracted_text: extractedText,
            id: resultId
          }
        };
      }
      return result;
    });
  } catch (error) {
    console.error('다중 이미지 업로드 중 오류:', error);
    throw error;
  }
};

export const getExtractedText = async (textId: number): Promise<ApiResponse<Extraction>> => {
  try {
    return await apiRequest<ApiResponse<Extraction>>(`/api/text/${textId}`);
  } catch (error) {
    console.error('추출 텍스트 조회 중 오류:', error);
    throw error;
  }
};

export const getExtractions = async (noCache: boolean = true): Promise<ApiResponse<ExtractionFromAPI[]>> => {
  try {
    const headers: Record<string, string> = {};
    if (noCache) {
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
      headers['Pragma'] = 'no-cache';
      headers['Expires'] = '0';
    }

    const response = await apiRequest<ApiResponse<ExtractionFromAPI[]>>(
      '/api/extractions',
      'GET',
      undefined,
      headers
    );

    // 시간대 변환 처리 (KST = UTC+9)
    if (response.success && response.data && Array.isArray(response.data)) {
      response.data = response.data.map(item => {
        if (item.created_at) {
          // created_at 시간을 KST로 변환
          const utcDate = new Date(item.created_at);
          const kstDate = new Date(utcDate.getTime() + 9 * 60 * 60 * 1000);
          item.created_at = kstDate.toISOString();
        }
        if (item.updated_at) {
          // updated_at 시간을 KST로 변환
          const utcDate = new Date(item.updated_at);
          const kstDate = new Date(utcDate.getTime() + 9 * 60 * 60 * 1000);
          item.updated_at = kstDate.toISOString();
        }
        return item;
      });
    }

    return response;

  } catch (error) {
    console.error('추출 이력 가져오기 오류:', error);
    return {
      success: false,
      error: `추출 이력을 불러올 수 없습니다: ${error instanceof Error ? error.message : String(error)}`
    } as ApiResponse<ExtractionFromAPI[]>;
  }
};

export const updateExtractionFilename = async (extractionId: number, newFilename: string): Promise<UpdateFilenameResponse> => {
  try {    
    if (!newFilename || newFilename.trim() === '') {
      console.error('파일명 업데이트 오류: 빈 파일명');
      return {
        success: false,
        error: '파일명은 비워둘 수 없습니다.'
      } as UpdateFilenameResponse;
    }
    
    const response = await apiRequest<UpdateFilenameResponse>(
      `/extractions/${extractionId}/filename`, 
      'PUT', 
      { filename: newFilename.trim() }
    );
    
    return response;
  } catch (error) {
    console.error('파일명 업데이트 중 오류:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '파일명 업데이트 중 알 수 없는 오류가 발생했습니다.'
    } as UpdateFilenameResponse;
  }
};

export const deleteExtraction = async (id: number): Promise<ApiResponse> => {
  try {
    const response = await apiRequest<ApiResponse>(
      `/api/extractions/${id}`,
      'DELETE'
    );
    return response;
  } catch (error) {
    console.error('추출 삭제 오류:', error);
    return {
      success: false,
      error: `추출을 삭제할 수 없습니다: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

export const updateExtractedText = async (id: number, text: string): Promise<ApiResponse> => {
  try {
    // ID가 객체인 경우 처리
    let numericId: number;
    if (typeof id === 'object') {
      console.warn('updateExtractedText: ID가 객체로 전달됨', id);
      // id.id 형태로 전달된 경우 처리
      if (id && (id as any).id && typeof (id as any).id === 'number') {
        numericId = (id as any).id;
      } else {
        throw new Error('유효하지 않은 ID 형식');
      }
    } else {
      numericId = Number(id);
      if (isNaN(numericId)) {
        throw new Error(`ID를 숫자로 변환할 수 없음: ${id}`);
      }
    }

    const response = await apiRequest<ApiResponse>(
      `/api/text/${numericId}`,
      'PUT',
      { text },
      {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    );
    return response;
  } catch (error) {
    console.error('텍스트 업데이트 오류:', error);
    return {
      success: false,
      error: `텍스트를 업데이트할 수 없습니다: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

export const loginUser = async (email: string, password: string): Promise<ApiResponse<User>> => {
  try {
    return await apiRequest<ApiResponse<User>>(
      '/api/auth/login',
      'POST',
      { email, password }
    );
  } catch (error) {
    console.error('로그인 중 오류:', error);
    throw error;
  }
};

export const registerUser = async (
  email: string,
  password: string,
  name?: string
): Promise<ApiResponse<any>> => {
  try {
    const body: { email: string; password: string; name?: string } = {
      email,
      password,
    };
    if (name) {
      body.name = name;
    }

    const response = await apiRequest<ApiResponse<any>>(
      '/api/auth/register',
      'POST',
      body
    );
    return response;
  } catch (error: any) {
    console.error('회원가입 중 오류:', error);
    return {
      success: false,
      error: error.message || '회원가입 처리 중 알 수 없는 오류가 발생했습니다.',
    } as ApiResponse<any>;
  }
};

export const requestPasswordReset = async (email: string): Promise<ApiResponse<{ message: string }>> => {
  try {
    return await apiRequest<ApiResponse<{ message: string }>>(
      '/api/auth/reset_password_request', 
      'POST', 
      { email }
    );
  } catch (error) {
    console.error('비밀번호 재설정 요청 중 오류:', error);
    throw error;
  }
};

export const resetPassword = async (token: string, password: string): Promise<ApiResponse<{ message: string }>> => {
  try {
    return await apiRequest<ApiResponse<{ message: string }>>(
      '/api/auth/reset_password', 
      'POST', 
      { token, password }
    );
  } catch (error) {
    console.error('비밀번호 재설정 중 오류:', error);
    throw error;
  }
};

export const deleteAccount = async (): Promise<ApiResponse<{ message?: string }>> => {
  try {
    const response = await apiRequest<ApiResponse<{ message?: string }>>(
        '/api/auth/delete_account',
        'DELETE'
    );
    return response;
  } catch (error) {
    console.error('계정 삭제 중 오류:', error);
     return {
       success: false,
       error: error instanceof Error ? error.message : '계정 삭제 중 알 수 없는 오류',
     } as ApiResponse<{ message?: string }>;
  }
};

export const changePassword = async (currentPassword: string, newPassword: string): Promise<ApiResponse<null>> => {
  try {
    const response = await apiRequest<ApiResponse<null>>(
        '/api/auth/change_password',
        'POST',
        {
            current_password: currentPassword,
            new_password: newPassword,
        }
    );
    
    return response;

  } catch (error: any) {
    console.error('비밀번호 변경 중 오류:', error);
    return {
        success: false,
        error: error.message || '비밀번호 변경 중 알 수 없는 오류'
    } as ApiResponse<null>;
  }
};

export const toggleExtractionBookmark = async (extractionId: number, currentState?: boolean): Promise<ApiResponse<{ is_bookmarked: boolean }>> => {
  try {
    return await apiRequest<ApiResponse<{ is_bookmarked: boolean }>>(
      `/api/extractions/bookmark/${extractionId}`, 
      'PUT'
    );
  } catch (error) {
    console.error('북마크 토글 중 오류:', error);
    throw error;
  }
};

export const summarizeText = async (
  text: string,
  maxLength: number = 300,
  style: string = 'concise'
): Promise<ApiResponse<{ summary: string }>> => {
  try {
    // 요청 옵션에 timeout 값을 늘려서 대용량 텍스트 처리 시간 확보
    const response = await apiRequest<ApiResponse<{ summary: string }>>(
      '/api/summarize',
      'POST',
      {
        text,
        maxLength,
        style
      },
      {
        'Content-Type': 'application/json'
      }
    );

    return response;
  } catch (error) {
    console.error('텍스트 요약 API 호출 오류:', error);
    return {
      success: false,
      error: '요약 서비스 연결 중 오류가 발생했습니다.'
    };
  }
};

export const getUserProfile = async (): Promise<ApiResponse<User>> => {
  try {
    return await apiRequest<ApiResponse<User>>(
      '/api/auth/profile',
      'GET'
    );
  } catch (error) {
    console.error('프로필 정보 가져오기 중 오류:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '프로필 정보를 가져오는 중 알 수 없는 오류가 발생했습니다.',
    } as ApiResponse<User>;
  }
};

export const updateUserProfile = async (profileData: { name?: string; username?: string }): Promise<ApiResponse<User>> => {
  try {
    return await apiRequest<ApiResponse<User>>(
      '/api/auth/profile',
      'PUT',
      profileData
    );
  } catch (error) {
    console.error('프로필 업데이트 중 오류:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '프로필 업데이트 중 알 수 없는 오류가 발생했습니다.',
    } as ApiResponse<User>;
  }
};