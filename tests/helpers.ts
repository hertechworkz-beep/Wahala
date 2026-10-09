import { loadCity } from '../src/content/node';
import { createRun, nextDay, resolveBailout, spotAvailable, type CreateOpts } from '../src/engine/engine';
import { applyAction, availableActions, type Action } from '../src/engine/sim';
import type { CityContent, PlayerSetup, RunState, VibeId, GoalId } from '../src/engine/types';

export const content: CityContent = loadCity();

export function setup(over: Partial<PlayerSetup> = {}): PlayerSetup {
  return {
    name: 'Ada',
    gender: 'woman',
    datePref: 'men',
    vibe: 'corporate',
    goal: 'love',
    avatar: { set: 'woman', build: 'Curvy / Thick', hair: 'Knotless Braids', style: 'Smart Casual' },
    ...over,
  };
}

export type { Action };

/** All actions available right now (scene options, card choices, today's spot options). */
export function actions(s: RunState, opts: { loans?: boolean; spots?: boolean } = {}): Action[] {
  return availableActions(content, s, opts);
}

export function apply(s: RunState, a: Action): RunState {
  return applyAction(content, s, a);
}

/**
 * A scripted player with one-step lookahead: it tries every available action on a copy of
 * the state and keeps the best by `score`. The engine is deterministic, so this is a real,
 * replayable playthrough; it just plays with perfect information about the next roll.
 */
export function lookaheadRun(
  start: RunState,
  score: (s: RunState) => number,
  opts: { acceptBailout?: boolean; loans?: boolean; spots?: boolean; prefer?: (a: Action, s: RunState) => boolean } = {},
): RunState {
  let s = start;
  for (let i = 0; i < 300 && s.status !== 'ended'; i++) {
    if (s.status === 'bailout') {
      s = resolveBailout(content, s, !!opts.acceptBailout);
      continue;
    }
    const acts = actions(s, { loans: opts.loans, spots: opts.spots });
    const forced = opts.prefer ? acts.filter((a) => opts.prefer!(a, s)) : [];
    const pool = forced.length ? forced : acts;
    if (!pool.length) {
      if (s.status === 'day_end') {
        s = nextDay(content, s).state;
        continue;
      }
      throw new Error('stuck');
    }
    let best = pool[0];
    let bestScore = -Infinity;
    for (const a of pool) {
      const next = apply(s, a);
      const sc = score(next);
      if (sc > bestScore) {
        bestScore = sc;
        best = a;
      }
    }
    // Only take a spot visit if it beats ending the day / taking the card without it.
    if (s.status === 'day_end' && best.kind === 'spot') {
      const skip = score(nextDay(content, s).state);
      if (skip >= bestScore) {
        s = nextDay(content, s).state;
        continue;
      }
    }
    s = apply(s, best);
    if (s.status === 'day_end' && !spotAvailable(s)) s = nextDay(content, s).state;
  }
  return s;
}

export function newRun(seed: number, over: Partial<PlayerSetup> = {}, force: CreateOpts['force'] = {}): RunState {
  return createRun(content, setup(over), 'chief_emeka', seed, { force });
}

export const VIBES: VibeId[] = ['lover', 'sugar', 'bigboy', 'runs', 'corporate'];
export const GOALS: GoalId[] = ['bag', 'love', 'ring', 'revenge'];
