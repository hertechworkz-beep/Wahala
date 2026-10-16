import { describe, expect, it } from 'vitest';
import { firstDate } from '../src/three/scenes/firstDate';
import { seatIds, validateScene } from '../src/three/scenes/validate';
import { LIBRARIES, PEOPLE } from '../src/three/cast';
import { existsSync, readFileSync } from 'node:fs';

describe('3D content', () => {
  it('the first date scene is complete and consistent', () => {
    expect(validateScene(firstDate)).toEqual([]);
  });
  it('the restaurant has free tables and twelve places', () => {
    expect(seatIds(firstDate.venue)).toHaveLength(12);
  });
  it('the validator catches a broken scene', () => {
    const broken = { ...firstDate, extras: [{ who: 'nobody', seat: 't9.a' }, { who: 'waiter', patrol: ['moon'] }] };
    const errs = validateScene(broken as any);
    expect(errs.some((e) => e.includes('unknown person nobody'))).toBe(true);
    expect(errs.some((e) => e.includes('unknown seat t9.a'))).toBe(true);
    expect(errs.some((e) => e.includes('unknown spot moon'))).toBe(true);
  });
  it('every person and animation library has its files, and libraries have the clips scenes need', () => {
    for (const p of Object.values(PEOPLE)) {
      expect(existsSync(`public/${p.model}`), p.model).toBe(true);
      if (p.meta) expect(existsSync(`public/${p.meta}`), p.meta).toBe(true);
    }
    const needed = ['idle', 'walk', 'sit_down', 'sit_idle', 'stand_up', 'table_down', 'table_idle', 'table_up', 'drink_idle', 'drink', 'wave', 'talk'];
    for (const L of Object.values(LIBRARIES)) {
      const meta = JSON.parse(readFileSync(`public/${L.meta}`, 'utf8'));
      for (const c of needed) expect(meta[c], `${L.meta} ${c}`).toBeTruthy();
    }
    const chief = JSON.parse(readFileSync('public/models/chief.clips.json', 'utf8'));
    for (const c of needed) expect(chief[c], `chief ${c}`).toBeTruthy();
  });
});
