import { useEffect, useRef, useState } from 'react';
import { inspectEvent, step, type InspectResult } from '../../engine/scene';
import type { ChoiceResult } from '../../engine/types';
import { sound } from '../audio';
import type { DateCtx } from './ctx';
import { ActionBtn, Caption, ChiefCut, Consequence, Panorama, SPOTS, useLines } from './parts';

/**
 * Chief steps out to take a call. His briefcase is right there. Open the latches, flip the
 * pages, tap what matters, and close it before his footsteps come back.
 */
export function Briefcase({ ctx }: { ctx: DateCtx }) {
  const st = step(ctx.scene, 'inspect');
  const pages = st.pages[ctx.run.truthId] ?? [];
  const [phase, setPhase] = useState<'lead' | 'alone' | 'back' | 'done'>('lead');
  const [latches, setLatches] = useState(0);
  const [page, setPage] = useState(0);
  const [found, setFound] = useState<Set<string>>(new Set());
  const [elapsed, setElapsed] = useState(0);
  const [res, setRes] = useState<{ text: string; r?: ChoiceResult; kind: InspectResult } | null>(null);
  const [expr, setExpr] = useState('charming');
  const open = latches >= 2;
  const total = st.seconds;
  const returning = elapsed > total * 0.62;
  const resolved = useRef(false);

  const lead = useLines(phase === 'lead' ? st.lead : [], { onDone: () => (sound.effect('step'), setPhase('alone')), onLine: (l) => l.expression && setExpr(l.expression) });
  const back = useLines(phase === 'back' ? st.back : [], { onDone: () => setPhase('done'), onLine: (l) => l.expression && setExpr(l.expression) });

  // His footsteps: far, then closer. When time is up he is standing behind you.
  useEffect(() => {
    if (phase !== 'alone') return;
    const t0 = performance.now();
    let lastStep = 0;
    let raf = 0;
    const tick = () => {
      const e = (performance.now() - t0) / 1000;
      setElapsed(e);
      const gap = e > total * 0.62 ? Math.max(0.28, 1.1 - (e - total * 0.62) * 0.18) : 99;
      if (e - lastStep > gap) {
        lastStep = e;
        sound.effect('step');
        if (navigator.vibrate) navigator.vibrate(20);
      }
      if (e >= total) return finish(openRef.current ? 'caught' : 'skipped');
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);
  const openRef = useRef(false);
  openRef.current = open;
  const foundRef = useRef(found);
  foundRef.current = found;

  function finish(kind: InspectResult) {
    if (resolved.current) return;
    resolved.current = true;
    const k: InspectResult = kind === 'closed' && foundRef.current.size > 0 ? 'found' : kind;
    const ev = inspectEvent(ctx.scene, ctx.run, k);
    if (k === 'caught') {
      sound.play('sting');
      setExpr('angry');
    }
    const r = ctx.play(ev);
    setRes({ text: ev.text, r, kind: k });
    setPhase(k === 'caught' ? 'done' : 'back');
  }

  function latch() {
    sound.effect('latch');
    setLatches((n) => n + 1);
  }
  function close() {
    sound.effect('latch');
    setLatches(0);
    finish(openRef.current ? 'closed' : 'skipped');
  }

  const pg = pages[page];
  return (
    <div className="absolute inset-0">
      <Panorama focus={phase === 'alone' ? SPOTS.briefcase : SPOTS.chief} zoom={phase === 'alone' ? 1.4 : 1.1} dim={phase === 'alone' && open ? 0.55 : 0} />
      {(phase === 'lead' || phase === 'back' || (phase === 'done' && res?.kind === 'caught')) && <ChiefCut expression={expr} className="anim-fade" />}

      {phase === 'alone' && (
        <div className="absolute inset-x-0 top-[17%] z-10 px-3">
          {/* Where is Chief? */}
          <div className="mb-2 flex items-center gap-2 rounded-2xl bg-black/70 px-3 py-2 backdrop-blur">
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/60">You</span>
            <div className="relative h-2 flex-1 rounded-full bg-white/10">
              <span className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-[#e7b54a] bg-[#a3131a] transition-[left] duration-200" style={{ left: `${Math.max(0, Math.min(94, returning ? 94 - ((elapsed - total * 0.62) / (total * 0.38)) * 94 : (elapsed / (total * 0.62)) * 94))}%` }} />
            </div>
            <span className={`text-[12px] font-black ${returning ? 'anim-pulse text-red-400' : 'text-white/60'}`}>{returning ? 'Chief: COMING BACK' : 'Chief: on the phone'}</span>
          </div>

          {!open ? (
            <div className="relative mx-auto mt-2 h-44 w-full max-w-[330px] rounded-2xl border-4 border-[#1a1a1a] bg-gradient-to-b from-[#2a2a2a] to-[#111] shadow-2xl">
              <div className="absolute -top-6 left-1/2 h-8 w-24 -translate-x-1/2 rounded-t-xl border-4 border-b-0 border-[#1a1a1a]" />
              {[0, 1].map((i) => (
                <button key={i} data-act={`latch-${i}`} onClick={latch} disabled={latches > i} className={`absolute top-6 h-10 w-14 rounded-md border-2 ${latches > i ? 'border-[#a3803a] bg-[#5c4a1f]' : 'anim-hotspot border-[#f2d27a] bg-[#c9a227]'} ${i ? 'right-8' : 'left-8'}`} />
              ))}
              <div className="absolute inset-x-0 bottom-4 text-center text-[13px] font-bold text-white/60">{latches === 0 ? 'Tap the latches' : 'One more…'}</div>
            </div>
          ) : (
            <div className="anim-pop mx-auto max-w-[340px]">
              <div className="rounded-xl bg-[#f3efe4] p-3.5 text-[#1b1b1b] shadow-2xl" style={{ transform: `rotate(${page % 2 ? 1.2 : -1}deg)` }}>
                <div className="border-b border-black/20 pb-1 font-mono text-[12px] font-bold">{pg?.title}</div>
                <div className="mt-2 space-y-1.5 font-mono text-[13px]">
                  {pg?.lines.map((l, i) => {
                    const key = `${page}:${i}`;
                    const got = found.has(key);
                    return (
                      <button
                        key={i}
                        data-clue={l.clue ? key : undefined}
                        onClick={() => {
                          if (!l.clue || got) return;
                          sound.effect('shutter');
                          setFound((f) => new Set(f).add(key));
                        }}
                        className={`block w-full rounded px-1 text-left ${got ? 'bg-yellow-300/80' : ''}`}
                      >
                        {l.text}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-[12px] font-bold">
                <button data-act="prev-page" disabled={page === 0} onClick={() => (sound.effect('paper'), setPage(page - 1))} className="rounded-full bg-white/10 px-3 py-1.5 disabled:opacity-30">
                  ‹ Page
                </button>
                <span className="text-white/70">
                  {page + 1}/{pages.length} · {found.size ? `${found.size} noted` : 'Tap a line to memorise it'}
                </span>
                <button data-act="next-page" disabled={page >= pages.length - 1} onClick={() => (sound.effect('paper'), setPage(page + 1))} className="rounded-full bg-white/10 px-3 py-1.5 disabled:opacity-30">
                  Page ›
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 z-10 space-y-2 pb-[max(14px,env(safe-area-inset-bottom))]">
        {phase === 'lead' && <Caption line={lead.line} onTap={lead.next} />}
        {phase === 'alone' && (
          <div className="space-y-2 px-3">
            {open ? (
              <ActionBtn testId="close-case" tone={returning ? 'danger' : 'gold'} className="text-center" onClick={close}>
                {returning ? 'CLOSE IT. NOW.' : 'Close it'}
              </ActionBtn>
            ) : (
              <ActionBtn testId="leave-case" className="text-center" onClick={close}>
                Leave it alone
              </ActionBtn>
            )}
          </div>
        )}
        {phase === 'back' && (
          <>
            {res && <Consequence text={res.text} deltas={res.r?.deltas ?? {}} />}
            <Caption line={back.line} onTap={back.next} />
          </>
        )}
        {phase === 'done' && res && (
          <>
            <Consequence text={res.text} deltas={res.r?.deltas ?? {}} />
            <div className="px-3">
              <ActionBtn testId="continue" tone="primary" className="text-center" onClick={() => ctx.next()}>
                Continue
              </ActionBtn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
