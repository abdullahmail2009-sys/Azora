import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home, RotateCcw, Copy, Check } from 'lucide-react';
import { AzoraPrimaryLogo } from './AzoraBrandLogo.tsx';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      copied: false,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('AZORA ErrorBoundary caught an unhandled error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleTryAgain = () => {
    if (this.props.onReset) {
      this.props.onReset();
    }
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  handleClearStaleCacheAndReload = () => {
    try {
      if (typeof window !== 'undefined') {
        // Clear session storage & temporary cached states, preserve core items
        sessionStorage.clear();
        localStorage.removeItem('azora_temp_session');
        window.location.href = '/';
      }
    } catch {
      window.location.reload();
    }
  };

  handleCopyDetails = () => {
    const details = `Error: ${this.state.error?.message || 'Unknown'}\nStack: ${
      this.state.error?.stack || ''
    }\nComponent: ${this.state.errorInfo?.componentStack || ''}`;
    navigator.clipboard?.writeText(details);
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2000);
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FBF7EF] text-[#1B4D48] flex flex-col items-center justify-center p-4 selection:bg-[#42BDAE] selection:text-white">
          <div className="max-w-lg w-full bg-[#F5EFE2] rounded-3xl p-6 sm:p-8 border border-[#E2DAC7] shadow-xl space-y-6 text-center">
            {/* Header Brand */}
            <div className="flex justify-center">
              <AzoraPrimaryLogo
                layout="horizontal"
                symbolSize={42}
                showTagline={false}
                idPrefix="error-boundary-logo"
              />
            </div>

            {/* Error Icon Badge */}
            <div className="w-16 h-16 rounded-2xl bg-[#E11D48]/10 border border-[#E11D48]/20 text-[#E11D48] flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8" />
            </div>

            {/* Title & Explanation */}
            <div className="space-y-2">
              <h1 className="text-xl sm:text-2xl font-bold text-[#1B4D48]">
                {this.props.fallbackTitle || 'Display Interruption Recovered'}
              </h1>
              <p className="text-sm text-[#4A6B66] leading-relaxed">
                AZORA intercepted an unexpected interface error. Your study notes, syllabus mastery,
                and streak progress remain safely stored.
              </p>
            </div>

            {/* Error Message Box */}
            {this.state.error && (
              <div className="p-3.5 rounded-xl bg-[#FBF7EF] border border-[#E5DEC9] text-left text-xs font-mono text-[#52736E] max-h-32 overflow-y-auto break-all">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            {/* Primary Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleTryAgain}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#1B4D48] hover:bg-[#153D39] text-[#FBF7EF] font-semibold text-sm transition cursor-pointer shadow-xs"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Resume Study</span>
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#75D9B4]/30 hover:bg-[#75D9B4]/50 text-[#1B4D48] border border-[#42BDAE] font-semibold text-sm transition cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload App</span>
              </button>
            </div>

            {/* Secondary Actions */}
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs pt-1 border-t border-[#E5DEC9]">
              <button
                type="button"
                onClick={this.handleClearStaleCacheAndReload}
                className="text-[#4A6B66] hover:text-[#1B4D48] underline transition cursor-pointer"
              >
                Restart Fresh Session
              </button>
              <button
                type="button"
                onClick={this.handleCopyDetails}
                className="flex items-center gap-1 text-[#4A6B66] hover:text-[#1B4D48] transition cursor-pointer"
              >
                {this.state.copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#1B4D48]" />
                    <span className="text-[#1B4D48] font-medium">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Diagnostic</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
