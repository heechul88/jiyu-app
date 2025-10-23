import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    console.error('Error stack:', error.stack);
    console.error('Component stack:', errorInfo.componentStack);
    
    // DOM 관련 오류인지 확인
    if (error.message && error.message.includes('removeChild')) {
      console.error('DOM removeChild 오류 감지됨');
    }
    
    // 추가 디버깅 정보
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl border shadow p-6 space-y-4 text-center">
            <div className="text-red-500 text-4xl mb-4">⚠️</div>
            <h1 className="text-xl font-bold text-gray-900">오류가 발생했습니다</h1>
            <p className="text-gray-600">
              페이지를 새로고침하거나 잠시 후 다시 시도해주세요.
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                // 페이지 새로고침 대신 부드러운 복구 시도
                try {
                  // YouTube 플레이어 관련 DOM 정리
                  const ytPlayer = document.getElementById('yt-player');
                  if (ytPlayer) {
                    ytPlayer.innerHTML = '';
                  }
                  
                  // 잠시 후 새로고침
                  setTimeout(() => {
                    window.location.reload();
                  }, 500);
                } catch (e) {
                  console.error('복구 시도 중 오류:', e);
                  window.location.reload();
                }
              }}
              className="w-full py-2 rounded-lg bg-black text-white hover:bg-gray-800 transition-colors"
            >
              페이지 새로고침
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
