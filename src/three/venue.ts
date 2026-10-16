import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import * as P from './props';
import type { SitStyle } from './character';

// A venue is configuration: the room, its lights, its furniture and the things in it that people
// can use. `buildVenue` turns the config into a scene, a list of seats and named spots, and the
// obstacles the navigation mesh walks round. New places are new configs, not new code.

export type Vec2 = [number, number];
export type PropSpec =
  | { kind: 'table_for_two'; id: string; at: Vec2; rot?: number; cloth?: string }
  | { kind: 'armchair'; id: string; at: Vec2; rot?: number }
  | { kind: 'bar'; at: Vec2; rot?: number; length?: number; stools?: number }
  | { kind: 'plant'; at: Vec2; height?: number }
  | { kind: 'pendant'; at: Vec2; light?: boolean }
  | { kind: 'door'; id: string; at: Vec2; rot?: number }
  | { kind: 'rug'; at: Vec2; size: Vec2; rot?: number }
  | { kind: 'speaker'; id: string; at: Vec2; rot?: number };

export interface VenueConfig {
  id: string;
  name: string;
  room: { width: number; depth: number; height: number; floor: 'wood' | 'marble'; wall: string; trim?: string };
  mood: { background: string; ambient: number; key: { color: string; intensity: number; at: [number, number, number] }; exposure?: number };
  ambience: string[]; // sound loops from ui/audio
  props: PropSpec[];
  spots: Record<string, Vec2>; // named places: entrance, kitchen, bar...
}

export interface Seat {
  id: string; // e.g. "t2.a"
  table?: string;
  chair: THREE.Object3D;
  point: THREE.Vector3; // cushion top, world
  facing: number;
  style: SitStyle;
  taken: string | null; // who sits here
  across?: string; // the seat opposite
  place: THREE.Vector3; // where this seat's glass goes (world)
  bagSpot: THREE.Vector3; // where a bag can rest on the table (world)
}

export interface BuiltVenue {
  group: THREE.Group;
  floor: THREE.Mesh[];
  obstacles: THREE.Object3D[];
  seats: Record<string, Seat>;
  tables: Record<string, THREE.Object3D>;
  things: Record<string, THREE.Object3D>; // doors, speakers...
  spots: Record<string, THREE.Vector3>;
  tick(t: number): void;
}

function marbleFloor(w: number, d: number) {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const g = c.getContext('2d')!;
  const rnd = P.mulberry(3);
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      const tone = 214 + rnd() * 14;
      g.fillStyle = (i + j) % 2 ? `rgb(${tone},${tone - 6},${tone - 14})` : `rgb(${tone - 22},${tone - 30},${tone - 40})`;
      g.fillRect(i * 256, j * 256, 256, 256);
      g.strokeStyle = 'rgba(255,255,255,0.08)';
      for (let k = 0; k < 6; k++) {
        g.beginPath();
        g.moveTo(i * 256 + rnd() * 256, j * 256);
        g.bezierCurveTo(i * 256 + rnd() * 256, j * 256 + 80, i * 256 + rnd() * 256, j * 256 + 170, i * 256 + rnd() * 256, j * 256 + 256);
        g.stroke();
      }
      g.fillStyle = 'rgba(176,138,60,0.9)';
      g.fillRect(i * 256, j * 256, 256, 3);
      g.fillRect(i * 256, j * 256, 3, 256);
    }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(w / 2.4, d / 2.4);
  t.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: t, roughness: 0.18, metalness: 0.05 }));
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  m.name = 'floor';
  return m;
}

/** An invisible box that catches taps (fingers are bigger than chair legs). */
export function touchTarget(w: number, h: number, d: number) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
  m.position.y = h / 2;
  m.name = 'touch';
  return m;
}

