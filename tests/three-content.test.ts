import { describe, expect, it } from 'vitest';
import { firstDate } from '../src/three/scenes/firstDate';
import { seatIds, validateCast, validateScene } from '../src/three/scenes/validate';
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
  it('casting follows Part 29: Lagos story roles and players are Black African, expats only in the background', () => {
    expect(validateCast()).toEqual([]);
    for (const p of Object.values(PEOPLE)) if (p.role !== 'background_expat') expect(p.heritage, p.name).toBe('black_african');
    PEOPLE.__test_expat = { ...PEOPLE.diner_m1, heritage: 'non_african', role: 'background_expat' };
    PEOPLE.__test_lead = { ...PEOPLE.diner_m1, heritage: 'non_african', role: 'npc' };
    try {
      const asDate = validateScene({ ...firstDate, date: { ...firstDate.date, who: '__test_lead' } });
      expect(asDate.some((e) => e.includes('must be Black African'))).toBe(true);
      const asNpc = validateScene({ ...firstDate, extras: [...firstDate.extras, { who: '__test_lead', seat: 't3.a' }] });
      expect(asNpc.some((e) => e.includes('only be cast as a background expat'))).toBe(true);
      const fewExpats = validateScene({ ...firstDate, extras: [...firstDate.extras, { who: '__test_expat', seat: 't3.a' }] });
      expect(fewExpats).toEqual([]);
      const tooMany = validateScene({ ...firstDate, extras: [...firstDate.extras, ...['t2.a', 't2.b', 't3.a'].map((seat) => ({ who: '__test_expat', seat }))] });
      expect(tooMany.some((e) => e.includes('a small share is at most'))).toBe(true);
    } finally {
      delete PEOPLE.__test_expat;
      delete PEOPLE.__test_lead;
    }
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
