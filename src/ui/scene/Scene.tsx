import { memo, useMemo } from 'react';
import type { LocationSpec } from '../../engine/types';
import { useArt } from '../art/Portrait';
import { fillSlot, type SlotFill } from '../brands';

// Scenes are data: a location in locations.json lists its ambient layers, and this file
// is the library of layer renderers. New locations reuse layers with no code changes.
// A file at public/art/<location>.webp replaces the painted backdrop automatically.

type Time = 'morning' | 'afternoon' | 'golden' | 'night';
type Mood = 'positive' | 'neutral' | 'negative';

const TINT: Record<Time, string> = {
  morning: 'linear-gradient(180deg, rgba(255,226,180,0.16), rgba(255,255,255,0))',
  afternoon: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(0,0,0,0))',
  golden: 'linear-gradient(180deg, rgba(255,120,40,0.24), rgba(255,170,80,0.1))',
  night: 'linear-gradient(180deg, rgba(6,10,30,0.5), rgba(6,8,20,0.35))',
};

function skyFor(loc: LocationSpec, time: Time): string {
  const [a, b, c] = loc.palette.sky;
  if (time === 'golden') return `linear-gradient(180deg, ${a} 0%, ${b} 35%, #f08a4b 70%, #ffc27a 100%)`;
  if (time === 'morning') return `linear-gradient(180deg, #9cc6e8 0%, #f6d7b0 70%, ${c} 100%)`;
  if (time === 'afternoon') return `linear-gradient(180deg, #6fa8d6 0%, #cfe3f2 60%, ${c} 100%)`;
  return `linear-gradient(180deg, ${a} 0%, ${b} 55%, ${c} 100%)`;
}

const INDOOR = new Set(['lekki_salon', 'aesthetic_clinic', 'mainland_lash_tech']);

export const SceneBackdrop = memo(function SceneBackdrop({
  location,
  time,
  mood,
  fx = [],
  reduced,
}: {
  location: LocationSpec;
  time: Time;
  mood: Mood;
  fx?: string[];
  reduced?: boolean;
}) {
  const hasArt = useArt(`/art/${location.id}.webp`);
  const night = time === 'night';
  const layers = reduced ? location.layers.slice(0, 3) : location.layers;
  const bg = INDOOR.has(location.id) ? `linear-gradient(180deg, ${location.palette.sky[0]}, ${location.palette.sky[2]})` : skyFor(location, time);
  const slots = useMemo(() => {
    const out: Record<string, SlotFill | null> = {};
    for (const s of location.brand_slots ?? []) out[s] = fillSlot(s, mood);
    return out;
  }, [location.id, mood]);

  return (
    <div className="ambient absolute inset-0 overflow-hidden" style={{ background: bg }}>
      {hasArt ? (
        <img src={`/art/${location.id}.webp`} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        layers.map((l) => <Layer key={l} id={l} loc={location} night={night} time={time} slots={slots} />)
      )}
      <div className="absolute inset-0 pointer-events-none" style={{ background: TINT[time] }} />
      {fx.includes('rain') && <Rain />}
      {fx.includes('sirens') && <div className="absolute inset-0 pointer-events-none" style={{ animation: 'siren 0.8s infinite' }} />}
      {fx.includes('generator') && <div className="absolute inset-0 pointer-events-none" style={{ background: 'rgba(255,170,60,0.12)', animation: 'flicker 0.4s infinite' }} />}
      {fx.includes('blackout') && <Blackout />}
      {/* Readability: darken the lower stage where the characters stand. */}
      <div className="absolute inset-x-0 bottom-0 h-1/3 pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(8,9,13,0), rgba(8,9,13,0.85))' }} />
    </div>
  );
});

function Blackout() {
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ background: '#000', animation: 'blackout 3s ease forwards' }}>
      <style>{`@keyframes blackout { 0% { opacity: 0.97 } 45% { opacity: 0.95 } 55% { opacity: 0.55 } 60% { opacity: 0.8 } 100% { opacity: 0.45 } }`}</style>
    </div>
  );
}

