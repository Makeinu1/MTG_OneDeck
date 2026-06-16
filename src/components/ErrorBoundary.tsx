import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useGameStore } from '../store/gameStore';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Top-level error boundary. A render-time exception anywhere below would
 * otherwise unmount the whole tree and leave a blank screen with no recovery;
 * this catches it and offers a reload / back-to-deck-selection fallback.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, info.componentStack);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleBackToImport = (): void => {
    // Drop the live game and re-render the import screen.
    useGameStore.setState({ state: null, warnings: [] });
    this.setState({ hasError: false });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="error-boundary" role="alert" data-testid="error-boundary">
          <div className="error-boundary__panel">
            <h1>予期しないエラーが発生しました</h1>
            <p>
              画面の描画中に問題が発生しました。リロードするか、デッキ選択に戻ってやり直してください。
            </p>
            <div className="error-boundary__actions">
              <button type="button" className="btn btn--accent" onClick={this.handleReload}>
                リロード
              </button>
              <button type="button" className="btn" onClick={this.handleBackToImport}>
                デッキ選択に戻る
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
