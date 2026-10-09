import { useEffect, useRef, useState } from 'react';
import { lagos } from '../../content/browser';
import { fill } from '../../engine/text';
import type { Character, PlayerSetup } from '../../engine/types';
import { Portrait } from '../art/Portrait';
import { sound } from '../audio';
import { SceneBackdrop } from '../scene/Scene';

/** Every run opens on a short animated scene (10 to 20 seconds) before any choice. */
export function ColdOpen({ ch, player, onDone, reduced }: { ch: Character; player: PlayerSetup; onDone: () => void; reduced?: boolean }) {
  const co = ch.cold_open!;
  const loc = lagos.locations.find((l) => l.id === co.scene.location) ?? lagos.locations[0];
  const [t, setT] = useState(0);
  const [pings, setPings] = useState<{ from: string; text: string; id: number }[]>([]);
  const fired = useRef(new Set<number>());
  const done = useRef(false);

  useEffect(() => {
    sound.unlock();
    sound.setAmbience(loc.ambience, `cold:${loc.id}`);
    const start = performance.now();
    const timer = window.setInterval(() => setT((performance.now() - start) / 1000), 100);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    (co.phone ?? []).forEach((p, i) => {
      if (t >= p.at && !fired.current.has(i)) {
        fired.current.add(i);
        sound.play('buzz');
        setPings((x) => [...x, { from: fill(p.from, { character: ch, player }), text: fill(p.text, { character: ch, player }), id: i }]);
      }
    });
    if (t >= co.duration && !done.current) finish();
  }, [t]);

  function finish() {
    if (done.current) return;
    done.current = true;
    sound.play('swoosh');
    onDone();
  }

  const beats = co.beats.filter((b) => t >= b.at);
  const current = beats[beats.length - 1];
  const showPartner = co.scene.partner_present !== false && t >= (co.beats[1]?.at ?? 2) - 0.5;
  const halfWindow = co.scene.props?.includes('window_half');
  const windowDrop = Math.min(1, Math.max(0, (t - (co.beats[1]?.at ?? 4)) / 2.5));

  return (
    <div className="relative h-full overflow-hidden bg-black" onClick={() => current && t > 2 && finish()}>
      <div className="absolute inset-0 anim-fade">
        <SceneBackdrop location={loc} time={(co.scene.time ?? 'night') as any} mood={co.scene.mood} fx={co.scene.fx} reduced={reduced} />
      </div>
      {showPartner && (
        <div className="absolute bottom-[26%] left-1/2 -translate-x-1/2">
          <div className="anim-enter relative">
            <Portrait look={ch.look} feminine={ch.gender === 'woman'} artId={ch.id.split('_')[0]} expression={co.scene.expression ?? 'charming'} size={270} idle={!reduced} />
            {halfWindow && (
              // Tinted back window lowering halfway: you only ever see part of him.
              <div className="absolute inset-x-[-12%] top-[-6%] rounded-t-[40px] border-4 border-[#1c1c22]" style={{ height: `${100 - windowDrop * 52}%`, background: 'linear-gradient(170deg, rgba(10,12,20,0.97), rgba(25,30,45,0.93))', boxShadow: 'inset 0 0 40px rgba(120,150,255,0.15)' }}>
                <div className="absolute inset-x-6 top-4 h-1 rounded bg-white/10" />
              </div>
            )}
          </div>
        </div>
      )}
      {/* Letterbox */}
      <div className="absolute inset-x-0 top-0 h-[9%] bg-black" />
      <div className="absolute inset-x-0 bottom-0 h-[26%] bg-gradient-to-t from-black via-black to-transparent" />

      <div className="absolute inset-x-3 top-[11%] space-y-2">
        {pings.slice(-1).map((p) => (
          <div key={p.id} className="anim-slide-down flex items-start gap-3 rounded-2xl border border-white/15 bg-[#15171f]/92 p-3 shadow-2xl backdrop-blur-xl">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10">💬</div>
            <div className="min-w-0">
              <div className="text-[13px] font-bold">{p.from}</div>
              <div className="text-[13px] text-white/80">{p.text}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="absolute inset-x-6 bottom-[9%] min-h-[96px]">
        {current && (
          <p key={current.at} className={`anim-rise text-center leading-snug ${current.who === 'narration' ? 'text-[17px] italic text-white/85' : 'font-display text-[21px] font-bold text-white'}`}>
            {current.who !== 'narration' && <span className="mb-1 block text-[11px] font-bold uppercase not-italic tracking-[0.3em] text-[#F59E0B]">{current.who === 'partner' ? ch.short : current.who}</span>}
            {current.who === 'narration' ? '' : '“'}
            {fill(current.text, { character: ch, player })}
            {current.who === 'narration' ? '' : '”'}
          </p>
        )}
      </div>

      <div className="absolute inset-x-6 bottom-[4%] flex items-center gap-3">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/15">
          <div className="h-full bg-[#F59E0B]" style={{ width: `${Math.min(100, (t / co.duration) * 100)}%`, transition: 'width 0.1s linear' }} />
        </div>
        <button onClick={(e) => (e.stopPropagation(), finish())} className="press rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-bold" data-skip-cold>
          Skip ›
        </button>
      </div>
    </div>
  );
}
