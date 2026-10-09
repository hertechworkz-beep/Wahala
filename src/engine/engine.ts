// The Wahala run engine. Pure and deterministic: every function takes a state,
// clones it, and returns a new one. All randomness flows through state.rng.

import { nextRand, pick, pickWeighted, randInt, shuffle } from './rng';
import { fill } from './text';
import type {
  Beat,
  Card,
  Character,
  ChoiceResult,
  ChoiceTag,
  CityContent,
  Condition,
  Effects,
  EndingId,
  FlagSet,
  Knower,
  LoggedEvent,
  Meters,
  Outcome,
  PhoneEvent,
  PlayerSetup,
  ResolvedCard,
  ResolvedChoice,
  RunState,
  Slot,
  SpotOption,
  Step,
  Tell,
  Truth,
  Choice,
  SceneEvent,
} from './types';

export const GOOD_ONE_CHANCE = 0.25;
export const SPARK_CHANCE = 1 / 6;
export const SCANDAL_EXPOSURE = 80;
export const LOAN_RATE = 1.5; // debt owed per naira borrowed
export const COUNTER_CON_NET = 750_000;
export const BAG_NET = 500_000;
export const MAX_INTERRUPTS = 2;
export const OBSESSION_ATTACHMENT = 95;
export const OBSESSION_STAYS = 2;
export const ESCALATION_ATTACHMENT = 80;

const PCT_METERS: (keyof Meters)[] = ['sanity', 'clout', 'attachment', 'trust', 'chemistry', 'exposure'];

// Which deck each slot draws from.
const SLOT_DECKS: Record<Slot, ('character' | 'shared')[]> = {
  first_date: ['character'],
  red_flag: ['character'],
  temptation: ['shared', 'character'],
  public_drama: ['character', 'shared'],
  money_trap: ['character'],
  confrontation: ['character'],
  payoff: ['character', 'shared'],
  talking_time: ['character'],
  interrupt: ['shared', 'character'],
  escalation: ['character', 'shared'],
  finale: [],
};

export function getCharacter(content: CityContent, id: string): Character {
  const c = content.characters.find((x) => x.id === id);
  if (!c) throw new Error(`Unknown character ${id}`);
  return c;
}

export function getTruth(content: CityContent, s: RunState): Truth {
  const t = getCharacter(content, s.characterId).truths.find((x) => x.id === s.truthId);
  if (!t) throw new Error(`Unknown truth ${s.truthId}`);
  return t;
}

export function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

// ---------------------------------------------------------------- run setup

export interface CreateOpts {
  /** Force rolls for scripted tests and support replays. */
  force?: { truth?: string; spark?: boolean; bestie?: 'genius' | 'toxic'; slotOrder?: Slot[]; interruptDays?: number[] };
}

export function createRun(content: CityContent, player: PlayerSetup, characterId: string, seed: number, opts: CreateOpts = {}): RunState {
  const character = getCharacter(content, characterId);
  const vibe = content.vibes.find((v) => v.id === player.vibe);
  if (!vibe) throw new Error(`Unknown vibe ${player.vibe}`);
  const r = { rng: seed >>> 0 };

  // Rule 4: truth roll. 25% Good One (the fake-out), 75% split evenly across the flawed truths.
  const goodTruths = character.truths.filter((t) => t.kind === 'good_one');
  const flawed = character.truths.filter((t) => t.kind === 'flawed');
  const roll = nextRand(r);
  let truth = roll < GOOD_ONE_CHANCE && goodTruths.length ? pick(r, goodTruths) : pick(r, flawed);
  if (opts.force?.truth) truth = character.truths.find((t) => t.id === opts.force!.truth) ?? truth;

  // Wildcard Spark is a separate roll.
  let spark = nextRand(r) < SPARK_CHANCE;
  if (opts.force?.spark !== undefined) spark = opts.force.spark;
  let bestie: 'genius' | 'toxic' = nextRand(r) < 0.5 ? 'genius' : 'toxic';
  if (opts.force?.bestie) bestie = opts.force.bestie;
  const tasteFav = pick(r, character.taste.pool);

  const middle = shuffle(r, ['red_flag', 'temptation', 'public_drama', 'money_trap'] as Slot[]);
  const slotOrder: Slot[] = opts.force?.slotOrder ?? ['first_date', ...middle, 'confrontation', 'finale'];
  const nInterrupts = 1 + (nextRand(r) < 0.5 ? 1 : 0);
  const interruptDays = opts.force?.interruptDays ?? shuffle(r, [2, 3, 4, 5, 6]).slice(0, nInterrupts).sort();

  const start = character.vibe_start[player.vibe];
  const meters: Meters = {
    wallet: vibe.wallet,
    debt: 0,
    sanity: vibe.sanity,
    clout: vibe.clout,
    attachment: start.attachment,
    trust: start.trust,
    chemistry: 30,
    exposure: 0,
    control: 0,
    glow: 1,
  };

  const state: RunState = {
    version: 1,
    status: 'card',
    seed: seed >>> 0,
    rng: r.rng,
    city: content.id,
    player: clone(player),
    characterId,
    truthId: truth.id,
    goodOne: truth.kind === 'good_one',
    spark,
    bestie,
    tasteFav,
    day: 1,
    stepIndex: 0,
    todaySteps: [],
    slotOrder,
    interruptDays,
    meters,
    start: { wallet: vibe.wallet, sanity: vibe.sanity, clout: vibe.clout },
    flags: {},
    seenCards: [],
    log: [],
    tellsShown: [],
    redFlagsMissed: 0,
    goalProgress: {},
    investigations: 0,
    evidenceSinceInvestigation: 0,
    stays: 0,
    toxicCount: 0,
    cluesUsed: 0,
    bailoutUsed: false,
    spotDays: {},
    chemistryShown: [],
    workMattered: [],
    sawTruth: false,
    truthExposed: false,
    payoffsPlayed: 0,
    interruptsPlayed: 0,
    money: { spent: 0, received: 0, borrowed: 0, earned: 0 },
    redFlagsCaught: 0,
    history: [],
  };

  // Hidden Chemistry from the avatar vs the partner's Taste.
  const m = tasteMatches(character, state);
  let chem = 30 + m.length * 15;
  if (spark) chem = Math.max(chem, 75);
  state.meters.chemistry = Math.min(100, chem);
  if (state.meters.chemistry > 30) state.chemistryShown.push(state.meters.chemistry - 30);

  state.todaySteps = buildDaySteps(state);
  return drawUntilPlayable(content, state);
}

