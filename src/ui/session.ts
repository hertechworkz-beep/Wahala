import { useCallback, useState } from 'react';
import { lagos } from '../content/browser';
import { choose, createRun, nextDay, replay, resolveBailout, useClue, visitSpot } from '../engine/engine';
import { newSeed } from '../engine/rng';
import type { ChoiceResult, Meters, PhoneEvent, PlayerSetup, RunState } from '../engine/types';
import { backend, storage } from '../backend';

// A saved run is just its seed and choices: the engine replays it exactly (rule 23).
interface Saved {
  player: PlayerSetup;
  characterId: string;
  seed: number;
  history: RunState['history'];
}

const KEY = 'wahala.run.v1';

export function loadSaved(): RunState | null {
  const s = storage.get<Saved | null>(KEY, null);
  if (!s) return null;
  try {
    return replay(lagos, s.player, s.characterId, s.seed, s.history);
  } catch {
    storage.set(KEY, null);
    return null;
  }
}

function save(s: RunState | null) {
  storage.set(KEY, s ? ({ player: s.player, characterId: s.characterId, seed: s.seed, history: s.history } satisfies Saved) : null);
}

export interface LastEvent {
  id: number;
  kind: 'choice' | 'spot' | 'morning' | 'bailout';
  result?: ChoiceResult;
  choiceLabel?: string;
  phone: PhoneEvent[];
  deltas: Partial<Meters>;
}

export function useRun() {
  const [run, setRun] = useState<RunState | null>(() => loadSaved());
  const [last, setLast] = useState<LastEvent | null>(null);

  const commit = useCallback((s: RunState | null) => {
    setRun(s);
    save(s);
  }, []);

  const start = useCallback(
    (player: PlayerSetup, characterId: string) => {
      const s = createRun(lagos, player, characterId, newSeed());
      backend.track('character_picked', { character: characterId, vibe: player.vibe, goal: player.goal });
      commit(s);
      setLast(null);
      return s;
    },
    [commit],
  );

  const pick = useCallback(
    (choiceId: string, label: string, loan?: boolean) => {
      if (!run) return;
      const { state, result } = choose(lagos, run, choiceId, { loan });
      if (state.day !== run.day) backend.track('day_reached', { day: state.day });
      if (state.status === 'bailout') backend.track('bailout_shown', { ending: state.pendingEnding });
      if (state.status === 'ended') backend.track('run_ended', { ending: state.ending, day: state.endedDay, character: state.characterId });
      commit(state);
      setLast({ id: Date.now(), kind: 'choice', result, choiceLabel: label, phone: result.phone, deltas: result.deltas });
      return result;
    },
    [run, commit],
  );

  const spot = useCallback(
    (spotId: string, optionId: string, label: string, loan?: boolean) => {
      if (!run) return;
      const { state, result } = visitSpot(lagos, run, spotId, optionId, { loan });
      commit(state);
      setLast({ id: Date.now(), kind: 'spot', result, choiceLabel: label, phone: result.phone, deltas: result.deltas });
      return result;
    },
    [run, commit],
  );

  const sleep = useCallback(() => {
    if (!run) return;
    const r = nextDay(lagos, run);
    backend.track('day_reached', { day: r.state.day });
    commit(r.state);
    setLast({ id: Date.now(), kind: 'morning', phone: r.events, deltas: r.deltas });
  }, [run, commit]);

  const bailout = useCallback(
    (granted: boolean) => {
      if (!run) return;
      const s = resolveBailout(lagos, run, granted);
      if (s.status === 'ended') backend.track('run_ended', { ending: s.ending, day: s.endedDay, character: s.characterId });
      commit(s);
      setLast({ id: Date.now(), kind: 'bailout', phone: [], deltas: {} });
    },
    [run, commit],
  );

  const clue = useCallback(() => {
    if (!run) return null;
    const r = useClue(lagos, run);
    commit(r.state);
    return r.hint;
  }, [run, commit]);

  const reset = useCallback(() => {
    commit(null);
    setLast(null);
  }, [commit]);

  return { run, last, start, pick, spot, sleep, bailout, clue, reset };
}
