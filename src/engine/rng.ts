// Seeded RNG (mulberry32). The whole run state carries `rng`, so replaying the
// same seed with the same choices gives the same run (rule 23).

export interface HasRng {
  rng: number;
}

export function nextRand(s: HasRng): number {
  let t = (s.rng = (s.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randInt(s: HasRng, n: number): number {
  return Math.floor(nextRand(s) * n);
}

export function pick<T>(s: HasRng, arr: readonly T[]): T {
  return arr[randInt(s, arr.length)];
}

export function pickWeighted<T>(s: HasRng, arr: readonly T[], weight: (t: T) => number): T {
  const total = arr.reduce((a, t) => a + weight(t), 0);
  let r = nextRand(s) * total;
  for (const t of arr) {
    r -= weight(t);
    if (r < 0) return t;
  }
  return arr[arr.length - 1];
}

export function shuffle<T>(s: HasRng, arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(s, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** A stateless hash for picks that must not disturb the run's RNG stream (titles, lessons). */
export function hashPick<T>(seed: number, salt: string, arr: readonly T[]): T {
  let h = seed ^ 0x9e3779b9;
  for (let i = 0; i < salt.length; i++) h = Math.imul(h ^ salt.charCodeAt(i), 0x01000193);
  h ^= h >>> 13;
  return arr[(h >>> 0) % arr.length];
}

export function newSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}
