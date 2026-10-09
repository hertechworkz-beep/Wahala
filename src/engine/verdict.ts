// Verdict Card + Wahala Receipts. Everything here is derived from the run's
// logged events (rules 9, 15, 20): no invented money, warnings or causes.

import { bond, getCharacter, getTruth, goalProgress, goalWon, netWorth } from './engine';
import { hashPick } from './rng';
import { fill, naira } from './text';
import type { CityContent, EndingId, LoggedEvent, RunState } from './types';

export const ENDING_NAMES: Record<EndingId, string> = {
  locked_in: 'Locked In',
  counter_con: 'The Counter-Con',
  survived: 'Survived Phase 1',
  scandal: 'Public Scandal',
  sapa: 'Sapa Eviction',
  breakdown: 'Public Breakdown',
  ghosted: 'Ghosted',
  fumbled: 'Fumbled It',
  obsession: 'Obsession',
  walked_away: 'Walked Away',
};

export interface Verdict {
  runId: string;
  playerName: string;
  avatar: RunState['player']['avatar'];
  vibeLabel: string;
  characterId: string;
  partnerName: string;
  archetype: string;
  daysSurvived: number;
  ending: EndingId;
  endingName: string;
  endingText: string;
  goalLabel: string;
  goalWon: boolean;
  goalProgress: number;
  goalReality: string;
  wallet: number;
  sanity: number;
  clout: number;
  debt: number;
  redFlagsMissed: number;
  redFlagsShown: number;
  goodOne: boolean;
  hiddenTruth: string;
  title: string;
  lesson: string;
  roast: string;
  rarityPct?: number;
  receipts: string[];
  workNotes: string[];
  noRoast: boolean;
}

export function buildVerdict(content: CityContent, s: RunState): Verdict {
  if (!s.ending) throw new Error('Run has not ended');
  const ch = getCharacter(content, s.characterId);
  const truth = getTruth(content, s);
  const ending = s.ending;
  const goal = content.goals.find((g) => g.id === s.player.goal)!;
  const vibe = content.vibes.find((v) => v.id === s.player.vibe)!;
  const won = goalWon(s);
  const noRoast = ending === 'obsession';
  const ctx = { character: ch, player: s.player };

  const endingText = fill(ch.endings[ending]?.text ?? defaultEndingText(ending), ctx);
  const title = noRoast ? "This one isn't funny." : pickTitle(content, s);
  const lesson = noRoast ? 'Control isn\'t love. If someone tracks you, keys your door or checks your phone, tell someone you trust. You deserve to feel free.' : pickLesson(content, s);
  const roast = noRoast ? "Control isn't love. Leaving isn't failure." : pickRoast(content, s, won, goal.roast);
  const r = content.rarity[s.characterId]?.endings?.[ending];

  return {
    runId: runId(s),
    playerName: s.player.name,
    avatar: s.player.avatar,
    vibeLabel: vibe.label[s.player.gender],
    characterId: ch.id,
    partnerName: ch.name,
    archetype: ch.archetype,
    daysSurvived: s.endedDay ?? s.day,
    ending,
    endingName: ENDING_NAMES[ending],
    endingText,
    goalLabel: goal.label,
    goalWon: won,
    goalProgress: goalProgress(s),
    goalReality: goalReality(content, s, won),
    wallet: s.meters.wallet,
    sanity: s.meters.sanity,
    clout: s.meters.clout,
    debt: s.meters.debt,
    redFlagsMissed: s.redFlagsMissed,
    redFlagsShown: s.tellsShown.length,
    goodOne: s.goodOne,
    hiddenTruth: fill(truth.reveal, ctx),
    title,
    lesson,
    roast,
    rarityPct: r !== undefined ? Math.max(0.1, Math.round(r * 1000) / 10) : undefined,
    receipts: buildReceipts(content, s),
    workNotes: s.workMattered.map((w) => fill(w, ctx)),
    noRoast,
  };
}

export function runId(s: RunState): string {
  return `${s.characterId.slice(0, 3)}-${s.seed.toString(36)}`;
}

function defaultEndingText(e: EndingId): string {
  return {
    locked_in: 'Made official. For Phase 1, anyway.',
    counter_con: 'You walked off with the money before they could play you.',
    survived: "'You're exclusive. For now.'",
    scandal: 'Trending in the Parlour for all the wrong reasons.',
    sapa: 'Locked out. Account empty. Lagos is not smiling.',
    breakdown: 'Crying in a Lekki supermarket on a Sunday.',
    ghosted: 'Double blue ticks. Then one. Then nothing.',
    fumbled: 'They were faithful. You went looking anyway, and found yourself.',
    obsession: "This one isn't funny. Control isn't love.",
    walked_away: 'You left. That was the plot twist.',
  }[e];
}

function specificity(rule: { goals?: unknown[]; vibes?: unknown[]; good_one?: boolean }): number {
  return (rule.goals ? 2 : 0) + (rule.vibes ? 2 : 0) + (rule.good_one !== undefined ? 1 : 0);
}

