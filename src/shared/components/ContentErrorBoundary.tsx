import { Component, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ContentErrorBoundaryProps {
  children: ReactNode;
  resetKey?: string;
}

interface ContentErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

export default class ContentErrorBoundary extends Component<
  ContentErrorBoundaryProps,
  ContentErrorBoundaryState
> {
  declare readonly props: Readonly<ContentErrorBoundaryProps>;
  declare state: ContentErrorBoundaryState;
  declare setState: (state: Partial<ContentErrorBoundaryState>) => void;

  constructor(props: ContentErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: null,
    };
  }

  static getDerivedStateFromError(error: Error): ContentErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'Erro inesperado ao renderizar este módulo.',
    };
  }

  componentDidCatch(error: Error) {
    console.error('Content render error:', error);
  }

  componentDidUpdate(prevProps: ContentErrorBoundaryProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({
        hasError: false,
        errorMessage: null,
      });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="max-w-lg w-full bg-white border border-amber-100 rounded-xl shadow-sm p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-os-text mb-3">
              Módulo indisponível
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              {this.state.errorMessage || 'Erro inesperado ao renderizar este módulo.'}
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
