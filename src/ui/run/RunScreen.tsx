import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { lagos } from '../../content/browser';
import { bailoutEligible, getCharacter, resolveCard } from '../../engine/engine';
import { fill, naira } from '../../engine/text';
import type { Beat, ChoiceResult, PhoneEvent, ResolvedCard, ResolvedChoice, RunState } from '../../engine/types';
import { backend } from '../../backend';
import { Portrait } from '../art/Portrait';
import { npcLook } from '../art/looks';
import { detectLowEnd, sound } from '../audio';
import { resetBrandCaps } from '../brands';
import { NotifStack, PhoneSheet, type Notif } from '../phone/Phone';
import { SceneBackdrop } from '../scene/Scene';
import type { useRun } from '../session';
import { Hud } from './Hud';
import { ColdOpen } from './ColdOpen';
import { storage } from '../../backend';

type Session = ReturnType<typeof useRun>;
type Phase = 'intro' | 'choices' | 'outcome' | 'night' | 'bailout' | 'ending';

let notifSeq = 0;
const location = (id: string) => lagos.locations.find((l) => l.id === id) ?? lagos.locations[0];

export function RunScreen({ session, onVerdict }: { session: Session; onVerdict: () => void }) {
  const run = session.run!;
  const ch = getCharacter(lagos, run.characterId);
  const coldKey = `wahala.cold.${run.seed}`;
  const [cold, setCold] = useState(() => !!ch.cold_open && run.day === 1 && run.log.length === 0 && !storage.get(coldKey, false));
  const [card, setCard] = useState<ResolvedCard | null>(() => resolveCard(lagos, run) ?? null);
  const [phase, setPhase] = useState<Phase>(() => (run.status === 'card' ? 'intro' : run.status === 'day_end' ? 'night' : run.status === 'bailout' ? 'bailout' : 'ending'));
  const [outcome, setOutcome] = useState<{ label: string; result: ChoiceResult } | null>(null);
  const [expression, setExpression] = useState(card?.expression ?? 'charming');
  const [fxKey, setFxKey] = useState(0);
  const [fx, setFx] = useState<string[]>([]);
  const [vignette, setVignette] = useState(0);
  const [shake, setShake] = useState(0);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [inbox, setInbox] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [phoneApp, setPhoneApp] = useState<'home' | 'messages' | 'parlour'>('home');
  const [spotResult, setSpotResult] = useState<{ spot: string; result: ChoiceResult } | null>(null);
  const [muted, setMuted] = useState(sound.muted);
  const [reduced, setReduced] = useState(() => detectLowEnd());
  const [toast, setToast] = useState('');
  const [chemToast, setChemToast] = useState<number | null>(null);
  const cardsSinceGossip = useRef(0);

  useEffect(() => {
    sound.lowEnd = reduced;
    resetBrandCaps();
  }, [reduced]);

  // Ambience follows the location on screen.
  const sceneLoc = phase === 'ending' ? (ch.endings[run.ending!]?.scene?.location ?? 'mainland_street') : (card?.location ?? 'mainland_street');
  const loc = location(sceneLoc);
  useEffect(() => {
    if (cold) return;
    sound.unlock();
    sound.setAmbience(fx.includes('blackout') ? ['generator', ...loc.ambience.slice(0, 1)] : loc.ambience, `${loc.id}:${fx.join(',')}`);
  }, [loc.id, fx.join(','), cold]);
  useEffect(() => () => sound.stopAmbience(), []);

  const push = useCallback((events: PhoneEvent[]) => {
    if (!events.length) return;
    const ns = events.map((e) => ({ ...e, id: ++notifSeq, at: run.day }));
    setNotifs((x) => [...x, ...ns]);
    setInbox((x) => [...x, ...ns].slice(-40));
    setUnread((u) => u + ns.length);
    sound.play(events.some((e) => e.kind === 'alert' && /credit/i.test(e.text)) ? 'cash' : events.some((e) => e.kind === 'call') ? 'ring' : 'ping');
    if (navigator.vibrate) navigator.vibrate(60);
  }, [run.day]);

  // Entering a card: expression, fx, sounds.
  useEffect(() => {
    if (!card || phase !== 'intro' || cold) return;
    setExpression(card.expression);
    const f = card.card.scene.fx ?? [];
    setFx(f);
    if (f.includes('blackout')) sound.play('boom');
    if (card.card.slot === 'confrontation' || card.card.slot === 'escalation') sound.play('sting');
    if (card.card.presentation === 'call') sound.play('ring');
    else if (card.card.presentation === 'text' || card.card.presentation === 'voice_note') sound.play('buzz');
    // Lagos happens around you: ambient Parlour gist every few cards.
    cardsSinceGossip.current++;
    if (cardsSinceGossip.current >= 3 && card.card.slot !== 'confrontation') {
      cardsSinceGossip.current = 0;
      const g = lagos.gossip[(run.seed + run.log.length) % lagos.gossip.length];
      setTimeout(() => push([{ kind: 'gist', from: 'The Parlour', text: g }]), 2600);
    }
  }, [card?.card.id, phase, cold]);

  function feedback(result: ChoiceResult) {
    const d = result.deltas;
    if (result.expression) setExpression(result.expression);
    if (result.fx.length) setFx((x) => [...x, ...result.fx]);
    const events: PhoneEvent[] = [...result.phone];
    if (d.wallet && d.wallet > 0) events.push({ kind: 'alert', from: 'Bank alert', text: `Credit ${naira(d.wallet)} · ${card?.card.character ? ch.name.toUpperCase() : 'TRANSFER'}` });
    if (d.wallet && d.wallet < 0) events.push({ kind: 'alert', from: 'Bank alert', text: `Debit ${naira(-d.wallet)} · POS ${loc.place.split(',')[0].toUpperCase()}` });
    if (d.wallet && d.wallet > 0) sound.play('cash');
    else if (d.wallet && d.wallet < -30_000) sound.play('loss');
    if ((d.sanity ?? 0) <= -15) {
      setVignette(Date.now());
      setShake(Date.now());
      sound.play('heartbeat');
      if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
    } else if (result.bad) setShake(Date.now());
    if ((d.chemistry ?? 0) > 0) {
      setChemToast(d.chemistry!);
      sound.play('chem');
      setTimeout(() => setChemToast(null), 2200);
    }
    setTimeout(() => push(events), 700);
  }

  function onChoose(c: ResolvedChoice, loan = false) {
    sound.unlock();
    sound.play('tap');
    const result = session.pick(c.id, c.label, loan);
    if (!result) return;
    setOutcome({ label: c.label, result });
    setPhase('outcome');
    setFxKey(Date.now());
    feedback(result);
  }

  function next() {
    sound.play('swoosh');
    setOutcome(null);
    const s = session.run!;
    if (s.status === 'ended') {
      setPhase('ending');
      sound.play('sting');
      return;
    }
    if (s.status === 'bailout') {
      setPhase('bailout');
      return;
    }
    if (s.status === 'day_end') {
      setPhase('night');
      return;
    }
    const rc = resolveCard(lagos, s);
    setCard(rc ?? null);
    setPhase('intro');
  }

  // A spot visit or bail-out can change the run status under us.
  useEffect(() => {
    if (phase === 'outcome') return;
    if (run.status === 'ended' && phase !== 'ending' && !phoneOpen) {
      setPhase('ending');
      sound.play('sting');
    } else if (run.status === 'bailout' && phase !== 'bailout' && !phoneOpen) setPhase('bailout');
    else if (run.status === 'card' && (phase === 'night' || phase === 'bailout')) {
      setCard(resolveCard(lagos, run) ?? null);
      setPhase('intro');
    } else if (run.status === 'day_end' && phase === 'bailout') setPhase('night');
  }, [run.status, run.history.length, phoneOpen]);

  function sleep() {
    sound.play('swoosh');
    session.sleep();
  }
  useEffect(() => {
    if (session.last?.kind === 'morning') {
      push(session.last.phone);
      setFxKey(Date.now());
    }
  }, [session.last?.id]);

  function onSpot(spot: string, option: string, label: string, loan: boolean) {
    const result = session.spot(spot, option, label, loan);
    if (!result) return;
    setSpotResult({ spot, result });
    setFxKey(Date.now());
    feedback(result);
  }

  async function clue() {
    const r = await backend.purchase('clue', `${run.seed}`);
    if (r.granted) {
      const hint = session.clue();
      if (hint) setToast(hint);
      backend.track('clue_paid');
    } else setToast(`Clue Pass (₦300) opens soon. ${r.reason ?? ''} For now, the Amebo on your phone sells tells for ₦30k in-game.`);
  }

  function leak() {
    if (!outcome) return;
    const text = `Someone dating ${ch.short}: "${outcome.result.text}"`;
    backend.leak(text).then(() => {
      setToast('Leaked to the Parlour. Anonymously. Mostly.');
      backend.track('receipt_leaked');
    });
  }

  const partnerPresent = card?.card.scene.partner_present !== false;
  const npc = card?.card.scene.npc;
  const npcVisual = useMemo(() => {
    if (!npc) return null;
    const asChar = npc.look ? lagos.characters.find((c) => c.id === npc.look) : undefined;
    if (asChar) return { look: asChar.look, feminine: asChar.gender === 'woman', art: asChar.id };
    const g = npcLook(npc.name);
    return { look: g.look, feminine: g.feminine, art: undefined };
  }, [npc?.name]);
  const time = (phase === 'ending' ? ch.endings[run.ending!]?.scene?.time : card?.time) ?? 'night';
  const mood = phase === 'ending' ? (ch.endings[run.ending!]?.scene?.mood ?? 'negative') : (card?.card.scene.mood ?? 'neutral');
  const presentation = card?.card.presentation ?? 'scene';

  if (cold)
    return (
      <ColdOpen
        ch={ch}
        player={run.player}
        reduced={reduced}
        onDone={() => {
          storage.set(coldKey, true);
          setCold(false);
        }}
      />
    );

  return (
    <div key={shake} className={`relative h-full overflow-hidden ${shake ? 'anim-shake' : ''} ${reduced ? 'reduced' : ''}`}>
      {/* Scene stage */}
      <div className="absolute inset-x-0 top-0 h-[60%]">
        <SceneBackdrop key={loc.id + time} location={loc} time={time as any} mood={mood as any} fx={fx} reduced={reduced} />
        {phase !== 'ending' && card && (
          <>
            {partnerPresent && (
              <div className={`absolute bottom-[-6%] ${npcVisual ? 'left-[-4%]' : 'left-1/2 -translate-x-1/2'}`}>
                <div key={card.card.id} className="anim-enter">
                  <Portrait look={ch.look} feminine={ch.gender === 'woman'} artId={ch.id.split('_')[0]} expression={expression} size={npcVisual ? 230 : 280} ringing={card.card.presentation === 'call' && phase === 'intro'} idle={!reduced} />
                </div>
              </div>
            )}
            {npcVisual && (
              <div className={`absolute bottom-[-6%] ${partnerPresent ? 'right-[-6%]' : 'left-1/2 -translate-x-1/2'}`}>
                <div key={`npc${card.card.id}`} className="anim-enter relative" style={{ animationDelay: '0.15s' }}>
                  <Portrait look={npcVisual.look} feminine={npcVisual.feminine} artId={npcVisual.art?.split('_')[0]} expression={card.card.slot === 'confrontation' ? 'angry' : 'charming'} size={partnerPresent ? 210 : 260} idle={!reduced} />
                  <div className="absolute bottom-[18%] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/70 px-2.5 py-0.5 text-[11px] font-bold">{npc!.name}</div>
                </div>
              </div>
            )}
          </>
        )}
        {phase === 'ending' && ch.endings[run.ending!]?.scene?.partner_present !== false && (
          <div className="absolute bottom-[-6%] left-1/2 -translate-x-1/2">
            <div className="anim-enter">
            <Portrait look={ch.look} feminine={ch.gender === 'woman'} artId={ch.id.split('_')[0]} expression={ch.endings[run.ending!]?.scene?.expression ?? 'suspicious'} size={280} />
            </div>
          </div>
        )}
      </div>
      {vignette > 0 && <div key={vignette} className="pointer-events-none absolute inset-0 z-20" style={{ boxShadow: 'inset 0 0 120px 40px rgba(239,68,68,0.75)', animation: 'vignette 1.4s ease both' }} />}
      {fx.includes('flash') && <div key={`f${fxKey}`} className="pointer-events-none absolute inset-0 z-20 bg-white" style={{ animation: 'flash 0.6s ease both' }} />}

      <Hud meters={run.meters} day={run.day} deltas={session.last?.deltas ?? {}} deltaKey={fxKey} onPhone={() => (setPhoneApp('home'), setPhoneOpen(true), setUnread(0))} phoneBadge={unread} muted={muted} onMute={() => (sound.unlock(), sound.setMuted(!muted), setMuted(!muted))} />
      <NotifStack items={notifs} onOpen={(n) => (setPhoneApp(n.kind === 'gist' ? 'parlour' : 'messages'), setPhoneOpen(true), setUnread(0))} onDismiss={(id) => setNotifs((x) => x.filter((n) => n.id !== id))} />
      {chemToast !== null && (
        <div className="num anim-pop pointer-events-none absolute left-1/2 top-[30%] z-30 -translate-x-1/2 rounded-full bg-[#F59E0B] px-4 py-1.5 text-lg text-black shadow-[0_0_40px_rgba(245,158,11,0.7)]">+{chemToast} Chemistry</div>
      )}

      {/* Bottom panel */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex h-[48%] flex-col">
        {(phase === 'intro' || phase === 'choices' || phase === 'outcome') && card && (
          presentation === 'scene' ? (
            <ScenePanel key={card.card.id} card={card} run={run} phase={phase} outcome={outcome} onTyped={() => setPhase('choices')} onChoose={onChoose} onNext={next} onClue={clue} onLeak={leak} partnerName={ch.short} />
          ) : (
            <PhonePanel key={card.card.id} card={card} run={run} phase={phase} outcome={outcome} onTyped={() => setPhase('choices')} onChoose={onChoose} onNext={next} onClue={clue} onLeak={leak} partnerName={ch.name} />
          )
        )}
        {phase === 'night' && <Night day={run.day} onPhone={() => (setPhoneApp('home'), setPhoneOpen(true))} onSleep={sleep} spotUsed={!!run.spotDays[run.day]} />}
      </div>

      {phase === 'bailout' && run.status === 'bailout' && <Bailout run={run} onResolve={(g) => session.bailout(g)} />}
      {phase === 'ending' && run.status === 'ended' && <EndingCard run={run} onVerdict={onVerdict} />}

      <PhoneSheet
        run={run}
        open={phoneOpen}
        initialApp={phoneApp}
        onClose={() => (setPhoneOpen(false), setSpotResult(null))}
        messages={inbox}
        onSpot={onSpot}
        spotResult={spotResult}
        clearSpotResult={() => setSpotResult(null)}
        muted={muted}
        onMute={() => (sound.setMuted(!muted), setMuted(!muted))}
        reduced={reduced}
        onReduced={() => setReduced(!reduced)}
        onRestart={() => session.reset()}
      />
      {toast && <Toast text={toast} onDone={() => setToast('')} />}
    </div>
  );
}

function Toast({ text, onDone }: { text: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4200);
    return () => clearTimeout(t);
  }, [text]);
  return (
    <div className="anim-pop absolute inset-x-4 top-[40%] z-[60] rounded-2xl border border-white/15 bg-black/90 p-4 text-center text-sm" onClick={onDone}>
      {text}
    </div>
  );
}

