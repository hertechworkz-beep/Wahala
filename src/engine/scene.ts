// The playable first date: pure rules that turn what the player physically did in a scene
// (what they wore, where they sat, how fast they closed a briefcase) into SceneEvents for the
// engine. The UI and the tests share these, so a played scene is seeded and replayable.
import type { Beat, Character, CityContent, Effects, RunState, SceneEvent, ChoiceTag } from './types';
import { finishScene, playSceneEvent } from './engine';

export interface Line {
  who: string; // partner | musa | bestie | narration | <npc>
  text: string;
  expression?: string;
  sfx?: string;
}

export interface Moment {
  id: string;
  label?: string;
  text?: string;
  tags?: string[];
  effects?: Effects;
  receipt?: string;
  expression?: string;
  caught?: boolean;
  missed?: boolean;
  tell?: string;
  lines?: Line[] | Record<string, Line[]>;
}

export interface WearItem {
  id: string;
  slot: 'outfit' | 'shoes' | 'jewellery' | 'bag' | 'perfume' | 'hair';
  set: 'woman' | 'man' | 'any';
  label: string;
  cost?: number;
  borrowed?: boolean;
  tags?: string[];
  look?: Record<string, string>;
}

export type SceneStep =
  | { type: 'dressup'; id: string; title: string; required: string[]; items: WearItem[]; borrowed_disaster: Moment & { chance: number }; call: { after_picks: number; caller: string; lines: Line[]; replies: Moment[]; missed: Moment } }
  | { type: 'ride'; id: string; driver: string; driver_lines: Line[]; partner_text: string; put_away: Moment; keep_out: Moment }
  | { type: 'seat'; id: string; prompt: string; seats: (Moment & { hint: string; node: string })[] }
  | { type: 'arrival'; id: string; lines: Record<Tier, Line[]>; effects: Record<Tier, Effects> }
  | { type: 'talk'; id: string; lines: Line[]; replies: Moment[]; rolex: { label: string; chance_seen: number; unseen: Moment; seen: Moment } }
  | { type: 'toast'; id: string; lines: Line[]; perfect: Moment; good: Moment; spill: Moment }
  | { type: 'glance'; id: string; seconds: number; lead: string; screen: Record<string, { name: string; tell: string }>; replies: Moment[]; timeout: Moment }
  | { type: 'inspect'; id: string; seconds: number; lead: Line[]; object: string; pages: Record<string, { title: string; lines: { text: string; clue?: boolean }[] }[]>; found: Record<string, Moment>; caught: Moment; skipped: Moment; back: Line[] }
  | { type: 'photo'; id: string; from: string; message: string; detail: Record<string, { label: string; text: string; tell: string }>; replies: (Moment & { effects?: Effects | Record<string, Effects> })[] }
  | { type: 'escape'; id: string; reaction_seconds: number; intruder: Record<string, { name: string; role: string; line: string }>; tactics: Tactic[]; reactions: { id: Reaction; label: string }[]; outcomes: Record<string, Moment | Record<string, Moment>> }
  | { type: 'outro'; id: string; lines: Record<string, Line[]>; envelope: Moment; envelope_broke: Moment; teaser: string };

export type Tier = 'high' | 'mid' | 'low';
export type Tactic = 'guard' | 'filming' | 'waiter';
export type Reaction = 'hide' | 'stay' | 'hand' | 'face';
export type EscapeOutcome = 'escaped' | 'outlasted' | 'filmed' | 'worse' | 'caught' | 'faced' | 'stayed' | 'hand';

export interface SceneSpec {
  id: string;
  character: string;
  replaces: string;
  likes: string[];
  steps: SceneStep[];
}

export type StepOf<T extends SceneStep['type']> = Extract<SceneStep, { type: T }>;

export function step<T extends SceneStep['type']>(scene: SceneSpec, type: T): StepOf<T> {
  const s = scene.steps.find((x) => x.type === type);
  if (!s) throw new Error(`Scene ${scene.id} has no ${type} step`);
  return s as StepOf<T>;
}

