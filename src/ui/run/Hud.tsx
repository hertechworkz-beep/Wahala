import { useEffect, useRef, useState } from 'react';
import type { Meters } from '../../engine/types';
import { naira } from '../../engine/text';

interface Float {
  id: number;
  key: 'wallet' | 'sanity' | 'clout' | 'debt';
  text: string;
  good: boolean;
}

function useTween(value: number, ms = 700) {
  const [v, setV] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      setV(Math.round(a + (value - a) * e));
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return v;
}

export function Hud({ meters, day, deltas, deltaKey, onPhone, phoneBadge, muted, onMute }: { meters: Meters; day: number; deltas: Partial<Meters>; deltaKey: number; onPhone?: () => void; phoneBadge: number; muted: boolean; onMute: () => void }) {
  const [floats, setFloats] = useState<Float[]>([]);
  const [hit, setHit] = useState<Record<string, number>>({});
  const wallet = useTween(meters.wallet);
  const sanity = useTween(meters.sanity);
  const clout = useTween(meters.clout);

  useEffect(() => {
    if (!deltaKey) return;
    const f: Float[] = [];
    const h: Record<string, number> = {};
    (['wallet', 'sanity', 'clout', 'debt'] as const).forEach((k) => {
      const d = deltas[k];
      if (!d) return;
      const big = k === 'wallet' ? Math.abs(d) >= 50_000 : Math.abs(d) >= 15;
      if (big) h[k] = deltaKey;
      f.push({
        id: deltaKey * 10 + f.length,
        key: k,
        text: k === 'wallet' || k === 'debt' ? `${k === 'debt' ? 'Debt ' : ''}${naira(d, { sign: true, short: Math.abs(d) >= 100_000 })}` : `${d > 0 ? '+' : ''}${d}${k === 'sanity' ? '% Sanity' : ' Clout'}`,
        good: k === 'debt' ? d < 0 : d > 0,
      });
    });
    setFloats((x) => [...x, ...f]);
    setHit(h);
    const t = setTimeout(() => setFloats((x) => x.filter((y) => !f.includes(y))), 1900);
    return () => clearTimeout(t);
  }, [deltaKey]);

  const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  return (
    <div className="absolute inset-x-0 top-0 z-30 px-3 pt-[max(10px,env(safe-area-inset-top))]">
      <div className="flex items-center gap-2">
        <div className="pill bg-black/55 px-3 py-1.5 backdrop-blur-md">
          <span className="num text-[13px] text-white">DAY {day}</span>
          <span className="ml-1.5 text-[11px] font-bold text-white/50">{DAYS[(day - 1) % 7]}</span>
        </div>
        <div className="flex-1" />
        <button onClick={onMute} className="press flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-sm backdrop-blur-md" aria-label={muted ? 'Unmute' : 'Mute'}>
          {muted ? '🔇' : '🔊'}
        </button>
        {onPhone && <button onClick={onPhone} className="press relative flex h-9 items-center gap-1.5 rounded-full bg-black/55 px-3 text-sm backdrop-blur-md" aria-label="Open phone">
          📱<span className="text-xs font-bold">Phone</span>
          {phoneBadge > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F43F5E] px-1 text-[10px] font-bold">{phoneBadge}</span>}
        </button>}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <Meter label="Wallet" color="#10B981" hitKey={hit.wallet} floats={floats.filter((f) => f.key === 'wallet' || f.key === 'debt')}>
          <div className="num text-[19px] leading-none text-[#10B981]">{naira(wallet, { short: wallet >= 1_000_000 })}</div>
          {meters.debt > 0 && <div className="mt-0.5 text-[10px] font-bold text-[#EF4444]">Debt {naira(meters.debt, { short: true })}</div>}
        </Meter>
        <Meter label="Sanity" color="#e5e7eb" hitKey={hit.sanity} floats={floats.filter((f) => f.key === 'sanity')} bar={sanity} danger={sanity <= 25}>
          <div className={`num text-[19px] leading-none ${sanity <= 25 ? 'text-[#EF4444]' : 'text-white'}`}>{sanity}%</div>
        </Meter>
        <Meter label="Clout" color="#F43F5E" hitKey={hit.clout} floats={floats.filter((f) => f.key === 'clout')} bar={clout}>
          <div className="num text-[19px] leading-none text-[#F43F5E]">{clout}%</div>
        </Meter>
      </div>
    </div>
  );
}

function Meter({ label, color, children, floats, hitKey, bar, danger }: { label: string; color: string; children: React.ReactNode; floats: Float[]; hitKey?: number; bar?: number; danger?: boolean }) {
  return (
    <div key={hitKey} className={`relative rounded-2xl border-2 bg-black/55 px-2.5 py-2 backdrop-blur-md ${hitKey ? 'anim-hit' : ''} ${danger ? 'border-[#EF4444]/70' : 'border-white/10'}`}>
      <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/50">{label}</div>
      <div className="mt-1">{children}</div>
      {bar !== undefined && (
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${bar}%`, background: danger ? '#EF4444' : color }} />
        </div>
      )}
      {floats.map((f) => (
        <div key={f.id} className="num pointer-events-none absolute left-1/2 top-full z-40 -translate-x-1/2 whitespace-nowrap text-[15px]" style={{ color: f.good ? '#10B981' : '#EF4444', animation: 'floatUp 1.8s ease-out both', textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}>
          {f.text}
        </div>
      ))}
    </div>
  );
}