export function tasteMatches(character: Character, s: RunState): string[] {
  const a = s.player.avatar;
  const fx = character.taste.fixed[a.set] ?? {};
  const favs = [fx.build, fx.hair, fx.style, fx.facial, s.tasteFav].filter(Boolean) as string[];
  const out: string[] = [];
  if (favs.includes(a.build)) out.push('build');
  if (favs.includes(a.hair)) out.push('hair');
  if (favs.includes(a.style)) out.push('style');
  if (a.facial && favs.includes(a.facial)) out.push('facial');
  return out;
}

function buildDaySteps(s: RunState): Step[] {
  const steps: Step[] = [];
  if (s.day >= 2) steps.push({ kind: 'talking_time', slot: 'talking_time' });
  const slot = s.slotOrder[s.day - 1];
  if (slot === 'finale') {
    steps.push({ kind: 'escalation', slot: 'escalation' });
    steps.push({ kind: 'finale', slot: 'finale' });
    return steps;
  }
  steps.push({ kind: 'main', slot });
  if (s.day >= 2) steps.push({ kind: 'payoff', slot: 'payoff' });
  if (s.day >= 3) steps.push({ kind: 'escalation', slot: 'escalation' });
  if (s.interruptDays.includes(s.day)) steps.push({ kind: 'interrupt', slot: 'interrupt' });
  return steps;
}

// ---------------------------------------------------------------- conditions

export function hasFlag(s: RunState, f: string): boolean {
  return !!s.flags[f];
}

export function knows(s: RunState, f: string, who: Knower): boolean {
  return !!s.flags[f]?.knows.includes(who);
}

export function check(content: CityContent, s: RunState, c: Condition | undefined): boolean {
  if (!c) return true;
  const ch = getCharacter(content, s.characterId);
  if (c.flags && !c.flags.every((f) => hasFlag(s, f))) return false;
  if (c.any_flags && !c.any_flags.some((f) => hasFlag(s, f))) return false;
  if (c.not_flags && c.not_flags.some((f) => hasFlag(s, f))) return false;
  if (c.partner_knows && !c.partner_knows.every((f) => knows(s, f, 'partner'))) return false;
  if (c.world_knows && !c.world_knows.every((f) => knows(s, f, 'world'))) return false;
  if (c.knows && !c.knows.every((k) => knows(s, k.flag, k.who))) return false;
  if (c.truth && !c.truth.includes(s.truthId)) return false;
  if (c.not_truth && c.not_truth.includes(s.truthId)) return false;
  if (c.good_one !== undefined && c.good_one !== s.goodOne) return false;
  if (c.vibe && !c.vibe.includes(s.player.vibe)) return false;
  if (c.goal && !c.goal.includes(s.player.goal)) return false;
  if (c.player_gender && !c.player_gender.includes(s.player.gender)) return false;
  if (c.min) for (const [k, v] of Object.entries(c.min)) if ((s.meters as any)[k] < (v as number)) return false;
  if (c.max) for (const [k, v] of Object.entries(c.max)) if ((s.meters as any)[k] > (v as number)) return false;
  if (c.day_min !== undefined && s.day < c.day_min) return false;
  if (c.day_max !== undefined && s.day > c.day_max) return false;
  if (c.controlling !== undefined && c.controlling !== ch.temperament.controlling) return false;
  if (c.spot_today && s.spotDays[s.day] !== c.spot_today) return false;
  if (c.bestie && !c.bestie.includes(s.bestie)) return false;
  if (c.min_stays !== undefined && s.stays < c.min_stays) return false;
  if (c.character && !c.character.includes(s.characterId)) return false;
  if (c.not_character && c.not_character.includes(s.characterId)) return false;
  if (c.flag_age) {
    const f = s.flags[c.flag_age.flag];
    if (!f || s.day - f.day < c.flag_age.min) return false;
  }
  return true;
}

// ---------------------------------------------------------------- drawing

function deckOf(card: Card): 'character' | 'shared' {
  return card.character ? 'character' : 'shared';
}

export function eligibleCards(content: CityContent, s: RunState, slot: Slot): Card[] {
  const decks = SLOT_DECKS[slot];
  return content.cards.filter(
    (c) =>
      c.slot === slot &&
      decks.includes(deckOf(c)) &&
      (!c.character || c.character === s.characterId) &&
      !s.seenCards.includes(c.id) &&
      check(content, s, c.requires),
  );
}

function drawFor(content: CityContent, s: RunState, step: Step): Card | undefined {
  if (step.kind === 'finale') return undefined;
  if (step.kind === 'interrupt' && s.interruptsPlayed >= MAX_INTERRUPTS) return undefined;
  let pool = eligibleCards(content, s, step.slot);
  if (step.kind === 'escalation') {
    const ch = getCharacter(content, s.characterId);
    const live = ch.temperament.controlling && !s.goodOne && s.meters.attachment >= ESCALATION_ATTACHMENT && !hasFlag(s, 'boundary_set');
    if (!live) return undefined;
  }
  if (!pool.length) return undefined;
  if (step.kind === 'payoff') {
    const top = Math.max(...pool.map((c) => c.priority ?? 0));
    pool = pool.filter((c) => (c.priority ?? 0) === top);
  }
  // Prefer character cards over shared for character-led slots so the deck feels personal.
  if (step.slot === 'public_drama') {
    const own = pool.filter((c) => c.character);
    if (own.length && nextRand(s) < 0.6) pool = own;
  }
  return pickWeighted(s, pool, (c) => c.weight ?? 1);
}

