import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-dark-bg">
          <div className="max-w-md text-center p-8">
            <div className="text-6xl mb-4">💥</div>
            <h2 className="text-xl font-bold text-red-400 mb-2">出错了</h2>
            <p className="text-sm text-gray-400 mb-4">
              {this.state.error?.message || '发生了未知错误'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.href = '/';
              }}
              className="px-5 py-2.5 bg-accent-primary/50 hover:bg-accent-primary/70 rounded-lg text-sm transition-colors"
            >
              回到首页
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
