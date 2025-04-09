import React from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { useTheme } from '../contexts/ThemeContext';

const Home: React.FC = () => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    return (
        <Layout>
            {/* 히어로 섹션 */}
            <main>
                <div className={`relative ${isDark ? 'bg-gray-900' : ''}`}>
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
                        <div className="lg:grid lg:grid-cols-12 lg:gap-8">
                            <div className="sm:text-center md:max-w-2xl md:mx-auto lg:col-span-6 lg:text-left">
                                <h2 className={`text-4xl tracking-tight font-extrabold ${isDark ? 'text-white' : 'text-gray-900'} sm:text-5xl md:text-6xl`}>
                                    <span className={`block ${isDark ? 'text-white' : 'text-gray-900'}`}>이미지 속 텍스트를</span>
                                    <span className={`block ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>쉽게 추출하고 편집하세요</span>
                                </h2>
                                <p className={`mt-6 text-base sm:text-lg md:text-xl ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                                    AI 기반 OCR 기술로 이미지에서 텍스트를 정확하게 추출하고,
                                    편리한 인터페이스에서 자유롭게 편집할 수 있습니다.
                                    스크린샷, 문서 사진, 명함 등 다양한 이미지에서 텍스트를 추출해보세요.
                                </p>
                                <div className="mt-10 sm:flex sm:justify-center lg:justify-start">
                                    <div className="rounded-md shadow">
                                        <Link
                                            to="/dashboard"
                                            className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 md:py-4 md:text-lg"
                                        >
                                            지금 시작하기
                                        </Link>
                                    </div>
                                    <div className="mt-3 sm:mt-0 sm:ml-3">
                                        <a
                                            href="#features"
                                            className={`w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md ${
                                                isDark 
                                                ? 'text-blue-400 bg-blue-900 hover:bg-blue-800' 
                                                : 'text-blue-700 bg-blue-100 hover:bg-blue-200'
                                            } md:py-4 md:text-lg`}
                                        >
                                            자세히 알아보기
                                        </a>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-12 relative sm:max-w-lg sm:mx-auto lg:mt-0 lg:max-w-none lg:mx-0 lg:col-span-6 lg:flex lg:items-center">
                                <div className="relative mx-auto w-full rounded-lg shadow-lg lg:max-w-md">
                                    <div className={`relative block w-full ${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg overflow-hidden`}>
                                        <img
                                            src="/demo-image.svg"
                                            alt="데모 이미지"
                                            className="w-full"
                                            onError={(e) => {
                                                const target = e.target as HTMLImageElement;
                                                target.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg width="600" height="400" xmlns="http://www.w3.org/2000/svg"><rect width="600" height="400" fill="${isDark ? '#1f2937' : '#f0f4f8'}" /><rect x="150" y="100" width="300" height="200" rx="8" fill="#4299e1" opacity="0.7" /><text x="300" y="220" font-family="Arial, sans-serif" font-size="24" fill="#ffffff" text-anchor="middle">OCR 데모 이미지</text></svg>`)}`;
                                            }}
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <button
                                                type="button"
                                                className={`flex items-center justify-center ${isDark ? 'bg-gray-800' : 'bg-white'} rounded-full p-2 shadow-lg ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                                            >
                                                <svg className={`h-10 w-10 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M8 5v14l11-7z" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 특징 섹션 */}
                <div id="features" className={`py-16 ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center">
                            <h2 className={`text-3xl font-extrabold ${isDark ? 'text-white' : 'text-gray-900'} sm:text-4xl`}>
                                주요 기능
                            </h2>
                            <p className={`mt-4 max-w-2xl text-xl ${isDark ? 'text-gray-300' : 'text-gray-500'} mx-auto`}>
                                이미지 텍스트 추출기가 제공하는 강력한 기능들을 확인하세요.
                            </p>
                        </div>

                        <div className="mt-12">
                            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
                                <div className="pt-6">
                                    <div className={`flow-root ${isDark ? 'bg-gray-800' : 'bg-gray-50'} rounded-lg px-6 pb-8`}>
                                        <div className="-mt-6">
                                            <div>
                                                <span className={`inline-flex items-center justify-center p-3 ${isDark ? 'bg-blue-500' : 'bg-blue-600'} rounded-md shadow-lg`}>
                                                    <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                    </svg>
                                                </span>
                                            </div>
                                            <h3 className={`mt-8 text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>정확한 OCR 추출</h3>
                                            <p className={`mt-5 text-base ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                최신 AI 기반 OCR 기술로 다양한 형태의 이미지에서 텍스트를 높은 정확도로 인식합니다.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-6">
                                    <div className={`flow-root ${isDark ? 'bg-gray-800' : 'bg-gray-50'} rounded-lg px-6 pb-8`}>
                                        <div className="-mt-6">
                                            <div>
                                                <span className={`inline-flex items-center justify-center p-3 ${isDark ? 'bg-blue-500' : 'bg-blue-600'} rounded-md shadow-lg`}>
                                                    <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                </span>
                                            </div>
                                            <h3 className={`mt-8 text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>직관적인 텍스트 편집</h3>
                                            <p className={`mt-5 text-base ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                추출된 텍스트를 편리한 인터페이스에서 바로 수정하고 편집할 수 있습니다.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-6">
                                    <div className={`flow-root ${isDark ? 'bg-gray-800' : 'bg-gray-50'} rounded-lg px-6 pb-8`}>
                                        <div className="-mt-6">
                                            <div>
                                                <span className={`inline-flex items-center justify-center p-3 ${isDark ? 'bg-blue-500' : 'bg-blue-600'} rounded-md shadow-lg`}>
                                                    <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                                    </svg>
                                                </span>
                                            </div>
                                            <h3 className={`mt-8 text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>이력 관리 및 동기화</h3>
                                            <p className={`mt-5 text-base ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                추출한 텍스트 이력을 관리하고 Supabase를 통해 안전하게 저장하여 어디서나 접근할 수 있습니다.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </Layout>
    );
};

export default Home;