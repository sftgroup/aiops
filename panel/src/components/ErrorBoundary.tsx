import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex items-center justify-center min-h-screen bg-dark-bg">
          <div className="max-w-md text-center p-8">
            <div className="text-6xl mb-4">💥</div>
            <h2 className="text-xl font-bold text-red-400 mb-2">出错了</h2>
            <p className="text-sm text-gray-400 mb-4">
              {this.state.error?.message || '发生了未知错误'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-lg text-sm transition-colors"
              aria-label="刷新页面"
            >
              刷新页面
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/** 页面级错误提示，可作为 ErrorBoundary 的 fallback prop 使用 */
export function PageError({ title, message }: { title?: string; message?: string }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh] bg-dark-bg">
      <div className="max-w-md text-center p-8">
        <div className="text-6xl mb-4">💥</div>
        <h2 className="text-xl font-bold text-red-400 mb-2">{title || '页面出错了'}</h2>
        <p className="text-sm text-gray-400 mb-6">{message || '页面遇到意外错误，请刷新重试'}</p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-lg text-sm transition-colors"
            aria-label="刷新页面"
          >
            刷新页面
          </button>
          <button
            onClick={() => { window.location.href = '/'; }}
            className="px-5 py-2.5 bg-dark-card hover:bg-dark-hover text-gray-400 border border-dark-border rounded-lg text-sm transition-colors"
            aria-label="回到首页"
          >
            回到首页
          </button>
        </div>
      </div>
    </div>
  );
}

export default ErrorBoundary;
