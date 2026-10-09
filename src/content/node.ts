import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCity } from './build';
import type { CityContent } from '../engine/types';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'data');
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));

export function loadCity(id = 'lagos', opts: { withGenerated?: boolean } = {}): CityContent {
  const dir = join(root, 'cities', id);
  const cardsDir = join(dir, 'cards');
  const cardFiles = readdirSync(cardsDir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => read(join(cardsDir, f)));
  const gen = opts.withGenerated !== false;
  const charDir = join(dir, 'characters');
  const characterFiles = existsSync(charDir)
    ? readdirSync(charDir)
        .filter((f) => f.endsWith('.json'))
        .sort()
        .map((f) => read(join(charDir, f)))
    : [];
  return buildCity({
    city: read(join(dir, 'city.json')),
    characters: read(join(dir, 'characters.json')),
    characterFiles,
    catalog: existsSync(join(dir, 'catalog.json')) ? read(join(dir, 'catalog.json')) : [],
    brand: existsSync(join(root, 'brand.json')) ? read(join(root, 'brand.json')) : undefined,
    cardFiles,
    spots: read(join(dir, 'spots.json')),
    locations: read(join(dir, 'locations.json')),
    brands: read(join(dir, 'brands.json')),
    titles: read(join(root, 'titles.json')),
    lessons: read(join(root, 'lessons.json')),
    roasts: read(join(root, 'roasts.json')),
    rarity: gen && existsSync(join(root, 'rarity.json')) ? read(join(root, 'rarity.json')) : {},
    launch: gen && existsSync(join(root, 'launch-gate.json')) ? read(join(root, 'launch-gate.json')) : {},
  });
}

export const DATA_ROOT = root;
