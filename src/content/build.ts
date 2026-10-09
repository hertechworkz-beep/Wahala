import type { BrandInventory, Card, Character, CityContent, LessonRule, LocationSpec, RoastRule, Spot, TitleRule } from '../engine/types';

export interface RawCity {
  city: any;
  characters: Character[];
  cardFiles: Card[][];
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
    characters: raw.characters,
    cards: raw.cardFiles.flat(),
    spots: raw.spots,
    locations: raw.locations,
    brands: raw.brands,
    titles: raw.titles,
    lessons: raw.lessons,
    roasts: raw.roasts,
    rarity: raw.rarity ?? {},
    launch: raw.launch ?? {},
  };
}
