import { useEffect, useMemo, useRef, useState } from 'react';
import { escapeEvent, escapeMoment, escapeTactics, step, type EscapeOutcome, type Reaction } from '../../engine/scene';
import type { ChoiceResult } from '../../engine/types';
import { sound } from '../audio';
import type { DateCtx } from './ctx';
import { FloorPlan, NODES, type NodeId, type TokenSpec } from './Floor';
import { ActionBtn, Caption, ChiefCut, Consequence, TimerBar } from './parts';
import { FRIEND_AT, GIVE_UP_TICKS, GUARD_AT, MOVE_MS, TICK_MS, isHide, moveYou, moves, startEscape, tick, type EscapeGame } from './plan';

const pt = (n: NodeId, dx = 0, dy = 0) => ({ x: NODES[n].x + dx, y: NODES[n].y + dy });

const TACTIC_TEXT: Record<string, string> = {
  guard: 'The bouncer is standing in the aisle. Nobody runs past him.',
  filming: 'Her friend is in the middle of the room, phone up, filming.',
  waiter: 'A waiter is doing laps with a full tray.',
};

/**
 * The Wife Escape. She walks in. You have seconds to react. If you hide, the restaurant
 * becomes the game: move between tables, the bar, the plant, the restroom; reach the kitchen
 * door or stay hidden until she gives up.
 */