/** Walks forward through today's steps until one has a card, the finale, or the day ends. */
function drawUntilPlayable(content: CityContent, s: RunState): RunState {
  while (true) {
    if (s.status === 'ended' || s.status === 'bailout') return s;
    const step = s.todaySteps[s.stepIndex];
    if (!step) {
      s.status = s.day >= 7 ? 'ended' : 'day_end';
      return s;
    }
    if (step.kind === 'finale') {
      endRun(content, s, computeFinalEnding(content, s), 7);
      return s;
    }
    if (!step.cardId) {
      const card = drawFor(content, s, step);
      if (!card) {
        s.stepIndex++;
        continue;
      }
      step.cardId = card.id;
      s.seenCards.push(card.id);
      // A discovery card delivers its facts the moment it is shown (rule 18).
      for (const d of card.discovers ?? []) if (s.flags[d.flag]) setFlag(s, { flag: d.flag, knows: d.to });
      if (step.kind === 'payoff') s.payoffsPlayed++;
      if (step.kind === 'interrupt') s.interruptsPlayed++;
    }
    s.status = 'card';
    return s;
  }
}

export function currentCard(content: CityContent, s: RunState): Card | undefined {
  if (s.status !== 'card') return undefined;
  const id = s.todaySteps[s.stepIndex]?.cardId;
  return id ? content.cards.find((c) => c.id === id) : undefined;
}

export function currentStep(s: RunState): Step | undefined {
  return s.todaySteps[s.stepIndex];
}

// ---------------------------------------------------------------- economy (rule 7, 22)

export function tier(content: CityContent, s: RunState): number {
  return content.vibes.find((v) => v.id === s.player.vibe)?.tier ?? 1;
}

/** Costs scale to the player's starting wallet tier, rounded to the nearest ₦500. */
export function scaleCost(content: CityContent, s: RunState, base: number): number {
  return Math.round((base * tier(content, s)) / 500) * 500;
}

function tellFor(content: CityContent, s: RunState, card: Card): Tell | undefined {
  const ref = card.tells?.[s.truthId];
  if (!ref) return undefined;
  const id = typeof ref === 'string' ? ref : ref.id;
  const base = getTruth(content, s).tells.find((t) => t.id === id);
  if (!base) return undefined;
  return typeof ref === 'string' ? base : { ...base, text: ref.text };
}

export function resolveCard(content: CityContent, s: RunState): ResolvedCard | undefined {
  const card = currentCard(content, s);
  if (!card) return undefined;
  const ch = getCharacter(content, s.characterId);
  const ctx = { character: ch, player: s.player };
  const tell = tellFor(content, s, card);
  let beats: Beat[] = card.beats.map((b) => ({ ...b, text: fill(b.text, ctx) }));
  if (tell) {
    const idx = beats.findIndex((b) => b.text.includes('{tell}'));
    const tb: Beat = { who: 'tell', text: fill(tell.text, ctx) };
    if (idx >= 0) beats[idx] = tb;
    else beats.push(tb);
  } else beats = beats.filter((b) => !b.text.includes('{tell}'));
  if (card.slot === 'first_date') {
    const first = ch.vibe_start[s.player.vibe]?.line;
    if (first) beats.splice(1, 0, { who: 'narration', text: fill(first, ctx) });
    const leak = chemistryLeak(ch, s);
    if (leak) beats.push({ who: 'narration', text: fill(leak, ctx) });
  }
  const choices = card.choices
    .filter((c) => !c.vibe || c.vibe === s.player.vibe)
    .filter((c) => check(content, s, c.requires))
    .map((c) => resolveChoice(content, s, c));
  return {
    card,
    beats,
    tell,
    choices,
    expression: card.scene.expression ?? 'charming',
    location: card.scene.location,
    time: card.scene.time ?? defaultTime(s.day),
  };
}

function resolveChoice(content: CityContent, s: RunState, c: Choice | SpotOption): ResolvedChoice {
  const cost = c.cost ? scaleCost(content, s, c.cost) : 0;
  const affordable = cost <= s.meters.wallet;
  const ch = getCharacter(content, s.characterId);
  return {
    id: c.id,
    // The price in the label is the price you pay (costs scale with your vibe).
    label: cost ? reconcileMoney(fill(c.label, { character: ch, player: s.player }), cost, { last: true }) : fill(c.label, { character: ch, player: s.player }),
    available: affordable,
    reason: affordable ? undefined : fill(c.broke_text ?? 'Your account balance said "be serious".', { character: ch, player: s.player }),
    cost,
    vibeOnly: (c as Choice).vibe,
    canLoan: !affordable,
    tags: (c.tags ?? []) as ChoiceTag[],
  };
}

export function defaultTime(day: number): string {
  return (['golden', 'night', 'afternoon', 'night', 'golden', 'night', 'morning'] as const)[(day - 1) % 7];
}

function chemistryLeak(ch: Character, s: RunState): string | undefined {
  const leaks = ch.chemistry_leaks ?? [];
  if (!leaks.length) return undefined;
  if (s.spark) return leaks.find((l) => l.match === 'spark')?.text;
  const m = tasteMatches(ch, s);
  if (!m.length) return leaks.find((l) => l.match === 'none')?.text;
  return leaks.find((l) => l.match === m[0])?.text;
}

// ---------------------------------------------------------------- applying choices

interface ApplyCtx {
  content: CityContent;
  s: RunState;
  ch: Character;
  fromPartner: boolean;
  tags: ChoiceTag[];
  notes: string[];
  phone: PhoneEvent[];
  fx: string[];
  deltas: Partial<Meters>;
  expression?: string;
}

function add(ctx: ApplyCtx, key: keyof Meters, v: number) {
  if (!v) return;
  const m = ctx.s.meters;
  const before = m[key];
  let after = before + v;
  if (PCT_METERS.includes(key)) after = Math.max(0, Math.min(100, after));
  if (key === 'wallet') after = Math.max(0, after);
  if (key === 'glow') after = Math.max(1, Math.min(5, after));
  if (key === 'control' || key === 'debt') after = Math.max(0, after);
  m[key] = Math.round(after);
  const d = m[key] - before;
  if (d) ctx.deltas[key] = (ctx.deltas[key] ?? 0) + d;
  if (key === 'wallet' && d) {
    if (d < 0) ctx.s.money.spent -= d;
    else ctx.s.money.received += d;
  }
}

