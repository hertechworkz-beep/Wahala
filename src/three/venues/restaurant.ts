import type { VenueConfig } from '../venue';

// A high-end Victoria Island restaurant for first dates. Pure configuration.
export const restaurant: VenueConfig = {
  id: 'vi_restaurant',
  name: 'Ìtàn, Victoria Island',
  room: { width: 11, depth: 10, height: 3.2, floor: 'marble', wall: '#3b2219', trim: '#c9a24a' },
  mood: { background: '#0e0907', ambient: 0.5, key: { color: '#ffd9b0', intensity: 1.6, at: [2, 6, 4] }, exposure: 1.05 },
  ambience: ['crowd'],
  props: [
    { kind: 'table_for_two', id: 't1', at: [-3.2, -2.6] },
    { kind: 'table_for_two', id: 't2', at: [0, -2.9] },
    { kind: 'table_for_two', id: 't3', at: [3.2, -2.6] },
    { kind: 'table_for_two', id: 't4', at: [-3.2, 0.6] },
    { kind: 'table_for_two', id: 't5', at: [0.2, 0.2] },
    { kind: 'table_for_two', id: 't6', at: [3.4, 0.9] },
    { kind: 'bar', at: [-3.6, -4.45], length: 3.4, stools: 0 },
    { kind: 'plant', at: [-5.0, 4.2], height: 1.7 },
    { kind: 'plant', at: [5.0, 4.2], height: 1.6 },
    { kind: 'plant', at: [5.0, -4.5], height: 1.5 },
    { kind: 'pendant', at: [-3.2, -2.6] },
    { kind: 'pendant', at: [0, -2.9], light: true },
    { kind: 'pendant', at: [3.2, -2.6] },
    { kind: 'pendant', at: [-3.2, 0.6], light: true },
    { kind: 'pendant', at: [0.2, 0.2], light: true },
    { kind: 'pendant', at: [3.4, 0.9], light: true },
    { kind: 'door', id: 'kitchen_door', at: [2.6, -4.97] },
    { kind: 'rug', at: [0, 3.6], size: [3, 1.6] },
  ],
  spots: {
    entrance: [0, 4.4],
    host_stand: [1.4, 3.6],
    kitchen: [2.6, -4.3],
    bar: [-3.6, -3.7],
  },
};
