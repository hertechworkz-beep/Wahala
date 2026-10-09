import type { Character, PlayerSetup } from './types';

export function naira(n: number, opts: { sign?: boolean; short?: boolean } = {}): string {
  const sign = n < 0 ? '-' : opts.sign && n > 0 ? '+' : '';
  const abs = Math.abs(Math.round(n));
  if (opts.short && abs >= 1_000_000) return `${sign}₦${trim(abs / 1_000_000)}m`;
  if (opts.short && abs >= 1_000) return `${sign}₦${trim(abs / 1_000)}k`;
  return `${sign}₦${abs.toLocaleString('en-NG')}`;
}

function trim(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}

export interface TemplateCtx {
  character?: Character;
  player?: PlayerSetup;
  extra?: Record<string, string>;
}

/** Fills {partner}, {he}/{him}/{his} (+ capitalised), {name} and any extra keys. */
export function fill(text: string, ctx: TemplateCtx): string {
  const c = ctx.character;
  const map: Record<string, string> = {
    partner: c?.short ?? 'them',
    partner_full: c?.name ?? 'them',
    he: c?.pronouns.he ?? 'they',
    him: c?.pronouns.him ?? 'them',
    his: c?.pronouns.his ?? 'their',
    name: ctx.player?.name ?? 'you',
    ...ctx.extra,
  };
  return text.replace(/\{([A-Za-z_]+)\}/g, (m, key: string) => {
    const lower = key.toLowerCase();
    const v = map[key] ?? map[lower];
    if (v === undefined) return m;
    return key[0] === key[0].toUpperCase() && key[0] !== key[0].toLowerCase() ? cap(v) : v;
  });
}

export function cap(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}
