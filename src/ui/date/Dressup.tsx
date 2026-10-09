import { useEffect, useMemo, useRef, useState } from 'react';
import { dressBudget, dressEvents, outfitCost, step, toEvent, wardrobe, type Outfit, type WearItem } from '../../engine/scene';
import { naira } from '../../engine/text';
import type { PortraitLook } from '../../engine/types';
import { sound } from '../audio';
import type { DateCtx } from './ctx';
import { Figure } from './Figure';
import { ActionBtn, Caption, Consequence, TimerBar, useLines } from './parts';

const SLOTS: { id: WearItem['slot']; label: string }[] = [
  { id: 'outfit', label: 'Outfit' },
  { id: 'hair', label: 'Hair' },
  { id: 'shoes', label: 'Shoes' },
  { id: 'jewellery', label: 'Jewellery' },
  { id: 'bag', label: 'Bag' },
  { id: 'perfume', label: 'Perfume' },
];

const SWATCH: Record<string, string> = {
  s_heels: '#c1121f', s_flats: '#d4a017', s_sneakers: '#f4f4f5', s_loafers: '#3b1f12', s_sandals: '#6b4423',
  j_gold_chain: '#e8c14a', j_coral: '#d1462f', j_pearls: '#f8f4e8', j_watch: '#c0c6cc',
  b_clutch: '#d4a017', b_designer: '#6b4423', b_tote: '#ece6d8',
  p_oud: '#f5b041', p_floral: '#f9a8d4', p_none: '#334155',
};

export function applyOutfit(base: PortraitLook, items: WearItem[], picks: Outfit): PortraitLook {
  const look = { ...base };
  for (const id of Object.values(picks)) {
    const it = items.find((i) => i.id === id);
    if (it?.look) Object.assign(look, it.look);
  }
  return look;
}

type CallState = 'none' | 'ringing' | 'talking' | 'reply' | 'done';

