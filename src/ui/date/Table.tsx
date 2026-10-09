import { useEffect, useMemo, useRef, useState } from 'react';
import { arrivalEvent, asBeats, dressTier, glanceEvent, linesFor, photoEvent, rolexEvent, step, toEvent, toastGrade, type Line, type Tier } from '../../engine/scene';
import type { ChoiceResult } from '../../engine/types';
import { sound } from '../audio';
import type { DateCtx } from './ctx';
import { Figure } from './Figure';
import { FloorPlan, NODES, type NodeId, type TokenSpec } from './Floor';
import { path } from './plan';
import { ActionBtn, Caption, ChiefCut, Consequence, Panorama, SPOTS, TimerBar, chiefArt, useLines, type Spot } from './parts';

void asBeats;

const DINERS: TokenSpec[] = [
  { id: 'd1', kind: 'diner', at: { x: 180, y: 145 }, color: '#a16207' },
  { id: 'd2', kind: 'diner', at: { x: 250, y: 145 }, color: '#0f766e' },
  { id: 'd3', kind: 'diner', at: { x: 110, y: 218 }, color: '#7c2d12' },
  { id: 'd4', kind: 'diner', at: { x: 126, y: 236 }, color: '#be185d' },
  { id: 'd5', kind: 'diner', at: { x: 240, y: 236 }, color: '#334155' },
  { id: 'd6', kind: 'diner', at: { x: 256, y: 266 }, color: '#4d7c0f' },
];

/** A diner or waiter that drifts around so the room is never frozen. */
function useWanderer(route: { x: number; y: number }[], ms: number) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % route.length), ms);
    return () => clearInterval(t);
  }, []);
  return route[i];
}

export function useStepper(nodes: NodeId[], onArrive: () => void, ms = 480) {
  const [at, setAt] = useState<NodeId | null>(null);
  useEffect(() => {
    if (!nodes.length) return;
    let i = 0;
    setAt(nodes[0]);
    sound.effect('step');
    const t = setInterval(() => {
      i++;
      if (i >= nodes.length) {
        clearInterval(t);
        onArrive();
        return;
      }
      setAt(nodes[i]);
      sound.effect('step');
    }, ms);
    return () => clearInterval(t);
  }, [nodes.join(',')]);
  return at;
}

const pt = (n: NodeId, dx = 0, dy = 0) => ({ x: NODES[n].x + dx, y: NODES[n].y + dy });

// ---------------------------------------------------------------- seat