function Rain() {
  const drops = useMemo(() => Array.from({ length: 50 }, (_, i) => ({ x: (i * 37) % 100, d: 0.5 + ((i * 13) % 10) / 14, delay: -((i * 7) % 10) / 10, h: 10 + ((i * 11) % 18) })), []);
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {drops.map((r, i) => (
        <div key={i} className="absolute" style={{ left: `${r.x}%`, top: '-20%', width: 1.5, height: '140%', animation: `rainfall ${r.d}s linear ${r.delay}s infinite` }}>
          {Array.from({ length: 4 }).map((_, j) => (
            <div key={j} style={{ position: 'absolute', top: `${j * 25 + (i % 5) * 4}%`, width: 1.5, height: r.h, background: 'rgba(200,220,255,0.45)', borderRadius: 2 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

function BrandTag({ fill, className, style }: { fill: SlotFill | null | undefined; className?: string; style?: React.CSSProperties }) {
  if (!fill) return null;
  return (
    <a href={fill.link} onClick={(e) => e.stopPropagation()} className={`pointer-events-auto block ${className ?? ''}`} style={style}>
      <div className="font-display font-extrabold leading-none">{fill.text}</div>
      <div className="mt-0.5 text-[7px] uppercase tracking-widest opacity-80">{fill.sponsored ? 'Sponsored' : fill.sub}</div>
    </a>
  );
}

function Layer({ id, loc, night, time, slots }: { id: string; loc: LocationSpec; night: boolean; time: Time; slots: Record<string, SlotFill | null> }) {
  const p = loc.palette;
  switch (id) {
    case 'skyline':
      return (
        <svg className="absolute inset-x-0" style={{ top: '22%' }} viewBox="0 0 430 160" preserveAspectRatio="none" width="100%" height="34%">
          {[
            [0, 70, 40], [36, 40, 30], [62, 90, 26], [86, 20, 34], [118, 60, 22], [138, 30, 40], [176, 85, 28], [202, 10, 30], [230, 55, 36], [264, 35, 26], [288, 75, 40], [326, 25, 30], [354, 60, 34], [386, 45, 44],
          ].map(([x, y, w], i) => (
            <g key={i}>
              <rect x={x} y={y} width={w} height={160 - y} fill={night ? '#0b1022' : '#2d3550'} opacity={0.95} />
              {Array.from({ length: Math.floor((160 - y) / 14) }).map((_, j) =>
                (i + j) % 3 === 0 ? (
                  <rect key={j} x={x + 5 + ((i * j) % 3) * 7} y={y + 8 + j * 14} width="4" height="5" fill={night ? '#ffd27a' : '#9fb4d8'} opacity={night ? 0.9 : 0.5} style={{ animation: night ? `flicker ${3 + ((i + j) % 5)}s infinite ${(i * 0.3) % 2}s` : undefined }} />
                ) : null,
              )}
            </g>
          ))}
        </svg>
      );
    case 'lagoon':
      return (
        <div className="absolute inset-x-0" style={{ top: '55%', height: '45%', background: night ? 'linear-gradient(180deg,#0b1a33,#050a14)' : 'linear-gradient(180deg,#2a4f73,#0f2236)' }}>
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="absolute rounded-full" style={{ left: `${(i * 23) % 90}%`, top: `${8 + i * 9}%`, width: 50 + (i % 3) * 30, height: 2, background: night ? 'rgba(255,210,120,0.55)' : 'rgba(255,255,255,0.35)', animation: `ripple ${2.5 + (i % 3)}s ease-in-out infinite ${i * 0.3}s` }} />
          ))}
        </div>
      );
    case 'city_lights':
    case 'bokeh':
      return (
        <div className="absolute inset-0">
          {Array.from({ length: id === 'bokeh' ? 10 : 16 }).map((_, i) => (
            <div key={i} className="absolute rounded-full" style={{ left: `${(i * 41) % 100}%`, top: `${(id === 'bokeh' ? 15 : 35) + ((i * 17) % 30)}%`, width: id === 'bokeh' ? 18 + (i % 4) * 10 : 4, height: id === 'bokeh' ? 18 + (i % 4) * 10 : 4, background: p.glow, opacity: id === 'bokeh' ? 0.12 : 0.7, filter: id === 'bokeh' ? 'blur(6px)' : undefined, animation: `flicker ${4 + (i % 4)}s infinite ${i * 0.4}s` }} />
          ))}
        </div>
      );
    case 'candles':
      return (
        <div className="absolute inset-x-0" style={{ bottom: '24%' }}>
          {[22, 50, 76].map((x, i) => (
            <div key={x} className="absolute" style={{ left: `${x}%` }}>
              <div className="absolute rounded-full" style={{ left: -40, top: -46, width: 92, height: 92, background: 'radial-gradient(circle, rgba(255,190,90,0.45), rgba(255,190,90,0))' }} />
              <div style={{ width: 9, height: 16, borderRadius: '50% 50% 40% 40%', background: 'radial-gradient(circle at 50% 70%, #fff6c9, #ffb43a 60%, #ff6a00)', transformOrigin: '50% 100%', animation: `candle ${0.9 + i * 0.2}s infinite` }} />
              <div style={{ width: 9, height: 18, background: '#f3ead6', borderRadius: 2 }} />
            </div>
          ))}
          {fillVenue(slots.date_venue_host)}
        </div>
      );
    case 'table':
      return <div className="absolute inset-x-0 bottom-0" style={{ height: '26%', background: 'linear-gradient(180deg,#f2ece0,#c9bfae)', borderTop: '3px solid #fff8ea', boxShadow: '0 -10px 30px rgba(0,0,0,0.4)' }} />;
    case 'neon':
      return (
        <div className="absolute inset-x-0 top-[8%] flex justify-around" style={{ animation: 'neon 6s ease-in-out infinite' }}>
          {['#ff4fd8', '#4fd1ff', '#ff4f7a'].map((c, i) => (
            <div key={c} className="font-display text-2xl font-extrabold" style={{ color: c, textShadow: `0 0 8px ${c}, 0 0 22px ${c}`, animation: `flicker ${2.5 + i}s infinite ${i * 0.7}s` }}>
              {['VIP', '★', 'OZUMBA'][i]}
            </div>
          ))}
          <ClubChip fill={slots.club_playlist} />
        </div>
      );
    case 'lasers':
      return (
        <div className="absolute inset-0 pointer-events-none">
          {[20, 50, 80].map((x, i) => (
            <div key={x} className="absolute top-0" style={{ left: `${x}%`, width: 2, height: '80%', background: `linear-gradient(180deg, ${['#ff4fd8', '#4fffb0', '#4fd1ff'][i]}, transparent)`, transformOrigin: 'top center', animation: `laser ${3 + i}s ease-in-out infinite ${i * 0.5}s`, opacity: 0.7, boxShadow: '0 0 8px currentColor' }} />
          ))}
        </div>
      );
    case 'crowd':
      return (
        <div className="absolute inset-x-0 flex items-end justify-between px-1" style={{ bottom: '20%' }}>
          {Array.from({ length: 13 }).map((_, i) => (
            <div key={i} style={{ animation: `crowd ${0.5 + (i % 3) * 0.08}s ease-in-out infinite ${i * 0.07}s` }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#1a0b22', margin: '0 auto' }} />
              <div style={{ width: 34, height: 40 + (i % 3) * 10, borderRadius: '16px 16px 0 0', background: '#1a0b22' }} />
            </div>
          ))}
        </div>
      );
    case 'booth':
      return <div className="absolute inset-x-[-10%] bottom-0" style={{ height: '22%', borderRadius: '50% 50% 0 0', background: 'linear-gradient(180deg,#4a0e3a,#1a0516)', borderTop: '3px solid #8a1d6a' }} />;
    case 'sparklers':
      return (
        <div className="absolute inset-x-0" style={{ bottom: '20%' }}>
          {[30, 68].map((x) => (
            <div key={x} className="absolute" style={{ left: `${x}%` }}>
              <div style={{ width: 12, height: 34, background: '#0f2', opacity: 0.25, borderRadius: 3 }} />
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="absolute rounded-full" style={{ left: 4 + ((i * 5) % 8) - 4, top: -4, width: 3, height: 3, background: '#fff6c9', boxShadow: '0 0 6px #ffd27a', animation: `sparkle ${0.6 + (i % 4) * 0.15}s linear infinite ${i * 0.09}s` }} />
              ))}
            </div>
          ))}
        </div>
      );
    case 'smoke':
    case 'suya_smoke':
      return (
        <div className="absolute" style={{ left: id === 'suya_smoke' ? '78%' : '10%', bottom: '26%', width: id === 'smoke' ? '80%' : 60 }}>
          {id === 'suya_smoke' && (
            <div style={{ width: 54, height: 16, background: '#2a1a12', borderRadius: 4, boxShadow: '0 -3px 12px rgba(255,90,0,0.8) inset' }}>
              <div className="text-[7px] font-bold text-amber-300 text-center pt-0.5">SUYA</div>
            </div>
          )}
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="absolute rounded-full" style={{ left: `${(i * 17) % 60}%`, bottom: 12, width: 26, height: 26, background: 'rgba(220,220,220,0.35)', filter: 'blur(5px)', animation: `smoke ${3 + (i % 3)}s ease-out infinite ${i * 0.6}s` }} />
          ))}
        </div>
      );
    case 'bridge_cables':
      return (
        <svg className="absolute inset-0" viewBox="0 0 430 400" preserveAspectRatio="none" width="100%" height="100%" style={{ animation: 'drift 14s linear infinite', width: '200%' }}>
          {[0, 430].map((ox) => (
            <g key={ox} transform={`translate(${ox} 0)`}>
              <rect x="200" y="40" width="10" height="230" fill={night ? '#c7d2fe' : '#e5e7eb'} opacity="0.8" />
              {Array.from({ length: 9 }).map((_, i) => (
                <g key={i} stroke={night ? 'rgba(199,210,254,0.6)' : 'rgba(255,255,255,0.7)'} strokeWidth="1.5">
                  <line x1="205" y1={50 + i * 6} x2={30 + i * 18} y2="250" />
                  <line x1="205" y1={50 + i * 6} x2={380 - i * 18} y2="250" />
                </g>
              ))}
            </g>
          ))}
        </svg>
      );
    case 'streaks':
      return (
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="absolute rounded-full" style={{ top: `${30 + ((i * 13) % 40)}%`, left: 0, width: 80 + (i % 4) * 40, height: 3, background: i % 3 === 0 ? 'linear-gradient(90deg, transparent, #ff3b3b)' : 'linear-gradient(90deg, transparent, #ffe2a0)', filter: 'blur(1px)', animation: `streak ${0.9 + (i % 5) * 0.35}s linear infinite ${i * 0.27}s` }} />
          ))}
        </div>
      );
    case 'billboard':
      return slots.bridge_billboard ? (
        <div className="absolute" style={{ top: '27%', left: 0, animation: 'billboard 11s linear infinite' }}>
          <BrandTag fill={slots.bridge_billboard} className="rounded-md border-2 border-white/30 px-3 py-2 text-center text-[11px] text-white" style={{ width: 150, background: 'linear-gradient(135deg,#1e3a8a,#7c3aed)', boxShadow: '0 0 24px rgba(124,58,237,0.6)' }} />
          <div className="mx-auto h-16 w-1.5 bg-gray-500/70" />
        </div>
      ) : null;
    case 'car_window':
      return (
        <svg className="absolute inset-0 pointer-events-none" viewBox="0 0 430 600" preserveAspectRatio="none" width="100%" height="100%">
          <path d="M0 0 H430 V600 H0 Z M40 70 Q60 40 140 36 H300 Q380 40 400 80 L410 330 Q300 350 215 350 Q120 350 30 330 Z" fill="#07070a" fillRule="evenodd" />
          <path d="M0 420 Q215 380 430 420 V600 H0 Z" fill="#1d1712" />
          <path d="M20 440 Q215 405 410 440" stroke="#3a2e22" strokeWidth="4" fill="none" />
        </svg>
      );
    case 'dashboard_glow':
      return <div className="absolute inset-x-0 bottom-0 h-1/4 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 120%, rgba(100,140,255,0.35), transparent 70%)' }} />;
    case 'mirrors':
      return (
        <div className="absolute inset-x-0 top-[10%] flex justify-around px-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="relative" style={{ width: 92, height: 130, borderRadius: 46, border: '5px solid #f0d7a2', background: 'linear-gradient(160deg, rgba(255,255,255,0.35), rgba(255,255,255,0.05))' }}>
              {Array.from({ length: 8 }).map((_, j) => {
                const a = (j / 8) * Math.PI * 2;
                return <div key={j} className="absolute rounded-full" style={{ left: 41 + Math.cos(a) * 50, top: 60 + Math.sin(a) * 68, width: 7, height: 7, background: '#fff8d6', boxShadow: '0 0 8px #fff2b0', animation: `flicker ${2 + ((i + j) % 4)}s infinite ${(i + j) * 0.2}s` }} />;
              })}
            </div>
          ))}
        </div>
      );
    case 'ring_lights':
      return (
        <div className="absolute" style={{ right: '8%', top: '38%' }}>
          <div style={{ width: 70, height: 70, borderRadius: '50%', border: '6px solid #fff', boxShadow: '0 0 30px #fff, inset 0 0 18px #fff', animation: 'flicker 2.6s infinite' }} />
          <div className="mx-auto h-24 w-1 bg-gray-300/70" />
        </div>
      );
    case 'dryers':
      return (
        <div className="absolute inset-x-0 flex justify-around" style={{ bottom: '22%' }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ width: 54, height: 44, borderRadius: '50% 50% 20% 20%', background: 'linear-gradient(180deg,#e9d5ff,#a78bfa)', opacity: 0.8, animation: `gen-shake 0.15s infinite ${i * 0.05}s` }} />
          ))}
        </div>
      );
    case 'salon_shelf':
      return (
        <div className="absolute" style={{ left: '6%', top: '52%' }}>
          <div className="flex gap-1">
            {['#f43f5e', '#fde68a', '#a7f3d0', '#fbcfe8', '#c4b5fd'].map((c) => (
              <div key={c} style={{ width: 9, height: 22, background: c, borderRadius: 3 }} />
            ))}
          </div>
          <div className="h-1 w-24 bg-amber-200/70" />
          <BrandTag fill={slots.glow_spots} className="mt-2 rounded-md bg-black/50 px-2 py-1 text-[9px] text-pink-100" />
        </div>
      );
    case 'sunset':
      return (
        <div className="absolute" style={{ left: '58%', top: time === 'golden' ? '30%' : '18%', width: 110, height: 110, borderRadius: '50%', background: 'radial-gradient(circle, #ffe7a3, #ff8a3d 60%, rgba(255,120,40,0))', opacity: night ? 0 : 0.95 }} />
      );
    case 'kiosks':
      return (
        <div className="absolute inset-x-0 flex items-end justify-between px-2" style={{ bottom: '30%' }}>
          {['POS', 'RECHARGE', 'SUYA', 'MAMA PUT'].map((t, i) => (
            <div key={t} className="relative" style={{ width: 82 }}>
              <div style={{ height: 14, borderRadius: '10px 10px 0 0', background: ['#facc15', '#ef4444', '#22c55e', '#3b82f6'][i] }} />
              <div className="text-center text-[8px] font-bold" style={{ height: 46, background: night ? '#2b2420' : '#6b5a48', color: '#fff7d6', paddingTop: 4 }}>
                {t}
                {night && <div className="mx-auto mt-1 h-1.5 w-6 rounded bg-amber-200" style={{ boxShadow: '0 0 10px #ffd27a', animation: `flicker 3s infinite ${i}s` }} />}
              </div>
            </div>
          ))}
        </div>
      );
    case 'poster':
      return slots.street_poster ? (
        <BrandTag fill={slots.street_poster} className="absolute rounded-sm border-2 border-black/40 px-2 py-2 text-center text-[9px] text-black" style={{ left: '6%', top: loc.id === 'mainland_lash_tech' ? '20%' : '34%', width: 92, background: '#fde047', transform: 'rotate(-3deg)' }} />
      ) : null;
    case 'danfos':
      return (
        <div className="absolute inset-x-0" style={{ bottom: '16%', height: 70 }}>
          {[0, 1].map((i) => (
            <div key={i} className="absolute" style={{ bottom: i * 20, animation: `${i ? 'driveR' : 'driveL'} ${7 + i * 3}s linear infinite ${i * 2.5}s` }}>
              <Danfo night={night} />
            </div>
          ))}
        </div>
      );
    case 'okadas':
      return (
        <div className="absolute inset-x-0" style={{ bottom: '13%' }}>
          <div className="absolute" style={{ animation: 'driveR 3.8s linear infinite 1.2s' }}>
            <svg width="54" height="36" viewBox="0 0 54 36">
              <circle cx="10" cy="28" r="7" fill="none" stroke="#111" strokeWidth="3" />
              <circle cx="44" cy="28" r="7" fill="none" stroke="#111" strokeWidth="3" />
              <path d="M10 28 L26 18 L44 28 M26 18 L34 10" stroke="#b91c1c" strokeWidth="4" />
              <circle cx="27" cy="6" r="5" fill="#222" />
              {night && <circle cx="50" cy="20" r="3" fill="#fff6c9" />}
            </svg>
          </div>
        </div>
      );
    case 'glass_wall':
      return (
        <div className="absolute inset-0 pointer-events-none flex justify-between">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ width: 6, height: '78%', background: 'linear-gradient(180deg,#1f2937,#111827)', boxShadow: '2px 0 8px rgba(0,0,0,0.5)' }} />
          ))}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(115deg, rgba(255,255,255,0.07) 0%, transparent 30%, rgba(255,255,255,0.05) 55%, transparent 70%)' }} />
        </div>
      );
    case 'rain':
      return <Rain />;
    case 'sofa':
      return (
        <div className="absolute inset-x-[-5%] bottom-0" style={{ height: '20%' }}>
          <div style={{ height: '100%', borderRadius: '30px 30px 0 0', background: 'linear-gradient(180deg,#3f3a36,#1c1917)', borderTop: '3px solid #57514b' }} />
          {fillGift(slots.gifts)}
        </div>
      );
    case 'lamp':
      return (
        <div className="absolute" style={{ right: '7%', top: '30%' }}>
          <div style={{ width: 48, height: 30, background: '#f5e6c8', borderRadius: '6px 6px 18px 18px', boxShadow: '0 0 60px 20px rgba(255,214,140,0.35)' }} />
          <div className="mx-auto h-40 w-1 bg-stone-600" />
        </div>
      );
    case 'marble':
      return (
        <svg className="absolute inset-0" viewBox="0 0 430 600" preserveAspectRatio="none" width="100%" height="100%">
          <rect width="430" height="600" fill={night ? '#cfc8bd' : '#f3efe8'} />
          {[[0, 120, 430, 60], [60, 0, 220, 600], [300, 0, 400, 400], [0, 420, 430, 380]].map(([a, b, c, d], i) => (
            <path key={i} d={`M${a} ${b} Q${(a + c) / 2 + 40} ${(b + d) / 2 - 30} ${c} ${d}`} stroke="#b9b1a4" strokeWidth="1.5" fill="none" opacity="0.6" />
          ))}
          <rect y="430" width="430" height="170" fill={night ? '#bdb5a8' : '#e2dccf'} />
        </svg>
      );
    case 'clinic_lights':
      return (
        <div className="absolute inset-x-0 top-[6%] flex justify-around">
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ width: 90, height: 8, borderRadius: 8, background: '#fff', boxShadow: '0 0 30px 10px rgba(255,255,255,0.8)' }} />
          ))}
          <BrandTag fill={slots.glow_spots} className="absolute left-1/2 top-8 -translate-x-1/2 rounded-full border border-amber-500/40 bg-white/80 px-3 py-1 text-center text-[9px] text-amber-800" />
        </div>
      );
    case 'plants':
      return (
        <div className="absolute" style={{ left: '4%', bottom: '24%' }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="absolute" style={{ left: 18, bottom: 30, width: 14, height: 70, background: '#2f6b3a', borderRadius: '50% 50% 50% 50% / 80% 80% 20% 20%', transformOrigin: 'bottom center', transform: `rotate(${-40 + i * 20}deg)` }} />
          ))}
          <div style={{ width: 50, height: 34, background: '#d6c7b0', borderRadius: '4px 4px 12px 12px' }} />
        </div>
      );
    case 'sparkle':
      return (
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="absolute text-amber-400" style={{ left: `${(i * 29) % 95}%`, top: `${(i * 19) % 60 + 10}%`, fontSize: 10 + (i % 3) * 4, animation: `flicker ${2 + (i % 3)}s infinite ${i * 0.3}s` }}>
              ✦
            </div>
          ))}
        </div>
      );
    case 'string_lights':
      return (
        <svg className="absolute inset-x-0 top-0" viewBox="0 0 430 80" width="100%" height="80" style={{ animation: 'bob 4s ease-in-out infinite' }}>
          <path d="M0 10 Q107 60 215 20 Q322 60 430 12" stroke="#333" strokeWidth="2" fill="none" />
          {Array.from({ length: 14 }).map((_, i) => {
            const x = i * 31 + 8;
            const y = 10 + Math.sin((x / 430) * Math.PI * 2) * 18 + 16;
            return <circle key={i} cx={x} cy={y} r="5" fill={['#ffd27a', '#ff7aa2', '#7ad1ff', '#a3ff7a'][i % 4]} style={{ filter: 'drop-shadow(0 0 5px #ffd27a)', animation: `flicker ${2 + (i % 4)}s infinite ${i * 0.2}s` }} />;
          })}
        </svg>
      );
    case 'ceiling_fan':
      return (
        <div className="absolute left-1/2 top-[3%] -translate-x-1/2">
          <div className="mx-auto h-6 w-1 bg-stone-700" />
          <div style={{ width: 150, height: 150, marginTop: -75, animation: 'spin 0.9s linear infinite', transform: 'scaleY(0.25)' }} className="relative">
            {[0, 120, 240].map((r) => (
              <div key={r} className="absolute left-1/2 top-1/2" style={{ width: 70, height: 16, marginTop: -8, background: '#5b4636', borderRadius: 8, transformOrigin: '0 50%', transform: `rotate(${r}deg)` }} />
            ))}
          </div>
        </div>
      );
    case 'kiosk_wall':
      return (
        <div className="absolute inset-0" style={{ background: 'repeating-linear-gradient(90deg, #4a3220 0 14px, #3a2616 14px 28px)' }}>
          <div className="absolute right-[8%] top-[24%] rotate-2 rounded bg-white/90 px-2 py-1.5 font-display text-[10px] font-extrabold leading-tight text-black shadow-lg">
            LASHES ₦15K
            <br />
            NAILS ₦8K
            <br />
            <span className="text-red-600">NO REFUND</span>
          </div>
        </div>
      );
    default:
      return null;
  }
}