export function buildVenue(cfg: VenueConfig, opts: { seatTop: number; lite?: boolean }): BuiltVenue {
  const group = new THREE.Group();
  group.name = cfg.id;
  const { width: W, depth: D, height: H } = cfg.room;
  const floor = cfg.room.floor === 'marble' ? marbleFloor(W, D) : P.woodFloor(Math.max(W, D));
  group.add(floor);
  const obstacles: THREE.Object3D[] = [];
  const seats: Record<string, Seat> = {};
  const tables: Record<string, THREE.Object3D> = {};
  const things: Record<string, THREE.Object3D> = {};
  const ticks: ((t: number) => void)[] = [];

  // Walls with a dado rail and panelling; the wall nearest the camera is left open.
  const wallMat = new THREE.MeshStandardMaterial({ color: cfg.room.wall, roughness: 0.85 });
  const trimMat = new THREE.MeshStandardMaterial({ color: cfg.room.trim ?? '#c9a24a', roughness: 0.3, metalness: 0.8 });
  const walls: [number, number, number, number][] = [
    [0, -D / 2, W, 0],
    [-W / 2, 0, D, Math.PI / 2],
    [W / 2, 0, D, -Math.PI / 2],
  ];
  for (const [x, z, len, rot] of walls) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(len, H), wallMat);
    w.position.set(x, H / 2, z);
    w.rotation.y = rot;
    w.receiveShadow = true;
    group.add(w);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.04, 0.03), trimMat);
    rail.position.set(x, 1.0, z);
    rail.rotation.y = rot;
    rail.translateZ(0.015);
    group.add(rail);
    for (let s = -len / 2 + 0.9; s < len / 2 - 0.5; s += 1.4) {
      const panel = new THREE.Mesh(new RoundedBoxGeometry(1.1, 0.75, 0.02, 1, 0.01), new THREE.MeshStandardMaterial({ color: cfg.room.wall, roughness: 0.7 }));
      panel.position.set(x, 0.5, z);
      panel.rotation.y = rot;
      panel.translateX(s);
      panel.translateZ(0.012);
      group.add(panel);
    }
    const wallBlock = new THREE.Object3D();
    wallBlock.position.set(x, 0, z);
    wallBlock.rotation.y = rot;
    const blocker = new THREE.Mesh(new THREE.BoxGeometry(len, 0.1, 0.1));
    blocker.visible = false;
    wallBlock.add(blocker);
    group.add(wallBlock);
    obstacles.push(blocker);
  }
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ color: '#160e0b', roughness: 1 }));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = H;
  group.add(ceiling);

  const place = (o: THREE.Object3D, at: Vec2, rot = 0) => {
    o.position.set(at[0], 0, at[1]);
    o.rotation.y = rot;
    group.add(o);
    return o;
  };

  for (const p of cfg.props) {
    switch (p.kind) {
      case 'table_for_two': {
        const t = place(P.roundTable(), p.at, p.rot ?? 0);
        t.name = p.id;
        tables[p.id] = t;
        obstacles.push(t.children[0]); // the cloth: chairs are obstacles of their own
        const top = t.userData.topY as number;
        const c = P.candle(false); // a light per candle is too much for phones; pendants light the tables
        c.position.set(0, top, 0);
        t.add(c);
        ticks.push(c.userData.tick);
        // two places facing each other along the table's local X axis
        for (const [side, sx] of [['a', -1], ['b', 1]] as const) {
          const chair = P.diningChair(opts.seatTop);
          chair.position.set(sx * 0.62, 0, 0);
          chair.rotation.y = sx < 0 ? Math.PI / 2 : -Math.PI / 2; // sitter faces the table
          t.add(chair);
          const plate = P.placeSetting();
          plate.position.set(sx * 0.24, top, 0);
          t.add(plate);
          obstacles.push(chair);
          t.updateMatrixWorld(true);
          const id = `${p.id}.${side}`;
          const point = (chair.userData.seatLocal as THREE.Vector3).clone().applyMatrix4(chair.matrixWorld);
          seats[id] = {
            id,
            table: p.id,
            chair,
            point,
            facing: (p.rot ?? 0) + chair.rotation.y,
            style: 'table',
            taken: null,
            across: `${p.id}.${side === 'a' ? 'b' : 'a'}`,
            place: new THREE.Vector3(sx * 0.2, top, 0.14 * -sx).applyMatrix4(t.matrixWorld),
            bagSpot: new THREE.Vector3(sx * 0.12, top, -0.27 * -sx).applyMatrix4(t.matrixWorld),
          };
          chair.userData.seat = id;
          chair.add(touchTarget(0.5, 1.0, 0.5));
        }
        break;
      }
      case 'armchair': {
        const ch = place(P.armchair(opts.seatTop + 0.02), p.at, p.rot ?? 0);
        obstacles.push(ch);
        ch.updateMatrixWorld(true);
        seats[p.id] = { id: p.id, chair: ch, point: (ch.userData.seatLocal as THREE.Vector3).clone().applyMatrix4(ch.matrixWorld), facing: p.rot ?? 0, style: 'chair', taken: null, place: new THREE.Vector3(), bagSpot: new THREE.Vector3() };
        ch.userData.seat = p.id;
        break;
      }
      case 'bar': {
        const len = p.length ?? 4;
        const b = place(P.barCounter(len), p.at, p.rot ?? 0);
        obstacles.push(b);
        for (let i = 0; i < (p.stools ?? 0); i++) {
          const s = P.barStool();
          s.position.set(-len / 2 + 0.5 + (i * (len - 1)) / Math.max(1, (p.stools ?? 1) - 1), 0, 0.6);
          b.add(s);
          obstacles.push(s);
        }
        break;
      }
      case 'plant':
        obstacles.push(place(P.plant(p.height), p.at));
        break;
      case 'pendant': {
        place(P.pendant(), p.at);
        if (p.light && !opts.lite) {
          const l = new THREE.PointLight('#ffc27a', 3.2, 4.5, 1.8);
          l.position.set(p.at[0], 1.8, p.at[1]);
          group.add(l);
        }
        break;
      }
      case 'door': {
        const d = place(P.door(), p.at, p.rot ?? 0);
        d.name = p.id;
        things[p.id] = d;
        break;
      }
      case 'rug': {
        const r = P.rug(p.size[0], p.size[1]);
        r.position.set(p.at[0], 0.004, p.at[1]);
        r.rotation.z = p.rot ?? 0;
        group.add(r);
        break;
      }
      case 'speaker': {
        const s = place(P.speaker(), p.at, p.rot ?? 0);
        things[p.id] = s;
        obstacles.push(s);
        ticks.push(s.userData.tick);
        break;
      }
    }
  }
  const spots: Record<string, THREE.Vector3> = {};
  for (const [k, [x, z]] of Object.entries(cfg.spots)) spots[k] = new THREE.Vector3(x, 0, z);
  group.updateMatrixWorld(true);
  return { group, floor: [floor], obstacles, seats, tables, things, spots, tick: (t) => ticks.forEach((f) => f(t)) };
}