/** Titles are picked by ending + goal + vibe, so the same ending titles differently per player. */
export function pickTitle(content: CityContent, s: RunState): string {
  const e = s.ending!;
  const pool = content.titles.filter(
    (t) =>
      (!t.endings || t.endings.includes(e)) &&
      (!t.goals || t.goals.includes(s.player.goal)) &&
      (!t.vibes || t.vibes.includes(s.player.vibe)) &&
      (t.good_one === undefined || t.good_one === s.goodOne),
  );
  if (!pool.length) return ENDING_NAMES[e];
  const best = Math.max(...pool.map(specificity));
  // Mix: the most specific titles, plus generic ones, so it isn't always the same line.
  const top = pool.filter((t) => specificity(t) === best || specificity(t) === 0);
  return hashPick(s.seed, `title:${e}:${s.log.length}`, top).title;
}

export function pickLesson(content: CityContent, s: RunState): string {
  const e = s.ending!;
  const byEnding = content.lessons.filter((l) => l.endings?.includes(e));
  const byTruth = content.lessons.filter((l) => l.truths?.includes(s.truthId) || (l.good_one && s.goodOne));
  const pool = e === 'fumbled' || e === 'walked_away' || e === 'counter_con' ? byEnding : byTruth.length ? byTruth : byEnding;
  if (!pool.length) return getTruth(content, s).lesson ?? 'Lagos teaches. You just paid tuition.';
  return hashPick(s.seed, `lesson:${e}`, pool).text;
}

function pickRoast(content: CityContent, s: RunState, won: boolean, goalRoast: string): string {
  const e = s.ending!;
  if (!won && e !== 'walked_away' && e !== 'counter_con') {
    // Missing the secret goal earns the goal's own roast half the time.
    if (hashPick(s.seed, 'roastkind', [0, 1]) === 0) return goalRoast + '.';
  }
  const pool = content.roasts.filter((r) => (!r.endings || r.endings.includes(e)) && (r.missed_min === undefined || s.redFlagsMissed >= r.missed_min));
  if (!pool.length) return goalRoast + '.';
  return hashPick(s.seed, `roast:${e}`, pool).text;
}

function goalReality(content: CityContent, s: RunState, won: boolean): string {
  const ch = getCharacter(content, s.characterId);
  const m = s.money;
  const net = netWorth(s);
  const sanityNote = s.meters.sanity <= 20 ? ' and a panic attack' : s.meters.sanity >= 70 ? ' and your peace intact' : '';
  switch (s.player.goal) {
    case 'bag': {
      const debt = s.meters.debt ? `, plus ${naira(s.meters.debt, { short: true })} of debt` : '';
      return `Spent ${naira(m.spent, { short: true })}, got ${naira(m.received, { short: true })} back, net ${naira(net, { short: true, sign: true })}${debt}${sanityNote}.`;
    }
    case 'love':
      return won ? `Bond ${bond(s)}/100 with ${ch.short}, Sanity ${s.meters.sanity}%. Real love, Lagos edition.` : `Bond ${bond(s)}/100, Sanity ${s.meters.sanity}%. You gave love; you got ${s.meters.attachment > 50 ? 'attachment, not love' : 'a voice note'}.`;
    case 'ring':
      return won ? `Locked In with ${ch.short}. The ring comes in a later Phase.` : `Ended on "${ENDING_NAMES[s.ending!]}". No ring. Not even a read receipt.`;
    case 'revenge':
      if (s.goodOne) return `There was no dirty secret to expose. ${s.toxicCount ? `You made ${s.toxicCount} toxic move${s.toxicCount > 1 ? 's' : ''} anyway.` : 'You kept your hands clean.'}`;
      return won ? `Exposed ${ch.short}'s hidden truth to the whole Parlour. Mission complete.` : `The truth stayed hidden. Your war ended as a draft in your notes app.`;
  }
}

// ---------------------------------------------------------------- receipts

export function eventLine(content: CityContent, s: RunState, e: LoggedEvent): string {
  const ch = getCharacter(content, s.characterId);
  let line = e.receipt ? fill(e.receipt, { character: ch, player: s.player }) : `You chose "${e.choiceLabel}".`;
  const w = e.deltas.wallet ?? 0;
  const threshold = Math.max(10_000, s.start.wallet * 0.05);
  if (!line.includes('₦')) {
    if (w <= -threshold) line += ` It cost you ${naira(-w)}.`;
    else if (w >= threshold) line += ` ${naira(w, { sign: true })} landed.`;
  }
  if (e.rolled && e.bad) line += ' The dice said no.';
  else if (e.cause === 'tricked') line += ' You got played.';
  if (e.missedTell) line += ' Red flag missed.';
  return `Day ${e.day}: ${line}`;
}

/** 4 to 5 of the most consequential logged moments, in the order they happened. */
export function buildReceipts(content: CityContent, s: RunState, max = 5): string[] {
  const candidates = s.log.filter((e) => e.slot !== 'system' || e.card === 'system:bailout');
  const top = [...candidates]
    .sort((a, b) => b.score - a.score || a.seq - b.seq)
    .slice(0, max)
    .sort((a, b) => a.seq - b.seq);
  return top.map((e) => eventLine(content, s, e));
}
