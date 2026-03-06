//错误边界组件
// src/components/player/ErrorBoundary.tsx
import React, { Component } from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('PlayerPanel 错误:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-[#d4a853] p-4 text-center">
          <div>
            <h2 className="text-2xl font-bold mb-4">界面加载出错</h2>
            <p className="text-[#aaaaaa] mb-6">请刷新页面重试</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-3 rounded bg-[#d4a853] text-[#0a0a0a] font-bold text-lg"
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