/** Stable roll in [0,1) for a named moment in this run: same seed, same luck. */
export function sceneRoll(s: Pick<RunState, 'seed'>, key: string): number {
  let h = 2166136261 ^ s.seed;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

export function truthKey(s: Pick<RunState, 'truthId'>): string {
  return s.truthId;
}

/** Turns a Moment into an engine event. `prefix` keeps ids unique per step. */
export function toEvent(prefix: string, m: Moment, extra: Partial<SceneEvent> = {}): SceneEvent {
  return {
    id: `${prefix}.${m.id}`,
    label: m.label ?? m.receipt ?? m.id,
    text: m.text ?? m.receipt ?? '',
    effects: m.effects ?? {},
    tags: (m.tags ?? []) as ChoiceTag[],
    receipt: m.receipt,
    caught: m.caught || undefined,
    missedTell: m.missed || undefined,
    tellShown: m.tell,
    ...extra,
  };
}

export function linesFor(lines: Line[] | Record<string, Line[]> | undefined, key: string): Line[] {
  if (!lines) return [];
  return Array.isArray(lines) ? lines : (lines[key] ?? []);
}

export function asBeats(lines: Line[]): Beat[] {
  return lines.map((l) => ({ who: l.who as Beat['who'], text: l.text }));
}

// ---------------------------------------------------------------- dress-up

export function wardrobe(scene: SceneSpec, set: 'woman' | 'man'): WearItem[] {
  return step(scene, 'dressup').items.filter((i) => i.set === 'any' || i.set === set);
}

export type Outfit = Partial<Record<WearItem['slot'], string>>;

/** Dress-up can never spend your last ₦10k: you still need transport home. */
export const DRESS_FLOOR = 10_000;
export const dressBudget = (s: Pick<RunState, 'meters'>) => Math.max(0, s.meters.wallet - DRESS_FLOOR);

/** How well the outfit matches the partner's taste: 0..1. Drives his first reaction. */
export function dressScore(scene: SceneSpec, picks: Outfit): number {
  const items = step(scene, 'dressup').items;
  const worn = Object.values(picks)
    .map((id) => items.find((i) => i.id === id))
    .filter(Boolean) as WearItem[];
  const hits = worn.reduce((n, i) => n + (i.tags ?? []).filter((t) => scene.likes.includes(t)).length, 0);
  return Math.min(1, hits / 4);
}

export function dressTier(score: number, chemistry: number): Tier {
  const v = score * 70 + chemistry * 0.6;
  return v >= 58 ? 'high' : v >= 34 ? 'mid' : 'low';
}

export function outfitCost(scene: SceneSpec, picks: Outfit): number {
  const items = step(scene, 'dressup').items;
  return Object.values(picks).reduce((sum, id) => sum + (items.find((i) => i.id === id)?.cost ?? 0), 0);
}

/** One event for leaving the house dressed, plus the borrowed-outfit disaster if it rolls. */
export function dressEvents(scene: SceneSpec, s: RunState, picks: Outfit): SceneEvent[] {
  const st = step(scene, 'dressup');
  const items = st.items;
  const worn = (Object.values(picks) as string[]).map((id) => items.find((i) => i.id === id)!).filter(Boolean);
  const cost = outfitCost(scene, picks);
  const names = worn.filter((i) => i.slot !== 'perfume' || i.id !== 'p_none').map((i) => i.label);
  const events: SceneEvent[] = [
    {
      id: `${st.id}.wear`,
      label: `Wore ${names.join(', ')}`,
      text: cost ? `You spent ₦${Math.round(cost / 1000)}k on tonight's look.` : 'Dressed. Out the door.',
      effects: cost ? { wallet: -cost, no_scale: true } : {},
      receipt: `You wore ${names.slice(0, 3).join(', ').toLowerCase()}${cost ? ` and spent ₦${Math.round(cost / 1000)}k getting ready` : ''}.`,
      fromPartner: false,
      cause: 'chosen',
      meta: { ...picks, score: String(dressScore(scene, picks)) },
    },
  ];
  const borrowed = worn.find((i) => i.borrowed);
  if (borrowed && sceneRoll(s, 'borrowed') < st.borrowed_disaster.chance) events.push(toEvent(st.id, { ...st.borrowed_disaster, id: 'zip' }, { cause: 'dice', label: 'The borrowed zip' }));
  return events;
}

// ---------------------------------------------------------------- table moments

const ARRIVAL_RECEIPT: Record<Tier, string> = { high: 'Chief loved your outfit.', mid: 'Chief noticed your outfit.', low: 'Chief did not like your outfit.' };
export function arrivalEvent(scene: SceneSpec, s: RunState, score: number): SceneEvent {
  const st = step(scene, 'arrival');
  const tier = dressTier(score, s.meters.chemistry);
  return { id: `${st.id}.${tier}`, label: 'Chief arrives', text: st.lines[tier].map((l) => l.text).join(' '), effects: st.effects[tier], receipt: ARRIVAL_RECEIPT[tier], meta: { tier } };
}

export function rolexEvent(scene: SceneSpec, s: RunState): SceneEvent {
  const r = step(scene, 'talk').rolex;
  const seen = sceneRoll(s, 'rolex') < r.chance_seen;
  const m = seen ? r.seen : r.unseen;
  return toEvent('rolex', m, { label: r.label, cause: 'dice' });
}

export type ToastGrade = 'perfect' | 'good' | 'spill';
/** The toast meter: distance from the sweet spot (0 = dead centre). */
export function toastGrade(distance: number): ToastGrade {
  const d = Math.abs(distance);
  return d <= 0.09 ? 'perfect' : d <= 0.26 ? 'good' : 'spill';
}

export function glanceEvent(scene: SceneSpec, s: RunState, replyId: string | 'timeout'): SceneEvent {
  const g = step(scene, 'glance');
  const screen = g.screen[truthKey(s)];
  const m = replyId === 'timeout' ? g.timeout : g.replies.find((r) => r.id === replyId)!;
  const read = !!m.caught;
  return toEvent(g.id, m, {
    label: m.label ?? 'Froze',
    text: read ? `${m.text} "${screen.name}".` : (m.text ?? ''),
    tellShown: read ? screen.tell : undefined,
  });
}

export type InspectResult = 'found' | 'caught' | 'skipped' | 'closed';
export function inspectEvent(scene: SceneSpec, s: RunState, result: InspectResult): SceneEvent {
  const st = step(scene, 'inspect');
  if (result === 'found') return toEvent(st.id, st.found[truthKey(s)], { label: 'Searched his briefcase' });
  if (result === 'caught') return toEvent(st.id, st.caught, { label: 'Kept reading', cause: 'played' });
  if (result === 'closed') return toEvent(st.id, { id: 'peeked', text: 'You shut it in time. You saw nothing useful.', tags: ['investigate'], effects: { sanity: -2 }, receipt: 'You peeked in his briefcase and found nothing.' }, { label: 'Peeked and closed it' });
  return toEvent(st.id, st.skipped, { label: 'Left his briefcase alone' });
}

export function photoEvent(scene: SceneSpec, s: RunState, replyId: string, zoomed: boolean): SceneEvent {
  const st = step(scene, 'photo');
  const t = truthKey(s);
  const r = st.replies.find((x) => x.id === replyId)!;
  const perTruth = !!r.effects && Object.keys(st.detail).some((k) => k in r.effects!);
  const eff = perTruth ? ((r.effects as Record<string, Effects>)[t] ?? {}) : ((r.effects as Effects) ?? {});
  const detail = st.detail[t];
  const lines = linesFor(r.lines, t);
  return toEvent(st.id, { ...r, effects: eff }, {
    text: lines.map((l) => l.text).join(' '),
    tellShown: zoomed ? detail.tell : undefined,
    caught: zoomed && replyId !== 'delete' ? true : undefined,
    missedTell: !zoomed || replyId === 'delete' ? true : undefined,
  });
}

export function escapeMoment(scene: SceneSpec, s: RunState, outcome: EscapeOutcome): Moment {
  const st = step(scene, 'escape');
  const o = st.outcomes[outcome];
  return ('id' in o ? o : (o as Record<string, Moment>)[truthKey(s)]) as Moment;
}

export function escapeEvent(scene: SceneSpec, s: RunState, outcome: EscapeOutcome, reaction: Reaction): SceneEvent {
  const m = escapeMoment(scene, s, outcome);
  const st = step(scene, 'escape');
  const label = st.reactions.find((r) => r.id === reaction)?.label ?? reaction;
  return toEvent(st.id, m, { label, meta: { outcome, reaction } });
}

/** The tactics in play for this run's escape: 2 of 3, seeded. */
export function escapeTactics(scene: SceneSpec, s: RunState): Tactic[] {
  const all = [...step(scene, 'escape').tactics];
  const drop = Math.floor(sceneRoll(s, 'tactics') * all.length);
  return all.filter((_, i) => i !== drop);
}

export function outroEvents(scene: SceneSpec, s: RunState): SceneEvent[] {
  const st = step(scene, 'outro');
  const m = s.truthId === 'broke' ? st.envelope_broke : st.envelope;
  return [toEvent(st.id, m, { label: 'Opened the envelope', fromPartner: true })];
}

/** Steps already played in this run (a reload resumes the scene where it stopped). */
export function playedSteps(s: RunState, sceneId: string): Set<string> {
  const done = new Set<string>();
  for (const h of s.history) if (h.action === 'scene_event' && h.id === sceneId && h.event) done.add(h.event.id.split('.')[0]);
  return done;
}

export function sceneMeta(s: RunState, sceneId: string, eventId: string): Record<string, string> | undefined {
  const h = s.history.find((x) => x.action === 'scene_event' && x.id === sceneId && x.event?.id === eventId);
  return h?.event?.meta;
}

export function sceneActive(s: RunState, scene: SceneSpec | undefined): boolean {
  if (!scene || s.characterId !== scene.character || s.status !== 'card' || s.day !== 1) return false;
  if (s.todaySteps[s.stepIndex]?.slot !== scene.replaces) return false;
  return !s.history.some((h) => h.action === 'scene_end' && h.id === scene.id);
}

// ---------------------------------------------------------------- simulated play

/**
 * The scene as decisions, for simulations, bots and tests: at each step, the options a player
 * really has (skill moments become one option per result). Applying one plays its events
 * through the engine, so simulated nights move the same meters as played ones.
 */
export interface SceneOption {
  id: string;
  events: SceneEvent[];
}

export function activeScene(content: { scenes: SceneSpec[] }, s: RunState): SceneSpec | undefined {
  const sc = content.scenes.find((x) => x.character === s.characterId);
  return sc && sceneActive(s, sc) ? sc : undefined;
}

export function currentSceneStep(scene: SceneSpec, s: RunState): SceneStep | undefined {
  const done = playedSteps(s, scene.id);
  return scene.steps.find((st) => !done.has(st.id));
}

function presetOutfit(scene: SceneSpec, s: RunState, kind: 'match' | 'plain' | 'borrowed' | 'designer'): Outfit {
  const set = s.player.avatar.set;
  const items = wardrobe(scene, set);
  const hits = (i: WearItem) => (i.tags ?? []).filter((t) => scene.likes.includes(t)).length;
  const picks: Outfit = {};
  let budget = dressBudget(s);
  const slots: WearItem['slot'][] = kind === 'plain' ? ['outfit', 'shoes'] : ['outfit', 'shoes', 'hair', 'jewellery', 'bag', 'perfume'];
  for (const slot of slots) {
    let pool = items.filter((i) => i.slot === slot && (i.cost ?? 0) <= budget);
    if (slot === 'outfit' && kind === 'borrowed') pool = pool.filter((i) => i.borrowed).concat(pool.filter((i) => !i.borrowed));
    if (!pool.length) continue;
    const rank = (i: WearItem) => (kind === 'plain' ? -hits(i) * 10 - (i.cost ?? 0) / 1e4 : kind === 'designer' ? (i.cost ?? 0) / 1e4 + hits(i) : kind === 'borrowed' && slot === 'outfit' ? (i.borrowed ? 100 : 0) : hits(i) * 10 - (i.cost ?? 0) / 1e5);
    const best = [...pool].sort((a, b) => rank(b) - rank(a))[0];
    picks[slot] = best.id;
    budget -= best.cost ?? 0;
  }
  return picks;
}

export function sceneOptions(scene: SceneSpec, s: RunState): SceneOption[] {
  const st = currentSceneStep(scene, s);
  if (!st) return [];
  const t = truthKey(s);
  switch (st.type) {
    case 'dressup': {
      const calls: SceneEvent[] = [...st.call.replies.map((r) => toEvent('bestie_call', r, { fromPartner: false })), toEvent('bestie_call', st.call.missed, { fromPartner: false })];
      const out: SceneOption[] = [];
      for (const kind of ['match', 'plain', 'borrowed', 'designer'] as const)
        for (const c of calls) out.push({ id: `${kind}+${c.id.split('.')[1]}`, events: [c, ...dressEvents(scene, s, presetOutfit(scene, s, kind))] });
      return out;
    }
    case 'ride':
      return [st.put_away, st.keep_out].map((m) => ({ id: m.id, events: [toEvent(st.id, m, { fromPartner: false })] }));
    case 'seat':
      return st.seats.map((m) => ({ id: m.id, events: [toEvent(st.id, m, { fromPartner: false })] }));
    case 'arrival':
      return [{ id: 'arrive', events: [arrivalEvent(scene, s, Number(sceneMeta(s, scene.id, `${scene.steps[0].id}.wear`)?.score ?? 0))] }];
    case 'talk': {
      const phoneOut = s.history.some((h) => h.action === 'scene_event' && h.event?.id === 'the_ride.phone_out');
      const replies = st.replies.map((r) => toEvent(st.id, r));
      const out = replies.map((e) => ({ id: e.id.split('.')[1], events: [e] }));
      if (phoneOut) for (const e of replies) out.push({ id: `rolex+${e.id.split('.')[1]}`, events: [rolexEvent(scene, s), e] });
      return out;
    }
    case 'toast':
      return (['perfect', 'good', 'spill'] as const).map((g) => ({ id: g, events: [toEvent(st.id, st[g])] }));
    case 'glance':
      return [...st.replies.map((r) => r.id), 'timeout'].map((id) => ({ id, events: [glanceEvent(scene, s, id)] }));
    case 'inspect':
      return (['found', 'caught', 'skipped', 'closed'] as const).map((k) => ({ id: k, events: [inspectEvent(scene, s, k)] }));
    case 'photo': {
      const out: SceneOption[] = [];
      for (const r of st.replies) for (const z of [true, false]) out.push({ id: `${r.id}${z ? '+zoom' : ''}`, events: [photoEvent(scene, s, r.id, z)] });
      return out;
    }
    case 'escape': {
      const tactics = escapeTactics(scene, s);
      const hide: EscapeOutcome[] = ['outlasted', 'caught'];
      if (!(tactics.includes('guard') && tactics.includes('filming'))) hide.push('escaped');
      if (tactics.includes('filming')) hide.push('filmed');
      if (tactics.includes('waiter')) hide.push('worse');
      const out: SceneOption[] = (['stay', 'hand', 'face'] as const).map((r) => ({ id: r, events: [escapeEvent(scene, s, r === 'face' ? 'faced' : r === 'hand' ? 'hand' : 'stayed', r)] }));
      for (const o of hide) out.push({ id: `hide:${o}`, events: [escapeEvent(scene, s, o, 'hide')] });
      void t;
      return out;
    }
    case 'outro':
      return [{ id: 'envelope', events: outroEvents(scene, s) }];
  }
}

/** Plays one option: its events, then closes the scene after the last step. */
export function playSceneOption(content: CityContent, scene: SceneSpec, prev: RunState, optionId: string): RunState {
  const opt = sceneOptions(scene, prev).find((o) => o.id === optionId);
  if (!opt) throw new Error(`No scene option ${optionId}`);
  let s = prev;
  for (const ev of opt.events) {
    if (s.status !== 'card') break;
    s = playSceneEvent(content, s, scene.id, ev).state;
  }
  if (s.status === 'card' && !currentSceneStep(scene, s)) s = finishScene(content, s, scene.id);
  return s;
}

/** Content checks for a played scene: every truth is covered, every tell exists. */
export function validateScene(scene: SceneSpec, ch: Character): string[] {
  const errs: string[] = [];
  const truths = ch.truths.map((t) => t.id);
  const tells = new Set(ch.truths.flatMap((t) => t.tells.map((x) => x.id)));
  const need = (where: string, rec: Record<string, unknown> | undefined) => {
    for (const t of truths) if (!rec || !(t in rec)) errs.push(`scene ${scene.id}: ${where} has nothing for truth ${t}`);
  };
  for (const st of scene.steps) {
    if (st.type === 'glance') {
      need('glance.screen', st.screen);
      for (const v of Object.values(st.screen)) if (!tells.has(v.tell)) errs.push(`scene ${scene.id}: unknown tell ${v.tell}`);
    }
    if (st.type === 'inspect') (need('inspect.pages', st.pages), need('inspect.found', st.found));
    if (st.type === 'photo') {
      need('photo.detail', st.detail);
      for (const v of Object.values(st.detail)) if (!tells.has(v.tell)) errs.push(`scene ${scene.id}: unknown tell ${v.tell}`);
    }
    if (st.type === 'escape') {
      need('escape.intruder', st.intruder);
      for (const k of ['caught', 'faced', 'stayed', 'hand']) need(`escape.outcomes.${k}`, st.outcomes[k] as Record<string, unknown>);
    }
  }
  for (const type of ['dressup', 'ride', 'seat', 'arrival', 'talk', 'toast', 'glance', 'inspect', 'photo', 'escape', 'outro'] as const) if (!scene.steps.some((s) => s.type === type)) errs.push(`scene ${scene.id}: missing ${type} step`);
  return errs;
}
