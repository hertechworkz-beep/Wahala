import { buildCity } from './build';
import type { Card, CityContent } from '../engine/types';
import city from '../../data/cities/lagos/city.json';
import characters from '../../data/cities/lagos/characters.json';
import spots from '../../data/cities/lagos/spots.json';
import locations from '../../data/cities/lagos/locations.json';
import brands from '../../data/cities/lagos/brands.json';
import titles from '../../data/titles.json';
import lessons from '../../data/lessons.json';
import roasts from '../../data/roasts.json';
import rarity from '../../data/rarity.json';
import launch from '../../data/launch-gate.json';
import catalog from '../../data/cities/lagos/catalog.json';
import brand from '../../data/brand.json';

// Every card file in the city's cards folder is picked up automatically.
const characterModules = import.meta.glob('../../data/cities/lagos/characters/*.json', { eager: true, import: 'default' }) as Record<string, any>;
const sceneModules = import.meta.glob('../../data/cities/lagos/scenes/*.json', { eager: true, import: 'default' }) as Record<string, any>;
const cardModules = import.meta.glob('../../data/cities/lagos/cards/*.json', { eager: true, import: 'default' }) as Record<string, Card[]>;

export const lagos: CityContent = buildCity({
  city,
  characters: characters as any,
  characterFiles: Object.keys(characterModules).sort().map((k) => characterModules[k]),
  catalog: catalog as any,
  brand: brand as any,
  scenes: Object.keys(sceneModules).sort().map((k) => sceneModules[k]),
  cardFiles: Object.values(cardModules),
  spots: spots as any,
  locations: locations as any,
  brands: brands as any,
  titles: titles as any,
  lessons: lessons as any,
  roasts: roasts as any,
  rarity: rarity as any,
  launch: launch as any,
});
