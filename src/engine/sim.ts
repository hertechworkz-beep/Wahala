// Automated play (rule 7, 17, 23). Bots use their own RNG so the engine's
// run RNG only ever advances on real game actions.

import { choose, nextDay, resolveBailout, resolveCard, resolveSpot, spotAvailable, visitSpot } from './engine';
import { createRun } from './engine';
import { nextRand, pick } from './rng';
import type { ChoiceTag, CityContent, EndingId, GoalId, PlayerSetup, ResolvedChoice, RunState, VibeId } from './types';

export type PolicyName = 'random' | 'clingy' | 'toxic' | 'cautious' | 'greedy' | 'stayer';
export const POLICIES: PolicyName[] = ['random', 'clingy', 'toxic', 'cautious', 'greedy', 'stayer'];

const PREFS: Record<PolicyName, ChoiceTag[]> = {
  random: [],
  clingy: ['stay', 'excuse', 'discreet', 'luxury'],
  toxic: ['toxic', 'public_embarrassment', 'investigate', 'independence'],
  cautious: ['cautious', 'call_out', 'exit', 'investigate'],
  greedy: ['call_out', 'investigate', 'budget'],
  stayer: ['stay', 'excuse', 'discreet', 'contact_partner'],
};

export interface SimOpts {
  policy?: PolicyName;
  spotChance?: number;
  acceptBailout?: boolean;
  loanChance?: number;
  maxSteps?: number;
}

function pickChoice(bot: { rng: number }, choices: ResolvedChoice[], policy: PolicyName, loanChance: number, requiresIds: Set<string>): { id: string; loan?: boolean } {
  const avail = choices.filter((c) => c.available);
  if (!avail.length || (loanChance > 0 && nextRand(bot) < loanChance)) {
    const loanable = choices.filter((c) => !c.available && c.canLoan);
    if (loanable.length && (!avail.length || nextRand(bot) < 0.5)) return { id: pick(bot, loanable).id, loan: true };
  }
  if (!avail.length) return { id: choices[0].id, loan: true };
  const prefs = PREFS[policy];
  if (policy !== 'random' && nextRand(bot) < 0.75) {
    // Unlocked (conditional) choices first for 'greedy': they're payoffs of earlier choices.
    if (policy === 'greedy') {
      const unlocked = avail.filter((c) => requiresIds.has(c.id));
      if (unlocked.length) return { id: pick(bot, unlocked).id };
    }
    for (const t of prefs) {
      const m = avail.filter((c) => c.tags.includes(t));
      if (m.length) return { id: pick(bot, m).id };
    }
  }
  return { id: pick(bot, avail).id };
}

export function randomSetup(content: CityContent, bot: { rng: number }, vibe?: VibeId, goal?: GoalId): PlayerSetup {
  const gender = nextRand(bot) < 0.5 ? 'woman' : 'man';
  const set = gender;
  const facial = set === 'man' ? pick(bot, content.avatar.facial.man) : undefined;
  return {
    name: 'Sim',
    gender,
    datePref: 'both',
    vibe: vibe ?? pick(bot, content.vibes).id,
    goal: goal ?? pick(bot, content.goals).id,
    avatar: { set, skin: pick(bot, content.avatar.skins).hex, facial, build: pick(bot, content.avatar.build[set]), hair: pick(bot, content.avatar.hair[set]), style: pick(bot, content.avatar.style[set]) },
  };
}

export function playOut(content: CityContent, start: RunState, opts: SimOpts = {}): RunState {
  const policy = opts.policy ?? 'random';
  const bot = { rng: (start.seed ^ 0x5bd1e995) >>> 0 };
  let s = start;
  let steps = 0;
  const max = opts.maxSteps ?? 200;
  while (s.status !== 'ended' && steps++ < max) {
    if (s.status === 'bailout') {
      s = resolveBailout(content, s, !!opts.acceptBailout);
      continue;
    }
    if (spotAvailable(s) && nextRand(bot) < (opts.spotChance ?? 0.3)) {
      const spot = pick(bot, content.spots);
      const options = resolveSpot(content, s, spot.id).filter((o) => o.available);
      if (options.length) {
        s = visitSpot(content, s, spot.id, pick(bot, options).id).state;
        continue;
      }
    }
    if (s.status === 'day_end') {
      s = nextDay(content, s).state;
      continue;
    }
    const rc = resolveCard(content, s);
    if (!rc) throw new Error(`No card in status ${s.status} day ${s.day} step ${s.stepIndex}`);
    const requiresIds = new Set(rc.card.choices.filter((c) => c.requires).map((c) => c.id));
    const c = pickChoice(bot, rc.choices, policy, opts.loanChance ?? 0.05, requiresIds);
    s = choose(content, s, c.id, { loan: c.loan }).state;
  }
  if (s.status !== 'ended') throw new Error(`Run did not end after ${max} steps (seed ${s.seed})`);
  return s;
}

