import { useEffect, useRef, useState, type ReactNode } from 'react';
import { step, toEvent, type Line } from '../../engine/scene';
import type { ChoiceResult } from '../../engine/types';
import { Portrait } from '../art/Portrait';
import { npcLook } from '../art/looks';
import { sound } from '../audio';
import type { DateCtx } from './ctx';
import { ActionBtn, Caption, Consequence, useLines } from './parts';

/** Inside the Prado at night: city lights streaking past, Musa in the mirror. */
export function PradoInterior({ children, musa = true }: { children?: ReactNode; musa?: boolean }) {
  const m = npcLook('Musa');
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#06070b]">
      {/* side window with the city going past */}
      <div className="absolute inset-x-[6%] top-[190px] h-[30%] overflow-hidden rounded-[36px] bg-gradient-to-b from-[#0d1b33] to-[#1c1630]">
        {Array.from({ length: 14 }).map((_, i) => (
          <span key={i} className="absolute h-[3px] rounded-full" style={{ top: `${18 + ((i * 37) % 70)}%`, width: `${30 + ((i * 17) % 50)}%`, background: i % 3 ? '#fbbf24' : '#f43f5e', opacity: 0.55, animation: `streak ${0.9 + (i % 5) * 0.35}s ${i * 0.21}s linear infinite`, filter: 'blur(1.5px)' }} />
        ))}
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={`b${i}`} className="absolute bottom-0 w-[16%] bg-[#0a0f1d]" style={{ height: `${40 + ((i * 23) % 50)}%`, left: 0, animation: `driveL ${4 + i}s ${i * 0.7}s linear infinite` }} />
        ))}
        <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.06] to-transparent" />
      </div>
      {/* rear-view mirror: Musa's eyes */}
      {musa && (
        <div className="absolute right-[8%] top-[112px] h-[64px] w-[42%] overflow-hidden rounded-xl border-2 border-black bg-black shadow-xl">
          <div className="absolute left-1/2 top-[-60%] -translate-x-1/2 opacity-80">
            <Portrait look={m.look} feminine={false} size={150} idle />
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent" />
        </div>
      )}
      {/* leather seat + door */}
      <div className="absolute inset-x-0 bottom-0 h-[50%] bg-gradient-to-t from-[#1a1210] via-[#21160f] to-transparent" />
      <div className="absolute bottom-[34%] left-0 h-3 w-full bg-[#2b1d14]" />
      <div className="absolute inset-0" style={{ animation: 'gen-shake 0.3s infinite' }} />
      {children}
    </div>
  );
}

export function Ride({ ctx }: { ctx: DateCtx }) {
  const st = step(ctx.scene, 'ride');
  const lines: Line[] = st.driver_lines.map((l) => ({ ...l, text: l.text.replace('{title}', ctx.title) }));
  const zip = ctx.run.log.find((e) => e.card === `scene:${ctx.scene.id}:getting_ready.zip`);
  const allLines: Line[] = zip ? [lines[0], { who: 'narration', text: zip.outcomeText }, ...lines.slice(1)] : lines;
  const [phase, setPhase] = useState<'talk' | 'text' | 'done'>('talk');
  const [result, setResult] = useState<{ text: string; r?: ChoiceResult } | null>(null);
  const { line, next } = useLines(allLines, { onDone: () => (setPhase('text'), sound.play('buzz')) });
  useEffect(() => {
    sound.setAmbience(['car_engine', 'afrobeats_radio'], 'date:prado');
    sound.effect('engine');
  }, []);

  function decide(away: boolean) {
    const m = away ? st.put_away : st.keep_out;
    sound.effect(away ? 'zip' : 'pop');
    const r = ctx.play(toEvent(st.id, m, { label: m.label, fromPartner: false }));
    setResult({ text: away ? 'Phone in the bag. Chief would be pleased. You feel a little lighter, and a little blind.' : 'Phone stays in your hand. Your night, your rules.', r });
    setPhase('done');
  }

  return (
    <PradoInterior>
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 pb-[max(14px,env(safe-area-inset-bottom))]">
        {phase === 'talk' && <Caption line={line} name={line?.who === 'musa' ? st.driver : undefined} onTap={next} />}
        {phase === 'text' && <PhoneDrag text={st.partner_text} onDecide={decide} />}
        {phase === 'done' && result && (
          <>
            <Consequence text={result.text} deltas={result.r?.deltas ?? {}} />
            <div className="px-3">
              <ActionBtn testId="arrive" tone="primary" className="text-center" onClick={() => ctx.next()}>
                Arrive in Ikoyi
              </ActionBtn>
            </div>
          </>
        )}
      </div>
    </PradoInterior>
  );
}

/** The phone in your hand. Drag it into your bag, or keep holding it. */
function PhoneDrag({ text, onDecide }: { text: string; onDecide: (away: boolean) => void }) {
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const bag = useRef<HTMLDivElement>(null);
  const [over, setOver] = useState(false);
  function overBag(x: number, y: number) {
    const b = bag.current?.getBoundingClientRect();
    return !!b && x > b.left - 20 && x < b.right + 20 && y > b.top - 30 && y < b.bottom + 20;
  }
  return (
    <div className="relative h-[300px] select-none touch-none">
      <div ref={bag} className={`absolute bottom-2 left-4 flex h-24 w-28 flex-col items-center justify-end rounded-b-3xl rounded-t-lg border-2 ${over ? 'border-[#F59E0B] bg-[#F59E0B]/20' : 'border-white/20 bg-[#3a2418]'} pb-2 transition-colors`}>
        <div className="absolute -top-5 h-8 w-16 rounded-t-full border-4 border-b-0 border-[#5a3a28]" />
        <span className="text-[11px] font-bold text-white/70">Your bag</span>
      </div>
      <div
        data-phone
        className="absolute right-8 top-0 w-[150px] cursor-grab rounded-[26px] border-4 border-[#222] bg-[#0b0d12] p-2 shadow-2xl"
        style={{ transform: drag ? `translate(${drag.x}px, ${drag.y}px) rotate(${drag.x / 12}deg)` : 'rotate(-6deg)', transition: drag ? 'none' : 'transform 0.35s' }}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          start.current = { x: e.clientX, y: e.clientY };
          setDrag({ x: 0, y: 0 });
        }}
        onPointerMove={(e) => {
          if (!start.current) return;
          setDrag({ x: e.clientX - start.current.x, y: e.clientY - start.current.y });
          setOver(overBag(e.clientX, e.clientY));
        }}
        onPointerUp={(e) => {
          const hit = overBag(e.clientX, e.clientY);
          start.current = null;
          setDrag(null);
          setOver(false);
          if (hit) onDecide(true);
        }}
      >
        <div className="anim-buzz rounded-2xl bg-[#1c2230] p-2.5">
          <div className="text-[10px] font-bold uppercase text-white/50">Chief 👑</div>
          <div className="mt-1 text-[13px] leading-snug">{text}</div>
        </div>
        <div className="mt-2 h-24 rounded-xl bg-gradient-to-b from-[#1b1f2a] to-[#0d0f14]" />
      </div>
      <div className="absolute bottom-3 right-3 w-[52%] space-y-2">
        <p className="text-right text-[12px] font-bold text-white/60">Drag your phone into the bag, or…</p>
        <ActionBtn testId="keep-phone" onClick={() => onDecide(false)} className="text-center text-[14px]">
          Keep it in your hand
        </ActionBtn>
        <button data-act="phone-away" className="sr-only" onClick={() => onDecide(true)}>
          Put it in the bag
        </button>
      </div>
    </div>
  );
}
