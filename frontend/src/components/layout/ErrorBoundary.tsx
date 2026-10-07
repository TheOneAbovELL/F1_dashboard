import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode; label?: string }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[${this.props.label ?? 'panel'}]`, error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="grid h-full place-items-center p-6 text-center">
        <div>
          <div className="label mb-2 text-f1-red">{this.props.label ?? 'Panel'} failed</div>
          <p className="max-w-xs text-[11px] leading-relaxed text-f1-dim">
            {this.state.error.message}
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            className="mt-4 rounded-lg border border-f1-border bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
}
