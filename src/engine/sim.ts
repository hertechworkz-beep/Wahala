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
  return {
    name: 'Sim',
    gender,
    datePref: 'both',
    vibe: vibe ?? pick(bot, content.vibes).id,
    goal: goal ?? pick(bot, content.goals).id,
    avatar: { set, build: pick(bot, content.avatar.build[set]), hair: pick(bot, content.avatar.hair[set]), style: pick(bot, content.avatar.style[set]) },
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
