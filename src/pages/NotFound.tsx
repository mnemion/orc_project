import React from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';

const NotFound: React.FC = () => {
    return (
        <Layout>
            <div className="min-h-[calc(100vh-144px)] flex items-center justify-center px-4 sm:px-6 lg:px-8">
                <div className="max-w-md w-full text-center">
                    <h1 className="text-9xl font-extrabold text-blue-600">404</h1>
                    <h2 className="mt-4 text-3xl font-bold text-gray-900">페이지를 찾을 수 없습니다</h2>
                    <p className="mt-6 text-base text-gray-500">
                        요청하신 페이지가 존재하지 않거나, 이동되었거나, 삭제되었을 수 있습니다.
                    </p>
                    <div className="mt-10">
                        <Link
                            to="/"
                            className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                        >
                            홈으로 돌아가기
                        </Link>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default NotFound;