export function Seat({ ctx, onSeat }: { ctx: DateCtx; onSeat: (id: string) => void }) {
  const st = step(ctx.scene, 'seat');
  const [walk, setWalk] = useState<NodeId[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);
  const [res, setRes] = useState<ChoiceResult | null>(null);
  const waiter = useWanderer([pt('aisle', 20), pt('band', -24), pt('centre', 20), pt('aisle', 20)], 1600);
  const at = useStepper(walk, () => {
    sound.effect('pop');
    const s = st.seats.find((x) => x.id === chosen)!;
    const r = ctx.play(toEvent(st.id, s, { label: s.label, fromPartner: false }));
    setRes(r ?? null);
    onSeat(s.id);
  });
  useEffect(() => sound.setAmbience(['restaurant', 'lagoon_breeze'], 'date:restaurant'), []);
  function pick(id: string) {
    if (chosen) return;
    setChosen(id);
    const node = st.seats.find((s) => s.id === id)!.node as NodeId;
    setWalk(['entrance', ...path('entrance', node)]);
  }
  const me = at ? pt(at) : pt('entrance');
  const seat = st.seats.find((s) => s.id === chosen);
  return (
    <div className="absolute inset-0 flex flex-col bg-[#120d0b]">
      <div className="relative min-h-0 flex-1 pt-[106px]">
        <FloorPlan
          tokens={[...DINERS, { id: 'waiter', kind: 'waiter', at: waiter }, { id: 'you', kind: 'you', at: me, label: 'You' }]}
          highlight={chosen ? [] : (st.seats.map((s) => s.node) as NodeId[])}
          onNode={(n) => {
            const s = st.seats.find((x) => x.node === n);
            if (s) pick(s.id);
          }}
        />
      </div>
      <div className="space-y-2 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2">
        {!chosen && (
          <>
            <Caption line={{ who: 'waiter', text: `Good evening. Chief's guest? ${st.prompt.replace('The terrace. ', '')}` }} />
            <div className="grid grid-cols-3 gap-2">
              {st.seats.map((s) => (
                <button key={s.id} data-act={`seat-${s.id}`} onClick={() => (sound.play('tap'), pick(s.id))} className="press rounded-2xl border-2 border-white/15 bg-white/5 p-2.5 text-left">
                  <div className="text-[13px] font-bold leading-tight">{s.label}</div>
                  <div className="mt-1 text-[11px] text-white/55">{s.hint}</div>
                </button>
              ))}
            </div>
          </>
        )}
        {res && seat && (
          <>
            <Consequence text={`${((seat.receipt?.replace('You chose', 'You take') ?? seat.label) as string).replace(/\.$/, '')}. ${seat.hint}`} deltas={res.deltas} />
            <ActionBtn testId="wait" tone="primary" className="text-center" onClick={() => ctx.next()}>
              Wait for Chief
            </ActionBtn>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- arrival

export function Arrival({ ctx, score }: { ctx: DateCtx; score: number }) {
  const st = step(ctx.scene, 'arrival');
  const seat = (step(ctx.scene, 'seat').seats.find((s) => s.id === ctx.seat)?.node ?? 'window') as NodeId;
  const tier: Tier = dressTier(score, ctx.run.meters.chemistry);
  const [phase, setPhase] = useState<'wait' | 'walk' | 'talk' | 'done'>('wait');
  const [res, setRes] = useState<ChoiceResult | null>(null);
  const [expr, setExpr] = useState('charming');
  const route = useMemo(() => ['entrance', ...path('entrance', seat)] as NodeId[], [seat]);
  const at = useStepper(phase === 'walk' ? route : [], () => setTimeout(() => setPhase('talk'), 500), 650);
  useEffect(() => {
    const t = setTimeout(() => {
      sound.effect('door');
      setPhase('walk');
    }, 1400);
    return () => clearTimeout(t);
  }, []);
  const lines = st.lines[tier];
  const { line, next } = useLines(phase === 'talk' ? lines : [], {
    onDone: () => {
      if (phase !== 'talk') return;
      const r = ctx.play(arrivalEvent(ctx.scene, ctx.run, score));
      setRes(r ?? null);
      setPhase('done');
    },
    onLine: (l) => l.expression && setExpr(l.expression),
  });
  if (phase === 'wait' || phase === 'walk') {
    const chief = at ? pt(at, at === seat ? 22 : 0, at === seat ? -10 : 0) : pt('entrance', 0, 30);
    return (
      <div className="absolute inset-0 flex flex-col bg-[#120d0b]">
        <div className="relative min-h-0 flex-1 pt-[106px]">
          <FloorPlan tokens={[...DINERS, { id: 'you', kind: 'you', at: pt(seat), label: 'You' }, { id: 'chief', kind: 'chief', at: chief, label: phase === 'walk' ? 'Chief' : undefined }]} />
        </div>
        <div className="px-3 pb-[max(14px,env(safe-area-inset-bottom))] pt-2">
          <Caption line={{ who: 'narration', text: phase === 'wait' ? 'You wait. The sax player knows the song you like. A door opens.' : 'Red cap. Coral beads. Every waiter straightens up. Chief has arrived.' }} />
        </div>
      </div>
    );
  }
  return (
    <div className="absolute inset-0">
      <ChiefCut expression={expr} />
      <YouInset ctx={ctx} />
      <div className="absolute inset-x-0 bottom-0 space-y-2 pb-[max(14px,env(safe-area-inset-bottom))]">
        {phase === 'talk' && <Caption line={line} onTap={next} />}
        {phase === 'done' && res && (
          <>
            <Consequence text={tier === 'high' ? 'He looks you up and down, slowly. You chose well.' : tier === 'mid' ? 'Polite. Not dazzled.' : 'Your outfit just cost you points.'} deltas={res.deltas} />
            <div className="px-3">
              <ActionBtn testId="sit" tone="primary" className="text-center" onClick={() => ctx.next()}>
                Sit down
              </ActionBtn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** You, in the corner of the shot: what you wore is always visible. */
export function YouInset({ ctx }: { ctx: DateCtx }) {
  return (
    <div className="pointer-events-none absolute right-2 top-[112px] z-10 h-[124px] w-[62px] overflow-hidden rounded-2xl border-2 border-white/25 bg-black/50 backdrop-blur">
      <div className="absolute left-1/2 top-1 -translate-x-1/2">
        <Figure look={ctx.look} feminine={ctx.feminine} worn={ctx.worn} size={58} />
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-black/70 py-0.5 text-center text-[9px] font-bold uppercase tracking-wider">You</div>
    </div>
  );
}

// ---------------------------------------------------------------- talk

export function Talk({ ctx }: { ctx: DateCtx }) {
  const st = step(ctx.scene, 'talk');
  const [phase, setPhase] = useState<'lines' | 'choose' | 'reply' | 'done'>('lines');
  const [expr, setExpr] = useState('charming');
  const [cut, setCut] = useState(true);
  const [reply, setReply] = useState<string | null>(null);
  const [res, setRes] = useState<{ text: string; r?: ChoiceResult } | null>(null);
  const [snap, setSnap] = useState<{ text: string; r?: ChoiceResult; flash: number } | null>(null);
  const [aside, setAside] = useState<string | null>(null);
  const replyM = st.replies.find((r) => r.id === reply);
  const lines: Line[] = phase === 'lines' ? st.lines : phase === 'reply' && replyM ? linesFor(replyM.lines, '') : [];
  const { line, next } = useLines(lines, {
    onDone: () => {
      if (phase === 'lines') {
        setPhase('choose');
        setCut(false);
      } else if (phase === 'reply' && replyM) {
        const r = ctx.play(toEvent(st.id, replyM, { label: replyM.label, text: linesFor(replyM.lines, '').map((l) => l.text).join(' ') }));
        setRes({ text: linesFor(replyM.lines, '')[0]?.text ?? '', r });
        setPhase('done');
        setCut(false);
      }
    },
    onLine: (l) => {
      if (l.expression) setExpr(l.expression);
      setCut(l.who === 'partner');
    },
  });

  const spots: Spot[] = [];
  if (phase === 'choose' && ctx.phoneOut && !snap)
    spots.push({
      id: 'rolex',
      ...SPOTS.rolex,
      label: st.rolex.label,
      icon: '📸',
      onTap: () => {
        sound.effect('shutter');
        const ev = rolexEvent(ctx.scene, ctx.run);
        const r = ctx.play(ev);
        setSnap({ text: ev.text, r, flash: Date.now() });
        if (ev.id.endsWith('seen')) {
          setExpr('angry');
          setCut(true);
          sound.play('sting');
          setTimeout(() => setCut(false), 2200);
        }
      },
    });
  if (phase === 'choose') {
    spots.push({ id: 'menu', ...SPOTS.table, label: 'Menu', icon: '📜', pulse: false, onTap: () => (sound.effect('paper'), setAside('Asun risotto, ₦38,000. Lobster, "market price". There are no prices on your side of the menu. Only his.')) });
    spots.push({ id: 'lagoon', ...SPOTS.lagoon, label: 'Lagoon', icon: '🌃', pulse: false, onTap: () => setAside('Banana Island lights on the water. Somewhere out there, Musa is parked with the engine running.') });
  }

  return (
    <div className="absolute inset-0">
      <Panorama focus={phase === 'choose' ? { x: 50, y: 50 } : SPOTS.chief} zoom={phase === 'choose' ? 1 : 1.15} spots={spots} />
      {cut && <ChiefCut expression={expr} className="anim-fade" />}
      {snap && <div key={snap.flash} className="pointer-events-none absolute inset-0 z-20 bg-white" style={{ animation: 'flash 0.6s ease both' }} />}
      <YouInset ctx={ctx} />
      <div className="absolute inset-x-0 bottom-0 z-10 space-y-2 pb-[max(14px,env(safe-area-inset-bottom))]">
        {(phase === 'lines' || phase === 'reply') && <Caption line={line} onTap={next} />}
        {phase === 'choose' && (
          <>
            {aside && <Consequence text={aside} deltas={{}} />}
            {snap && <Consequence text={snap.text} deltas={snap.r?.deltas ?? {}} />}
            <Caption line={st.lines[st.lines.length - 1]} />
            <div className="space-y-2 px-3">
              {st.replies.map((r) => (
                <ActionBtn key={r.id} testId={`talk-${r.id}`} onClick={() => (setReply(r.id), setPhase('reply'), setAside(null))}>
                  {r.label}
                </ActionBtn>
              ))}
            </div>
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

// ---------------------------------------------------------------- toast

export function Toast({ ctx }: { ctx: DateCtx }) {
  const st = step(ctx.scene, 'toast');
  const [phase, setPhase] = useState<'lines' | 'aim' | 'done'>('lines');
  const [res, setRes] = useState<{ text: string; r?: ChoiceResult; grade: string } | null>(null);
  const [expr, setExpr] = useState('tender');
  const { line, next } = useLines(phase === 'lines' ? st.lines : [], { onDone: () => setPhase('aim'), onLine: (l) => l.expression && setExpr(l.expression) });
  const [pos, setPos] = useState(0);
  const t0 = useRef(performance.now());
  useEffect(() => {
    if (phase !== 'aim') return;
    t0.current = performance.now();
    let raf = 0;
    const tick = () => {
      const t = (performance.now() - t0.current) / 1000;
      setPos(Math.sin(t * 3.1) * (0.9 - Math.min(0.25, t * 0.02)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);
  function clink() {
    const grade = toastGrade(pos);
    const m = st[grade];
    sound.effect(grade === 'spill' ? 'spill' : 'clink');
    if (grade === 'spill' && navigator.vibrate) navigator.vibrate(120);
    const r = ctx.play(toEvent(st.id, m, { label: grade === 'perfect' ? 'Perfect toast' : grade === 'good' ? 'Toasted' : 'Spilled the wine' }));
    if (m.expression) setExpr(m.expression);
    setRes({ text: m.text ?? '', r, grade });
    setPhase('done');
  }
  return (
    <div className="absolute inset-0">
      <Panorama focus={SPOTS.wine} zoom={1.3} />
      {phase === 'lines' && <ChiefCut expression={expr} className="anim-fade" />}
      {phase === 'done' && <div className="absolute left-3 top-[112px] z-10 h-36 w-28 overflow-hidden rounded-2xl border-2 border-white/30 shadow-xl"><img src={chiefArt(expr)} alt="" className="h-full w-full object-cover" /></div>}
      {res?.grade === 'spill' && <div className="pointer-events-none absolute inset-0 z-10" style={{ background: 'radial-gradient(circle at 60% 55%, rgba(127,10,30,0.55), transparent 50%)', animation: 'fadeIn 0.3s ease both' }} />}
      <YouInset ctx={ctx} />
      <div className="absolute inset-x-0 bottom-0 z-10 space-y-2 pb-[max(14px,env(safe-area-inset-bottom))]">
        {phase === 'lines' && <Caption line={line} onTap={next} />}
        {phase === 'aim' && (
          <div className="mx-3 rounded-3xl bg-black/75 p-4 backdrop-blur">
            <div className="text-center text-[13px] font-bold text-white/70">Clink when your glass meets his</div>
            <div className="relative mx-auto mt-3 h-24 w-full">
              <div className="absolute left-1/2 top-0 h-full w-[18%] -translate-x-1/2 rounded-xl bg-[#F59E0B]/15 ring-1 ring-[#F59E0B]/50" />
              <Glass className="absolute left-1/2 top-2 -translate-x-[110%]" tint="#7f1d1d" />
              <Glass className="absolute top-2" tint="#9f1239" style={{ left: `${50 + pos * 45}%`, transform: 'translateX(-10%)' }} />
            </div>
            <ActionBtn testId="clink" tone="gold" className="mt-3 text-center" onClick={clink}>
              Clink 🥂
            </ActionBtn>
          </div>
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

function Glass({ className = '', tint, style }: { className?: string; tint: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 40 80" width="34" height="68" className={className} style={style}>
      <path d="M6 4 Q4 34 20 40 Q36 34 34 4 Z" fill="rgba(255,255,255,0.12)" stroke="#fff" strokeOpacity="0.6" />
      <path d="M7 18 Q8 34 20 38 Q32 34 33 18 Z" fill={tint} />
      <path d="M20 40 L20 70 M10 74 Q20 70 30 74" stroke="#fff" strokeOpacity="0.6" strokeWidth="2" fill="none" />
    </svg>
  );
}

// ---------------------------------------------------------------- glance

export function Glance({ ctx }: { ctx: DateCtx }) {
  const st = step(ctx.scene, 'glance');
  const screen = st.screen[ctx.run.truthId];
  const [phase, setPhase] = useState<'lead' | 'live' | 'done'>('lead');
  const [read, setRead] = useState(false);
  const [res, setRes] = useState<{ text: string; r?: ChoiceResult } | null>(null);
  useEffect(() => {
    sound.play('buzz');
    const t = setTimeout(() => setPhase('live'), 1100);
    return () => clearTimeout(t);
  }, []);
  function act(id: string) {
    if (phase === 'done') return;
    if (id === 'read') setRead(true);
    const ev = glanceEvent(ctx.scene, ctx.run, id);
    if (id === 'read') sound.play('reveal');
    const r = ctx.play(ev);
    setRes({ text: ev.text, r });
    setPhase('done');
  }
  return (
    <div className="absolute inset-0">
      <Panorama focus={SPOTS.phone} zoom={1.25}>
        <div className="absolute" style={{ left: `${SPOTS.phone.x}%`, top: `${SPOTS.phone.y}%`, transform: 'translate(-50%, -50%) rotate(-14deg)' }}>
          <button data-act="read" onClick={() => act('read')} disabled={phase !== 'live'} className={`block w-[86px] rounded-[14px] border-[3px] border-[#111] bg-[#0b0d12] p-1.5 shadow-[0_0_40px_rgba(147,197,253,0.6)] ${phase !== 'done' ? 'anim-buzz' : ''}`}>
            <div className="rounded-lg bg-[#1c2230] p-1.5 text-left">
              <div className="text-[7px] font-bold uppercase text-white/50">Incoming</div>
              <div className={`text-[11px] font-bold leading-tight transition-[filter] duration-300 ${read ? '' : 'blur-[4px]'}`}>{screen.name}</div>
            </div>
          </button>
        </div>
      </Panorama>
      <YouInset ctx={ctx} />
      <div className="absolute inset-x-0 bottom-0 z-10 space-y-2 pb-[max(14px,env(safe-area-inset-bottom))]">
        {phase !== 'done' && <Caption line={{ who: 'narration', text: st.lead }} />}
        {phase === 'live' && (
          <div className="space-y-2 px-3">
            <TimerBar seconds={st.seconds} onEnd={() => act('timeout')} />
            <p className="text-center text-[12px] font-bold text-white/60">Tap his phone to read it</p>
            {st.replies
              .filter((r) => r.id !== 'read')
              .map((r) => (
                <ActionBtn key={r.id} testId={`glance-${r.id}`} onClick={() => act(r.id)}>
                  {r.label}
                </ActionBtn>
              ))}
          </div>
        )}
        {phase === 'done' && res && (
          <>
            <Consequence text={res.text} deltas={res.r?.deltas ?? {}} />
            {read && <p className="px-4 text-center text-[12px] font-bold text-[#F59E0B]">Red flag caught. It's in your receipts.</p>}
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

// ---------------------------------------------------------------- photo

export function Photo({ ctx }: { ctx: DateCtx }) {
  const st = step(ctx.scene, 'photo');
  const t = ctx.run.truthId;
  const detail = st.detail[t];
  const [phase, setPhase] = useState<'buzz' | 'open' | 'reply' | 'done'>('buzz');
  const [zoom, setZoom] = useState(false);
  const [replyId, setReplyId] = useState<string | null>(null);
  const [res, setRes] = useState<{ text: string; r?: ChoiceResult } | null>(null);
  const [expr, setExpr] = useState('charming');
  useEffect(() => sound.play('buzz'), []);
  const reply = st.replies.find((r) => r.id === replyId);
  const { line, next } = useLines(phase === 'reply' && reply ? linesFor(reply.lines, t) : [], {
    onDone: () => {
      if (phase !== 'reply' || !reply) return;
      const ev = photoEvent(ctx.scene, ctx.run, reply.id, zoom);
      const r = ctx.play(ev);
      setRes({ text: ev.text || (reply.id === 'delete' ? 'Deleted. The photo is gone. The feeling is not.' : ''), r });
      setPhase('done');
    },
    onLine: (l) => l.expression && setExpr(l.expression),
  });
  return (
    <div className="absolute inset-0">
      <Panorama focus={SPOTS.chief} dim={phase === 'open' ? 0.7 : 0.2} />
      {phase === 'reply' && line?.who === 'partner' && <ChiefCut expression={expr} className="anim-fade" />}
      {phase === 'buzz' && (
        <div className="anim-slide-down absolute inset-x-3 top-[19%] z-10 rounded-3xl border border-white/15 bg-[#151821]/95 p-3.5 backdrop-blur" onClick={() => setPhase('open')}>
          <div className="text-[11px] font-bold uppercase text-white/50">WhatsApp · {st.from}</div>
          <div className="mt-1 text-[15px]">📷 Photo. "{st.message}"</div>
          <ActionBtn testId="open-photo" tone="gold" className="mt-3 text-center" onClick={() => setPhase('open')}>
            Open it under the table
          </ActionBtn>
        </div>
      )}
      {phase === 'open' && (
        <div className="absolute inset-x-3 top-[16%] z-10">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border-4 border-[#111] bg-black">
            <div className="absolute inset-0 transition-transform duration-700" style={{ transform: zoom ? `scale(2.6)` : 'none', transformOrigin: t === 'serial_sponsor' ? '74% 74%' : t === 'broke' ? '50% 12%' : '50% 10%' }}>
              <PhotoScene truth={t} />
            </div>
            {!zoom && (
              <button data-act="zoom" onClick={() => (setZoom(true), sound.play('reveal'))} className="absolute -translate-x-1/2 -translate-y-1/2" style={t === 'serial_sponsor' ? { left: '74%', top: '74%' } : { left: '50%', top: '14%' }}>
                <span className="anim-hotspot flex h-12 w-12 items-center justify-center rounded-full border-2 border-white bg-black/50 text-lg">🔍</span>
              </button>
            )}
          </div>
          {zoom ? (
            <Consequence text={`${detail.label}: ${detail.text}`} deltas={{}} />
          ) : (
            <p className="mt-2 text-center text-[12px] font-bold text-white/60">Something in the picture. Zoom in, or don't.</p>
          )}
          <div className="mt-2 space-y-2">
            {st.replies.map((r) => (
              <ActionBtn key={r.id} testId={`photo-${r.id}`} onClick={() => (setReplyId(r.id), setPhase('reply'))}>
                {r.label}
              </ActionBtn>
            ))}
          </div>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 z-10 space-y-2 pb-[max(14px,env(safe-area-inset-bottom))]">
        {phase === 'reply' && <Caption line={line} onTap={next} />}
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

/** The anonymous photo: Chief with a woman, and one detail that tells you everything. */
function PhotoScene({ truth }: { truth: string }) {
  const her = { skin: '#7a4e32', hair: 'frontal' as const, hairColor: '#120b08', outfit: '#0f766e', outfitAccent: '#fde68a', outfitStyle: 'dress' as const, accessory: 'earrings' as const };
  return (
    <div className="absolute inset-0" style={{ background: truth === 'broke' ? 'linear-gradient(#64748b, #334155)' : truth === 'divorced' ? 'linear-gradient(#bae6fd, #86efac)' : 'linear-gradient(#3b0764, #1e1b4b)' }}>
      {truth === 'broke' && <div className="absolute inset-x-[18%] top-[6%] rounded bg-[#1e3a8a] py-1 text-center text-[10px] font-black tracking-wider text-white">APAPA CLEARING AGENTS</div>}
      {truth === 'divorced' && (
        <>
          <div className="absolute inset-x-[14%] top-[5%] rounded bg-[#b91c1c] py-1 text-center text-[10px] font-black tracking-wider text-white">PRIZE-GIVING DAY</div>
          <div className="absolute bottom-0 right-[3%] h-[38%] w-[9%] rounded-t-full bg-[#1d4ed8]" />
          <div className="absolute bottom-0 right-[13%] h-[30%] w-[8%] rounded-t-full bg-[#be185d]" />
        </>
      )}
      <img src={chiefArt('laughing')} alt="" className="absolute bottom-0 left-[4%] h-[80%] w-[46%] rounded-t-[45%] object-cover" style={{ objectPosition: '50% 15%', filter: 'saturate(0.85)' }} />
      <div className="absolute bottom-[-70%] left-[52%]">
        <Figure look={her} feminine size={150} />
      </div>
      {truth === 'serial_sponsor' && <div className="absolute left-[73%] top-[72%] h-3 w-5 rounded-full border-[3px] border-[#facc15] shadow-[0_0_10px_#facc15]" />}
      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
    </div>
  );
}
