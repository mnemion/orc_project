import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { getUserProfile, updateUserProfile } from '../services/api';

const Profile: React.FC = () => {
  const { user, updateUserInfo } = useAuth();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const isDark = theme === 'dark';

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [username, setUsername] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [email, setEmail] = useState<string>('');

  useEffect(() => {
    const fetchProfile = async () => {
      setIsLoading(true);
      try {
        const response = await getUserProfile();
        
        if (response.success && response.data) {
          setDisplayName(response.data.name || '');
          setUsername(response.data.username || '');
          setEmail(response.data.email || '');
        } else {
          showToast(response.error || '프로필을 불러오는 데 실패했습니다', 'error');
        }
      } catch (error) {
        console.error('프로필 조회 중 오류:', error);
        showToast('프로필을 불러오는 중 오류가 발생했습니다', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    // 페이지 로드 시 항상 최신 정보 가져오기
    fetchProfile();
    
    // user 객체에서 초기 값 설정 (백업으로)
    if (user) {
      setDisplayName(user.name || '');
      setUsername(user.username || '');
      setEmail(user.email || '');
    }
  }, [showToast, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (saving) return;
    
    setSaving(true);
    
    try {
      const response = await updateUserProfile({ 
        name: displayName,
        username: username 
      });
      
      if (response.success) {
        if (response.token) {
          localStorage.setItem('token', response.token);
          showToast('프로필이 성공적으로 업데이트되었습니다', 'success');
          
          if (user && updateUserInfo) {
            updateUserInfo({
              ...user,
              name: displayName,
              username: username
            });
          }
          
          setTimeout(() => {
            window.location.reload();
          }, 800);
        } else {
          showToast('프로필이 업데이트되었지만 세션 정보를 갱신할 수 없습니다', 'warning');
        }
      } else {
        showToast(response.error || '프로필 업데이트에 실패했습니다', 'error');
      }
    } catch (error) {
      console.error('프로필 업데이트 중 오류:', error);
      showToast('프로필을 업데이트하는 중 오류가 발생했습니다', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSettingsClick = () => {
    navigate('/settings');
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-full py-20">
          <LoadingSpinner size="medium" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-5 sm:px-0">
          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} shadow overflow-hidden sm:rounded-lg`}>
            <div className="px-4 py-5 sm:px-6">
              <h2 className={`text-lg leading-6 font-medium ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                프로필
              </h2>
              <p className={`mt-1 max-w-2xl text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                개인 정보를 관리하세요
              </p>
            </div>
            
            <div className="border-t border-gray-700">
              <form onSubmit={handleSubmit}>
                <div className="px-4 py-5 sm:p-6">
                  <div className="grid grid-cols-1 gap-6">
                    <div>
                      <label htmlFor="name" className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        이름
                      </label>
                      <input
                        type="text"
                        id="name"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className={`mt-1 block w-full border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'} rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="username" className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        아이디
                      </label>
                      <input
                        type="text"
                        id="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className={`mt-1 block w-full border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'} rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="email" className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        이메일
                      </label>
                      <input
                        type="email"
                        id="email"
                        value={email}
                        disabled
                        className={`mt-1 block w-full border ${isDark ? 'bg-gray-600 border-gray-600 text-gray-400' : 'bg-gray-100 border-gray-300 text-gray-500'} rounded-md shadow-sm py-2 px-3 sm:text-sm`}
                      />
                      <p className={`mt-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        이메일은 변경할 수 없습니다.
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className={`px-4 py-3 ${isDark ? 'bg-gray-700' : 'bg-gray-50'} text-right sm:px-6 flex justify-between items-center`}>
                  <button
                    type="button"
                    onClick={handleSettingsClick}
                    className={`py-2 px-4 text-sm font-medium rounded-md ${isDark 
                      ? 'bg-gray-600 text-gray-300 hover:bg-gray-500' 
                      : 'bg-white text-gray-700 hover:bg-gray-50'} border border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
                  >
                    설정으로 이동
                  </button>
                  
                  <button
                    type="submit"
                    disabled={saving}
                    className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${
                      saving
                        ? 'bg-indigo-400 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                    }`}
                  >
                    {saving ? '저장 중...' : '저장하기'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Profile; 