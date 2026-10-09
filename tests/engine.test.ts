import { describe, expect, it } from 'vitest';
import { checkInstantEnding, choose, computeFinalEnding, contextTags, createRun, currentCard, eligibleCards, nextDay, replay, resolveBailout, resolveCard, resolveSpot, useClue, visitSpot, clone } from '../src/engine/engine';
import { playOut, simulate, POLICIES } from '../src/engine/sim';
import { validateCity } from '../src/engine/validate';
import { buildVerdict } from '../src/engine/verdict';
import { content, newRun, setup, VIBES } from './helpers';
import type { RunState } from '../src/engine/types';

describe('content validation (rules 6, 13, 16, 17, 22)', () => {
  const report = validateCity(content);
  it('has no validation errors', () => {
    const errors = report.issues.filter((i) => i.level === 'error');
    expect(errors).toEqual([]);
  });
  it('Chief passes the content matrix and launch gate', () => {
    expect(report.characters.chief_emeka.pass).toBe(true);
    expect(content.launch.chief_emeka?.pass).toBe(true);
  });
  it('shared deck meets its minimums', () => {
    expect(report.shared.pass).toBe(true);
  });
  it('characters without decks stay locked', () => {
    for (const ch of content.characters.filter((c) => c.id !== 'chief_emeka')) expect(content.launch[ch.id]?.pass).toBe(false);
  });
});

describe('determinism (rule 23)', () => {
  it('same seed + same choices gives the same run', () => {
    for (const seed of [1, 42, 9001, 123456]) {
      for (const policy of POLICIES) {
        const a = playOut(content, newRun(seed), { policy });
        const b = playOut(content, newRun(seed), { policy });
        expect(b).toEqual(a);
      }
    }
  });
  it('replaying the recorded history reproduces the run exactly', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const a = playOut(content, newRun(seed, { vibe: 'runs' }), { policy: POLICIES[seed % POLICIES.length], spotChance: 0.5, loanChance: 0.2, acceptBailout: seed % 2 === 0 });
      const b = replay(content, setup({ vibe: 'runs' }), 'chief_emeka', seed, a.history);
      expect(b).toEqual(a);
    }
  });
  it('different seeds give different stories', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) seen.add(newRun(seed).todaySteps[0].cardId + ':' + newRun(seed).truthId);
    expect(seen.size).toBeGreaterThan(3);
  });
});

describe('truth roll (rule 4)', () => {
  it('rolls ~25% Good One and splits the rest evenly', () => {
    const counts: Record<string, number> = {};
    const N = 4000;
    for (let i = 0; i < N; i++) {
      const s = newRun(i * 31 + 7);
      counts[s.truthId] = (counts[s.truthId] ?? 0) + 1;
    }
    expect(counts.divorced / N).toBeGreaterThan(0.22);
    expect(counts.divorced / N).toBeLessThan(0.28);
    expect(Math.abs(counts.serial_sponsor - counts.broke) / N).toBeLessThan(0.05);
  });
  it('Wildcard Spark is a separate ~1/6 roll that sets Chemistry high', () => {
    let sparks = 0;
    for (let i = 0; i < 3000; i++) {
      const s = newRun(i * 13 + 5, { avatar: { set: 'woman', build: 'Athletic', hair: 'Locs', style: 'Alté / Streetwear' } });
      if (s.spark) {
        sparks++;
        expect(s.meters.chemistry).toBeGreaterThanOrEqual(75);
      }
    }
    expect(sparks / 3000).toBeGreaterThan(0.13);
    expect(sparks / 3000).toBeLessThan(0.2);
  });
  it('avatar matching the hidden Taste adds Chemistry', () => {
    const match = newRun(5, { avatar: { set: 'woman', build: 'Curvy / Thick', hair: '30-inch Bone Straight', style: 'Smart Casual' } }, { spark: false });
    const none = newRun(5, { avatar: { set: 'woman', build: 'Athletic', hair: 'Locs', style: 'Alté / Streetwear' } }, { spark: false });
    expect(match.meters.chemistry).toBeGreaterThan(none.meters.chemistry);
  });
});

