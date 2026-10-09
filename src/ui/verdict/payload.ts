import type { Verdict } from '../../engine/verdict';
import type { EndingId, PlayerSetup } from '../../engine/types';

/** Everything a Verdict Card needs, small enough to live in a share URL. */
export interface CardData {
  v: 1;
  id: string;
  n: string;
  av: PlayerSetup['avatar'];
  vb: string;
  c: string;
  p: string;
  ar: string;
  d: number;
  e: EndingId;
  en: string;
  t: string;
  g: string;
  gw: boolean;
  gr: string;
  w: number;
  s: number;
  cl: number;
  rf: number;
  rs: number;
  go: boolean;
  h: string;
  l: string;
  ro: string;
  ra?: number;
  r: string[];
  nr: boolean;
}

export function toCard(v: Verdict): CardData {
  return {
    v: 1,
    id: v.runId,
    n: v.playerName,
    av: v.avatar,
    vb: v.vibeLabel,
    c: v.characterId,
    p: v.partnerName,
    ar: v.archetype,
    d: v.daysSurvived,
    e: v.ending,
    en: v.endingName,
    t: v.title,
    g: v.goalLabel,
    gw: v.goalWon,
    gr: v.goalReality,
    w: v.wallet,
    s: v.sanity,
    cl: v.clout,
    rf: v.redFlagsMissed,
    rs: v.redFlagsShown,
    go: v.goodOne,
    h: v.hiddenTruth,
    l: v.lesson,
    ro: v.roast,
    ra: v.rarityPct,
    r: v.receipts,
    nr: v.noRoast,
  };
}

export function encodeCard(c: CardData): string {
  const bytes = new TextEncoder().encode(JSON.stringify(c));
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeCard(s: string): CardData | null {
  try {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
    const c = JSON.parse(new TextDecoder().decode(bytes)) as CardData;
    return c && c.v === 1 && typeof c.t === 'string' ? c : null;
  } catch {
    return null;
  }
}

export function shareUrl(c: CardData): string {
  return `${location.origin}/v/${encodeCard(c)}`;
}
