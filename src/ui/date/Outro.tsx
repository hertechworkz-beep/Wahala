import { useEffect, useState } from 'react';
import { linesFor, outroEvents, step, type EscapeOutcome } from '../../engine/scene';
import { naira } from '../../engine/text';
import type { ChoiceResult, LoggedEvent, RunState } from '../../engine/types';
import { sound } from '../audio';
import type { DateCtx } from './ctx';
import { ActionBtn, Caption, Consequence, useLines } from './parts';
import { PradoInterior } from './Ride';

export function Outro({ ctx }: { ctx: DateCtx }) {
  const st = step(ctx.scene, 'outro');
  const outcome: EscapeOutcome = ctx.escape ?? 'stayed';
  const [phase, setPhase] = useState<'lines' | 'envelope' | 'open' | 'done'>('lines');
  const [res, setRes] = useState<{ text: string; r?: ChoiceResult } | null>(null);
  const [count, setCount] = useState(0);
  useEffect(() => sound.setAmbience(['car_engine'], 'date:home'), []);
  const lines = linesFor(st.lines, outcome);
  const { line, next } = useLines(phase === 'lines' ? lines : [], { onDone: () => setPhase('envelope') });

  function open() {
    sound.effect('paper');
    const [ev] = outroEvents(ctx.scene, ctx.run);
    const r = ctx.play(ev);
    const amount = r?.deltas.wallet ?? 0;
    setRes({ text: r?.text ?? ev.text, r });
    setPhase('open');
    sound.play('cash');
    const t0 = performance.now();
    const tick = () => {
      const k = Math.min(1, (performance.now() - t0) / 1300);
      setCount(Math.round(amount * (1 - Math.pow(1 - k, 3))));
      if (k < 1) requestAnimationFrame(tick);
      else setPhase('done');
    };
    requestAnimationFrame(tick);
  }

  return (
    <PradoInterior musa>
      <div className="absolute inset-x-0 top-[186px] text-center">
        <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/50">The ride home · 11:40pm</div>
      </div>
      {(phase === 'envelope' || phase === 'open' || phase === 'done') && (
        <button data-act="envelope" disabled={phase !== 'envelope'} onClick={phase === 'envelope' ? open : undefined} className="absolute inset-x-0 top-[42%] flex flex-col items-center">
          <div className={`relative h-28 w-48 rounded-md bg-[#e9dcc0] shadow-2xl ${phase === 'envelope' ? 'anim-hotspot' : ''}`}>
            <div className="absolute inset-x-0 top-0 h-14 bg-[#d8c7a3]" style={{ clipPath: 'polygon(0 0, 100% 0, 50% 100%)', transform: phase === 'envelope' ? 'none' : 'scaleY(-1) translateY(100%)', transformOrigin: 'top' }} />
            <div className="absolute bottom-3 left-0 right-0 text-center font-serif text-[13px] italic text-[#5a4630]">For transport.</div>
            {phase !== 'envelope' && (
              <>
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="absolute left-1/2 h-10 w-24 rounded-sm border border-emerald-900 bg-emerald-600/90" style={{ top: -30 - i * 6, transform: `translateX(-50%) rotate(${(i - 2) * 9}deg)`, animation: `rise 0.5s ${i * 0.08}s both` }} />
                ))}
                <div className="num absolute -bottom-10 left-0 right-0 text-center text-3xl text-[#10B981]">+{naira(count)}</div>
              </>
            )}
          </div>
          {phase === 'envelope' && <div className="mt-3 text-[13px] font-bold text-white/70">An envelope on the seat. Tap to open.</div>}
        </button>
      )}
      <div className="absolute inset-x-0 bottom-0 space-y-2 pb-[max(14px,env(safe-area-inset-bottom))]">
        {phase === 'lines' && <Caption line={line} onTap={next} />}
        {phase === 'done' && res && (
          <>
            <Consequence text={res.text} deltas={res.r?.deltas ?? {}} />
            <div className="px-3">
              <ActionBtn testId="recap" tone="primary" className="text-center" onClick={() => ctx.next()}>
                How did tonight go?
              </ActionBtn>
            </div>
          </>
        )}
      </div>
    </PradoInterior>
  );
}

