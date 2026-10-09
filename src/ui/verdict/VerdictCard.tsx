import { forwardRef, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { naira } from '../../engine/text';
import type { EndingId } from '../../engine/types';
import { Portrait } from '../art/Portrait';
import { playerLook } from '../art/looks';
import { fillSlot } from '../brands';
import type { CardData } from './payload';

const GLOW: Record<EndingId, [string, string]> = {
  locked_in: ['#F59E0B', '#7c2d12'],
  counter_con: ['#10B981', '#F59E0B'],
  survived: ['#F43F5E', '#7c3aed'],
  scandal: ['#F43F5E', '#EF4444'],
  sapa: ['#EF4444', '#7f1d1d'],
  breakdown: ['#EF4444', '#1e3a8a'],
  ghosted: ['#64748b', '#1e293b'],
  fumbled: ['#F59E0B', '#EF4444'],
  obsession: ['#334155', '#0f172a'],
  walked_away: ['#10B981', '#0e7490'],
};

export function useQr(url: string) {
  const [qr, setQr] = useState('');
  useEffect(() => {
    QRCode.toDataURL(url, { margin: 0, width: 160, color: { dark: '#08090D', light: '#ffffff' } })
      .then(setQr)
      .catch(() => setQr(''));
  }, [url]);
  return qr;
}

/** 9:16 Verdict Card, rendered at 360x640 CSS px and exported at 3x = 1080x1920. */
export const VerdictCard = forwardRef<HTMLDivElement, { c: CardData; url: string }>(function VerdictCard({ c, url }, ref) {
  const qr = useQr(url);
  const [a, b] = GLOW[c.e];
  const strip = fillSlot('verdict_strip', c.nr ? 'negative' : 'neutral');
  const rare = c.ra !== undefined && c.ra < 10;
  return (
    <div ref={ref} className="relative overflow-hidden" style={{ width: 360, height: 640, background: '#08090D', fontFamily: "'DM Sans', sans-serif", color: '#F5F1E8' }}>
      <div className="absolute inset-0" style={{ background: `radial-gradient(120% 60% at 0% 0%, ${a}55, transparent 60%), radial-gradient(100% 60% at 100% 100%, ${b}66, transparent 60%)` }} />
      <div className="absolute inset-[10px] rounded-[26px] border-2" style={{ borderColor: `${a}66` }} />
      <div className="relative flex h-full flex-col px-6 pb-5 pt-5">
        <div className="flex items-center justify-between">
          <div className="text-[9px] font-bold uppercase tracking-[0.28em] text-white/60">
            <span className="font-display text-[13px] font-extrabold tracking-normal text-white">WAHALA</span> · Lagos dating report
          </div>
          <div className="text-[9px] text-white/40">#{c.id}</div>
        </div>

        <div className="mt-2.5 flex items-center gap-3">
          <div className="h-[50px] w-[50px] overflow-hidden rounded-full border-2" style={{ borderColor: a, background: '#1a1d27' }}>
            <div style={{ marginTop: -6, marginLeft: -9 }}>
              <Portrait look={playerLook({ avatar: c.av, name: c.n })} feminine={c.av.set === 'woman'} size={72} idle={false} expression={c.e === 'locked_in' || c.e === 'counter_con' || c.e === 'walked_away' ? 'happy' : c.e === 'survived' ? 'charming' : 'sad'} />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-display truncate text-[20px] font-extrabold leading-tight">{c.n}</div>
            <div className="text-[11px] text-white/55">
              {c.vb} · dated <b className="text-white/85">{c.p}</b> <span className="text-white/40">({c.ar})</span>
            </div>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span className="rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-black" style={{ background: a }}>
            {c.en}
          </span>
          <span className="text-[11px] text-white/60">
            {c.d >= 7 ? 'Lasted' : 'Survived'} <b className="num text-white">{c.d}/7</b> days
          </span>
        </div>

        <div className="mt-2.5">
          <div className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/45">Verdict</div>
          <div className={`font-display mt-0.5 font-extrabold leading-[0.95] ${c.nr ? 'text-white' : rare ? 'shimmer-gold' : ''}`} style={{ fontSize: c.t.length > 30 ? 27 : c.t.length > 20 ? 31 : 36, color: c.nr || rare ? undefined : '#fff' }}>
            {c.t}
          </div>
        </div>

        <div className="mt-2.5 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
          <div className="flex items-baseline justify-between text-[10px] font-bold uppercase tracking-widest">
            <span className="text-white/45">Goal: {c.g}</span>
            <span style={{ color: c.gw ? '#10B981' : '#EF4444' }}>{c.gw ? '✓ achieved' : '✗ failed'}</span>
          </div>
          <div className="mt-0.5 line-clamp-3 text-[11.5px] leading-snug text-white/85">
            <b className="text-white/50">Reality:</b> {c.gr}
          </div>
        </div>

        <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
          <Stat label="Wallet" v={naira(c.w, { short: true })} color="#10B981" />
          <Stat label="Sanity" v={`${c.s}%`} color="#F5F1E8" />
          <Stat label="Clout" v={`${c.cl}%`} color="#F43F5E" />
        </div>

        <div className="mt-2.5 rounded-2xl border-2 px-3 py-2" style={{ borderColor: '#EF444488', background: '#EF44440f' }}>
          <div className="flex items-baseline gap-2">
            <span className="num text-[26px] leading-none text-[#EF4444]">{c.go ? c.rs : c.rf}</span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#fca5a5]">{c.go ? `"red flags" that were nothing` : 'red flags missed'}</span>
          </div>
          <div className="mt-1 line-clamp-4 text-[11px] leading-snug text-white/85">{c.h}</div>
        </div>

        <div className="mt-2.5 line-clamp-3 text-[12px] italic leading-snug text-white/80">“{c.l}”</div>

        <div className="min-h-0 flex-1" />
        {c.ra !== undefined && (
          <div className="text-[10.5px] text-[#F59E0B]">
            ★ Only {c.ra}% of simulated runs with {c.p.split(' ')[0]} end this way.
          </div>
        )}
        {strip && (
          <div className="mt-1 text-[9px] text-white/35">
            {strip.text} {strip.sponsored ? '· Sponsored' : '· advertise on Wahala'}
          </div>
        )}
        <div className="mt-2 flex items-end justify-between">
          <div>
            <div className="font-display text-[15px] font-extrabold">Date {c.p.split(' ')[0]} yourself →</div>
            <div className="text-[10px] text-white/50">{url.replace(/^https?:\/\//, '').split('/v/')[0]} · Wahala: The Dating Survival Sim</div>
          </div>
          {qr && <img src={qr} alt="" className="h-[58px] w-[58px] rounded-md bg-white p-1" />}
        </div>
      </div>
    </div>
  );
});

function Stat({ label, v, color }: { label: string; v: string; color: string }) {
  return (
    <div className="rounded-xl bg-white/[0.05] py-1.5">
      <div className="text-[8.5px] font-bold uppercase tracking-widest text-white/45">{label}</div>
      <div className="num text-[16px]" style={{ color }}>
        {v}
      </div>
    </div>
  );
}

/** 1200x675 card for X, rendered at 400x225 and exported at 3x. */
export const WideCard = forwardRef<HTMLDivElement, { c: CardData; url: string }>(function WideCard({ c, url }, ref) {
  const [a, b] = GLOW[c.e];
  return (
    <div ref={ref} className="relative overflow-hidden" style={{ width: 400, height: 225, background: '#08090D', color: '#F5F1E8', fontFamily: "'DM Sans', sans-serif" }}>
      <div className="absolute inset-0" style={{ background: `radial-gradient(80% 90% at 0% 0%, ${a}55, transparent 60%), radial-gradient(70% 90% at 100% 100%, ${b}66, transparent 60%)` }} />
      <div className="relative flex h-full gap-3 p-4">
        <div className="flex w-[150px] flex-col">
          <div className="text-[8px] font-bold uppercase tracking-[0.25em] text-white/55">
            <span className="font-display text-[11px] font-extrabold tracking-normal text-white">WAHALA</span> · Lagos
          </div>
          <div className="font-display mt-2 text-[15px] font-extrabold leading-tight">{c.n}</div>
          <div className="text-[9px] text-white/55">dated {c.p}</div>
          <span className="mt-2 self-start rounded-full px-2 py-0.5 text-[8px] font-extrabold uppercase text-black" style={{ background: a }}>
            {c.en} · {c.d}/7
          </span>
          <div className="flex-1" />
          <div className="text-[9px] text-white/45">{url.replace(/^https?:\/\//, '').split('/v/')[0]}</div>
        </div>
        <div className="flex flex-1 flex-col">
          <div className="text-[8px] font-bold uppercase tracking-[0.3em] text-white/45">Verdict</div>
          <div className="font-display mt-0.5 text-[24px] font-extrabold leading-[0.95]">{c.t}</div>
          <div className="mt-2 text-[9.5px] leading-snug text-white/80">
            <b className="text-[#fca5a5]">{c.go ? 'Good One.' : `${c.rf} red flags missed.`}</b> {c.h.replace(/^HIDDEN TRUTH:\s*/, '')}
          </div>
          <div className="flex-1" />
          <div className="text-[9.5px] italic text-white/70">“{c.l}”</div>
        </div>
      </div>
    </div>
  );
});

/** Wahala Receipts: a POS-slip timeline built only from logged events (rules 9, 15). */
export const ReceiptsCard = forwardRef<HTMLDivElement, { c: CardData; url: string }>(function ReceiptsCard({ c, url }, ref) {
  const qr = useQr(url);
  return (
    <div ref={ref} className="relative flex items-center justify-center overflow-hidden" style={{ width: 360, height: 640, background: 'linear-gradient(160deg,#1a1d27,#08090D)', fontFamily: "'DM Sans', sans-serif" }}>
      <div className="relative w-[300px] bg-[#f8f5ee] px-5 pb-6 pt-6 text-[#1a1a1a]" style={{ boxShadow: '0 30px 60px rgba(0,0,0,0.6)', transform: 'rotate(-1.5deg)', clipPath: 'polygon(0 6px, 5% 0, 10% 6px, 15% 0, 20% 6px, 25% 0, 30% 6px, 35% 0, 40% 6px, 45% 0, 50% 6px, 55% 0, 60% 6px, 65% 0, 70% 6px, 75% 0, 80% 6px, 85% 0, 90% 6px, 95% 0, 100% 6px, 100% calc(100% - 6px), 95% 100%, 90% calc(100% - 6px), 85% 100%, 80% calc(100% - 6px), 75% 100%, 70% calc(100% - 6px), 65% 100%, 60% calc(100% - 6px), 55% 100%, 50% calc(100% - 6px), 45% 100%, 40% calc(100% - 6px), 35% 100%, 30% calc(100% - 6px), 25% 100%, 20% calc(100% - 6px), 15% 100%, 10% calc(100% - 6px), 5% 100%, 0 calc(100% - 6px))' }}>
        <div className="text-center">
          <div className="font-display text-[22px] font-extrabold tracking-tight">WAHALA RECEIPTS</div>
          <div className="font-mono text-[9px] uppercase tracking-widest text-black/55">
            {c.n} × {c.p} · Lagos · #{c.id}
          </div>
        </div>
        <div className="my-3 border-t-2 border-dashed border-black/25" />
        <div className="space-y-2.5 font-mono text-[10.5px] leading-snug">
          {c.r.map((line, i) => {
            const m = line.match(/^(Day \d+):\s*(.*)$/);
            return (
              <div key={i} className="flex gap-2">
                <span className="w-[42px] shrink-0 font-bold">{m?.[1] ?? ''}</span>
                <span>{m?.[2] ?? line}</span>
              </div>
            );
          })}
        </div>
        <div className="my-3 border-t-2 border-dashed border-black/25" />
        <div className="flex justify-between font-mono text-[11px] font-bold">
          <span>ENDING</span>
          <span>{c.en.toUpperCase()}</span>
        </div>
        <div className="flex justify-between font-mono text-[11px]">
          <span>DAYS SURVIVED</span>
          <span>{c.d}/7</span>
        </div>
        <div className="mt-3 text-center font-display text-[20px] font-extrabold leading-tight">{c.t}</div>
        <div className="mt-1.5 text-center text-[11.5px] italic">{c.ro}</div>
        <div className="mt-4 flex items-center justify-between">
          <div className="font-mono text-[8.5px] leading-tight text-black/55">
            THANK YOU FOR DATING
            <br />
            IN LAGOS · NO REFUNDS
          </div>
          {qr && <img src={qr} alt="" className="h-12 w-12" />}
        </div>
      </div>
    </div>
  );
});
