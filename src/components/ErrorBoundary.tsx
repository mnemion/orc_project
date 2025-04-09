import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error: Error): State {
        // 다음 렌더링에서 폴백 UI가 보이도록 상태를 업데이트
        return { hasError: true, error, errorInfo: null };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        // 에러 정보를 상태에 저장
        this.setState({
            error,
            errorInfo
        });
    }

    render(): ReactNode {
        if (this.state.hasError) {
            // 사용자 정의 폴백 UI가 있으면 사용
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // 기본 폴백 UI
            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
                    <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-md">
                        <div>
                            <h2 className="text-center text-2xl font-bold text-gray-900">
                                문제가 발생했습니다
                            </h2>
                            <p className="mt-2 text-center text-sm text-gray-600">
                                예기치 않은 오류가 발생했습니다. 죄송합니다.
                            </p>
                        </div>

                        <div className="mt-6 flex items-center justify-center gap-4">
                            <button
                                onClick={() => window.location.reload()}
                                className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none"
                            >
                                페이지 새로고침
                            </button>
                            <Link
                                to="/"
                                className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                            >
                                홈으로 돌아가기
                            </Link>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;