// ---------------------------------------------------------------- typed beats

function useTyped(beats: Beat[], active: boolean, onDone: () => void) {
  const [shown, setShown] = useState(active ? 0 : beats.length);
  const [typing, setTyping] = useState(false);
  const done = useRef(!active);
  useEffect(() => {
    if (!active) return;
    sound.duck(true);
    let i = 0;
    let t: number;
    const step = () => {
      if (i >= beats.length) {
        setTyping(false);
        sound.duck(false);
        if (!done.current) {
          done.current = true;
          onDone();
        }
        return;
      }
      const b = beats[i];
      const speaking = b.who !== 'narration' && b.who !== 'tell';
      setTyping(speaking);
      const wait = speaking ? Math.min(1500, 450 + b.text.length * 14) : 260;
      t = window.setTimeout(() => {
        i++;
        setShown(i);
        setTyping(false);
        sound.play('type');
        t = window.setTimeout(step, 420 + Math.min(900, b.text.length * 9));
      }, wait);
    };
    step();
    return () => {
      clearTimeout(t);
      sound.duck(false);
    };
  }, []);
  const skip = () => {
    if (done.current) return;
    setShown(beats.length);
    setTyping(false);
    done.current = true;
    sound.duck(false);
    onDone();
  };
  return { shown, typing, skip };
}

