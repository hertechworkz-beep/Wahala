import { loadCity } from '../src/content/node';
import { choose, createRun, nextDay, resolveBailout, resolveCard, resolveSpot, spotAvailable, visitSpot, type CreateOpts } from '../src/engine/engine';
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

export type Action = { kind: 'choose'; id: string; loan?: boolean } | { kind: 'spot'; spot: string; option: string };

/** All actions available right now (card choices plus today's spot options). */
export function actions(s: RunState, opts: { loans?: boolean; spots?: boolean } = {}): Action[] {
  const out: Action[] = [];
  const rc = resolveCard(content, s);
  if (rc) for (const c of rc.choices) if (c.available || (opts.loans && c.canLoan)) out.push({ kind: 'choose', id: c.id, loan: !c.available || undefined });
  if (opts.spots !== false && spotAvailable(s))
    for (const spot of content.spots) for (const o of resolveSpot(content, s, spot.id)) if (o.available) out.push({ kind: 'spot', spot: spot.id, option: o.id });
  return out;
}

export function apply(s: RunState, a: Action): RunState {
  return a.kind === 'choose' ? choose(content, s, a.id, { loan: a.loan }).state : visitSpot(content, s, a.spot, a.option).state;
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