function chemFactor(s: RunState): number {
  return 0.6 + s.meters.chemistry / 125; // 0.6 .. 1.4
}

function setFlag(s: RunState, f: string | FlagSet) {
  const fs: FlagSet = typeof f === 'string' ? { flag: f } : f;
  const who = fs.knows ?? ['player'];
  const ex = s.flags[fs.flag];
  if (ex) ex.knows = Array.from(new Set([...ex.knows, ...who]));
  else s.flags[fs.flag] = { day: s.day, knows: who };
}

function applyEffects(ctx: ApplyCtx, e: Effects) {
  const { s, content } = ctx;
  const isToxic = ctx.tags.includes('toxic');
  const isCautious = ctx.tags.includes('cautious');

  // Money: costs scale with tier; partner gifts scale with Chemistry.
  if (e.wallet) {
    let w = e.wallet;
    if (w < 0 && !e.no_scale) w = -scaleCost(content, s, -w);
    if (w > 0 && e.scaled) w = scaleCost(content, s, w);
    if (w > 0 && ctx.fromPartner) w = Math.round((w * chemFactor(s)) / 500) * 500;
    add(ctx, 'wallet', w);
  }
  add(ctx, 'debt', e.debt ?? 0);
  add(ctx, 'sanity', e.sanity ?? 0);
  let clout = e.clout ?? 0;
  let att = (e.attachment ?? 0) + (e.bond ?? 0);
  let trust = (e.trust ?? 0) + (e.bond ?? 0);
  if (att > 0) att = Math.round(att * chemFactor(s));
  // Rule 14 + 19: cautious choices never damage Trust, on any run.
  if (isCautious && trust < 0) trust = 0;
  // Rule 14: on a Good One run, toxic choices drain Trust instead of rewarding Clout.
  if (s.goodOne && isToxic) {
    if (clout > 0) clout = 0;
    trust = Math.min(trust, 0) - 20;
    att = Math.min(att, 0) - 8;
    ctx.notes.push(fill('{He} saw it. Something in {his} face closes.', { character: ctx.ch }));
  }
  add(ctx, 'clout', clout);
  // Rule 2: a controlling partner with high Attachment gets more possessive, not nicer.
  if (att > 0 && ctx.ch.temperament.controlling && !s.goodOne && s.meters.attachment >= 70) add(ctx, 'control', 1);
  add(ctx, 'attachment', att);
  add(ctx, 'trust', trust);
  add(ctx, 'chemistry', e.chemistry ?? 0);
  if ((e.chemistry ?? 0) > 0) s.chemistryShown.push(e.chemistry!);
  add(ctx, 'exposure', e.exposure ?? 0);
  add(ctx, 'control', e.control ?? 0);
  add(ctx, 'glow', e.glow ?? 0);
  if (e.goal) for (const [g, v] of Object.entries(e.goal)) s.goalProgress[g as keyof typeof s.goalProgress] = Math.min(100, (s.goalProgress[g as keyof typeof s.goalProgress] ?? 0) + (v as number));
  for (const f of e.set ?? []) setFlag(s, f);
  for (const r of e.reveal ?? []) if (s.flags[r.flag]) setFlag(s, { flag: r.flag, knows: r.to });
  for (const f of e.unset ?? []) delete s.flags[f];
  if (e.expression) ctx.expression = e.expression;
  if (e.fx) ctx.fx.push(...e.fx);
  if (e.phone) ctx.phone.push(...e.phone.map((p) => ({ ...p, from: fill(p.from, { character: ctx.ch, player: s.player }), text: fill(p.text, { character: ctx.ch, player: s.player }) })));
  if (e.saw_truth && !s.goodOne) s.sawTruth = true;
  if (e.truth_exposed && !s.goodOne) {
    s.truthExposed = true;
    setFlag(s, { flag: 'truth_exposed', knows: ['player', 'world'] });
  }
  if (e.work_note) s.workMattered.push(e.work_note);
  if (e.leak_secret) {
    const secret = Object.keys(s.flags).find((f) => f.startsWith('secret_') && !knows(s, f, 'partner'));
    if (secret) {
      setFlag(s, { flag: secret, knows: ['partner', 'amebo'] });
      ctx.notes.push(fill('The Amebo sold your gist too. {Partner} knows now.', { character: ctx.ch }));
    } else ctx.notes.push('The Amebo tried to sell your gist. You have none. Respect.');
  }
  if (e.intel) {
    const truth = getTruth(content, s);
    const unseen = truth.tells.filter((t) => !s.tellsShown.includes(t.id));
    if (e.intel === 'tell' || s.bestie === 'genius') {
      const t = unseen[0] ?? truth.tells[0];
      ctx.notes.push(`Intel: ${fill(t.hint, { character: ctx.ch })}`);
      s.evidenceSinceInvestigation++;
      setFlag(s, { flag: 'has_intel', knows: ['player'] });
    } else {
      // A toxic Bestie's intel: a hint from a truth that is NOT this run's.
      const others = getCharacter(content, s.characterId).truths.filter((t) => t.id !== s.truthId);
      const wrong = pick(s, others).tells[0];
      ctx.notes.push(`Bestie swears: ${fill(wrong.hint, { character: ctx.ch })}`);
      setFlag(s, { flag: 'has_intel', knows: ['player', 'bestie'] });
    }
  }
}

function applyRules(ctx: ApplyCtx, spotId?: string) {
  const { s, ch } = ctx;
  const truthKind = s.goodOne ? 'good_one' : 'flawed';
  for (const r of ch.rules) {
    const w = r.when;
    if (w.tag && !ctx.tags.includes(w.tag)) continue;
    if (w.spot && w.spot !== spotId) continue;
    if (!w.tag && !w.spot) continue;
    if (w.day_min && s.day < w.day_min) continue;
    if (w.truth_kind && w.truth_kind !== truthKind) continue;
    if (w.min && Object.entries(w.min).some(([k, v]) => (s.meters as any)[k] < (v as number))) continue;
    applyEffects({ ...ctx, tags: [] }, r.effect);
    if (r.note) ctx.notes.push(fill(r.note, { character: ch, player: s.player }));
  }
}