export function Dressup({ ctx, baseLook, onLook }: { ctx: DateCtx; baseLook: PortraitLook; onLook: (picks: Outfit) => void }) {
  const st = step(ctx.scene, 'dressup');
  const set = ctx.feminine ? 'woman' : 'man';
  const items = useMemo(() => wardrobe(ctx.scene, set), [set]);
  const [tab, setTab] = useState<WearItem['slot']>('outfit');
  const [picks, setPicks] = useState<Outfit>({});
  const [pop, setPop] = useState(0);
  const [call, setCall] = useState<CallState>('none');
  const [callResult, setCallResult] = useState<{ text: string; deltas: Record<string, number | undefined> } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [mins, setMins] = useState(12);
  const picksCount = Object.keys(picks).length;
  const cost = outfitCost(ctx.scene, picks);
  const wallet = dressBudget(ctx.run);
  const look = applyOutfit(baseLook, items, picks);
  const ready = st.required.every((r) => picks[r as WearItem['slot']]);

  useEffect(() => onLook(picks), [JSON.stringify(picks)]);
  // The clock runs to 7:59. No fail state, just the feeling of getting ready late.
  useEffect(() => {
    const t = setInterval(() => setMins((m) => Math.min(59, m + 1)), 2600);
    return () => clearInterval(t);
  }, []);
  // Bestie rings once you've started dressing.
  useEffect(() => {
    if (call === 'none' && picksCount >= st.call.after_picks) {
      setCall('ringing');
      sound.play('ring');
    }
  }, [picksCount]);

  function wear(it: WearItem) {
    const extra = (it.cost ?? 0) - (picks[it.slot] ? (items.find((i) => i.id === picks[it.slot])?.cost ?? 0) : 0);
    if (picks[it.slot] !== it.id && cost + extra > wallet) {
      sound.play('loss');
      setPop(-Date.now());
      return;
    }
    sound.effect(it.slot === 'perfume' && it.id !== 'p_none' ? 'sparkle' : it.slot === 'outfit' ? 'zip' : 'pop');
    if (it.cost && picks[it.slot] !== it.id) sound.play('cash');
    setPicks((p) => {
      const n = { ...p };
      if (n[it.slot] === it.id && !st.required.includes(it.slot)) delete n[it.slot];
      else n[it.slot] = it.id;
      return n;
    });
    setPop(Date.now());
  }

  function answer(replyId: string | 'missed') {
    const m = replyId === 'missed' ? st.call.missed : st.call.replies.find((r) => r.id === replyId)!;
    const r = ctx.play(toEvent('bestie_call', m, { label: m.label ?? 'Let it ring', fromPartner: false }));
    setCallResult(replyId === 'missed' ? { text: 'You let it ring. She will remember.', deltas: r?.deltas ?? {} } : null);
    setTimeout(() => setCallResult(null), 3500);
    if (replyId !== 'missed') {
      setCall('reply');
      setReplyLines(m.lines as any);
    } else setCall('done');
    return r;
  }
  const [replyLines, setReplyLines] = useState<any[] | null>(null);

  function leave() {
    setLeaving(true);
    sound.effect('door');
    const evs = dressEvents(ctx.scene, ctx.run, picks);
    for (const e of evs) ctx.play(e);
    setTimeout(() => ctx.next(), 900);
  }

  const shown = items.filter((i) => i.slot === tab);
  const short = cost > wallet;
  return (
    <div className="absolute inset-0 flex flex-col bg-[#120c14]">
      {/* Bedroom: mirror, ring light, the figure that wears everything */}
      <div className="relative flex-1 overflow-hidden" style={{ background: 'radial-gradient(ellipse at 50% 30%, #3b2340 0%, #1a1020 55%, #0c0810 100%)' }}>
        <div className="absolute left-1/2 top-[24%] h-[74%] w-[62%] -translate-x-1/2 rounded-t-[999px] border-[6px] border-[#c9a86a]/70 bg-gradient-to-b from-white/10 to-white/[0.02] shadow-[0_0_60px_rgba(201,168,106,0.25)]" />
        <div className="absolute left-[8%] top-[34%] h-12 w-12 rounded-full border-[6px] border-white/80 shadow-[0_0_40px_rgba(255,255,255,0.6)]" style={{ animation: 'flicker 6s infinite' }} />
        <div className="absolute right-3 top-[118px] rounded-xl bg-black/60 px-3 py-1.5 text-right backdrop-blur">
          <div className="num text-lg leading-none">7:{String(mins).padStart(2, '0')}pm</div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-white/60">Dinner at 8</div>
        </div>
        <div className="absolute inset-x-0 bottom-0 flex justify-center">
          <div key={pop > 0 ? pop : 'still'} className={pop > 0 ? 'anim-dress' : ''}>
            <Figure look={look} feminine={ctx.feminine} worn={{ shoes: picks.shoes, jewellery: picks.jewellery, bag: picks.bag, perfume: picks.perfume }} size={170} />
          </div>
        </div>
        {pop < 0 && (
          <div key={pop} className="anim-pop absolute inset-x-6 top-[42%] rounded-2xl bg-black/85 p-3 text-center text-sm">
            Your account balance said "be serious". Keep transport money for later.
          </div>
        )}
        <div className="absolute left-3 top-[118px] max-w-[52%]">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#F59E0B]">Getting ready</div>
          <div className="font-display text-[17px] font-bold leading-tight">{st.title}</div>
        </div>

        {call !== 'none' && call !== 'done' && (
          <BestieCall
            ctx={ctx}
            state={call}
            onAnswer={() => setCall('talking')}
            onReply={answer}
            replyLines={replyLines}
            onFinished={() => setCall('done')}
          />
        )}
        {callResult && call === 'done' && <div className="anim-rise absolute inset-x-3 top-[34%]"><Consequence text={callResult.text} deltas={callResult.deltas} /></div>}
      </div>

      {/* Wardrobe */}
      <div className="rounded-t-[26px] border-t border-white/10 bg-[#0b0a0f] px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
          {SLOTS.filter((s) => items.some((i) => i.slot === s.id)).map((s) => (
            <button key={s.id} data-tab={s.id} onClick={() => (sound.play('tap'), setTab(s.id))} className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-bold ${tab === s.id ? 'bg-[#F43F5E] text-white' : 'bg-white/5 text-white/70'}`}>
              {s.label}
              {picks[s.id] ? ' ✓' : st.required.includes(s.id) ? ' •' : ''}
            </button>
          ))}
        </div>
        <div className="no-scrollbar mt-2.5 flex gap-2 overflow-x-auto pb-1">
          {shown.map((it) => {
            const on = picks[it.slot] === it.id;
            const col = it.look?.outfit ?? (it.look?.hairColor && it.slot === 'hair' ? it.look.hairColor : undefined) ?? SWATCH[it.id] ?? '#444';
            return (
              <button key={it.id} data-item={it.id} onClick={() => wear(it)} className={`press relative w-[104px] shrink-0 rounded-2xl border-2 p-2 text-left ${on ? 'border-[#F59E0B] bg-[#F59E0B]/10' : 'border-white/10 bg-white/[0.04]'}`}>
                <div className="mb-1.5 h-10 w-full rounded-xl" style={{ background: it.look?.outfitAccent ? `linear-gradient(135deg, ${col} 60%, ${it.look.outfitAccent})` : col }} />
                <div className="text-[12.5px] font-bold leading-tight">{it.label}</div>
                <div className="mt-0.5 text-[11px] font-bold">
                  {it.cost ? <span className="text-[#F59E0B]">{naira(it.cost, { short: true })}</span> : it.borrowed ? <span className="text-sky-300">Borrowed</span> : <span className="text-white/40">Yours</span>}
                </div>
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex items-center gap-3">
          <div className="text-[12px] leading-tight text-white/60">
            {cost > 0 ? (
              <>
                Tonight's look: <span className={`num ${short ? 'text-red-400' : 'text-[#F59E0B]'}`}>{naira(cost)}</span>
              </>
            ) : (
              'Pick an outfit and shoes. Everything shows on you.'
            )}
          </div>
          <div className="flex-1" />
          <button data-act="leave" disabled={!ready || leaving || call === 'ringing' || call === 'talking' || call === 'reply'} onClick={leave} className="press rounded-2xl bg-[#F43F5E] px-5 py-3 font-display text-[16px] font-bold disabled:opacity-35">
            Leave the house
          </button>
        </div>
      </div>
    </div>
  );
}

function BestieCall({ ctx, state, onAnswer, onReply, replyLines, onFinished }: { ctx: DateCtx; state: CallState; onAnswer: () => void; onReply: (id: string) => void; replyLines: any[] | null; onFinished: () => void }) {
  const st = step(ctx.scene, 'dressup').call;
  const [talked, setTalked] = useState(false);
  const missed = useRef(false);
  return (
    <div className="anim-slide-down absolute inset-x-3 top-[112px] z-40 rounded-3xl border border-white/15 bg-[#151821]/95 p-3 shadow-2xl backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-pink-400 to-purple-600 text-lg font-black">B</div>
        <div className="flex-1">
          <div className="font-bold">{st.caller}</div>
          <div className="text-[12px] text-white/60">{state === 'ringing' ? 'Incoming call…' : 'On the phone'}</div>
        </div>
      </div>
      {state === 'ringing' && (
        <div className="mt-3 space-y-2">
          <TimerBar seconds={7} tone="#F59E0B" onEnd={() => { if (!missed.current) { missed.current = true; onReply('missed'); } }} />
          <div className="grid grid-cols-2 gap-2">
            <ActionBtn testId="decline" onClick={() => { missed.current = true; onReply('missed'); }} tone="danger" className="text-center">Decline</ActionBtn>
            <ActionBtn testId="answer" onClick={() => { missed.current = true; onAnswer(); }} tone="gold" className="text-center">Answer</ActionBtn>
          </div>
        </div>
      )}
      {state === 'talking' && !talked && <CallLines lines={st.lines} onDone={() => setTalked(true)} />}
      {state === 'talking' && talked && (
        <div className="mt-3 space-y-2">
          {st.replies.map((r) => (
            <ActionBtn key={r.id} testId={`call-${r.id}`} onClick={() => onReply(r.id)}>
              {r.label}
            </ActionBtn>
          ))}
        </div>
      )}
      {state === 'reply' && replyLines && <CallLines lines={replyLines} onDone={onFinished} />}
    </div>
  );
}

function CallLines({ lines, onDone }: { lines: any[]; onDone: () => void }) {
  const { line, next } = useLines(lines, { onDone });
  return (
    <div className="mt-3" onClick={next}>
      <Caption line={line} />
    </div>
  );
}