describe('run structure', () => {
  it('Day 1 is a First Date, Day 6 is the Confrontation for the rolled truth, Day 7 the Finale', () => {
    for (const truth of ['serial_sponsor', 'broke', 'divorced']) {
      for (let seed = 1; seed <= 15; seed++) {
        const s = playOut(content, newRun(seed, {}, { truth }), { policy: 'cautious' });
        const first = s.log.find((e) => e.slot !== 'spot' && e.slot !== 'system');
        expect(first?.slot).toBe('first_date');
        if ((s.endedDay ?? 0) >= 7) {
          const conf = s.log.filter((e) => e.slot === 'confrontation');
          expect(conf.length).toBe(1);
          expect(conf[0].day).toBe(6);
          expect(conf[0].card).toBe({ serial_sponsor: 'emeka_cf_sponsor', broke: 'emeka_cf_broke', divorced: 'emeka_cf_divorced' }[truth]);
        }
      }
    }
  });
  it('Days 2-5 shuffle the middle slots per run', () => {
    const orders = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) orders.add(newRun(seed).slotOrder.slice(1, 5).join(','));
    expect(orders.size).toBeGreaterThan(8);
  });
  it('at most 2 interrupts per run, only on Days 2-6', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const s = playOut(content, newRun(seed));
      const ints = s.log.filter((e) => e.slot === 'interrupt');
      expect(ints.length).toBeLessThanOrEqual(2);
      for (const e of ints) expect(e.day).toBeGreaterThanOrEqual(2);
    }
  });
  it('one city spot per day', () => {
    let s = newRun(3);
    s = visitSpot(content, s, 'bestie', 'vent').state;
    expect(() => visitSpot(content, s, 'bestie', 'vent')).toThrow();
  });
  it('vibe-only options only show for that vibe', () => {
    const runs = newRun(11, { vibe: 'runs' }, { slotOrder: undefined });
    const corp = newRun(11, { vibe: 'corporate' });
    const rcR = resolveCard(content, runs)!;
    const rcC = resolveCard(content, corp)!;
    expect(rcR.choices.every((c) => !c.vibeOnly || c.vibeOnly === 'runs')).toBe(true);
    expect(rcC.choices.every((c) => !c.vibeOnly || c.vibeOnly === 'corporate')).toBe(true);
  });
});

describe('Good Ones and context (rules 14, 19)', () => {
  it('cautious choices never lower Trust on any run', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const s = playOut(content, newRun(seed), { policy: POLICIES[seed % POLICIES.length] });
      for (const e of s.log) if (e.tags.includes('cautious') && e.slot !== 'spot') expect(e.deltas.trust ?? 0).toBeGreaterThanOrEqual(0);
    }
  });
  it('toxic choices on a Good One run drain Trust and never pay Clout', () => {
    let checked = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const s = playOut(content, newRun(seed, {}, { truth: 'divorced' }), { policy: 'toxic' });
      for (const e of s.log)
        if (e.tags.includes('toxic') && e.slot !== 'spot') {
          checked++;
          expect(e.deltas.clout ?? 0).toBeLessThanOrEqual(0);
          expect(e.deltas.trust ?? 0).toBeLessThan(0);
        }
    }
    expect(checked).toBeGreaterThan(20);
  });
  it('Bond at 0 on a Good One run routes to Fumbled It, never Ghosted', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const s = playOut(content, newRun(seed, {}, { truth: 'divorced' }), { policy: 'toxic' });
      expect(s.ending).not.toBe('ghosted');
    }
    for (let seed = 1; seed <= 400; seed++) {
      const s = playOut(content, newRun(seed, {}, { truth: 'broke' }), { policy: 'toxic' });
      expect(s.ending).not.toBe('fumbled');
    }
  });
  it('checking once after a real tell is cautious; again without evidence, or across a boundary, is toxic', () => {
    const s = newRun(1);
    s.evidenceSinceInvestigation = 1;
    expect(contextTags(s, ['investigate'])).toContain('cautious');
    s.evidenceSinceInvestigation = 0;
    expect(contextTags(s, ['investigate'])).toContain('toxic');
    s.evidenceSinceInvestigation = 2;
    s.flags.boundary_phone = { day: 1, knows: ['player', 'partner'] };
    expect(contextTags(s, ['investigate'])).toContain('toxic');
  });
});

describe('knowledge (rules 13, 18)', () => {
  it('world knowing is not the partner knowing', () => {
    const s = newRun(1);
    s.day = 4;
    s.flags.secret_leaked_rant = { day: 2, knows: ['player', 'world'] };
    expect(eligibleCards(content, s, 'payoff').map((c) => c.id)).not.toContain('emeka_po_leak_confront');
    s.flags.secret_leaked_rant.knows.push('partner');
    expect(eligibleCards(content, s, 'payoff').map((c) => c.id)).toContain('emeka_po_leak_confront');
  });
  it('every card where the partner reacts to a fact only appears once the partner knows it', () => {
    const reacting = content.cards.filter((c) => c.partner_reacts_to?.length);
    let hits = 0;
    for (let seed = 1; seed <= 1500; seed++) {
      const s = playOut(content, newRun(seed), { policy: POLICIES[seed % POLICIES.length], spotChance: 0.4 });
      for (const c of reacting)
        if (s.seenCards.includes(c.id)) {
          hits++;
          for (const f of c.partner_reacts_to!) expect(s.flags[f]?.knows).toContain('partner');
        }
    }
    expect(hits).toBeGreaterThan(10);
  });
});

