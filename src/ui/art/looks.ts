import type { PlayerSetup, PortraitLook } from '../../engine/types';

const SKINS = ['#5b3a26', '#6b4329', '#7a4e32', '#4a2e1e', '#8a5a3c', '#3f271a'];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** The player's own avatar, built from the three setup taps. */
export function playerLook(p: Pick<PlayerSetup, 'avatar' | 'name'>): PortraitLook {
  const a = p.avatar;
  const skin = a.skin ?? SKINS[hash(p.name || 'you') % SKINS.length];
  const hairMap: Record<string, Pick<PortraitLook, 'hair' | 'hairColor'>> = {
    '30-inch Bone Straight': { hair: 'frontal', hairColor: '#17100b' },
    'Knotless Braids': { hair: 'braids', hairColor: '#1a120c' },
    Natural: { hair: 'natural', hairColor: '#140d08' },
    'Natural / Low Cut': { hair: 'natural', hairColor: '#140d08' },
    'Coloured Frontal': { hair: 'frontal', hairColor: '#b5452a' },
    Locs: { hair: 'locs', hairColor: '#1e140c' },
    'Low Cut': { hair: 'low', hairColor: '#0f0a07' },
    Waves: { hair: 'waves', hairColor: '#0f0a07' },
    'Clean Bald': { hair: 'bald', hairColor: '#0f0a07' },
  };
  const styleMap: Record<string, Pick<PortraitLook, 'outfit' | 'outfitAccent' | 'outfitStyle'>> = {
    'Designer Glam': { outfit: '#121212', outfitAccent: '#e8c14a', outfitStyle: 'dress' },
    'Alté / Streetwear': { outfit: '#2d5bd7', outfitAccent: '#c6ff4a', outfitStyle: 'top' },
    'Smart Casual': { outfit: '#e9e4da', outfitAccent: '#1d2b3a', outfitStyle: 'shirt' },
    'Owambe Traditional': { outfit: '#7b2fa3', outfitAccent: '#f2c84b', outfitStyle: 'agbada' },
    'Designer Drip': { outfit: '#111111', outfitAccent: '#c9a86a', outfitStyle: 'jacket' },
    Agbada: { outfit: '#efe7d6', outfitAccent: '#b8862b', outfitStyle: 'agbada' },
    Senator: { outfit: '#1f4d3a', outfitAccent: '#e7d29a', outfitStyle: 'senator' },
    'Agbada / Senator': { outfit: '#1f4d3a', outfitAccent: '#e7d29a', outfitStyle: 'senator' },
  };
  const facialMap: Record<string, Pick<PortraitLook, 'beard' | 'beardStyle'>> = {
    'Clean Shaven': { beard: false },
    Stubble: { beard: true, beardStyle: 'stubble' },
    'Full Beard': { beard: true, beardStyle: 'full' },
    Goatee: { beard: true, beardStyle: 'goatee' },
  };
  const broad = ['Curvy / Thick', 'Soft and Full', 'Big Daddy', 'Gym Rat'].includes(a.build);
  const slim = ['Slim and Trim', 'Petite Baddie', 'Lean and Clean', 'Tall and Slim'].includes(a.build);
  const h = hairMap[a.hair] ?? hairMap['Low Cut'];
  return {
    skin,
    hair: h.hair,
    hairColor: h.hairColor,
    ...(a.facial ? facialMap[a.facial] ?? {} : a.hair === 'Beard Gang' ? { beard: true, beardStyle: 'full' as const } : {}),
    ...(styleMap[a.style] ?? styleMap['Smart Casual']),
    accessory: a.set === 'woman' ? 'earrings' : undefined,
    build: broad ? 'broad' : slim ? 'slim' : 'average',
  };
}

/** Background NPCs (bailiffs, waiters, Timi) get a stable look from their name. */
export function npcLook(name: string): { look: PortraitLook; feminine: boolean } {
  const h = hash(name);
  const feminine = /woman|wife|nkechi|chioma|bestie|mama|mercy|blessing|tiwa|amebo/i.test(name);
  const outfits: PortraitLook['outfitStyle'][] = feminine ? ['dress', 'top', 'agbada'] : ['shirt', 'jacket', 'kaftan'];
  const colours = ['#7b2fa3', '#0f766e', '#b45309', '#1d4ed8', '#be123c', '#334155'];
  return {
    feminine,
    look: {
      skin: SKINS[h % SKINS.length],
      hair: feminine ? (['frontal', 'braids', 'bun'] as const)[h % 3] : (['low', 'waves', 'bald'] as const)[h % 3],
      hairColor: '#140d08',
      outfit: colours[(h >>> 3) % colours.length],
      outfitAccent: '#f2c84b',
      outfitStyle: outfits[(h >>> 5) % outfits.length],
      beard: !feminine && h % 2 === 0,
      accessory: feminine ? 'earrings' : undefined,
      build: 'average',
    },
  };
}