interface PanelProps {
  card: ResolvedCard;
  run: RunState;
  phase: Phase;
  outcome: { label: string; result: ChoiceResult } | null;
  onTyped: () => void;
  onChoose: (c: ResolvedChoice, loan?: boolean) => void;
  onNext: () => void;
  onClue: () => void;
  onLeak: () => void;
  partnerName: string;
}

function speakerName(b: Beat, partner: string) {
  return b.who === 'partner' ? partner : b.who;
}

function ScenePanel({ card, run, phase, outcome, onTyped, onChoose, onNext, onClue, onLeak, partnerName }: PanelProps) {
  const { shown, typing, skip } = useTyped(card.beats, phase === 'intro', onTyped);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ top: 99999, behavior: 'smooth' });
  }, [shown, phase, typing]);
  return (
    <div className="flex h-full flex-col rounded-t-[30px] border-t-2 border-white/10 bg-[#08090D]/95 backdrop-blur-xl" onClick={skip}>
      <div ref={scroller} className="flex-1 space-y-2.5 overflow-y-auto px-4 pb-2 pt-4 no-scrollbar">
        {card.beats.slice(0, shown).map((b, i) => (
          <Bubble key={i} b={b} name={speakerName(b, partnerName)} />
        ))}
        {typing && <TypingDots />}
        {outcome && (
          <>
            <div className="anim-rise flex justify-end">
              <div className="max-w-[80%] rounded-[22px] rounded-br-md bg-[#F43F5E] px-4 py-2.5 text-[15px] font-medium">{outcome.label.replace(/^\[[^\]]+\]\s*/, '')}</div>
            </div>
            <Outcome result={outcome.result} />
          </>
        )}
      </div>
      <div className="px-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        {phase === 'choices' && <Choices card={card} run={run} onChoose={onChoose} onClue={onClue} />}
        {phase === 'outcome' && <NextBar onNext={onNext} onLeak={onLeak} />}
      </div>
    </div>
  );
}

