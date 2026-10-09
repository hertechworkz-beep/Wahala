import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Line } from '../../engine/scene';
import { sound } from '../audio';

export const art = (file: string) => `${import.meta.env.BASE_URL}art/${file}`;

/** Painted Chief expressions (set 1). Older expression names map onto the nearest painting. */
const CHIEF_EXPR: Record<string, string> = { charming: 'charming', laughing: 'laughing', happy: 'laughing', suspicious: 'suspicious', angry: 'angry', caught: 'caught', tender: 'tender', sad: 'tender' };
export const chiefArt = (expr = 'charming') => art(`chief_${CHIEF_EXPR[expr] ?? 'charming'}.webp`);

export const NAMES: Record<string, string> = { partner: 'Chief', musa: 'Musa', bestie: 'Bestie', narration: '', waiter: 'Waiter' };

/**
 * Plays lines one after another: each is voiced (babble or recorded clip), captioned and held
 * long enough to read. Tap advances. `onLine` lets the stage react (expression, camera).
 */
export function useLines(lines: Line[], { onDone, onLine, auto = true }: { onDone: () => void; onLine?: (l: Line, i: number) => void; auto?: boolean }) {
  // A new set of lines (by content) restarts the player; an empty set waits.
  const key = lines.map((l) => l.text).join('|');
  const [st, setSt] = useState({ key, i: 0 });
  const i = st.key === key ? st.i : 0;
  if (st.key !== key) setSt({ key, i: 0 });
  const finished = useRef('');
  const cb = useRef({ onDone, onLine });
  cb.current = { onDone, onLine };
  const timer = useRef<number>();
  useEffect(() => {
    if (!lines.length) return;
    if (i >= lines.length) {
      if (finished.current !== key) {
        finished.current = key;
        sound.duck(false);
        cb.current.onDone();
      }
      return;
    }
    const l = lines[i];
    cb.current.onLine?.(l, i);
    sound.duck(true);
    if (l.sfx) sound.effect(l.sfx);
    const ms = l.who === 'narration' ? 900 + l.text.length * 28 : sound.voice(l.who, l.text);
    if (auto) timer.current = window.setTimeout(() => setSt((x) => (x.key === key ? { key, i: x.i + 1 } : x)), Math.max(1700, ms + 700 + l.text.length * 22));
    return () => clearTimeout(timer.current);
  }, [i, key]);
  const next = () => {
    clearTimeout(timer.current);
    setSt((x) => (x.key === key ? { key, i: Math.min(lines.length, x.i + 1) } : x));
  };
  return { line: lines.length ? lines[Math.min(i, lines.length - 1)] : undefined, index: i, next, finished: lines.length > 0 && i >= lines.length };
}

export function Caption({ line, name, onTap }: { line?: Line; name?: string; onTap?: () => void }) {
  if (!line) return null;
  const who = name ?? NAMES[line.who] ?? line.who;
  if (line.who === 'narration')
    return (
      <div key={line.text} className="anim-rise mx-3 rounded-2xl bg-black/60 px-4 py-3 text-center text-[15px] italic leading-snug text-white/85 backdrop-blur" onClick={onTap}>
        {line.text}
      </div>
    );
  return (
    <div key={line.text} className="anim-rise mx-3 rounded-[22px] border border-white/10 bg-[#120f14]/90 px-4 py-3 backdrop-blur" onClick={onTap}>
      <div className="mb-0.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#F59E0B]">
        {who}
        <Wave />
      </div>
      <div className="text-[17px] leading-snug">{line.text}</div>
    </div>
  );
}

function Wave() {
  return (
    <span className="flex h-3 items-end gap-[2px]">
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="w-[3px] rounded-full bg-[#F59E0B]" style={{ height: '100%', animation: `wave 0.6s ${i * 0.12}s ease-in-out infinite alternate` }} />
      ))}
    </span>
  );
}

/** A painted close-up of Chief: crossfades between expressions with a slow push-in. */
export function ChiefCut({ expression, className = '' }: { expression: string; className?: string }) {
  const [shown, setShown] = useState([expression]);
  useEffect(() => {
    setShown((s) => (s[s.length - 1] === expression ? s : [...s.slice(-1), expression]));
  }, [expression]);
  return (
    <div className={`absolute inset-0 overflow-hidden bg-black ${className}`}>
      {shown.map((e, i) => (
        <img
          key={e + i}
          src={chiefArt(e)}
          alt="Chief Emeka"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: '50% 30%', animation: `${i === shown.length - 1 ? 'fadeIn 0.35s ease both, kenburns 9s ease-out both' : 'none'}` }}
        />
      ))}
      <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.25) 0%, transparent 30%, transparent 60%, rgba(8,9,13,0.9) 100%)' }} />
    </div>
  );
}

export interface Spot {
  id: string;
  x: number; // % of the painting's width
  y: number; // % of its height
  label: string;
  icon?: ReactNode;
  onTap: () => void;
  pulse?: boolean;
}

/**
 * The restaurant, painted. The "camera" pans and zooms across it (focus x/y in % of the
 * painting) and tappable things sit on top at painting coordinates, so they move with it.
 */
