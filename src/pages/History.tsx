import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { useTheme } from '../contexts/ThemeContext';
import { getExtractions, deleteExtraction } from '../services/api';
import { Extraction } from '../types';

const History: React.FC = () => {
  const [extractions, setExtractions] = useState<Extraction[]>([]);
  const [selectedExtraction, setSelectedExtraction] = useState<Extraction | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [newFilename, setNewFilename] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  useEffect(() => {
    loadExtractions();
  }, []);

  const loadExtractions = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setMessage(null);
      
      const response = await getExtractions();
      
      if (response && response.success) {
        const formattedExtractions: Extraction[] = (response.data || []).map((item) => ({
          id: item.id,
          filename: item.filename || '제목 없음',
          extracted_text: item.extracted_text || '',
          created_at: item.created_at || '',
          updated_at: item.updated_at,
          is_bookmarked: typeof item.is_bookmarked === 'number' ? item.is_bookmarked === 1 : !!item.is_bookmarked,
          source_type: item.source_type || 'image',
          ocr_model: item.ocr_model || 'tesseract'
        }));
        
        setExtractions(formattedExtractions);
      } else {
        setError('추출 기록을 불러오는데 실패했습니다.');
        setExtractions([]);
      }
    } catch (error) {
      setError('서버 연결 중 오류가 발생했습니다.');
      console.error('추출 기록 로드 오류:', error);
      setExtractions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditClick = (extraction: Extraction) => {
    setSelectedExtraction(extraction);
    setNewFilename(extraction.filename || '');
    setOpenDialog(true);
  };

  const handleDeleteClick = async (id: number) => {
    try {
      setIsLoading(true);
      
      const response = await deleteExtraction(id);
      
      if (response && response.success) {
        setExtractions(extractions.filter(e => e.id !== id));
        setMessage('추출 이력이 삭제되었습니다.');
      } else {
        setError('삭제 중 오류가 발생했습니다.');
      }
    } catch (error) {
      setError('삭제 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const attemptFilenameUpdate = async () => {
    if (!selectedExtraction) return;
    
    const token = localStorage.getItem('token');
    
    if (!token) {
      setError('로그인 상태가 아닙니다. 다시 로그인해주세요.');
      setOpenDialog(false);
      return;
    }
    
    try {
      setIsLoading(true);
      const apiUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/extractions/${selectedExtraction.id}/filename`;
      
      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ filename: newFilename })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setExtractions(extractions.map(e =>
          e.id === selectedExtraction.id ? { ...e, filename: newFilename } : e
        ));
        setOpenDialog(false);
        setMessage('파일명이 성공적으로 업데이트되었습니다.');
      } else {
        setError(`파일명 업데이트 실패: ${data.error || '알 수 없는 오류'}`);
        console.error('[파일명 변경] 실패 응답:', data);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      setError(`파일명 업데이트 중 오류가 발생했습니다: ${errorMessage}`);
      console.error('[파일명 변경] 예외:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedExtraction) return;

    try {
      setIsLoading(true);
      
      if (!newFilename || newFilename.trim() === '') {
        setError('파일명은 비워둘 수 없습니다.');
        return;
      }

      const token = localStorage.getItem('token');

      if (token) {
        try {
          const tokenParts = token.split('.');
          if (tokenParts.length === 3) {
            const payload = JSON.parse(atob(tokenParts[1]));
          }
        } catch (e) {
          console.error('토큰 디코딩 오류:', e);
        }
      }
      
      return attemptFilenameUpdate();
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      setError(`파일명 업데이트 중 오류가 발생했습니다: ${errorMessage}`);
      console.error('파일명 업데이트 예외:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      
      return date.toLocaleString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return '';
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <h1 className={`text-2xl font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'} mb-6`}>추출 이력</h1>
        
        <div className="flex justify-between mb-4">
          <div>
            {isLoading && 
              <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>데이터 로딩 중...</span>
            }
          </div>
          <div className="flex space-x-2">
            <button 
              onClick={loadExtractions}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              새로고침
            </button>
          </div>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center items-center py-10">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500"></div>
          </div>
        ) : error ? (
          <div className={`${isDark ? 'bg-red-900' : 'bg-red-50'} p-4 rounded-md mb-4`}>
            <div className="flex flex-col">
              <div className={isDark ? 'text-red-300' : 'text-red-700'}>
                <p className="font-bold">오류 발생:</p>
                <p>{error}</p>
              </div>
            </div>
          </div>
        ) : message ? (
          <div className={`${isDark ? 'bg-blue-900' : 'bg-blue-50'} p-4 rounded-md mb-4`}>
            <div className={isDark ? 'text-blue-300' : 'text-blue-700'}>
              <p>{message}</p>
            </div>
          </div>
        ) : extractions.length === 0 ? (
          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} shadow-md rounded-lg p-6 text-center ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
            저장된 추출 이력이 없습니다.<br />
            이미지를 업로드하여 텍스트를 추출해보세요.
          </div>
        ) : (
          <div className="overflow-hidden shadow-md rounded-lg">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className={isDark ? 'bg-gray-800' : 'bg-gray-50'}>
                <tr>
                  <th scope="col" className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>파일명</th>
                  <th scope="col" className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>추출일시</th>
                  <th scope="col" className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>추출된 텍스트</th>
                  <th scope="col" className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>작업</th>
                </tr>
              </thead>
              <tbody className={`${isDark ? 'bg-gray-900' : 'bg-white'} divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
                {extractions.map((extraction) => (
                  <tr key={extraction.id}>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{extraction.filename}</td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>{formatDate(extraction.created_at)}</td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-500'} truncate max-w-xs`}>{extraction.extracted_text}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button 
                        onClick={() => handleEditClick(extraction)}
                        className={`${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-indigo-600 hover:text-indigo-900'} mr-3`}
                      >
                        편집
                      </button>
                      <button 
                        onClick={() => handleDeleteClick(extraction.id)}
                        className="text-red-600 hover:text-red-900 dark:text-red-500 dark:hover:text-red-400"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {openDialog && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className={`absolute inset-0 ${isDark ? 'bg-gray-900' : 'bg-gray-500'} opacity-75`}></div>
            </div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className={`inline-block align-bottom ${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full`}>
              <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} px-4 pt-5 pb-4 sm:p-6 sm:pb-4`}>
                <h3 className={`text-lg leading-6 font-medium ${isDark ? 'text-gray-100' : 'text-gray-900'} mb-4`}>파일명 수정</h3>
                <div className="mt-2">
                  <input
                    type="text"
                    className={`shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm ${
                      isDark 
                        ? 'bg-gray-700 border-gray-600 text-gray-100' 
                        : 'border-gray-300 text-gray-900'
                    } rounded-md`}
                    value={newFilename}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewFilename(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>
              <div className={`${isDark ? 'bg-gray-700' : 'bg-gray-50'} px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse`}>
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={handleSave}
                >
                  저장
                </button>
                <button
                  type="button"
                  className={`mt-3 w-full inline-flex justify-center rounded-md border ${
                    isDark 
                      ? 'border-gray-600 bg-gray-800 text-gray-300 hover:bg-gray-700' 
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  } shadow-sm px-4 py-2 text-base font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm`}
                  onClick={() => setOpenDialog(false)}
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default History;