/** Rule 19: an `investigate` choice becomes cautious or toxic depending on evidence and boundaries. */
export function contextTags(s: RunState, tags: ChoiceTag[]): ChoiceTag[] {
  if (!tags.includes('investigate')) return tags;
  const crossesBoundary = hasFlag(s, 'boundary_phone');
  const justified = s.evidenceSinceInvestigation > 0 && !crossesBoundary;
  return [...tags.filter((t) => t !== 'investigate' && t !== 'cautious' && t !== 'toxic'), 'investigate', justified ? 'cautious' : 'toxic'];
}

function pickOutcome(s: RunState, list: Outcome[]): { o: Outcome; i: number; rolled: boolean } {
  if (list.length === 1) return { o: list[0], i: 0, rolled: false };
  const r = nextRand(s);
  let acc = 0;
  for (let i = 0; i < list.length; i++) {
    acc += list[i].chance;
    if (r < acc) return { o: list[i], i, rolled: true };
  }
  return { o: list[list.length - 1], i: list.length - 1, rolled: true };
}

function outcomesFor(s: RunState, c: { outcomes: Outcome[]; truth_override?: Record<string, Outcome | Outcome[]> }): Outcome[] {
  const ov = c.truth_override?.[s.truthId] ?? (s.goodOne ? c.truth_override?.good_one : undefined) ?? (!s.goodOne ? c.truth_override?.flawed : undefined);
  if (ov) return Array.isArray(ov) ? ov : [{ ...ov, chance: 1 }];
  return c.outcomes;
}

function eventScore(e: Omit<LoggedEvent, 'score' | 'seq'>, s: RunState): number {
  const d = e.deltas;
  let sc = 0;
  sc += Math.abs(d.wallet ?? 0) / Math.max(20_000, s.start.wallet / 10);
  sc += Math.abs(d.sanity ?? 0) / 6 + Math.abs(d.trust ?? 0) / 6 + Math.abs(d.attachment ?? 0) / 8;
  sc += Math.abs(d.exposure ?? 0) / 8 + Math.abs(d.clout ?? 0) / 10;
  if (e.tellShown) sc += 2;
  if (e.missedTell) sc += 3;
  if (e.bad) sc += 2;
  if (e.slot === 'payoff' || e.slot === 'confrontation' || e.slot === 'escalation') sc += 3;
  if (e.tags.includes('toxic')) sc += 2;
  return Math.round(sc * 10) / 10;
}

export interface ChooseOpts {
  loan?: boolean;
}

/** Resolve the player's choice on the current card. */
export function choose(content: CityContent, prev: RunState, choiceId: string, opts: ChooseOpts = {}): { state: RunState; result: ChoiceResult } {
  const s = clone(prev);
  const card = currentCard(content, s);
  if (!card) throw new Error('No card to choose on');
  const choice = card.choices.find((c) => c.id === choiceId);
  if (!choice) throw new Error(`Unknown choice ${choiceId} on ${card.id}`);
  if (choice.vibe && choice.vibe !== s.player.vibe) throw new Error('Vibe-only choice');
  if (!check(content, s, choice.requires)) throw new Error(`Choice ${choiceId} not available`);
  const ch = getCharacter(content, s.characterId);
  s.history.push({ action: 'choose', id: choiceId, loan: opts.loan || undefined });

  for (const f of card.sets ?? []) setFlag(s, f);
  const tags = contextTags(s, choice.tags ?? []);
  const ctx: ApplyCtx = { content, s, ch, fromPartner: !!card.character, tags, notes: [], phone: [], fx: [], deltas: {} };

  const cost = choice.cost ? scaleCost(content, s, choice.cost) : 0;
  if (cost > s.meters.wallet) {
    if (!opts.loan) throw new Error(`Cannot afford ${choiceId}`);
    takeLoan(ctx, cost - s.meters.wallet);
  }
  if (cost) add(ctx, 'wallet', -cost);

  const tell = tellFor(content, s, card);
  if (tell && !s.tellsShown.includes(tell.id)) {
    s.tellsShown.push(tell.id);
    s.evidenceSinceInvestigation++;
  }
  if (tags.includes('investigate')) {
    s.investigations++;
    s.evidenceSinceInvestigation = 0;
  }
  if (tags.includes('toxic')) s.toxicCount++;
  if (tags.includes('stay')) s.stays++;

  const { o, i, rolled } = pickOutcome(s, outcomesFor(s, choice));
  applyEffects(ctx, o);
  applyRules(ctx);

  // Talking Time: catching the passing detail.
  if (card.detail) {
    if (choice.caught) setFlag(s, { flag: card.detail.flag, knows: ['player'] });
    else {
      applyEffects({ ...ctx, tags: [] }, card.detail.missed);
      if (card.detail.red_flag && !s.goodOne) s.redFlagsMissed++;
    }
  }
  if (tell && (tags.includes('call_out') || tags.includes('investigate') || tags.includes('cautious'))) s.redFlagsCaught++;
  let missedTell = false;
  if (tell && tags.includes('excuse') && !s.goodOne) {
    s.redFlagsMissed++;
    missedTell = true;
  }

  const bad = rolled && (o.bad ?? false);
  const cause = o.tricked ? 'tricked' : rolled ? 'dice' : 'chosen';
  logEvent(s, {
    day: s.day,
    card: card.id,
    slot: card.slot,
    choice: choice.id,
    choiceLabel: cost ? reconcileMoney(fill(choice.label, { character: ch, player: s.player }), cost, { last: true }) : fill(choice.label, { character: ch, player: s.player }),
    outcomeText: reconcileMoney(fill(o.text, { character: ch, player: s.player }), ctx.deltas.wallet),
    outcomeIndex: i,
    rolled,
    bad,
    cause,
    deltas: ctx.deltas,
    tags,
    tellShown: tell?.id,
    missedTell,
    receipt: o.receipt ?? choice.receipt,
  });

  const result: ChoiceResult = {
    text: reconcileMoney(fill(o.text, { character: ch, player: s.player }), ctx.deltas.wallet),
    notes: ctx.notes,
    deltas: ctx.deltas,
    phone: ctx.phone,
    expression: ctx.expression,
    fx: ctx.fx,
    rolled,
    bad,
  };
  if (o.end) {
    endRun(content, s, o.end, s.day);
    result.ending = o.end;
    return { state: s, result };
  }
  const instant = checkInstantEnding(s);
  if (instant) {
    result.pendingEnding = instant;
    queueEnding(content, s, instant);
    if (s.status === 'ended') result.ending = instant;
    return { state: s, result };
  }
  s.stepIndex++;
  drawUntilPlayable(content, s);
  if (s.status === 'ended') result.ending = s.ending;
  return { state: s, result };
}

