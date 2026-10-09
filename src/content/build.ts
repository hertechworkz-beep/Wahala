import type { BrandInfo, BrandInventory, Card, CatalogItem, Character, CityContent, LessonRule, LocationSpec, RoastRule, Spot, TitleRule } from '../engine/types';

export interface RawCity {
  city: any;
  characters: Character[];
  /** data/cities/<city>/characters/<id>.json: per-character additions (cold open, endings, overrides). */
  characterFiles?: (Partial<Character> & { id: string })[];
  cardFiles: Card[][];
  catalog?: CatalogItem[];
  brand?: BrandInfo;
  spots: Spot[];
  locations: LocationSpec[];
  brands: BrandInventory;
  titles: TitleRule[];
  lessons: LessonRule[];
  roasts: RoastRule[];
  rarity?: CityContent['rarity'];
  launch?: CityContent['launch'];
}

/** Assembles a city from its JSON files. New characters and cards drop in as files. */
export function buildCity(raw: RawCity): CityContent {
  return {
    id: raw.city.id,
    name: raw.city.name,
    season: raw.city.season,
    vibes: raw.city.vibes,
    goals: raw.city.goals,
    avatar: raw.city.avatar,
    gossip: raw.city.gossip,
    characters: mergeCharacters(raw.characters, raw.characterFiles ?? []),
    cards: raw.cardFiles.flat(),
    spots: raw.spots,
    locations: raw.locations,
    brands: raw.brands,
    titles: raw.titles,
    lessons: raw.lessons,
    roasts: raw.roasts,
    rarity: raw.rarity ?? {},
    launch: raw.launch ?? {},
    catalog: raw.catalog ?? [],
    brand: raw.brand ?? { name: 'Wahala', edition: 'Lagos', social: [] },
  };
}

function mergeCharacters(base: Character[], ext: (Partial<Character> & { id: string })[]): Character[] {
  const out = base.map((c) => ({ ...c }));
  for (const e of ext) {
    const i = out.findIndex((c) => c.id === e.id);
    if (i < 0) {
      out.push(e as Character);
      continue;
    }
    const merged = { ...out[i], ...e } as Character;
    merged.endings = { ...out[i].endings, ...(e.endings ?? {}) };
    out[i] = merged;
  }
  return out;
}
