import { PEOPLE } from '../cast';
import type { VenueConfig } from '../venue';
import type { DateScene } from './firstDate';

// Checks content before it ships: every name a scene uses must exist. Runs in tests and `npm run validate`.

export function validateVenue(v: VenueConfig): string[] {
  const errs: string[] = [];
  const ids = new Set<string>();
  const { width: W, depth: D } = v.room;
  for (const p of v.props) {
    if ('id' in p) {
      if (ids.has(p.id)) errs.push(`${v.id}: duplicate prop id ${p.id}`);
      ids.add(p.id);
    }
    const [x, z] = p.at;
    if (Math.abs(x) > W / 2 || Math.abs(z) > D / 2) errs.push(`${v.id}: ${p.kind} at ${p.at} is outside the room`);
  }
  for (const [k, [x, z]] of Object.entries(v.spots)) if (Math.abs(x) > W / 2 || Math.abs(z) > D / 2) errs.push(`${v.id}: spot ${k} is outside the room`);
  return errs;
}

/** Seat ids a venue will create (tables make ".a" and ".b"; armchairs use their own id). */
export function seatIds(v: VenueConfig) {
  const out: string[] = [];
  for (const p of v.props) {
    if (p.kind === 'table_for_two') out.push(`${p.id}.a`, `${p.id}.b`);
    if (p.kind === 'armchair') out.push(p.id);
  }
  return out;
}

/** Most background people a scene may cast from outside Africa ("a few expats or tourists"). */
export const MAX_EXPATS_PER_SCENE = 2;

/** Brief Part 29: Lagos is cast Black African; non-African people only as a few background expats. */
export function validateCasting(s: DateScene): string[] {
  const errs: string[] = [];
  const leads = [s.player.who, s.date.who];
  for (const w of leads) {
    const p = PEOPLE[w];
    if (p && p.heritage !== 'black_african') errs.push(`${s.id}: ${w} is a story character and must be Black African (Part 29)`);
    if (p && p.role === 'background_expat') errs.push(`${s.id}: ${w} is a background expat and can't be a story character`);
  }
  let expats = 0;
  for (const e of s.extras) {
    const p = PEOPLE[e.who];
    if (!p || p.heritage === 'black_african') continue;
    if (p.role !== 'background_expat') errs.push(`${s.id}: ${e.who} is not Black African, so may only be cast as a background expat (Part 29)`);
    expats++;
  }
  if (expats > MAX_EXPATS_PER_SCENE) errs.push(`${s.id}: ${expats} non-African extras; at most ${MAX_EXPATS_PER_SCENE} background expats per scene (Part 29)`);
  return errs;
}

/** Every person registered for the player or a story role must be Black African. */
export function validateCast(): string[] {
  return Object.entries(PEOPLE)
    .filter(([, p]) => (p.role === 'player' || p.role === 'story') && p.heritage !== 'black_african')
    .map(([id]) => `cast: ${id} has a ${PEOPLE[id].role} role and must be Black African (Part 29)`);
}

export function validateScene(s: DateScene): string[] {
  const errs = validateVenue(s.venue);
  const seats = new Set(seatIds(s.venue));
  const who = [s.player.who, s.date.who, ...s.extras.map((e) => e.who)];
  for (const w of who) if (!PEOPLE[w]) errs.push(`${s.id}: unknown person ${w}`);
  errs.push(...validateCasting(s));
  if (!s.venue.spots[s.player.start]) errs.push(`${s.id}: player start spot ${s.player.start} missing`);
  if (!s.venue.spots[s.date.enterFrom]) errs.push(`${s.id}: date entrance ${s.date.enterFrom} missing`);
  const used = new Set<string>();
  for (const e of s.extras) {
    if ('seat' in e) {
      if (!seats.has(e.seat)) errs.push(`${s.id}: ${e.who} sits at unknown seat ${e.seat}`);
      if (used.has(e.seat)) errs.push(`${s.id}: two people at ${e.seat}`);
      used.add(e.seat);
    } else for (const spot of e.patrol) if (!s.venue.spots[spot]) errs.push(`${s.id}: ${e.who} patrols to unknown spot ${spot}`);
  }
  // the player needs at least one table where both places are free
  const free = s.venue.props.filter((p) => p.kind === 'table_for_two' && !used.has(`${p.id}.a`) && !used.has(`${p.id}.b`));
  if (!free.length) errs.push(`${s.id}: no free table for the date`);
  for (const [k, pool] of Object.entries(s.lines)) {
    if (!pool.length) errs.push(`${s.id}: no lines for ${k}`);
    for (const l of pool) {
      if (l.text.split(/\s+/).length > 25) errs.push(`${s.id}: line ${l.id} is over 25 words`);
      if (!/^[a-z0-9_]+$/.test(l.id)) errs.push(`${s.id}: bad voice id ${l.id}`);
    }
  }
  const ids = Object.values(s.lines).flat().map((l) => l.id);
  for (const id of ids) if (ids.indexOf(id) !== ids.lastIndexOf(id)) errs.push(`${s.id}: voice id ${id} used twice`);
  return [...new Set(errs)];
}