export function Escape({ ctx, onOutcome }: { ctx: DateCtx; onOutcome: (o: EscapeOutcome) => void }) {
  const st = step(ctx.scene, 'escape');
  const who = st.intruder[ctx.run.truthId];
  const tactics = useMemo(() => escapeTactics(ctx.scene, ctx.run), []);
  const seatNode = (step(ctx.scene, 'seat').seats.find((s) => s.id === ctx.seat)?.node ?? 'window') as NodeId;
  const [phase, setPhase] = useState<'enter' | 'react' | 'hide' | 'scene' | 'done'>('enter');
  const [reaction, setReaction] = useState<Reaction | null>(null);
  const [game, setGame] = useState<EscapeGame>(() => startEscape(ctx.seat, tactics));
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ text: string; r?: ChoiceResult; outcome: EscapeOutcome } | null>(null);
  const [wifeAt, setWifeAt] = useState<{ x: number; y: number }>(pt('entrance', 0, 40));
  const [youAt, setYouAt] = useState(pt(seatNode));
  const [shake, setShake] = useState(0);
  const gameRef = useRef(game);
  gameRef.current = game;

  // She walks in.
  useEffect(() => {
    sound.play('sting');
    sound.effect('door');
    if (navigator.vibrate) navigator.vibrate([200, 80, 200]);
    const a = setTimeout(() => setWifeAt(pt('entrance')), 300);
    const b = setTimeout(() => {
      sound.voice('wife', who.line);
      setPhase('react');
    }, 1400);
    return () => (clearTimeout(a), clearTimeout(b));
  }, []);

  function react(r: Reaction) {
    if (reaction) return;
    setReaction(r);
    sound.play('tap');
    if (r === 'hide') {
      setPhase('hide');
      return;
    }
    // Not hiding: the confrontation plays out at the table.
    setPhase('scene');
    if (r === 'face') {
      setYouAt(pt('aisle', -14));
      setWifeAt(pt('aisle', 14));
    } else setWifeAt(pt(seatNode, 0, 26));
    setTimeout(() => resolve(r === 'face' ? 'faced' : r === 'hand' ? 'hand' : 'stayed', r), 1500);
  }

  // The hunt: one beat of the world every TICK_MS.
  useEffect(() => {
    if (phase !== 'hide') return;
    const t = setInterval(() => {
      if (gameRef.current.over) return;
      const g = tick(gameRef.current);
      setGame(g);
      sound.effect('step');
      if (g.over) end(g);
    }, TICK_MS);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'hide') return;
    setYouAt(pt(game.you));
    setWifeAt(pt(game.wife, 10, 6));
  }, [game.you, game.wife, phase]);

  function go(n: NodeId) {
    if (busy || game.over || !moves(game).includes(n)) return;
    setBusy(true);
    sound.effect('whoosh');
    const g = moveYou(game, n);
    gameRef.current = g;
    setGame(g);
    if (g.filmed && !game.filmed) sound.effect('shutter');
    if (g.over) end(g);
    setTimeout(() => setBusy(false), MOVE_MS);
  }

  function end(g: EscapeGame) {
    if (phase === 'done' || res) return;
    const o = g.over!;
    if (o === 'worse') {
      sound.effect('crash');
      setShake(Date.now());
      if (navigator.vibrate) navigator.vibrate([100, 50, 200]);
    } else if (o === 'caught') {
      sound.play('sting');
      setShake(Date.now());
    } else if (o === 'escaped' || o === 'filmed') sound.effect('door');
    setTimeout(() => resolve(o, 'hide'), 700);
  }

  const resolved = useRef(false);
  function resolve(o: EscapeOutcome, r: Reaction) {
    if (resolved.current) return;
    resolved.current = true;
    const ev = escapeEvent(ctx.scene, ctx.run, o, r);
    const out = ctx.play(ev);
    const m = escapeMoment(ctx.scene, ctx.run, o);
    setRes({ text: m.text ?? '', r: out, outcome: o });
    onOutcome(o);
    setPhase('done');
  }

  const tokens: TokenSpec[] = [
    { id: 'you', kind: 'you', at: youAt, label: 'You', hidden: phase === 'hide' && isHide(game.you) },
    { id: 'chief', kind: 'chief', at: pt(seatNode, 24, -12) },
    { id: 'wife', kind: 'wife', at: wifeAt, label: who.name },
  ];
  if (phase === 'hide' || phase === 'done') {
    if (game.guard) tokens.push({ id: 'guard', kind: 'guard', at: pt(GUARD_AT), label: 'Bouncer' });
    if (game.friend) tokens.push({ id: 'friend', kind: 'friend', at: pt(FRIEND_AT, 0, -4), label: 'Filming', facing: 200 });
    if (game.waiter) tokens.push({ id: 'waiter', kind: 'waiter', at: pt(game.waiter, -14, 10), label: 'Tray' });
  }
  const left = Math.max(0, GIVE_UP_TICKS - game.ticks);
  const reactSecs = st.reaction_seconds;

  return (
    <div key={shake} className={`absolute inset-0 flex flex-col bg-[#120d0b] ${shake ? 'anim-shake' : ''}`}>
      {phase === 'scene' && <ChiefCut expression="caught" className="anim-fade opacity-40" />}
      <div className="relative min-h-0 flex-1 pt-[140px]">
        <FloorPlan tokens={tokens} highlight={phase === 'hide' && !game.over && !busy ? moves(game) : []} onNode={phase === 'hide' ? go : undefined} dark={phase === 'react'} />
        {phase === 'hide' && (
          <div className="absolute inset-x-3 top-[110px] z-10 flex items-center gap-2 rounded-2xl bg-black/70 px-3 py-1.5 text-[12px] font-bold backdrop-blur">
            <span className={isHide(game.you) ? 'text-[#F59E0B]' : 'text-red-400'}>{isHide(game.you) ? 'Hidden' : 'Visible'}</span>
            <span className="text-white/40">·</span>
            <span className="text-white/80">She gives up in {Math.ceil((left * TICK_MS) / 1000)}s</span>
            <span className="flex-1" />
            {game.filmed && <span className="text-sky-300">📹 Filmed</span>}
          </div>
        )}
      </div>
      <div className="space-y-2 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2">
        {phase === 'enter' && <Caption line={{ who: 'narration', text: 'The door opens. The whole terrace goes quiet.' }} />}
        {phase === 'react' && (
          <>
            <div className="anim-pop rounded-2xl border-2 border-red-500/60 bg-red-950/60 p-3">
              <div className="text-[11px] font-black uppercase tracking-wider text-red-300">
                {who.name} · {who.role}
              </div>
              <div className="mt-1 text-[17px] font-bold leading-snug">"{who.line}"</div>
            </div>
            <TimerBar seconds={reactSecs} onEnd={() => react('stay')} />
            <div className="grid grid-cols-2 gap-2">
              {st.reactions.map((r) => (
                <ActionBtn key={r.id} testId={`react-${r.id}`} tone={r.id === 'hide' ? 'danger' : 'ghost'} className="text-center text-[15px]" onClick={() => react(r.id)}>
                  {r.label}
                </ActionBtn>
              ))}
            </div>
          </>
        )}
        {phase === 'hide' && (
          <div className="rounded-2xl bg-black/60 p-3 text-[13px] leading-snug">
            <b className="text-[#F59E0B]">Tap a glowing spot to move.</b> Reach the <b className="text-emerald-300">kitchen door</b>, or stay in a <b className="text-[#F59E0B]">hiding spot</b> until she gives up. She hunts anyone she can see.
            <div className="mt-1 text-white/60">{tactics.map((t) => TACTIC_TEXT[t]).join(' ')}</div>
          </div>
        )}
        {phase === 'scene' && <Caption line={{ who: 'narration', text: reaction === 'face' ? 'You stand up and walk straight towards her.' : reaction === 'hand' ? 'You reach across the table for his hand. Slowly. Publicly.' : 'You sit. You smile. You hold your fork like a weapon.' }} />}
        {phase === 'done' && res && (
          <>
            <div className="text-center text-[11px] font-black uppercase tracking-[0.2em] text-[#F59E0B]">{OUTCOME_TITLE[res.outcome]}</div>
            <Consequence text={res.text} deltas={res.r?.deltas ?? {}} />
            <ActionBtn testId="continue" tone="primary" className="text-center" onClick={() => ctx.next()}>
              Continue
            </ActionBtn>
          </>
        )}
      </div>
    </div>
  );
}

const OUTCOME_TITLE: Record<EscapeOutcome, string> = {
  escaped: 'Escaped',
  outlasted: 'She gave up',
  filmed: 'Escaped, on camera',
  worse: 'Made it worse',
  caught: 'Caught',
  faced: 'Faced her',
  stayed: 'Held your nerve',
  hand: 'Claimed him',
};
