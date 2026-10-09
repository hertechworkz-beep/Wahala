import { useEffect, useRef, useState } from 'react';
import { dressScore, playedSteps, sceneMeta, step, type EscapeOutcome, type Outfit, type SceneSpec } from '../../engine/scene';
import { naira } from '../../engine/text';
import type { ChoiceResult, Meters, RunState, SceneEvent } from '../../engine/types';
import { playerLook } from '../art/looks';
import { detectLowEnd, sound } from '../audio';
import { Hud } from '../run/Hud';
import { Briefcase } from './Briefcase';
import type { DateCtx } from './ctx';
import { Dressup, applyOutfit } from './Dressup';
import { Escape } from './Escape';
import { Outro, Recap } from './Outro';
import { Ride } from './Ride';
import { Arrival, Glance, Photo, Seat, Talk, Toast } from './Table';

interface Props {
  scene: SceneSpec;
  run: RunState;
  play: (sceneId: string, ev: SceneEvent) => { state: RunState; result: ChoiceResult } | undefined;
  end: (sceneId: string) => void;
}

/**
 * Chief's first date, played: get dressed, ride over, pick a table, watch him walk in, talk,
 * toast, catch (or miss) what his phone and briefcase say, survive whoever walks in, and get
 * home. Every moment is an engine event, so the night is saved, replayable and on the receipts.
 */
export function FirstDate({ scene, run, play, end }: Props) {
  const steps = scene.steps;
  const [idx, setIdx] = useState(() => {
    const done = playedSteps(run, scene.id);
    const i = steps.findIndex((s) => !done.has(s.id));
    return i < 0 ? steps.length : i;
  });
  const feminine = run.player.avatar.set === 'woman';
  const [picks, setPicks] = useState<Outfit>(() => {
    const m = sceneMeta(run, scene.id, `${steps[0].id}.wear`);
    if (!m) return {};
    const { score: _s, ...rest } = m;
    return rest as Outfit;
  });
  const [seat, setSeat] = useState(() => run.log.find((e) => e.card.startsWith(`scene:${scene.id}:choose_table.`))?.choice.split('.')[1] ?? 'window');
  const [escape, setEscape] = useState<EscapeOutcome | undefined>(() => sceneMeta(run, scene.id, findEscapeId(run, scene.id))?.outcome as EscapeOutcome | undefined);
  const [deltas, setDeltas] = useState<Partial<Meters>>({});
  const [deltaKey, setDeltaKey] = useState(0);
  const [alert, setAlert] = useState<{ id: number; text: string; credit: boolean } | null>(null);
  const [muted, setMuted] = useState(sound.muted);
  const [reduced] = useState(() => detectLowEnd());
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    sound.lowEnd = reduced;
  }, [reduced]);
  useEffect(() => () => sound.stopAmbience(), []);
  // Ambience follows where you are.
  const cur = steps[idx];
  useEffect(() => {
    if (!cur) return;
    if (cur.type === 'dressup') sound.setAmbience(['afrobeats_radio', 'ac_hum'], 'date:bedroom');
    else if (cur.type === 'ride' || cur.type === 'outro') sound.setAmbience(['car_engine', 'afrobeats_radio'], 'date:prado');
    else sound.setAmbience(['restaurant', 'lagoon_breeze'], 'date:restaurant');
  }, [cur?.type]);

  const items = step(scene, 'dressup').items;
  const base = playerLook(run.player);
  const look = applyOutfit(base, items, picks);
  const worn = { shoes: picks.shoes, jewellery: picks.jewellery, bag: picks.bag, perfume: picks.perfume };
  const score = dressScore(scene, picks);
  const phoneOut = run.log.some((e) => e.card === `scene:${scene.id}:the_ride.phone_out`);

  const ctx: DateCtx = {
    scene,
    run,
    feminine,
    look,
    worn,
    seat,
    phoneOut,
    escape,
    title: feminine ? 'Madam' : 'Oga',
    play: (ev) => {
      const out = play(scene.id, ev);
      if (!out) return undefined;
      const d = out.result.deltas;
      setDeltas(d);
      setDeltaKey(Date.now());
      if (d.wallet) {
        setAlert({ id: Date.now(), text: `${d.wallet > 0 ? 'Credit' : 'Debit'} ${naira(Math.abs(d.wallet))} · ${ev.label}`, credit: d.wallet > 0 });
        if (d.wallet < 0) sound.play('loss');
      }
      if ((d.sanity ?? 0) <= -12 && navigator.vibrate) navigator.vibrate([120, 60, 120]);
      if ((d.chemistry ?? 0) > 0) sound.play('chem');
      return out.result;
    },
    next: () => {
      sound.play('swoosh');
      setIdx((i) => i + 1);
    },
  };

  const body = (() => {
    if (!cur) return <Recap run={run} sceneId={scene.id} teaser={step(scene, 'outro').teaser} onHome={() => end(scene.id)} />;
    switch (cur.type) {
      case 'dressup':
        return <Dressup ctx={ctx} baseLook={base} onLook={setPicks} />;
      case 'ride':
        return <Ride ctx={ctx} />;
      case 'seat':
        return <Seat ctx={ctx} onSeat={setSeat} />;
      case 'arrival':
        return <Arrival ctx={ctx} score={score} />;
      case 'talk':
        return <Talk ctx={ctx} />;
      case 'toast':
        return <Toast ctx={ctx} />;
      case 'glance':
        return <Glance ctx={ctx} />;
      case 'inspect':
        return <Briefcase ctx={ctx} />;
      case 'photo':
        return <Photo ctx={ctx} />;
      case 'escape':
        return <Escape ctx={ctx} onOutcome={setEscape} />;
      case 'outro':
        return <Outro ctx={ctx} />;
    }
  })();

  useEffect(() => {
    if (!alert) return;
    const t = setTimeout(() => setAlert(null), 2600);
    return () => clearTimeout(t);
  }, [alert?.id]);

  return (
    <div className="relative h-full overflow-hidden bg-black" data-scene={scene.id} data-step={cur?.id ?? 'recap'}>
      <div key={idx} className="anim-fade absolute inset-0">
        {body}
      </div>
      {cur && <Hud meters={run.meters} day={run.day} deltas={deltas} deltaKey={deltaKey} phoneBadge={0} muted={muted} onMute={() => (sound.unlock(), sound.setMuted(!muted), setMuted(!muted))} />}
      {alert && (
        <div key={alert.id} className="anim-slide-down pointer-events-none absolute inset-x-3 top-[calc(max(10px,env(safe-area-inset-top))+96px)] z-40 flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0f1115]/95 px-3 py-2 shadow-xl">
          <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-black ${alert.credit ? 'bg-emerald-500 text-black' : 'bg-red-500 text-white'}`}>₦</span>
          <div className="text-[13px]">
            <div className="text-[10px] font-bold uppercase text-white/50">Bank alert</div>
            {alert.text}
          </div>
        </div>
      )}
    </div>
  );
}

function findEscapeId(run: RunState, sceneId: string): string {
  const h = run.history.find((x) => x.action === 'scene_event' && x.id === sceneId && x.event?.id.startsWith('wife_escape.'));
  return h?.event?.id ?? '';
}
