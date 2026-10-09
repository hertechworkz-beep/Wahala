import { Component, type ReactNode } from 'react';

/** A render bug must never black-screen a run: the run is saved, so offer a reload. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error('Wahala UI error', error);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <div className="text-5xl">⚡</div>
        <h1 className="font-display mt-3 text-2xl font-extrabold">NEPA took light.</h1>
        <p className="mt-2 text-white/60">Something broke on our side. Your run is saved.</p>
        <button onClick={() => location.reload()} className="press pill mt-6 min-h-[52px] bg-white px-6 font-display font-bold text-black">
          Reload and continue
        </button>
      </div>
    );
  }
}