function Bubble({ b, name }: { b: Beat; name: string }) {
  if (b.who === 'narration' || b.who === 'tell')
    return <p className="anim-rise px-2 text-center text-[14px] italic leading-snug text-white/70">{b.text}</p>;
  return (
    <div className="anim-rise flex flex-col items-start">
      <span className="mb-1 ml-3 text-[11px] font-bold uppercase tracking-wider text-[#F59E0B]">{name}</span>
      <div className="max-w-[86%] rounded-[22px] rounded-tl-md border border-white/10 bg-[#1a1d27] px-4 py-2.5 text-[16px] leading-snug">{b.text}</div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="ml-1 flex w-16 items-center justify-center gap-1 rounded-full bg-[#1a1d27] py-3">
      {[0, 1, 2].map((i) => (
        <span key={i} className="typing-dot h-2 w-2 rounded-full bg-white/60" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </div>
  );
}

function Outcome({ result }: { result: ChoiceResult }) {
  return (
    <div className="anim-rise space-y-2">
      <div className={`rounded-[22px] border-2 px-4 py-3 text-[16px] leading-snug ${result.bad ? 'border-[#EF4444]/50 bg-[#EF4444]/10' : 'border-white/10 bg-white/[0.06]'}`}>
        {result.rolled && <span className="mr-1.5 inline-block rounded-full bg-black/40 px-2 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wider text-white/60">🎲 {result.bad ? 'dice said no' : 'dice'}</span>}
        {result.text}
      </div>
      {result.notes.map((n, i) => (
        <p key={i} className={`rounded-2xl px-3 py-2 text-[13px] ${n.startsWith('Intel') || n.startsWith('Bestie') ? 'bg-[#F59E0B]/10 font-medium text-[#fde68a]' : 'text-white/60 italic'}`}>
          {n}
        </p>
      ))}
    </div>
  );
}

function Choices({ card, run, onChoose, onClue }: { card: ResolvedCard; run: RunState; onChoose: (c: ResolvedChoice, loan?: boolean) => void; onClue: () => void }) {
  const [loanFor, setLoanFor] = useState<string | null>(null);
  return (
    <div className="space-y-2 pt-1" onClick={(e) => e.stopPropagation()}>
      {card.choices.map((c, i) => (
        <div key={c.id} className="anim-rise" style={{ animationDelay: `${i * 70}ms` }}>
          <button
            data-choice={c.id}
            disabled={!c.available}
            onClick={() => onChoose(c)}
            className={`press flex min-h-[52px] w-full items-center gap-3 rounded-[22px] border-2 px-4 py-2.5 text-left text-[15px] font-medium leading-tight disabled:opacity-45 ${c.vibeOnly ? 'border-[#F59E0B]/60 bg-[#F59E0B]/10' : 'border-white/12 bg-white/[0.06]'}`}
          >
            <span className="flex-1">
              {c.vibeOnly && <span className="mr-1.5 rounded-full bg-[#F59E0B] px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-black">{c.label.match(/^\[([^\]]+)\]/)?.[1] ?? c.vibeOnly} only</span>}
              {c.label.replace(/^\[[^\]]+\]\s*/, '')}
              {!c.available && <span className="mt-0.5 block text-[12px] font-normal italic text-[#fca5a5]">{c.reason}</span>}
            </span>
            {c.cost > 0 && <span className="num shrink-0 text-[14px] text-[#10B981]">-{naira(c.cost, { short: true })}</span>}
          </button>
          {!c.available && c.canLoan && (
            <button onClick={() => (loanFor === c.id ? onChoose(c, true) : setLoanFor(c.id))} className="mt-1 w-full rounded-xl bg-[#EF4444]/10 px-3 py-1.5 text-left text-[12px] text-[#fca5a5]">
              {loanFor === c.id ? 'Tap again to borrow. 50% interest. They WILL call your contacts.' : '💸 QuickCash Loan App: borrow the difference'}
            </button>
          )}
        </div>
      ))}
      {run.day >= 2 && run.cluesUsed < 2 && card.card.slot !== 'talking_time' && (
        <button onClick={onClue} className="mx-auto mt-1 block rounded-full px-3 py-1 text-[12px] text-white/45">
          🔍 Clue Pass · ₦300
        </button>
      )}
    </div>
  );
}

function NextBar({ onNext, onLeak }: { onNext: () => void; onLeak: () => void }) {
  return (
    <div className="flex gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
      <button onClick={onLeak} className="press pill min-h-[52px] border-2 border-white/12 px-4 text-[13px] text-white/70">
        🗣️ Leak
      </button>
      <button data-next onClick={onNext} className="press pill min-h-[52px] flex-1 bg-white font-display text-[17px] font-bold text-black">
        Continue →
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- phone takeovers (texts, voice notes, calls)

function PhonePanel({ card, run, phase, outcome, onTyped, onChoose, onNext, onClue, onLeak, partnerName }: PanelProps) {
  const kind = card.card.presentation!;
  const first = card.beats.find((b) => b.who !== 'narration' && b.who !== 'tell');
  const caller = first ? speakerName(first, partnerName) : partnerName;
  const [answered, setAnswered] = useState(kind !== 'call' || phase !== 'intro');
  const [played, setPlayed] = useState(kind !== 'voice_note' || phase !== 'intro');
  const [declines, setDeclines] = useState(0);
  const ready = answered && played;

  useEffect(() => {
    if (kind === 'call' && !answered) {
      const t = setInterval(() => sound.play('ring'), 2200);
      return () => clearInterval(t);
    }
  }, [answered]);

  if (!answered)
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-t-[30px] bg-gradient-to-b from-[#0f172a]/95 to-[#08090D] px-6 text-center">
        <div className="text-xs uppercase tracking-[0.3em] text-white/50">Incoming call</div>
        <div className="font-display mt-2 text-3xl font-extrabold">{caller}</div>
        <div className="mt-1 text-sm text-white/40">{declines ? 'It keeps ringing. This is Lagos.' : 'mobile'}</div>
        <div className="mt-8 flex w-full max-w-xs justify-between">
          <button onClick={() => (sound.play('buzz'), setDeclines(declines + 1))} className="press flex h-16 w-16 items-center justify-center rounded-full bg-[#EF4444] text-2xl">
            ✕
          </button>
          <button data-answer onClick={() => (sound.play('tap'), setAnswered(true))} className="press anim-ring flex h-16 w-16 items-center justify-center rounded-full bg-[#10B981] text-2xl">
            📞
          </button>
        </div>
      </div>
    );

  return (
    <div className="flex h-full flex-col rounded-t-[30px] border-t-2 border-white/10 bg-[#0b141a]/97">
      <div className="flex items-center gap-3 border-b border-white/5 px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-sm">{kind === 'call' ? '📞' : caller[0]}</div>
        <div>
          <div className="text-[15px] font-bold">{caller}</div>
          <div className="text-[11px] text-[#10B981]">{kind === 'call' ? 'on call · 00:14' : 'online'}</div>
        </div>
      </div>
      {!played ? (
        <div className="flex flex-1 items-center px-4">
          <VoiceNote seconds={Math.max(6, Math.round((first?.text.length ?? 40) / 6))} onPlay={() => setPlayed(true)} />
        </div>
      ) : (
        <ChatBody key={String(ready)} card={card} phase={phase} outcome={outcome} onTyped={onTyped} partnerName={partnerName} voice={kind === 'voice_note'} />
      )}
      <div className="px-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        {ready && phase === 'choices' && <Choices card={card} run={run} onChoose={onChoose} onClue={onClue} />}
        {phase === 'outcome' && <NextBar onNext={onNext} onLeak={onLeak} />}
      </div>
    </div>
  );
}

function ChatBody({ card, phase, outcome, onTyped, partnerName, voice }: { card: ResolvedCard; phase: Phase; outcome: PanelProps['outcome']; onTyped: () => void; partnerName: string; voice: boolean }) {
  const { shown, typing, skip } = useTyped(card.beats, phase === 'intro', onTyped);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ top: 99999, behavior: 'smooth' });
  }, [shown, phase]);
  return (
    <div ref={scroller} className="flex-1 space-y-2 overflow-y-auto px-3 py-3 no-scrollbar" onClick={skip} style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '14px 14px' }}>
      {card.beats.slice(0, shown).map((b, i) =>
        b.who === 'narration' || b.who === 'tell' ? (
          <p key={i} className="anim-rise mx-auto max-w-[90%] rounded-lg bg-black/30 px-3 py-1.5 text-center text-[12px] italic text-white/60">
            {b.text}
          </p>
        ) : (
          <div key={i} className="anim-rise max-w-[85%] rounded-2xl rounded-tl-sm bg-[#202c33] px-3 py-2 text-[15px]">
            {voice && <div className="mb-1 text-[10px] font-bold uppercase text-[#10B981]">🎙️ Voice note transcript</div>}
            <div className="text-[11px] font-bold text-[#F59E0B]">{speakerName(b, partnerName)}</div>
            {b.text}
          </div>
        ),
      )}
      {typing && (
        <div className="flex w-16 items-center justify-center gap-1 rounded-2xl bg-[#202c33] py-3">
          {[0, 1, 2].map((i) => (
            <span key={i} className="typing-dot h-2 w-2 rounded-full bg-white/60" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      )}
      {outcome && (
        <>
          <div className="anim-rise ml-auto max-w-[80%] rounded-2xl rounded-tr-sm bg-[#005c4b] px-3 py-2 text-[15px]">
            {outcome.label.replace(/^\[[^\]]+\]\s*/, '')}
            <span className="ml-2 text-[10px] text-[#53bdeb]">✓✓</span>
          </div>
          <Outcome result={outcome.result} />
        </>
      )}
    </div>
  );
}

