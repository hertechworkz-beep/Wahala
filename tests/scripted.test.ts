// Seeded scripted runs that deliberately reach every ending, every hidden truth, the Good One
// path, every flag payoff and money edge cases (rule 23). Each target is reached by a scripted
// player on a fixed seed, then replayed from history to prove it reproduces exactly.
import { describe, expect, it } from 'vitest';
import { bond, netWorth, replay } from '../src/engine/engine';
import { playOut, POLICIES } from '../src/engine/sim';
import type { EndingId, PlayerSetup, RunState } from '../src/engine/types';
import { content, lookaheadRun, newRun, setup, type Action } from './helpers';

interface Target {
  ending: EndingId;
  player?: Partial<PlayerSetup>;
  truth?: string;
  score: (s: RunState) => number;
  acceptBailout?: boolean;
  prefer?: (a: Action, s: RunState) => boolean;
}

const alive = (s: RunState) => (s.status === 'ended' ? -1e6 : 0);

const TARGETS: Target[] = [
  { ending: 'locked_in', player: { vibe: 'corporate' }, truth: 'divorced', score: (s) => alive(s) + s.meters.attachment + s.meters.trust - s.meters.exposure - s.meters.control * 5 - s.stays * 50 },
  { ending: 'counter_con', player: { vibe: 'runs', goal: 'bag' }, truth: 'serial_sponsor', score: (s) => alive(s) + netWorth(s) / 1000 + (s.sawTruth ? 2000 : 0) - s.meters.exposure * 5 - s.stays * 500 },
  { ending: 'survived', player: { vibe: 'lover' }, truth: 'broke', score: (s) => alive(s) + Math.min(s.meters.attachment, 60) + Math.min(s.meters.trust, 50) + s.meters.sanity - s.meters.exposure },
  { ending: 'scandal', player: { vibe: 'bigboy', goal: 'revenge' }, truth: 'serial_sponsor', score: (s) => s.meters.exposure * 10 + (s.ending === 'scandal' ? 1e6 : 0) },
  { ending: 'sapa', player: { vibe: 'sugar', goal: 'bag' }, truth: 'broke', score: (s) => -s.meters.wallet + (s.ending === 'sapa' ? 1e9 : 0) },
  { ending: 'breakdown', player: { vibe: 'bigboy' }, truth: 'serial_sponsor', score: (s) => -s.meters.sanity * 10 + (s.ending === 'breakdown' ? 1e6 : 0) },
  { ending: 'ghosted', player: { vibe: 'runs' }, truth: 'broke', score: (s) => -(s.meters.attachment + s.meters.trust) + (s.ending === 'ghosted' ? 1e6 : 0) - s.meters.exposure * 2 },
  { ending: 'fumbled', player: { vibe: 'sugar', goal: 'revenge' }, truth: 'divorced', score: (s) => -s.meters.trust - s.meters.attachment + (s.ending === 'fumbled' ? 1e6 : 0) - s.meters.exposure * 2 },
  { ending: 'obsession', player: { vibe: 'lover', goal: 'ring' }, truth: 'serial_sponsor', score: (s) => alive(s) + s.meters.attachment * 3 + s.stays * 200 + s.meters.sanity - s.meters.exposure * 3, prefer: (a, s) => a.kind === 'choose' && s.todaySteps[s.stepIndex]?.slot === 'escalation' && /share|tea|hand_over/.test(a.id) },
  { ending: 'walked_away', player: { vibe: 'corporate' }, truth: 'broke', score: (s) => alive(s) * 0 + s.meters.attachment * 2 - s.meters.exposure + (s.ending === 'walked_away' ? 1e6 : 0) - (s.status === 'ended' && s.ending !== 'walked_away' ? 1e6 : 0) },
];

function findRun(t: Target): { seed: number; run: RunState } | undefined {
  for (let seed = 1; seed <= 60; seed++) {
    const start = newRun(seed, t.player, { truth: t.truth });
    const run = lookaheadRun(start, t.score, { acceptBailout: t.acceptBailout, prefer: t.prefer });
    if (run.ending === t.ending) return { seed, run };
  }
  return undefined;
}

describe('scripted: every ending is reachable on a fixed seed and replays exactly', () => {
  for (const t of TARGETS) {
    it(`reaches ${t.ending}${t.truth ? ` (${t.truth})` : ''}`, () => {
      const found = findRun(t);
      expect(found, `no seed in 1..60 reached ${t.ending}`).toBeTruthy();
      const { seed, run } = found!;
      const again = replay(content, setup(t.player), 'chief_emeka', seed, run.history, { force: { truth: t.truth } });
      expect(again).toEqual(run);
      if (t.ending === 'fumbled') expect(run.goodOne).toBe(true);
      if (t.ending === 'ghosted' || t.ending === 'obsession') expect(run.goodOne).toBe(false);
      if (t.ending === 'obsession') expect(run.stays).toBeGreaterThanOrEqual(2);
      if (t.ending === 'counter_con') {
        expect(run.sawTruth).toBe(true);
        expect(netWorth(run)).toBeGreaterThanOrEqual(750_000);
      }
      if (t.ending === 'locked_in') expect(bond(run)).toBeGreaterThanOrEqual(65);
    });
  }
});