export function Panorama({ focus, zoom = 1, spots = [], children, dim = 0 }: { focus: { x: number; y: number }; zoom?: number; spots?: Spot[]; children?: ReactNode; dim?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 390, h: 460 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // The painting is 1513x512. Scale it to cover the stage (bottom-anchored, caption cropped).
  const base = Math.max(box.h / 512, box.w / 1513) * 1.18 * zoom;
  const W = 1513 * base;
  const H = 512 * base;
  let tx = box.w / 2 - (focus.x / 100) * W;
  let ty = box.h / 2 - (focus.y / 100) * H;
  tx = Math.min(0, Math.max(box.w - W, tx));
  ty = Math.min(0, Math.max(box.h - H, ty));
  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden bg-black">
      <div className="absolute left-0 top-0" style={{ width: W, height: H, transform: `translate(${tx}px, ${ty}px)`, transition: 'transform 1.4s cubic-bezier(0.45, 0, 0.2, 1), width 1.4s cubic-bezier(0.45, 0, 0.2, 1), height 1.4s cubic-bezier(0.45, 0, 0.2, 1)' }}>
        <img src={art('chief_seated_ikoyi_restaurant.webp')} alt="" className="absolute inset-0 h-full w-full" draggable={false} />
        <Candle x={60.6} y={74} />
        <Candle x={22.5} y={46} />
        {children}
        {spots.map((s) => (
          <button
            key={s.id}
            data-spot={s.id}
            onClick={() => {
              sound.unlock();
              sound.play('tap');
              s.onTap();
            }}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${s.x}%`, top: `${s.y}%` }}
          >
            <span className={`relative flex h-11 w-11 items-center justify-center rounded-full border-2 border-white/80 bg-black/45 text-lg backdrop-blur ${s.pulse !== false ? 'anim-hotspot' : ''}`}>{s.icon ?? '•'}</span>
            <span className="absolute left-1/2 top-12 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/75 px-2 py-0.5 text-[11px] font-bold">{s.label}</span>
          </button>
        ))}
      </div>
      {dim > 0 && <div className="pointer-events-none absolute inset-0 bg-black transition-opacity duration-700" style={{ opacity: dim }} />}
      <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, transparent 22%, transparent 65%, rgba(8,9,13,0.95) 100%)' }} />
    </div>
  );
}

function Candle({ x, y }: { x: number; y: number }) {
  return <span className="pointer-events-none absolute h-[7%] w-[2.2%] rounded-full" style={{ left: `${x}%`, top: `${y}%`, background: 'radial-gradient(circle, rgba(255,200,120,0.55), transparent 70%)', animation: 'candle 1.8s ease-in-out infinite', mixBlendMode: 'screen' }} />;
}

/** Painting coordinates of things on the table (% of the 1513x512 image). */
export const SPOTS = {
  chief: { x: 55.5, y: 34 },
  table: { x: 52, y: 62 },
  wine: { x: 37.5, y: 66 },
  rolex: { x: 47.7, y: 59 },
  briefcase: { x: 91, y: 82 },
  phone: { x: 61, y: 74 },
  lagoon: { x: 33, y: 36 },
  sax: { x: 90, y: 30 },
};

export function TimerBar({ seconds, onEnd, paused, tone = '#EF4444' }: { seconds: number; onEnd: () => void; paused?: boolean; tone?: string }) {
  const [left, setLeft] = useState(seconds);
  const ended = useRef(false);
  useEffect(() => {
    if (paused) return;
    const t0 = performance.now() - (seconds - left) * 1000;
    let raf = 0;
    const tick = () => {
      const l = Math.max(0, seconds - (performance.now() - t0) / 1000);
      setLeft(l);
      if (l <= 0) {
        if (!ended.current) {
          ended.current = true;
          onEnd();
        }
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused]);
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
      <div className="h-full rounded-full" style={{ width: `${(left / seconds) * 100}%`, background: tone }} />
    </div>
  );
}

export function ActionBtn({ children, onClick, tone = 'ghost', className = '', disabled, testId }: { children: ReactNode; onClick: () => void; tone?: 'ghost' | 'primary' | 'gold' | 'danger'; className?: string; disabled?: boolean; testId?: string }) {
  const tones = {
    primary: 'bg-[#F43F5E] text-white',
    gold: 'bg-[#F59E0B] text-black',
    danger: 'bg-[#EF4444] text-white',
    ghost: 'bg-black/55 text-white border-2 border-white/20 backdrop-blur',
  };
  return (
    <button
      data-act={testId}
      disabled={disabled}
      onClick={() => {
        sound.unlock();
        sound.play('tap');
        onClick();
      }}
      className={`press min-h-[50px] w-full rounded-2xl px-4 py-2.5 text-left text-[16px] font-bold leading-tight disabled:opacity-40 ${tones[tone]} ${className}`}
    >
      {children}
    </button>
  );
}

/** Result of a moment: what happened, and the meters it moved, right where you are looking. */
export function Consequence({ text, deltas }: { text: string; deltas: Record<string, number | undefined> }) {
  const chips = Object.entries(deltas).filter(([k, v]) => v && ['wallet', 'sanity', 'clout', 'attachment', 'trust', 'chemistry', 'exposure', 'debt'].includes(k)) as [string, number][];
  const label: Record<string, string> = { wallet: '₦', sanity: 'Sanity', clout: 'Clout', attachment: 'Attachment', trust: 'Trust', chemistry: 'Chemistry', exposure: 'Exposure', debt: 'Debt' };
  const good = (k: string, v: number) => (k === 'exposure' || k === 'debt' ? v < 0 : v > 0);
  return (
    <div className="anim-pop mx-3 rounded-2xl border border-white/10 bg-black/80 p-3.5 backdrop-blur">
      <p className="text-[16px] leading-snug">{text}</p>
      {chips.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {chips.map(([k, v]) => (
            <span key={k} className={`num rounded-full px-2.5 py-0.5 text-[12px] font-bold ${good(k, v) ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
              {k === 'wallet' ? `${v > 0 ? '+' : '−'}₦${Math.abs(v).toLocaleString()}` : `${v > 0 ? '+' : ''}${v} ${label[k]}`}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