function VoiceNote({ seconds, onPlay }: { seconds: number; onPlay: () => void }) {
  const [playing, setPlaying] = useState(false);
  const bars = useMemo(() => Array.from({ length: 34 }, (_, i) => 0.25 + Math.abs(Math.sin(i * 1.7) * 0.75)), []);
  return (
    <div className="flex w-full items-center gap-3 rounded-2xl bg-[#202c33] p-3">
      <button
        onClick={() => {
          sound.play('tap');
          setPlaying(true);
          setTimeout(onPlay, 900);
        }}
        className="press flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#10B981] text-xl text-black"
        aria-label="Play voice note"
      >
        {playing ? '❚❚' : '▶'}
      </button>
      <div className="flex h-10 flex-1 items-center gap-[3px]">
        {bars.map((h, i) => (
          <span key={i} className="flex-1 rounded-full bg-white/60" style={{ height: `${h * 100}%`, animation: playing ? `wave 0.6s ease-in-out infinite ${i * 0.03}s` : undefined }} />
        ))}
      </div>
      <span className="text-xs text-white/50">0:{String(seconds).padStart(2, '0')}</span>
    </div>
  );
}

// ---------------------------------------------------------------- night, bail-out, ending

function Night({ day, onPhone, onSleep, spotUsed }: { day: number; onPhone: () => void; onSleep: () => void; spotUsed: boolean }) {
  return (
    <div className="anim-slide-up flex h-full flex-col justify-end rounded-t-[30px] border-t-2 border-white/10 bg-[#08090D]/95 p-5 pb-[max(20px,env(safe-area-inset-bottom))] backdrop-blur-xl">
      <div className="text-xs font-bold uppercase tracking-[0.3em] text-white/40">Night falls on Lagos</div>
      <h2 className="font-display mt-1 text-[34px] font-extrabold leading-none">Day {day} survived.</h2>
      <p className="mt-2 text-[15px] text-white/60">{spotUsed ? 'Generator humming. Phone face-down. Tomorrow is another wahala.' : 'Before you sleep: one city spot on your phone. Glow up, call your Bestie, buy gist, pray, or party.'}</p>
      <div className="mt-5 flex gap-2">
        {!spotUsed && (
          <button onClick={onPhone} className="press pill min-h-[54px] flex-1 border-2 border-[#F59E0B]/60 bg-[#F59E0B]/10 font-display font-bold text-[#F59E0B]">
            📱 City spots
          </button>
        )}
        <button data-sleep onClick={onSleep} className="press pill min-h-[54px] flex-1 bg-white font-display text-[17px] font-bold text-black">
          Sleep → Day {day + 1}
        </button>
      </div>
    </div>
  );
}

