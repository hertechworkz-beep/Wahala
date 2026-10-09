// Content validation (rules 6, 13, 16, 17, 18, 22). Pure: runs at build time
// (scripts/validate-content.ts) and in tests. Simulation-based reachability
// lives in sim.ts and is combined by the script into the launch gate.

import { wordCount } from './text';
import type { CityContent, Condition, Effects, FlagSet, Outcome, Slot } from './types';

export interface Issue {
  level: 'error' | 'warn';
  where: string;
  msg: string;
}

export const MATRIX: Partial<Record<Slot, number>> = {
  first_date: 3,
  red_flag: 3,
  money_trap: 3,
  payoff: 2,
  talking_time: 3,
};
export const SHARED_MATRIX: Partial<Record<Slot, number>> = { temptation: 6, public_drama: 6, interrupt: 8 };

/** Flags the engine itself sets or reads. */
export const SYSTEM_FLAGS = new Set(['boundary_phone', 'boundary_set', 'loan_taken', 'truth_exposed', 'has_intel', 'named_tactic']);
const SYSTEM_PREFIXES = ['visited_'];

/** Real businesses may only appear by name in neutral or positive scenes (Real names policy). */
export const NAMED_BUSINESSES = ['Shoprite', 'Quilox', 'RSVP', 'Eko Hotel', 'Hard Rock', 'Chicken Republic', 'Mr Biggs', 'Sky Restaurant', 'Cubana', 'Club Quilox', 'Ebano'];

function flagName(f: string | FlagSet) {
  return typeof f === 'string' ? f : f.flag;
}

function condFlags(c: Condition | undefined, positiveOnly = false): string[] {
  if (!c) return [];
  const out = [...(c.flags ?? []), ...(c.any_flags ?? []), ...(c.partner_knows ?? []), ...(c.world_knows ?? []), ...(c.knows ?? []).map((k) => k.flag)];
  if (c.flag_age) out.push(c.flag_age.flag);
  if (!positiveOnly) out.push(...(c.not_flags ?? []));
  return out;
}

function allOutcomes(x: { outcomes: Outcome[]; truth_override?: Record<string, Outcome | Outcome[]> }): { key: string; list: Outcome[] }[] {
  const res = [{ key: 'base', list: x.outcomes }];
  for (const [k, v] of Object.entries(x.truth_override ?? {})) res.push({ key: k, list: Array.isArray(v) ? v : [{ ...v, chance: 1 }] });
  return res;
}

function effectsSets(e: Effects): string[] {
  return (e.set ?? []).map(flagName);
}

export interface ValidationReport {
  issues: Issue[];
  characters: Record<string, { pass: boolean; errors: string[]; counts: Partial<Record<Slot, number>> }>;
  shared: { pass: boolean; counts: Partial<Record<Slot, number>> };
}