export interface SimStats {
  runs: number;
  reachedDay7: number;
  endings: Partial<Record<EndingId, number>>;
  truths: Record<string, number>;
  avgCards: number;
  cardsSeen: Record<string, number>;
  flagsSet: Record<string, number>;
  minWallet: number;
  loans: number;
}

export function simulate(content: CityContent, characterId: string, n: number, opts: { vibe?: VibeId; seedBase?: number; policies?: PolicyName[] } & SimOpts = {}): SimStats {
  const stats: SimStats = { runs: 0, reachedDay7: 0, endings: {}, truths: {}, avgCards: 0, cardsSeen: {}, flagsSet: {}, minWallet: Infinity, loans: 0 };
  const policies = opts.policies ?? ['random'];
  let totalCards = 0;
  for (let i = 0; i < n; i++) {
    const seed = ((opts.seedBase ?? 1) * 1_000_003 + i * 7919) >>> 0;
    const bot = { rng: seed ^ 0x2545f491 };
    const setup = randomSetup(content, bot, opts.vibe);
    const policy = policies[i % policies.length];
    const s = playOut(content, createRun(content, setup, characterId, seed), { ...opts, policy });
    stats.runs++;
    if ((s.endedDay ?? 0) >= 7) stats.reachedDay7++;
    stats.endings[s.ending!] = (stats.endings[s.ending!] ?? 0) + 1;
    stats.truths[s.truthId] = (stats.truths[s.truthId] ?? 0) + 1;
    totalCards += s.seenCards.length;
    for (const c of s.seenCards) stats.cardsSeen[c] = (stats.cardsSeen[c] ?? 0) + 1;
    for (const f of Object.keys(s.flags)) stats.flagsSet[f] = (stats.flagsSet[f] ?? 0) + 1;
    stats.minWallet = Math.min(stats.minWallet, ...s.log.map(() => s.meters.wallet));
    if (s.flags.loan_taken) stats.loans++;
  }
  stats.avgCards = Math.round((totalCards / Math.max(1, stats.runs)) * 10) / 10;
  return stats;
}

// ---------------------------------------------------------------- deliberate play

export type Action = { kind: 'choose'; id: string; loan?: boolean } | { kind: 'spot'; spot: string; option: string };

export function availableActions(content: CityContent, s: RunState, opts: { loans?: boolean; spots?: boolean } = {}): Action[] {
  const out: Action[] = [];
  const rc = resolveCard(content, s);
  if (rc) for (const c of rc.choices) if (c.available || (opts.loans && c.canLoan)) out.push({ kind: 'choose', id: c.id, loan: !c.available || undefined });
  if (opts.spots !== false && spotAvailable(s))
    for (const spot of content.spots) for (const o of resolveSpot(content, s, spot.id)) if (o.available) out.push({ kind: 'spot', spot: spot.id, option: o.id });
  return out;
}

export function applyAction(content: CityContent, s: RunState, a: Action): RunState {
  return a.kind === 'choose' ? choose(content, s, a.id, { loan: a.loan }).state : visitSpot(content, s, a.spot, a.option).state;
}

/**
 * A deliberate player: one-step lookahead that keeps the action scoring best. The engine is
 * deterministic, so it plays with perfect knowledge of the next roll; results are replayable.
 */
export function lookaheadRun(
  content: CityContent,
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
    const acts = availableActions(content, s, { loans: opts.loans, spots: opts.spots });
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
      const sc = score(applyAction(content, s, a));
      if (sc > bestScore) {
        bestScore = sc;
        best = a;
      }
    }
    if (s.status === 'day_end' && best.kind === 'spot') {
      const slept = nextDay(content, s).state;
      if (score(slept) >= bestScore) {
        s = slept;
        continue;
      }
    }
    s = applyAction(content, s, best);
    if (s.status === 'day_end' && !spotAvailable(s)) s = nextDay(content, s).state;
  }
  return s;
}

/** The "playing for love" objective used to check every vibe can reach Locked In. */
export function lockedInScore(s: RunState): number {
  if (s.status === 'ended') return s.ending === 'locked_in' ? 1e6 : -1e6;
  return s.meters.attachment + s.meters.trust * 1.5 - s.meters.exposure - s.meters.control * 5 - s.stays * 50;
}

export function lockedInReach(content: CityContent, characterId: string, vibe: VibeId, seeds = 40): number {
  let hits = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const bot = { rng: seed * 7717 };
    const setup = randomSetup(content, bot, vibe);
    const r = lookaheadRun(content, createRun(content, setup, characterId, seed), lockedInScore);
    if (r.ending === 'locked_in') hits++;
  }
  return hits;
}