function Bailout({ run, onResolve }: { run: RunState; onResolve: (granted: boolean) => void }) {
  const [left, setLeft] = useState(10);
  const [free, setFree] = useState(0);
  const [msg, setMsg] = useState('');
  const e = run.pendingEnding!;
  useEffect(() => {
    sound.play('sting');
    backend.freeBailouts().then(setFree);
    const t = setInterval(() => setLeft((x) => x - 1), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (left <= 0) onResolve(false);
  }, [left]);
  if (!bailoutEligible(e)) return null;
  async function pay() {
    backend.track('bailout_tapped');
    const r = await backend.purchase('bailout', `${run.seed}`);
    if (r.granted) {
      backend.track('bailout_paid');
      onResolve(true);
    } else setMsg(r.reason ?? 'Payment not verified.');
  }
  async function useFree() {
    if (await backend.useFreeBailout(`${run.seed}`)) onResolve(true);
  }
  return (
    <div className="anim-fade absolute inset-0 z-[55] flex items-center justify-center bg-black/80 p-5 backdrop-blur">
      <div className="anim-pop w-full rounded-[32px] border-2 border-[#EF4444]/60 bg-[#14070a] p-6 text-center">
        <div className="text-5xl">{e === 'sapa' ? '💸' : '🫠'}</div>
        <div className="font-display mt-2 text-xs font-bold uppercase tracking-[0.3em] text-[#EF4444]">{e === 'sapa' ? 'Sapa alert' : 'Sanity at zero'}</div>
        <h2 className="font-display mt-1 text-3xl font-extrabold">{e === 'sapa' ? 'Your wallet just hit ₦0.' : "You're about to break down."}</h2>
        <p className="mt-2 text-white/60">An Emergency Bail-Out restores you to 25 and keeps the story going. Once per run.</p>
        <div className="num mt-4 text-6xl text-[#EF4444]">{left}</div>
        <button onClick={pay} className="press pill mt-4 min-h-[54px] w-full bg-[#10B981] font-display text-lg font-bold text-black">
          Bail me out · ₦500
        </button>
        {free > 0 && (
          <button onClick={useFree} className="press pill mt-2 min-h-[50px] w-full border-2 border-[#10B981] font-bold text-[#10B981]">
            Use free Bail-Out ({free})
          </button>
        )}
        {msg && <p className="mt-3 text-[13px] text-[#fde68a]">{msg} Invite a friend who finishes a run to earn a free one.</p>}
        {import.meta.env.DEV && (
          <button onClick={() => onResolve(true)} className="mt-2 text-xs text-white/30 underline">
            dev: grant bail-out
          </button>
        )}
        <button data-let-end onClick={() => onResolve(false)} className="mt-4 block w-full text-sm text-white/50">
          Let it end
        </button>
      </div>
    </div>
  );
}

function EndingCard({ run, onVerdict }: { run: RunState; onVerdict: () => void }) {
  const ch = getCharacter(lagos, run.characterId);
  const e = ch.endings[run.ending!];
  const text = fill(e?.text ?? '', { character: ch, player: run.player });
  const [reveal, setReveal] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setReveal(1), 900);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="absolute inset-x-0 bottom-0 z-40 flex h-[50%] flex-col justify-end rounded-t-[30px] border-t-2 border-white/10 bg-gradient-to-b from-[#08090D]/80 to-[#08090D] p-6 pb-[max(20px,env(safe-area-inset-bottom))]">
      <div className="text-xs font-bold uppercase tracking-[0.35em] text-white/40">Day {run.endedDay} · The end of Phase 1</div>
      <h1 className={`font-display anim-pop mt-2 text-[44px] font-extrabold leading-[0.95] ${run.ending === 'locked_in' || run.ending === 'counter_con' ? 'shimmer-gold' : run.ending === 'obsession' ? 'text-white' : 'text-[#F43F5E]'}`}>{e?.title ?? run.ending}</h1>
      {reveal > 0 && <p className="anim-rise mt-3 text-[17px] leading-snug text-white/85">{text}</p>}
      {reveal > 0 && (
        <button data-verdict onClick={() => (sound.play('reveal'), onVerdict())} className="anim-rise press pill mt-6 min-h-[56px] w-full bg-[#F59E0B] font-display text-lg font-extrabold text-black" style={{ animationDelay: '0.4s' }}>
          See your Verdict →
        </button>
      )}
    </div>
  );
}