function fillVenue(fill: SlotFill | null | undefined) {
  if (!fill) return null;
  return <BrandTag fill={fill} className="absolute right-3 -top-28 rounded-md border border-amber-400/40 bg-black/50 px-2 py-1 text-right text-[9px] text-amber-200" />;
}

function fillGift(fill: SlotFill | null | undefined) {
  if (!fill) return null;
  return <BrandTag fill={fill} className="absolute left-4 -top-10 rounded-md bg-rose-950/70 px-2 py-1 text-[9px] text-rose-100" />;
}

function ClubChip({ fill }: { fill: SlotFill | null | undefined }) {
  if (!fill) return null;
  return (
    <a href={fill.link} onClick={(e) => e.stopPropagation()} className="pointer-events-auto absolute left-3 top-14 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-[10px] text-white backdrop-blur">
      <span className="flex h-3 items-end gap-0.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="w-0.5 bg-pink-400" style={{ height: '100%', animation: `wave 0.7s ease-in-out infinite ${i * 0.15}s`, transformOrigin: 'bottom' }} />
        ))}
      </span>
      <span>
        <b>Now playing:</b> {fill.text}
        <span className="ml-1 opacity-60">{fill.sponsored ? '· Sponsored' : '· Advertise'}</span>
      </span>
    </a>
  );
}

function Danfo({ night }: { night: boolean }) {
  return (
    <svg width="150" height="62" viewBox="0 0 150 62">
      <rect x="4" y="8" width="140" height="40" rx="8" fill="#facc15" />
      <rect x="4" y="30" width="140" height="5" fill="#111" />
      <rect x="4" y="38" width="140" height="3" fill="#111" />
      {[14, 40, 66, 92].map((x) => (
        <g key={x}>
          <rect x={x} y="13" width="22" height="14" rx="2" fill={night ? '#3b3a2a' : '#7dd3fc'} opacity="0.85" />
          <circle cx={x + 11} cy="19" r="4" fill="#2b1a10" />
        </g>
      ))}
      <rect x="120" y="13" width="18" height="14" rx="2" fill={night ? '#3b3a2a' : '#7dd3fc'} />
      <circle cx="30" cy="50" r="9" fill="#111" />
      <circle cx="118" cy="50" r="9" fill="#111" />
      {night && <ellipse cx="148" cy="38" rx="10" ry="4" fill="#fff6c9" opacity="0.9" />}
      <text x="60" y="44" fontSize="6" fontWeight="bold" fill="#111">NO TELL GOD</text>
    </svg>
  );
}