/** The night on paper: what you did, what it cost, what you caught and what you let slide. */
export function Recap({ run, sceneId, teaser, onHome }: { run: RunState; sceneId: string; teaser: string; onHome: () => void }) {
  const events = run.log.filter((e) => e.card.startsWith(`scene:${sceneId}:`));
  const sum = (k: keyof LoggedEvent['deltas']) => events.reduce((n, e) => n + (e.deltas[k] ?? 0), 0);
  const moneyIn = events.reduce((n, e) => n + Math.max(0, e.deltas.wallet ?? 0), 0);
  const moneyOut = events.reduce((n, e) => n + Math.min(0, e.deltas.wallet ?? 0), 0);
  const caught = events.filter((e) => e.tellShown && !e.missedTell).length;
  const missed = events.filter((e) => e.missedTell).length;
  const bond = sum('attachment') + sum('trust');
  useEffect(() => sound.play('reveal'), []);
  return (
    <div className="absolute inset-0 overflow-y-auto bg-[#0b0a0f] px-4 pb-8 pt-[max(18px,env(safe-area-inset-top))]">
      <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#F59E0B]">Day 1 · First date</div>
      <h1 className="font-display text-[30px] font-bold leading-tight">Tonight, on paper</h1>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Stat label="Money in" value={`+${naira(moneyIn, { short: true })}`} tone="text-emerald-300" />
        <Stat label="Money out" value={`−${naira(-moneyOut, { short: true })}`} tone="text-red-300" />
        <Stat label="Net" value={`${moneyIn + moneyOut >= 0 ? '+' : '−'}${naira(Math.abs(moneyIn + moneyOut), { short: true })}`} tone={moneyIn + moneyOut >= 0 ? 'text-emerald-300' : 'text-red-300'} />
        <Stat label="Red flags caught" value={String(caught)} tone="text-[#F59E0B]" />
        <Stat label="Let slide" value={String(missed)} tone={missed ? 'text-red-300' : 'text-white'} />
        <Stat label="Chief's feelings" value={bond > 12 ? 'Warmer' : bond < -6 ? 'Cooler' : 'Unsure'} tone={bond > 12 ? 'text-pink-300' : bond < -6 ? 'text-sky-300' : 'text-white'} />
      </div>
      <div className="mt-5 space-y-2">
        {events
          .filter((e) => e.receipt)
          .map((e) => (
            <div key={e.seq} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <span className="mt-0.5 text-[15px]">{e.tellShown && !e.missedTell ? '🚩' : e.missedTell ? '🙈' : (e.deltas.wallet ?? 0) > 0 ? '💸' : (e.deltas.wallet ?? 0) < 0 ? '🧾' : '•'}</span>
              <div className="flex-1">
                <div className="text-[14px] leading-snug">{e.receipt}</div>
                <Deltas d={e.deltas} />
              </div>
            </div>
          ))}
      </div>
      <div className="mt-5 rounded-2xl border border-[#F59E0B]/40 bg-[#F59E0B]/10 p-3.5 text-[15px] font-bold">{teaser}</div>
      <ActionBtn testId="go-home" tone="primary" className="mt-4 text-center" onClick={onHome}>
        Go home. Sleep.
      </ActionBtn>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-2.5">
      <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/50">{label}</div>
      <div className={`num mt-1 text-[17px] leading-none ${tone}`}>{value}</div>
    </div>
  );
}

function Deltas({ d }: { d: LoggedEvent['deltas'] }) {
  const names: Record<string, string> = { sanity: 'Sanity', clout: 'Clout', attachment: 'Attachment', trust: 'Trust', chemistry: 'Chemistry', exposure: 'Exposure' };
  const parts = Object.entries(d).filter(([k, v]) => v && (k === 'wallet' || names[k])) as [string, number][];
  if (!parts.length) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-x-2 text-[11px] font-bold">
      {parts.map(([k, v]) => (
        <span key={k} className={(k === 'exposure' ? v < 0 : v > 0) ? 'text-emerald-300' : 'text-red-300'}>
          {k === 'wallet' ? `${v > 0 ? '+' : '−'}${naira(Math.abs(v), { short: true })}` : `${v > 0 ? '+' : ''}${v} ${names[k]}`}
        </span>
      ))}
    </div>
  );
}