/**
 * Story text is written with round base amounts ("a ₦100k alert"), but costs scale by vibe and
 * gifts by Chemistry. When the text names exactly one amount, rewrite it to the real delta so
 * the text, the bank alert and the meter always agree (Playtest 1, rule 7).
 */
export function reconcileMoney(text: string, delta: number | undefined, opts: { last?: boolean } = {}): string {
  if (!delta) return text;
  const re = /₦\s?(\d[\d,.]*)\s?(k|m)?\b/gi;
  const hits = text.match(re);
  if (!hits || (hits.length !== 1 && !opts.last)) return text;
  const abs = Math.abs(delta);
  const short = abs >= 1_000_000 ? `₦${(Math.round(abs / 100_000) / 10).toString()}m` : abs >= 1000 ? `₦${(Math.round(abs / 100) / 10).toString()}k` : `₦${abs}`;
  if (hits.length === 1) return text.replace(re, short);
  // Choice labels put the price last ("Spray ₦50 notes. Many of them. ₦5k").
  const i = text.lastIndexOf(hits[hits.length - 1]);
  return text.slice(0, i) + short + text.slice(i + hits[hits.length - 1].length);
}

function takeLoan(ctx: ApplyCtx, shortfall: number) {
  const amount = Math.ceil(shortfall / 5000) * 5000;
  add(ctx, 'wallet', amount);
  ctx.s.money.received -= amount;
  ctx.s.money.borrowed += amount;
  add(ctx, 'debt', Math.round(amount * LOAN_RATE));
  setFlag(ctx.s, { flag: 'loan_taken', knows: ['player'] });
  ctx.notes.push(`Loan app approved ${amount.toLocaleString('en-NG')} in 4 seconds. That speed should scare you.`);
  ctx.phone.push({ kind: 'alert', from: 'QuickCash Loan', text: `Credit ₦${amount.toLocaleString('en-NG')}. Repay ₦${Math.round(amount * LOAN_RATE).toLocaleString('en-NG')} in 7 days or we contact your contacts.` });
  ctx.tags = [...ctx.tags, 'loan'];
}

function logEvent(s: RunState, e: Omit<LoggedEvent, 'score' | 'seq'>) {
  s.log.push({ ...e, seq: s.log.length, score: eventScore(e, s) });
}

// ---------------------------------------------------------------- played scenes

/** Applies one moment from a played scene (dress-up, inspect, Wife Escape...) to the run. */
export function playSceneEvent(content: CityContent, prev: RunState, sceneId: string, ev: SceneEvent): { state: RunState; result: ChoiceResult } {
  const s = clone(prev);
  if (s.status !== 'card') throw new Error('Scene events need an active day');
  const ch = getCharacter(content, s.characterId);
  s.history.push({ action: 'scene_event', id: sceneId, event: clone(ev) });
  const tags = (ev.tags ?? []) as ChoiceTag[];
  const ctx: ApplyCtx = { content, s, ch, fromPartner: ev.fromPartner ?? true, tags, notes: [], phone: [], fx: [], deltas: {} };
  if (tags.includes('toxic')) s.toxicCount++;
  if (tags.includes('stay')) s.stays++;
  if (ev.tellShown && !s.tellsShown.includes(ev.tellShown)) {
    s.tellsShown.push(ev.tellShown);
    s.evidenceSinceInvestigation++;
  }
  if (ev.caught) s.redFlagsCaught++;
  if (ev.missedTell && !s.goodOne) s.redFlagsMissed++;
  applyEffects(ctx, ev.effects);
  applyRules(ctx);
  const text = reconcileMoney(fill(ev.text, { character: ch, player: s.player }), ctx.deltas.wallet);
  logEvent(s, {
    day: s.day,
    card: `scene:${sceneId}:${ev.id}`,
    slot: currentStep(s)?.slot ?? 'first_date',
    choice: ev.id,
    choiceLabel: fill(ev.label, { character: ch, player: s.player }),
    outcomeText: text,
    outcomeIndex: 0,
    rolled: false,
    bad: false,
    cause: ev.cause ?? 'played',
    deltas: ctx.deltas,
    tags,
    tellShown: ev.tellShown,
    missedTell: !!ev.missedTell && !s.goodOne,
    receipt: ev.receipt,
  });
  const result: ChoiceResult = { text, notes: ctx.notes, deltas: ctx.deltas, phone: ctx.phone, fx: ctx.fx, expression: ctx.expression, rolled: false, bad: false };
  const instant = checkInstantEnding(s);
  if (instant) {
    result.pendingEnding = instant;
    queueEnding(content, s, instant);
    if ((s.status as string) === 'ended') result.ending = instant;
  }
  return { state: s, result };
}

/** Ends a played scene: it stands in for the current step (e.g. Day 1's First Date card). */
export function finishScene(content: CityContent, prev: RunState, sceneId: string): RunState {
  const s = clone(prev);
  if (s.status !== 'card') return s;
  s.history.push({ action: 'scene_end', id: sceneId });
  s.stepIndex++;
  drawUntilPlayable(content, s);
  return s;
}

// ---------------------------------------------------------------- city spots (rule 8)

export function spotAvailable(s: RunState): boolean {
  return (s.status === 'card' || s.status === 'day_end') && !s.spotDays[s.day];
}

export function resolveSpot(content: CityContent, s: RunState, spotId: string): ResolvedChoice[] {
  const spot = content.spots.find((x) => x.id === spotId);
  if (!spot) return [];
  return spot.options.filter((o) => check(content, s, o.requires)).map((o) => resolveChoice(content, s, o));
}

