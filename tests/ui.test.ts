import { describe, expect, it } from 'vitest';
import { npcLook, playerLook } from '../src/ui/art/looks';
import { decodeCard, encodeCard, toCard } from '../src/ui/verdict/payload';
import { buildVerdict } from '../src/engine/verdict';
import { playOut } from '../src/engine/sim';
import { content, newRun } from './helpers';

const HEX = /^#[0-9a-f]{6}$/i;

describe('UI data helpers', () => {
  it('every NPC in the content gets a complete look', () => {
    const names = new Set<string>(['Unknown', 'Bestie']);
    for (const c of content.cards) {
      if (c.scene.npc) names.add(c.scene.npc.name);
      for (const b of c.beats) names.add(b.who);
    }
    for (const n of names) {
      const { look } = npcLook(n);
      expect(look.skin, n).toMatch(HEX);
      expect(look.outfit, n).toMatch(HEX);
      expect(look.outfitStyle, n).toBeTruthy();
      expect(look.hair, n).toBeTruthy();
    }
  });
  it('every avatar combination maps to a complete look', () => {
    for (const set of ['woman', 'man'] as const)
      for (const build of content.avatar.build[set])
        for (const hair of content.avatar.hair[set])
          for (const style of content.avatar.style[set]) {
            const l = playerLook({ name: 'Ada', avatar: { set, build, hair, style } });
            expect(l.skin).toMatch(HEX);
            expect(l.outfit).toMatch(HEX);
          }
  });
  it('NPC scene looks reference real characters', () => {
    for (const c of content.cards) if (c.scene.npc?.look) expect(content.characters.some((x) => x.id === c.scene.npc!.look)).toBe(true);
  });
  it('share payload round-trips, including naira signs and pidgin', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = playOut(content, newRun(seed));
      const card = toCard(buildVerdict(content, s));
      const back = decodeCard(encodeCard(card));
      expect(back).toEqual(card);
      expect(encodeCard(card).length).toBeLessThan(4000);
    }
    expect(decodeCard('garbage!!')).toBeNull();
  });
});
