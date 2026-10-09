// The restaurant floor as a graph, and the Wife Escape rules on it. Pure: the UI animates it,
// the tests play it.
import type { EscapeOutcome, Tactic } from '../../engine/scene';

export const NODES = {
  window: { x: 92, y: 92, label: 'Window table' },
  booth: { x: 292, y: 96, label: 'Corner booth' },
  restroom: { x: 34, y: 196, label: 'Restroom', hide: true },
  centre: { x: 180, y: 196, label: 'Centre' },
  plant: { x: 330, y: 214, label: 'Big plant', hide: true },
  bar: { x: 70, y: 304, label: 'Behind the bar', hide: true },
  band: { x: 282, y: 300, label: 'Sax corner' },
  aisle: { x: 176, y: 352, label: 'Aisle' },
  entrance: { x: 150, y: 430, label: 'Entrance' },
  kitchen: { x: 336, y: 412, label: 'Kitchen door', exit: true },
} as const;

export type NodeId = keyof typeof NODES;

export const EDGES: [NodeId, NodeId][] = [
  ['window', 'centre'],
  ['window', 'restroom'],
  ['booth', 'centre'],
  ['booth', 'plant'],
  ['centre', 'bar'],
  ['centre', 'plant'],
  ['centre', 'aisle'],
  ['restroom', 'bar'],
  ['bar', 'aisle'],
  ['plant', 'band'],
  ['band', 'aisle'],
  ['band', 'kitchen'],
  ['aisle', 'entrance'],
  ['aisle', 'kitchen'],
];

export function neighbours(n: NodeId): NodeId[] {
  return EDGES.filter((e) => e.includes(n)).map((e) => (e[0] === n ? e[1] : e[0]));
}

/** Shortest path (BFS), avoiding `blocked`. Returns the nodes after `from`, ending at `to`. */
export function path(from: NodeId, to: NodeId, blocked: NodeId[] = []): NodeId[] {
  const prev = new Map<NodeId, NodeId | null>([[from, null]]);
  const q: NodeId[] = [from];
  while (q.length) {
    const n = q.shift()!;
    if (n === to) break;
    for (const m of neighbours(n)) {
      if (prev.has(m) || (blocked.includes(m) && m !== to)) continue;
      prev.set(m, n);
      q.push(m);
    }
  }
  if (!prev.has(to)) return [];
  const out: NodeId[] = [];
  for (let n: NodeId | null = to; n && n !== from; n = prev.get(n) ?? null) out.unshift(n);
  return out;
}

export const SEAT_NODE: Record<string, NodeId> = { window: 'window', booth: 'booth', band: 'band' };
const WAITER_ROUTE: NodeId[] = ['kitchen', 'band', 'plant', 'centre', 'aisle', 'band'];
export const GUARD_AT: NodeId = 'aisle';
export const FRIEND_AT: NodeId = 'centre';
export const GIVE_UP_TICKS = 14;
export const TICK_MS = 1250;
export const MOVE_MS = 600;

export interface EscapeGame {
  seat: NodeId;
  you: NodeId;
  wife: NodeId;
  waiter?: NodeId;
  waiterStep: number;
  guard?: NodeId;
  friend?: NodeId;
  filmed: boolean;
  ticks: number;
  search: NodeId[];
  over?: EscapeOutcome;
  seen: boolean;
}

export const isHide = (n: NodeId) => !!(NODES[n] as { hide?: boolean }).hide;

export function startEscape(seat: string, tactics: Tactic[]): EscapeGame {
  const s = SEAT_NODE[seat] ?? 'window';
  return {
    seat: s,
    you: s,
    wife: 'entrance',
    waiter: tactics.includes('waiter') ? 'kitchen' : undefined,
    waiterStep: 0,
    guard: tactics.includes('guard') ? GUARD_AT : undefined,
    friend: tactics.includes('filming') ? FRIEND_AT : undefined,
    filmed: false,
    ticks: 0,
    search: [s, 'centre', 'restroom', 'plant', 'bar', 'band', 'window', 'booth'].filter((n, i, a) => a.indexOf(n as NodeId) === i) as NodeId[],
    seen: false,
  };
}

/** Where the player may move next. */
export function moves(g: EscapeGame): NodeId[] {
  if (g.over) return [];
  return neighbours(g.you).filter((n) => n !== g.guard && n !== 'entrance');
}

export function moveYou(prev: EscapeGame, to: NodeId): EscapeGame {
  const g = { ...prev };
  if (g.over || !moves(g).includes(to)) return g;
  g.you = to;
  if (to === g.friend) g.filmed = true;
  if (to === g.wife) g.over = 'caught';
  else if (to === g.waiter) g.over = 'worse';
  else if (to === 'kitchen') g.over = g.filmed ? 'filmed' : 'escaped';
  return g;
}

/** One beat of the world: she searches (or chases if she can see you), the waiter walks. */
export function tick(prev: EscapeGame): EscapeGame {
  const g = { ...prev, search: [...prev.search] };
  if (g.over) return g;
  g.ticks++;
  const hidden = isHide(g.you);
  const sees = !hidden && (g.wife === g.you || neighbours(g.wife).includes(g.you) || g.seen);
  if (sees) g.seen = true;
  let target: NodeId;
  if (g.seen && !hidden) target = g.you;
  else {
    g.seen = false;
    while (g.search.length && g.search[0] === g.wife) g.search.shift();
    target = g.search[0] ?? g.seat;
  }
  const step = path(g.wife, target)[0];
  if (step) g.wife = step;
  if (g.wife === g.you) {
    g.over = 'caught';
    return g;
  }
  if (g.waiter) {
    g.waiterStep = (g.waiterStep + 1) % WAITER_ROUTE.length;
    g.waiter = WAITER_ROUTE[g.waiterStep];
    if (g.waiter === g.you && !hidden) {
      g.over = 'worse';
      return g;
    }
  }
  if (g.ticks >= GIVE_UP_TICKS) g.over = 'outlasted';
  return g;
}