export function visitSpot(content: CityContent, prev: RunState, spotId: string, optionId: string, opts: ChooseOpts = {}): { state: RunState; result: ChoiceResult } {
  const s = clone(prev);
  if (!spotAvailable(s)) throw new Error('Spot already used today');
  const spot = content.spots.find((x) => x.id === spotId);
  const opt = spot?.options.find((o) => o.id === optionId);
  if (!spot || !opt) throw new Error(`Unknown spot option ${spotId}/${optionId}`);
  if (!check(content, s, opt.requires)) throw new Error('Spot option unavailable');
  const ch = getCharacter(content, s.characterId);
  s.history.push({ action: 'spot', id: spotId, option: optionId, loan: opts.loan || undefined });
  s.spotDays[s.day] = spotId;
  const tags = contextTags(s, opt.tags ?? []);
  const ctx: ApplyCtx = { content, s, ch, fromPartner: false, tags, notes: [], phone: [], fx: [], deltas: {} };
  const cost = opt.cost ? scaleCost(content, s, opt.cost) : 0;
  if (cost > s.meters.wallet) {
    if (!opts.loan) throw new Error('Cannot afford spot');
    takeLoan(ctx, cost - s.meters.wallet);
  }
  if (cost) add(ctx, 'wallet', -cost);
  if (tags.includes('toxic')) s.toxicCount++;
  const { o, i, rolled } = pickOutcome(s, outcomesFor(s, opt));
  applyEffects(ctx, o);
  applyRules(ctx, spotId);
  setFlag(s, { flag: `visited_${spotId}`, knows: ['player'] });
  logEvent(s, {
    day: s.day,
    card: `spot:${spotId}`,
    slot: 'spot',
    choice: opt.id,
    choiceLabel: `${spot.name}: ${opt.label}`,
    outcomeText: fill(o.text, { character: ch, player: s.player }),
    outcomeIndex: i,
    rolled,
    bad: rolled && !!o.bad,
    cause: rolled ? 'dice' : 'chosen',
    deltas: ctx.deltas,
    tags,
    receipt: o.receipt ?? opt.receipt,
  });
  const result: ChoiceResult = { text: fill(o.text, { character: ch, player: s.player }), notes: ctx.notes, deltas: ctx.deltas, phone: ctx.phone, fx: ctx.fx, expression: ctx.expression, rolled, bad: rolled && !!o.bad };
  const instant = checkInstantEnding(s);
  if (instant) {
    result.pendingEnding = instant;
    queueEnding(content, s, instant);
    if (s.status === 'ended') result.ending = instant;
  } else if (s.status === 'card' && !currentCard(content, s)) {
    drawUntilPlayable(content, s);
  }
  return { state: s, result };
}

// ---------------------------------------------------------------- day flow

export function nextDay(content: CityContent, prev: RunState): { state: RunState; events: PhoneEvent[]; deltas: Partial<Meters> } {
  const s = clone(prev);
  if (s.status !== 'day_end') throw new Error('Day is not over');
  const ch = getCharacter(content, s.characterId);
  s.day++;
  s.stepIndex = 0;
  s.history.push({ action: 'next_day', id: String(s.day) });
  const vibe = content.vibes.find((v) => v.id === s.player.vibe)!;
  const ctx: ApplyCtx = { content, s, ch, fromPartner: false, tags: [], notes: [], phone: [], fx: [], deltas: {} };
  // Light work layer: a small daily salary (Big Boy money is volatile).
  let pay = vibe.salary;
  if (vibe.volatile) pay = Math.round((vibe.salary * (nextRand(s) * 3 - 1)) / 500) * 500;
  if (pay > 0) {
    add(ctx, 'wallet', pay);
    s.money.received -= pay;
    s.money.earned += pay;
    ctx.phone.push({ kind: 'alert', from: 'Bank', text: `Credit ₦${pay.toLocaleString('en-NG')}. ${vibe.volatile ? 'Crypto pumped small.' : 'Salary drip.'}` });
  } else if (pay < 0) {
    const loss = Math.max(pay, -Math.floor(s.meters.wallet / 4));
    add(ctx, 'wallet', loss);
    s.money.spent += loss;
    s.money.earned += loss;
    ctx.phone.push({ kind: 'alert', from: 'Binance', text: `Portfolio down ${naiStr(-pay)} overnight. "HODL," says your guy.` });
  }
  // Upkeep: a high-maintenance partner drains Chemistry unless you kept up the glow.
  if (ch.taste.high_maintenance && !Object.values(s.spotDays).includes('clinic')) add(ctx, 'chemistry', -3);
  if (Object.keys(ctx.deltas).length) {
    logEvent(s, { day: s.day, card: 'system:morning', slot: 'system', choice: 'morning', choiceLabel: 'Morning', outcomeText: 'A new day in Lagos.', outcomeIndex: 0, rolled: vibe.volatile ?? false, bad: pay < 0, cause: 'world', deltas: ctx.deltas, tags: [] });
  }
  s.todaySteps = buildDaySteps(s);
  s.status = 'card';
  const instant = checkInstantEnding(s);
  if (instant) queueEnding(content, s, instant);
  else drawUntilPlayable(content, s);
  return { state: s, events: ctx.phone, deltas: ctx.deltas };
}

function naiStr(n: number) {
  return `₦${Math.abs(n).toLocaleString('en-NG')}`;
}

// ---------------------------------------------------------------- endings

export function checkInstantEnding(s: RunState): EndingId | undefined {
  const m = s.meters;
  if (m.wallet <= 0) return 'sapa';
  if (m.sanity <= 0) return 'breakdown';
  if (m.exposure >= SCANDAL_EXPOSURE) return 'scandal';
  if (m.attachment <= 0 || m.trust <= 0) return s.goodOne ? 'fumbled' : 'ghosted';
  return undefined;
}

export function bailoutEligible(e: EndingId): boolean {
  return e === 'sapa' || e === 'breakdown';
}

function queueEnding(content: CityContent, s: RunState, e: EndingId) {
  if (bailoutEligible(e) && !s.bailoutUsed) {
    s.pendingEnding = e;
    s.status = 'bailout';
  } else endRun(content, s, e, s.day);
}

