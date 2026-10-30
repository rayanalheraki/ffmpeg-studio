import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/Feedback';
import { t } from '@shared/i18n';

interface State {
  error: Error | null;
}

/** Last-resort fallback so a rendering bug never leaves the user with a blank window. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled rendering error', error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
        <EmptyState
          icon="TriangleAlert"
          title={t('Something went wrong')}
          action={
            <Button variant="primary" icon="RotateCcw" onClick={() => window.location.reload()}>
              {t('Reload window')}
            </Button>
          }
        >
          {this.state.error.message}
        </EmptyState>
      </div>
    );
  }
}
