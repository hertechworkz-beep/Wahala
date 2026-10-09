import type { ReactNode } from 'react';
import { sound } from './audio';

/** Hash routing for sandboxed previews (claude.ai), path routing everywhere else. */
export const HASH_ROUTER = import.meta.env.VITE_HASH_ROUTER === '1';

export function currentPath(): string {
  if (!HASH_ROUTER) return location.pathname;
  const h = location.hash.slice(1);
  return h ? `/${h}` : '/';
}

export function navigate(path: string) {
  if (HASH_ROUTER) {
    const token = path.replace(/^\//, '').split('?')[0];
    location.hash = token;
    window.dispatchEvent(new PopStateEvent('popstate'));
    return;
  }
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function Btn({
  children,
  onClick,
  tone = 'primary',
  className = '',
  disabled,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: 'primary' | 'ghost' | 'gold' | 'money' | 'danger';
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  const tones = {
    primary: 'bg-[#F43F5E] text-white shadow-[0_8px_30px_rgba(244,63,94,0.35)]',
    gold: 'bg-[#F59E0B] text-black shadow-[0_8px_30px_rgba(245,158,11,0.35)]',
    money: 'bg-[#10B981] text-black shadow-[0_8px_30px_rgba(16,185,129,0.35)]',
    danger: 'bg-[#EF4444] text-white',
    ghost: 'bg-white/5 text-white border-2 border-white/15',
  };
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={() => {
        sound.unlock();
        sound.play('tap');
        onClick?.();
      }}
      className={`press pill min-h-[52px] px-6 font-display text-[17px] font-bold disabled:opacity-40 ${tones[tone]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Chip({ active, children, onClick, className = '' }: { active?: boolean; children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button
      onClick={() => {
        sound.unlock();
        sound.play('tap');
        onClick?.();
      }}
      className={`press pill min-h-[48px] border-2 px-4 text-[15px] font-medium transition-colors ${active ? 'border-[#F43F5E] bg-[#F43F5E]/15 text-white' : 'border-white/12 bg-white/[0.04] text-white/85'} ${className}`}
    >
      {children}
    </button>
  );
}

export function StepHeader({ step, total, title, sub, onBack }: { step: number; total: number; title: string; sub?: string; onBack?: () => void }) {
  return (
    <div className="px-5 pt-5">
      <div className="flex items-center gap-3">
        {onBack ? (
          <button onClick={onBack} className="press flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-lg" aria-label="Back">
            ←
          </button>
        ) : (
          <div className="h-10 w-10" />
        )}
        <div className="flex flex-1 gap-1.5">
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${i < step ? 'bg-[#F43F5E]' : 'bg-white/10'}`} />
          ))}
        </div>
      </div>
      <h1 className="font-display mt-6 text-[34px] font-extrabold leading-[1.02]">{title}</h1>
      {sub && <p className="mt-2 text-[15px] text-white/60">{sub}</p>}
    </div>
  );
}

export function Logo({ size = 64, edition = true }: { size?: number; edition?: boolean }) {
  return (
    <div className="font-display flex flex-col items-center font-extrabold leading-none tracking-tight">
      <div style={{ fontSize: size }}>
        <span className="text-white">WAHA</span>
        <span className="text-[#F43F5E]">LA</span>
        <span className="text-[#F59E0B]">:</span>
      </div>
      {edition && (
        <div className="mt-1 tracking-[0.4em] text-[#F59E0B]" style={{ fontSize: Math.max(12, size * 0.3) }}>
          LAGOS
        </div>
      )}
    </div>
  );
}