describe('economy (rules 7, 22)', () => {
  it('costs scale with the vibe tier', () => {
    const sugar = newRun(1, { vibe: 'sugar' });
    const big = newRun(1, { vibe: 'bigboy' });
    const a = resolveSpot(content, sugar, 'clinic').find((o) => o.id === 'full_glow')!;
    const b = resolveSpot(content, big, 'clinic').find((o) => o.id === 'full_glow')!;
    expect(a.cost).toBeLessThan(b.cost);
  });
  it('unaffordable options are greyed with a reason, and the Loan App tracks Debt separately', () => {
    let s = newRun(1, { vibe: 'sugar' });
    s.meters.wallet = 1000;
    const opt = resolveSpot(content, s, 'clinic').find((o) => o.id === 'full_glow')!;
    expect(opt.available).toBe(false);
    expect(opt.reason).toBeTruthy();
    expect(() => visitSpot(content, s, 'clinic', 'full_glow')).toThrow();
    const r = visitSpot(content, s, 'clinic', 'full_glow', { loan: true });
    s = r.state;
    expect(s.meters.debt).toBeGreaterThan(0);
    expect(s.flags.loan_taken).toBeTruthy();
    expect(s.money.borrowed).toBeGreaterThan(0);
  });
  it('a loan comes back as debt collectors on a later day', () => {
    let found = false;
    for (let seed = 1; seed <= 300 && !found; seed++) {
      const s = playOut(content, newRun(seed, { vibe: 'sugar' }), { policy: 'random', loanChance: 0.5 });
      if (s.flags.loan_taken && (s.endedDay ?? 0) > s.flags.loan_taken.day + 1) {
        expect(s.seenCards).toContain('shared_po_debt_collectors');
        found = true;
      }
    }
    expect(found).toBe(true);
  });
  it('every vibe can reach Day 7', () => {
    for (const vibe of VIBES) {
      const st = simulate(content, 'chief_emeka', 200, { vibe, seedBase: 5 });
      expect(st.reachedDay7).toBeGreaterThan(0);
    }
  });
  it('every resolved card offers at least one affordable choice even at ₦0', () => {
    for (let seed = 1; seed <= 300; seed++) {
      let s = newRun(seed, { vibe: 'sugar' });
      for (let i = 0; i < 40 && s.status !== 'ended'; i++) {
        if (s.status === 'bailout') {
          s = resolveBailout(content, s, false);
          continue;
        }
        if (s.status === 'day_end') {
          s = nextDay(content, s).state;
          continue;
        }
        const broke = clone(s);
        broke.meters.wallet = 0;
        const rc = resolveCard(content, broke)!;
        expect(rc.choices.some((c) => c.available)).toBe(true);
        const pickFrom = resolveCard(content, s)!.choices.filter((c) => c.available);
        s = choose(content, s, pickFrom[(seed + i) % pickFrom.length].id).state;
      }
    }
  });
});

describe('bail-out (server-granted only)', () => {
  function toSapa(): RunState {
    for (let seed = 1; seed < 2000; seed++) {
      const s = playOut(content, newRun(seed, { vibe: 'sugar' }), { policy: 'clingy' });
      if (s.ending === 'sapa') {
        // Rebuild the same run, stopping at the bail-out offer.
        let r = newRun(seed, { vibe: 'sugar' });
        r = replay(content, setup({ vibe: 'sugar' }), 'chief_emeka', seed, s.history.filter((h) => h.action !== 'decline_bailout'));
        if (r.status === 'bailout') return r;
      }
    }
    throw new Error('no sapa found');
  }
  it('offers a bail-out at zero, restores to 25 when granted, and only once per run', () => {
    const s = toSapa();
    expect(s.pendingEnding).toBe('sapa');
    const declined = resolveBailout(content, s, false);
    expect(declined.ending).toBe('sapa');
    const saved = resolveBailout(content, s, true);
    expect(saved.bailoutUsed).toBe(true);
    expect(saved.meters.wallet).toBeGreaterThanOrEqual(25_000);
    expect(saved.status === 'ended' ? saved.ending : saved.status).not.toBe('bailout');
  });
});