export function validateCity(content: CityContent): ValidationReport {
  const issues: Issue[] = [];
  const err = (where: string, msg: string) => issues.push({ level: 'error', where, msg });
  const warn = (where: string, msg: string) => issues.push({ level: 'warn', where, msg });

  const charIds = new Set(content.characters.map((c) => c.id));
  const locIds = new Set(content.locations.map((l) => l.id));
  const vibeIds = new Set(content.vibes.map((v) => v.id));
  const cardIds = new Set<string>();

  // --- flag bookkeeping (rule 1, 6) -------------------------------------
  const setBy = new Map<string, Set<string>>(); // flag -> card ids that set it
  const refBy = new Map<string, Set<string>>(); // flag -> card ids that positively reference it
  const guardBy = new Map<string, Set<string>>(); // flag -> card ids that reference it in not_flags
  const note = (m: Map<string, Set<string>>, f: string, id: string) => {
    if (!m.has(f)) m.set(f, new Set());
    m.get(f)!.add(id);
  };

  const scan = (id: string, cond: Condition | undefined) => {
    for (const f of condFlags(cond, true)) note(refBy, f, id);
    for (const f of cond?.not_flags ?? []) note(guardBy, f, id);
  };

  for (const card of content.cards) {
    const w = `card ${card.id}`;
    if (cardIds.has(card.id)) err(w, 'duplicate card id');
    cardIds.add(card.id);
    if (card.character && !charIds.has(card.character)) err(w, `unknown character ${card.character}`);
    if (!locIds.has(card.scene.location)) err(w, `unknown location ${card.scene.location}`);
    if (!['positive', 'neutral', 'negative'].includes(card.scene.mood)) err(w, 'scene mood must be positive, neutral or negative');
    scan(card.id, card.requires);
    for (const f of card.payoff_of ?? []) note(refBy, f, card.id);
    for (const f of card.sets ?? []) note(setBy, flagName(f), card.id);
    if (card.detail) note(setBy, card.detail.flag, card.id);

    const ch = card.character ? content.characters.find((c) => c.id === card.character) : undefined;
    if (card.scene.expression && ch && !ch.expressions.includes(card.scene.expression)) err(w, `expression ${card.scene.expression} not in ${ch.id}'s expressions`);

    // Real names policy
    const allText = [...card.beats.map((b) => b.text), ...card.choices.flatMap((c) => [c.label, ...allOutcomes(c).flatMap((o) => o.list.map((x) => x.text))])].join(' ');
    if (card.scene.mood === 'negative') for (const b of NAMED_BUSINESSES) if (allText.includes(b)) err(w, `named business "${b}" in a negative scene`);

    // Word budgets (tone guide): setup under 45 words, choices under 12.
    const setup = card.beats.filter((b) => !b.text.includes('{tell}')).map((b) => b.text).join(' ');
    if (wordCount(setup) > 45) warn(w, `setup is ${wordCount(setup)} words (target under 45)`);

    // Choices
    const baseline = card.choices.filter((c) => !c.vibe && !c.requires);
    if (card.slot !== 'escalation' && baseline.length < 3) err(w, `needs 3 unconditional choices, has ${baseline.length}`);
    // Rule 22: every state must offer at least one affordable choice.
    if (!baseline.some((c) => !c.cost)) err(w, 'no free unconditional choice (dead end at zero Wallet)');
    // Rule 16: a budget tier beside every luxury option.
    if (card.choices.some((c) => c.tags?.includes('luxury')) && !baseline.some((c) => c.tags?.includes('budget'))) err(w, 'luxury option without an unconditional budget option');
    if (card.slot === 'escalation') {
      const exits = baseline.filter((c) => c.tags?.includes('exit'));
      if (exits.length < 2) err(w, 'escalation needs at least 2 unconditional exits (rule 21)');
      if (!baseline.some((c) => c.outcomes.some((o) => o.end === 'walked_away'))) err(w, 'escalation needs a real "leave" exit');
    }
    const choiceIds = new Set<string>();
    for (const c of card.choices) {
      const cw = `${w} choice ${c.id}`;
      if (choiceIds.has(c.id)) err(cw, 'duplicate choice id');
      choiceIds.add(c.id);
      if (c.vibe && !vibeIds.has(c.vibe)) err(cw, `unknown vibe ${c.vibe}`);
      const label = c.label.replace(/^\[[^\]]+\]\s*/, '');
      if (wordCount(label) > 12) warn(cw, `label is ${wordCount(label)} words (target under 12)`);
      scan(card.id, c.requires);
      for (const { key, list } of allOutcomes(c)) {
        const sum = list.reduce((a, o) => a + o.chance, 0);
        if (Math.abs(sum - 1) > 0.001) err(cw, `outcomes (${key}) sum to ${sum}, not 1`);
        if (key !== 'base' && key !== 'good_one' && key !== 'flawed' && ch && !ch.truths.some((t) => t.id === key)) err(cw, `truth_override for unknown truth ${key}`);
        for (const o of list) {
          for (const f of effectsSets(o)) note(setBy, f, card.id);
          if (o.end && !['walked_away', 'ghosted', 'sapa', 'breakdown', 'scandal', 'fumbled'].includes(o.end)) warn(cw, `outcome ends the run with ${o.end}`);
        }
      }
      // Rule 13/18: a partner may only react to what they know.
      for (const f of c.partner_reacts_to ?? []) {
        const ok = (c.requires?.partner_knows ?? []).includes(f) || (card.requires?.partner_knows ?? []).includes(f) || (card.discovers ?? []).some((d) => d.flag === f && d.to.includes('partner'));
        if (!ok) err(cw, `partner reacts to ${f} without partner_knows or a discovery`);
      }
    }
    for (const f of card.partner_reacts_to ?? []) {
      const ok = (card.requires?.partner_knows ?? []).includes(f) || (card.discovers ?? []).some((d) => d.flag === f && d.to.includes('partner'));
      if (!ok) err(w, `partner reacts to ${f} without partner_knows or a discovery`);
    }
    // Heuristic for rule 13: a payoff about the player's secret where the partner speaks must declare how they know.
    const secretPayoffs = (card.payoff_of ?? []).filter((f) => f.startsWith('secret_'));
    if (secretPayoffs.length && card.beats.some((b) => b.who === 'partner')) {
      for (const f of secretPayoffs) if (!(card.partner_reacts_to ?? []).includes(f)) err(w, `partner speaks in a payoff of ${f} but the card doesn't declare partner_reacts_to`);
    }

    // Tells: character cards carry a tell for each truth they can appear under.
    if (ch && !['talking_time', 'escalation', 'payoff'].includes(card.slot)) {
      const truths = card.requires?.truth ?? ch.truths.map((t) => t.id);
      for (const t of truths) if (!card.tells?.[t]) err(w, `no tell for truth ${t}`);
    }
    for (const [t, ref] of Object.entries(card.tells ?? {})) {
      const truth = ch?.truths.find((x) => x.id === t);
      const id = typeof ref === 'string' ? ref : ref.id;
      if (!truth) err(w, `tell for unknown truth ${t}`);
      else if (!truth.tells.some((x) => x.id === id)) err(w, `tell ${id} is not one of ${t}'s tells`);
    }
  }

  // Spots
  for (const spot of content.spots) {
    if (spot.location && !locIds.has(spot.location)) err(`spot ${spot.id}`, `unknown location ${spot.location}`);
    for (const o of spot.options) {
      scan(`spot:${spot.id}`, o.requires);
      for (const { key, list } of allOutcomes(o)) {
        const sum = list.reduce((a, x) => a + x.chance, 0);
        if (Math.abs(sum - 1) > 0.001) err(`spot ${spot.id}/${o.id}`, `outcomes (${key}) sum to ${sum}`);
        for (const x of list) for (const f of effectsSets(x)) note(setBy, f, `spot:${spot.id}`);
      }
    }
  }
  if (!content.spots.some((s) => s.options.some((o) => !o.cost && !o.requires))) err('spots', 'no free spot option');

  // Character rules + behaviour
  for (const ch of content.characters) {
    if (ch.rules.length < 3) err(`character ${ch.id}`, 'needs at least 3 behaviour rules (rule 3)');
    for (const t of ch.truths) if (t.tells.length < 3) err(`character ${ch.id}`, `truth ${t.id} needs 3 tells`);
    const good = ch.truths.filter((t) => t.kind === 'good_one').length;
    const flawed = ch.truths.filter((t) => t.kind === 'flawed').length;
    if (good !== 1 || flawed !== 2) err(`character ${ch.id}`, 'needs exactly 2 flawed truths and 1 Good One');
    for (const r of ch.rules) for (const f of effectsSets(r.effect)) note(setBy, f, `rule:${ch.id}`);
  }

  // Flag payoffs: every flag set must be paid off somewhere (rule 1, 6).
  for (const [f, setters] of setBy) {
    if (SYSTEM_FLAGS.has(f) || SYSTEM_PREFIXES.some((p) => f.startsWith(p))) continue;
    const refs = refBy.get(f);
    if (refs && refs.size) continue;
    // Self-guards: a flag set and checked in not_flags by the same card is bookkeeping, not story.
    const guards = guardBy.get(f);
    if (guards && [...setters].every((s) => guards.has(s))) continue;
    err(`flag ${f}`, `set by ${[...setters].join(', ')} but never paid off`);
  }

  // Avatar coverage: every option is a favourite of at least one character.
  const favs = new Set<string>();
  for (const ch of content.characters) {
    for (const set of ['woman', 'man'] as const) Object.values(ch.taste.fixed[set] ?? {}).forEach((v) => v && favs.add(v));
    ch.taste.pool.forEach((p) => favs.add(p));
  }
  for (const set of ['woman', 'man'] as const)
    for (const kind of ['build', 'hair', 'style'] as const)
      for (const opt of content.avatar[kind][set]) if (!favs.has(opt)) err('avatar', `"${opt}" is nobody's favourite`);

  // Content matrix per character (rule 6) and the launch gate (rule 17).
  const characters: ValidationReport['characters'] = {};
  for (const ch of content.characters) {
    const deck = content.cards.filter((c) => c.character === ch.id);
    const counts: Partial<Record<Slot, number>> = {};
    for (const c of deck) counts[c.slot] = (counts[c.slot] ?? 0) + 1;
    const errors: string[] = [];
    for (const [slot, min] of Object.entries(MATRIX)) if ((counts[slot as Slot] ?? 0) < min!) errors.push(`${slot}: ${counts[slot as Slot] ?? 0}/${min}`);
    for (const t of ch.truths) if (!deck.some((c) => c.slot === 'confrontation' && c.requires?.truth?.includes(t.id))) errors.push(`no confrontation for truth ${t.id}`);
    if (ch.temperament.controlling && !deck.some((c) => c.slot === 'escalation')) errors.push('controlling temperament but no escalation cards');
    const payoffFlags = new Set(deck.flatMap((c) => c.payoff_of ?? []));
    if (payoffFlags.size < 2) errors.push('needs at least 2 payoff cards tied to earlier choices');
    const own = issues.filter((i) => i.level === 'error' && deck.some((c) => i.where.startsWith(`card ${c.id}`)));
    errors.push(...own.map((i) => `${i.where}: ${i.msg}`));
    characters[ch.id] = { pass: errors.length === 0, errors, counts };
  }
  const sharedDeck = content.cards.filter((c) => !c.character);
  const sharedCounts: Partial<Record<Slot, number>> = {};
  for (const c of sharedDeck) sharedCounts[c.slot] = (sharedCounts[c.slot] ?? 0) + 1;
  let sharedPass = true;
  for (const [slot, min] of Object.entries(SHARED_MATRIX)) {
    if ((sharedCounts[slot as Slot] ?? 0) < min!) {
      sharedPass = false;
      err('shared deck', `${slot}: ${sharedCounts[slot as Slot] ?? 0}/${min}`);
    }
  }
  return { issues, characters, shared: { pass: sharedPass, counts: sharedCounts } };
}
