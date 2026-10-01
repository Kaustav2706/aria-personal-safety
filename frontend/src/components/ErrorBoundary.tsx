import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackScreen?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[REACT ERROR BOUNDARY] Uncaught component error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center text-[#fadcd8]">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-5 animate-pulse">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          
          <h2 className="text-xl font-black text-white tracking-tight mb-2">
            Safety Shield Alert
          </h2>
          
          <p className="text-xs text-[#fadcd8]/70 max-w-xs mb-6 leading-relaxed">
            A temporary component error was caught. Your safety session is secure.
          </p>

          {this.state.error && (
            <div className="w-full max-w-sm bg-black/40 border border-white/10 rounded-xl p-3 mb-6 text-left overflow-x-auto">
              <p className="text-[10px] font-mono text-red-300">
                {this.state.error.message || 'Unknown error occurred'}
              </p>
            </div>
          )}

          <div className="flex gap-3 w-full max-w-xs">
            <button
              onClick={this.handleReset}
              className="flex-1 py-3 px-4 rounded-xl bg-primary text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/20"
            >
              <RefreshCw className="w-4 h-4" />
              Reload View
            </button>
            <button
              onClick={() => {
                localStorage.removeItem('aria_token');
                localStorage.removeItem('aria_refresh_token');
                window.location.reload();
              }}
              className="py-3 px-4 rounded-xl bg-white/10 border border-white/10 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-white/15 active:scale-95 transition-all"
            >
              <Home className="w-4 h-4" />
              Reset
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