describe('control and agency (rules 16, 21)', () => {
  it('max Attachment alone never forces Obsession', () => {
    const s = newRun(1, {}, { truth: 'serial_sponsor' });
    s.meters.attachment = 100;
    s.stays = 0;
    expect(computeFinalEnding(content, s)).not.toBe('obsession');
    s.stays = 2;
    expect(computeFinalEnding(content, s)).toBe('obsession');
    expect(checkInstantEnding(s)).toBeUndefined();
  });
  it('players who never choose to stay never get Obsession', () => {
    for (let seed = 1; seed <= 600; seed++) {
      const s = playOut(content, newRun(seed), { policy: 'cautious' });
      if (s.stays === 0) expect(s.ending).not.toBe('obsession');
    }
  });
  it('every escalation card offers at least two real exits', () => {
    const s = newRun(1, {}, { truth: 'serial_sponsor' });
    for (const card of content.cards.filter((c) => c.slot === 'escalation')) {
      const t = clone(s);
      t.day = 4;
      t.todaySteps = [{ kind: 'escalation', slot: 'escalation', cardId: card.id }];
      t.stepIndex = 0;
      t.status = 'card';
      const rc = resolveCard(content, t)!;
      expect(rc.choices.filter((c) => c.tags.includes('exit') && c.available).length).toBeGreaterThanOrEqual(2);
    }
  });
  it('escalation never appears on a Good One run', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const s = playOut(content, newRun(seed, {}, { truth: 'divorced' }), { policy: 'stayer' });
      expect(s.log.some((e) => e.slot === 'escalation')).toBe(false);
    }
  });
});

describe('Clue Pass', () => {
  it('reveals a tell hint, never the hidden truth, max 2 per run, from Day 2', () => {
    let s = newRun(9, {}, { truth: 'broke' });
    expect(() => useClue(content, s)).toThrow();
    s.day = 2;
    const a = useClue(content, s);
    const b = useClue(content, a.state);
    const reveal = content.characters[0].truths.find((t) => t.id === 'broke')!.reveal;
    expect(a.hint).not.toContain(reveal);
    expect(a.hint.startsWith('Amebo says:')).toBe(true);
    expect(() => useClue(content, b.state)).toThrow();
  });
});

describe('Verdict and Receipts (rules 9, 15, 20)', () => {
  it('every receipt line is built from a logged event of that run', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const s = playOut(content, newRun(seed, { vibe: VIBES[seed % 5] }), { policy: POLICIES[seed % POLICIES.length], spotChance: 0.4 });
      const v = buildVerdict(content, s);
      expect(v.receipts.length).toBeGreaterThanOrEqual(Math.min(4, s.log.filter((e) => e.slot !== 'system').length));
      expect(v.receipts.length).toBeLessThanOrEqual(5);
      for (const line of v.receipts) {
        const day = Number(line.match(/^Day (\d+):/)![1]);
        const evs = s.log.filter((e) => e.day === day);
        expect(evs.length).toBeGreaterThan(0);
        if (line.includes('The dice said no.')) expect(evs.some((e) => e.rolled && e.bad)).toBe(true);
        if (line.includes('Red flag missed.')) expect(evs.some((e) => e.missedTell)).toBe(true);
        const cost = line.match(/It cost you ₦([\d,]+)\./);
        if (cost) expect(evs.some((e) => -(e.deltas.wallet ?? 0) === Number(cost[1].replace(/,/g, '')))).toBe(true);
      }
    }
  });
  it('the Obsession card never roasts the player', () => {
    const s = newRun(1, {}, { truth: 'serial_sponsor' });
    s.status = 'ended';
    s.ending = 'obsession';
    s.endedDay = 7;
    const v = buildVerdict(content, s);
    expect(v.title).toBe("This one isn't funny.");
    expect(v.noRoast).toBe(true);
    expect(v.roast).toContain("Control isn't love");
  });
  it('builds a card for every ending with title, lesson and the hidden truth', () => {
    for (const e of ['locked_in', 'counter_con', 'survived', 'scandal', 'sapa', 'breakdown', 'ghosted', 'fumbled', 'obsession', 'walked_away'] as const) {
      const s = newRun(3);
      s.status = 'ended';
      s.ending = e;
      s.endedDay = 5;
      const v = buildVerdict(content, s);
      expect(v.title.length).toBeGreaterThan(3);
      expect(v.lesson.length).toBeGreaterThan(10);
      expect(v.hiddenTruth).toMatch(/^HIDDEN TRUTH/);
    }
  });
});

describe('first card', () => {
  it('starts on a playable card', () => {
    const s = createRun(content, setup(), 'chief_emeka', 77);
    expect(s.status).toBe('card');
    expect(currentCard(content, s)?.slot).toBe('first_date');
  });
});
