// The played first date: seeded, replayable, every branch reachable, and the Wife Escape is
// a fair game (always winnable, always losable) from every table with every tactic mix.
import { describe, expect, it } from 'vitest';
import { replay } from '../src/engine/engine';
import { activeScene, currentSceneStep, dressBudget, playSceneOption, sceneOptions, type EscapeOutcome, type Tactic } from '../src/engine/scene';
import { playOut } from '../src/engine/sim';
import type { RunState } from '../src/engine/types';
import { moveYou, moves, startEscape, tick, type EscapeGame } from '../src/ui/date/plan';
import { content, newRun, setup } from './helpers';

const scene = content.scenes.find((s) => s.id === 'chief_first_date')!;

function playScene(start: RunState, pickIdx: (n: number, step: number) => number): RunState {
  let s = start;
  for (let i = 0; i < 40 && activeScene(content, s); i++) {
    const opts = sceneOptions(scene, s);
    s = playSceneOption(content, scene, s, opts[pickIdx(opts.length, i)].id);
  }
  return s;
}

describe('first date scene', () => {
  it('is what Day 1 plays for Chief, and closes into the rest of the day', () => {
    const s = newRun(5);
    expect(activeScene(content, s)?.id).toBe('chief_first_date');
    const after = playScene(s, () => 0);
    expect(activeScene(content, after)).toBeUndefined();
    expect(after.history.some((h) => h.action === 'scene_end')).toBe(true);
    expect(after.stepIndex).toBe(1);
  });

  it('replays exactly from seed + history', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const s = playOut(content, newRun(seed, { vibe: (['lover', 'sugar', 'bigboy', 'runs', 'corporate'] as const)[seed % 5] }), { policy: 'random', spotChance: 0.3 });
      const again = replay(content, s.player, s.characterId, s.seed, s.history);
      expect(again).toEqual(s);
    }
  });

  it('every step offers options for every truth, and every moment is logged with a receipt', () => {
    for (const truth of ['serial_sponsor', 'broke', 'divorced']) {
      for (let k = 0; k < 6; k++) {
        const s = playScene(newRun(10 + k, {}, { truth }), (n, i) => (k * 7 + i * 3) % n);
        const logged = s.log.filter((e) => e.card.startsWith('scene:chief_first_date:'));
        expect(logged.length).toBeGreaterThanOrEqual(11);
        for (const e of logged) expect(e.receipt, e.card).toBeTruthy();
      }
    }
  });

  it('a woman and a man both get a wardrobe that fills the required slots', () => {
    for (const set of ['woman', 'man'] as const) {
      const s = newRun(3, { gender: set, avatar: { set, build: set === 'man' ? 'Big Daddy' : 'Curvy / Thick', hair: set === 'man' ? 'Waves' : 'Knotless Braids', style: 'Smart Casual' } });
      for (const o of sceneOptions(scene, s)) {
        const wear = o.events.find((e) => e.id === 'getting_ready.wear')!;
        expect(wear.meta?.outfit, o.id).toBeTruthy();
        expect(wear.meta?.shoes, o.id).toBeTruthy();
      }
    }
  });

  it('dressing up never spends your last ₦10k (no Day 1 Sapa from an outfit)', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const s = newRun(seed, { vibe: (['lover', 'sugar', 'bigboy', 'runs', 'corporate'] as const)[seed % 5] });
      for (const o of sceneOptions(scene, s)) {
        const spend = -(o.events.find((e) => e.id === 'getting_ready.wear')!.effects.wallet ?? 0);
        expect(spend).toBeLessThanOrEqual(dressBudget(s));
      }
    }
  });

  it('the anonymous photo only counts as a caught red flag if you zoomed in', () => {
    let s = newRun(9, {}, { truth: 'serial_sponsor' });
    while (currentSceneStep(scene, s)?.type !== 'photo') s = playSceneOption(content, scene, s, sceneOptions(scene, s)[0].id);
    const caught = s.redFlagsCaught;
    const zoomed = playSceneOption(content, scene, s, 'confront+zoom');
    const blind = playSceneOption(content, scene, s, 'confront');
    expect(zoomed.redFlagsCaught).toBe(caught + 1);
    expect(blind.redFlagsCaught).toBe(caught);
    expect(blind.redFlagsMissed).toBeGreaterThan(s.redFlagsMissed);
  });
});

// ---------------------------------------------------------------- Wife Escape fairness

/** Every outcome a player can force, moving at most twice between her steps. */
function reachable(seat: string, tactics: Tactic[]): Set<EscapeOutcome> {
  const out = new Set<EscapeOutcome>();
  const seen = new Set<string>();
  const key = (g: EscapeGame) => [g.you, g.wife, g.waiter, g.waiterStep, g.ticks, g.filmed, g.seen, g.search.join(',')].join('|');
  const stack: EscapeGame[] = [startEscape(seat, tactics)];
  while (stack.length) {
    const g = stack.pop()!;
    if (g.over) {
      out.add(g.over);
      continue;
    }
    if (seen.has(key(g))) continue;
    seen.add(key(g));
    const afterMoves: EscapeGame[] = [g];
    for (const a of moves(g)) {
      const g1 = moveYou(g, a);
      afterMoves.push(g1);
      if (!g1.over) for (const b of moves(g1)) afterMoves.push(moveYou(g1, b));
    }
    for (const m of afterMoves) stack.push(m.over ? m : tick(m));
  }
  return out;
}

describe('Wife Escape', () => {
  const combos: Tactic[][] = [['filming', 'waiter'], ['guard', 'waiter'], ['guard', 'filming']];
  for (const seat of ['window', 'booth', 'band'])
    for (const t of combos)
      it(`from the ${seat} with ${t.join(' + ')}: winnable and losable`, () => {
        const r = reachable(seat, t);
        expect(r.has('escaped') || r.has('outlasted') || r.has('filmed'), [...r].join(',')).toBe(true);
        expect(r.has('caught')).toBe(true);
        if (t.includes('waiter')) expect(r.has('worse')).toBe(true);
        if (t.includes('filming')) expect(r.has('filmed')).toBe(true);
      });

  it('she gives up eventually if you stay out of her way', () => {
    let any = false;
    for (const seat of ['window', 'booth', 'band']) for (const t of combos) if (reachable(seat, t).has('outlasted')) any = true;
    expect(any).toBe(true);
  });

  it('standing still in plain sight gets you caught', () => {
    let g = startEscape('window', ['guard', 'waiter']);
    for (let i = 0; i < 20 && !g.over; i++) g = tick(g);
    expect(g.over).toBe('caught');
  });
});

void setup;

describe('money text matches money moved', () => {
  it('a choice label shows the price you actually pay', async () => {
    const { reconcileMoney } = await import('../src/engine/engine');
    expect(reconcileMoney('Send ₦10k. Uber, not Uber Black.', 6000, { last: true })).toBe('Send ₦6k. Uber, not Uber Black.');
    expect(reconcileMoney('Spray ₦50 notes. Many of them. ₦5k.', 3000, { last: true })).toBe('Spray ₦50 notes. Many of them. ₦3k.');
    expect(reconcileMoney('Spray ₦50 notes. Many of them. ₦5k.', 3000)).toBe('Spray ₦50 notes. Many of them. ₦5k.');
  });
});
