import { Component, ErrorInfo, ReactNode } from 'react';
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
        <div className="flex flex-col items-center justify-center p-8 bg-white border border-red-200 rounded-2xl backdrop-blur-sm m-4">
          <AlertTriangle size={48} className="text-[#d63a4d] mb-4 opacity-80" />
          <h2 className="text-xl font-bold text-[var(--ink)] mb-2 tracking-tight">
            Algo deu errado
          </h2>
          <p className="text-[var(--muted)] text-sm mb-6 text-center max-w-md">
            O componente <strong className="text-[#2b2f37]">{this.props.name || 'da interface'}</strong> falhou ao carregar. 
            Nossa equipe possivelmente não sabe, mas você pode tentar recarregar.
          </p>
          
          {this.state.error && (
            <div className="bg-[var(--bg)] p-4 rounded-lg w-full mb-6 border border-red-200 overflow-x-auto">
               <pre className="text-xs text-[#d63a4d] font-mono">
                 {this.state.error.message || String(this.state.error)}
               </pre>
            </div>
          )}

          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 px-6 py-2.5 bg-[var(--bg)] hover:bg-black/10 text-[var(--ink)] rounded-xl transition-colors text-sm font-bold "
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