function endRun(_content: CityContent, s: RunState, e: EndingId, day: number) {
  s.ending = e;
  s.endedDay = day;
  s.status = 'ended';
  s.pendingEnding = undefined;
}

/**
 * Bail-out decision. `granted` must come from the server (rule 10): a verified payment
 * or a server-recorded free Bail-Out credit. The engine never grants it on its own.
 */
export function resolveBailout(content: CityContent, prev: RunState, granted: boolean): RunState {
  const s = clone(prev);
  if (s.status !== 'bailout' || !s.pendingEnding) throw new Error('No bail-out pending');
  const e = s.pendingEnding;
  if (!granted) {
    s.history.push({ action: 'decline_bailout', id: e });
    endRun(content, s, e, s.day);
    return s;
  }
  s.history.push({ action: 'bailout', id: e });
  s.bailoutUsed = true;
  s.pendingEnding = undefined;
  const before = { ...s.meters };
  if (e === 'sapa') s.meters.wallet = Math.max(s.meters.wallet, 25_000);
  if (e === 'breakdown') s.meters.sanity = Math.max(s.meters.sanity, 25);
  logEvent(s, { day: s.day, card: 'system:bailout', slot: 'system', choice: 'bailout', choiceLabel: 'Emergency Bail-Out', outcomeText: 'Bailed out.', outcomeIndex: 0, rolled: false, bad: false, cause: 'chosen', deltas: { wallet: s.meters.wallet - before.wallet, sanity: s.meters.sanity - before.sanity }, tags: [], receipt: 'You used your Emergency Bail-Out.' });
  s.status = 'card';
  const again = checkInstantEnding(s);
  if (again) {
    queueEnding(content, s, again);
    return s;
  }
  const step = s.todaySteps[s.stepIndex];
  // The card that caused the crash was already resolved; move on.
  if (step?.cardId && s.log.some((l) => l.card === step.cardId)) s.stepIndex++;
  drawUntilPlayable(content, s);
  return s;
}

export function netWorth(s: RunState): number {
  return s.meters.wallet - s.meters.debt - s.start.wallet;
}

export function bond(s: RunState): number {
  return Math.round((s.meters.attachment + s.meters.trust) / 2);
}

export function computeFinalEnding(content: CityContent, s: RunState): EndingId {
  const ch = getCharacter(content, s.characterId);
  const m = s.meters;
  // Rule 16 + 21: Obsession only when the player kept choosing to stay with a controlling, flawed partner.
  if (ch.temperament.controlling && !s.goodOne && m.attachment >= OBSESSION_ATTACHMENT && s.stays >= OBSESSION_STAYS && !hasFlag(s, 'boundary_set')) return 'obsession';
  if (m.exposure >= SCANDAL_EXPOSURE) return 'scandal';
  if (!s.goodOne && s.sawTruth && netWorth(s) >= COUNTER_CON_NET) return 'counter_con';
  if (m.attachment >= 70 && m.trust >= 65 && m.exposure < 50) return 'locked_in';
  return 'survived';
}

export function goalWon(s: RunState): boolean {
  switch (s.player.goal) {
    case 'bag':
      return netWorth(s) >= BAG_NET;
    case 'love':
      return s.endedDay === 7 && bond(s) >= 80 && s.meters.sanity >= 40 && !['ghosted', 'fumbled', 'obsession'].includes(s.ending ?? '');
    case 'ring':
      return s.ending === 'locked_in';
    case 'revenge':
      return s.truthExposed;
  }
}

export function goalProgress(s: RunState): number {
  const m = s.meters;
  switch (s.player.goal) {
    case 'bag':
      return clampPct((netWorth(s) / BAG_NET) * 100);
    case 'love':
      return clampPct(Math.min(bond(s) / 80, m.sanity / 40) * 100);
    case 'ring':
      return s.ending === 'locked_in' ? 100 : clampPct(Math.min(m.attachment / 70, m.trust / 65) * 90);
    case 'revenge':
      return s.truthExposed ? 100 : clampPct(s.goalProgress.revenge ?? 0);
  }
}

function clampPct(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

// ---------------------------------------------------------------- clue pass

/** Clue Pass (rule 10: only call after the server confirms the purchase). Returns a tell hint, never the truth. */
export function useClue(content: CityContent, prev: RunState): { state: RunState; hint: string } {
  const s = clone(prev);
  if (s.cluesUsed >= 2) throw new Error('Max 2 clues per run');
  if (s.day < 2) throw new Error('Clue Pass opens on Day 2');
  const truth = getTruth(content, s);
  const t = truth.tells.find((x) => !s.tellsShown.includes(x.id)) ?? truth.tells[s.cluesUsed % truth.tells.length];
  s.cluesUsed++;
  s.evidenceSinceInvestigation++;
  s.history.push({ action: 'clue', id: t.id });
  return { state: s, hint: `Amebo says: ${fill(t.hint, { character: getCharacter(content, s.characterId) })}` };
}

// ---------------------------------------------------------------- replay

/** Replays a run from its seed and recorded actions (support tooling + rule 23 determinism). */
export function replay(content: CityContent, player: PlayerSetup, characterId: string, seed: number, history: RunState['history'], opts: CreateOpts = {}): RunState {
  let s = createRun(content, player, characterId, seed, opts);
  for (const h of history) {
    if (h.action === 'next_day') s = nextDay(content, s).state;
    else if (h.action === 'choose') s = choose(content, s, h.id, { loan: h.loan }).state;
    else if (h.action === 'spot') s = visitSpot(content, s, h.id, h.option!, { loan: h.loan }).state;
    else if (h.action === 'bailout') s = resolveBailout(content, s, true);
    else if (h.action === 'decline_bailout') s = resolveBailout(content, s, false);
    else if (h.action === 'clue') s = useClue(content, s).state;
    else if (h.action === 'scene_event') s = playSceneEvent(content, s, h.id, h.event!).state;
    else if (h.action === 'scene_end') s = finishScene(content, s, h.id);
  }
  return s;
}

export function randomInt(s: RunState, n: number) {
  return randInt(s, n);
}
