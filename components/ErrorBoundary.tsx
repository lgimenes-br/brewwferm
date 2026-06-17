import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string; // Optional name to identify which boundary caught the error
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // We can log the error to an error reporting service here (Sentry, Datadog, etc.)
    console.error(`ErrorBoundary caught an error in ${this.props.name || 'Component'}:`, error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    // optionally window.location.reload() for a hard reset
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default Fallback UI
      return (
        <div className="flex flex-col items-center justify-center p-8 bg-neutral-900/40 border border-red-900/50 rounded-2xl backdrop-blur-sm m-4">
          <AlertTriangle size={48} className="text-red-500 mb-4 opacity-80" />
          <h2 className="text-xl font-bold text-white mb-2 tracking-tight">
            Algo deu errado
          </h2>
          <p className="text-neutral-400 text-sm mb-6 text-center max-w-md">
            O componente <strong className="text-neutral-300">{this.props.name || 'da interface'}</strong> falhou ao carregar. 
            Nossa equipe possivelmente não sabe, mas você pode tentar recarregar.
          </p>
          
          {this.state.error && (
            <div className="bg-black/50 p-4 rounded-lg w-full mb-6 border border-red-900/30 overflow-x-auto">
               <pre className="text-xs text-red-400 font-mono">
                 {this.state.error.message}
               </pre>
            </div>
          )}

          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 px-6 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl transition-colors text-sm font-bold uppercase tracking-wider"
          >
            <RefreshCw size={16} />
            Tentar Novamente
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