describe('scripted: every hidden truth plays out', () => {
  for (const truth of ['serial_sponsor', 'broke', 'divorced']) {
    it(`${truth}: tells shown are this truth's, confrontation is this truth's`, () => {
      const tells = new Set(content.characters[0].truths.find((t) => t.id === truth)!.tells.map((t) => t.id));
      let reachedConfrontation = false;
      for (let seed = 1; seed <= 20; seed++) {
        const s = playOut(content, newRun(seed, {}, { truth }), { policy: 'cautious', spotChance: 0 });
        for (const t of s.tellsShown) expect(tells.has(t)).toBe(true);
        if (s.log.some((e) => e.slot === 'confrontation')) reachedConfrontation = true;
      }
      expect(reachedConfrontation).toBe(true);
    });
  }
});

describe('scripted: flag payoffs (rule 1)', () => {
  it('Rolex video on Day 1 -> recognised later -> a woman messages you', () => {
    let ok = false;
    for (let seed = 1; seed <= 200 && !ok; seed++) {
      const start = newRun(seed);
      if (start.todaySteps[0].cardId !== 'emeka_d1_ikoyi_dinner') continue;
      const run = lookaheadRun(start, (s) => (s.status === 'ended' ? -1e6 : 0) + (s.flags.secret_rolex_video ? 100 : 0) + (s.flags.watch_recognised ? 100 : 0) + (s.flags.woman_met ? 100 : 0) + s.meters.sanity, {
        spots: false,
        prefer: (a) => a.kind === 'choose' && ['rolex_video', 'flex', 'meet'].includes(a.id),
      });
      const iRec = run.log.findIndex((e) => e.card === 'emeka_po_watch_recognised');
      const iMsg = run.log.findIndex((e) => e.card === 'emeka_po_woman_messages');
      if (iRec >= 0 && iMsg > iRec) {
        expect(run.log[iMsg].day).toBeGreaterThan(run.log[iRec].day);
        ok = true;
      }
    }
    expect(ok).toBe(true);
  });

  it('every flag-driven payoff card in the game is drawn in some run', () => {
    const payoffs = content.cards.filter((c) => c.slot === 'payoff' && (!c.character || c.character === 'chief_emeka'));
    const seen = new Set<string>();
    for (let seed = 1; seed <= 2500 && payoffs.some((c) => !seen.has(c.id)); seed++) {
      const s = playOut(content, newRun(seed, { vibe: (['lover', 'sugar', 'bigboy', 'runs', 'corporate'] as const)[seed % 5] }), { policy: POLICIES[seed % POLICIES.length], spotChance: 0.45, loanChance: 0.15 });
      s.seenCards.forEach((c) => seen.add(c));
    }
    const missing = payoffs.filter((c) => !seen.has(c.id)).map((c) => c.id);
    expect(missing).toEqual([]);
  });

  it('caught Talking Time details unlock secret options later', () => {
    let unlocked = false;
    for (let seed = 1; seed <= 300 && !unlocked; seed++) {
      const run = lookaheadRun(newRun(seed), (s) => (s.status === 'ended' ? -1e6 : 0) + Object.keys(s.flags).filter((f) => f.startsWith('knows_') || f === 'trusts_musa').length * 50 + s.meters.sanity, {
        spots: false,
        prefer: (a, s) => a.kind === 'choose' && (['noted', 'suya', 'okafor', 'ask_musa', 'call_6pm', 'respect_friday', 'mama'].includes(a.id)) && !!s,
      });
      unlocked = run.log.some((e) => ['suya', 'okafor', 'ask_musa', 'call_6pm', 'respect_friday', 'mama'].includes(e.choice));
    }
    expect(unlocked).toBe(true);
  });

  it('the Club starts a 2-day storyline', () => {
    let ok = false;
    for (let seed = 1; seed <= 400 && !ok; seed++) {
      const s = playOut(content, newRun(seed, { vibe: 'bigboy' }), { policy: 'toxic', spotChance: 0.9 });
      const follow = s.log.find((e) => e.card === 'shared_po_club_follow');
      const end = s.log.find((e) => e.card === 'shared_po_club_end');
      if (follow && end) {
        expect(end.day).toBeGreaterThan(follow.day);
        expect(follow.day).toBeGreaterThan(s.flags.club_night.day);
        ok = true;
      }
    }
    expect(ok).toBe(true);
  });
});

describe('scripted: money edge cases', () => {
  it('Wallet never goes below zero; Debt is separate', () => {
    for (let seed = 1; seed <= 500; seed++) {
      const s = playOut(content, newRun(seed, { vibe: 'sugar' }), { policy: 'clingy', loanChance: 0.3, spotChance: 0.6, acceptBailout: true });
      expect(s.meters.wallet).toBeGreaterThanOrEqual(0);
      expect(s.meters.debt).toBeGreaterThanOrEqual(0);
      if (s.meters.debt > 0) expect(s.flags.loan_taken || s.log.some((e) => (e.deltas.debt ?? 0) > 0)).toBeTruthy();
    }
  });
  it('a sugar-vibe run can be bailed out exactly once and continue to Day 7', () => {
    let ok = false;
    for (let seed = 1; seed <= 1500 && !ok; seed++) {
      const s = playOut(content, newRun(seed, { vibe: 'sugar' }), { policy: 'clingy', acceptBailout: true, spotChance: 0.6 });
      if (s.bailoutUsed && s.endedDay === 7) ok = true;
      expect(s.history.filter((h) => h.action === 'bailout').length).toBeLessThanOrEqual(1);
    }
    expect(ok).toBe(true);
  });
});
