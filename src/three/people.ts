import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Character, loadGLB, type ClipMeta } from './character';
import { LIBRARIES, PEOPLE } from './cast';
export { LIBRARIES, PEOPLE } from './cast';
export type { PersonDef, Voice } from './cast';

/** A public asset's URL; the claude.ai preview can't serve .glb, so it gets the JSON form. */
export function asset(path: string) {
  const p = import.meta.env.VITE_HASH_ROUTER === '1' ? path.replace(/\.glb$/, '.gltf.json') : path;
  return `${import.meta.env.BASE_URL}${p}`;
}

const json = <T,>(path: string) => fetch(asset(path)).then((r) => r.json() as Promise<T>);
const libCache = new Map<string, Promise<{ clips: THREE.AnimationClip[]; meta: Record<string, ClipMeta>; restHip: number }>>();
const modelCache = new Map<string, ReturnType<typeof loadGLB>>();

function library(id: keyof typeof LIBRARIES) {
  if (!libCache.has(id)) {
    const L = LIBRARIES[id];
    libCache.set(
      id,
      Promise.all([loadGLB(asset(L.model)), json<Record<string, ClipMeta>>(L.meta)]).then(([g, meta]) => {
        g.scene.updateMatrixWorld(true);
        let restHip = 0;
        g.scene.traverse((o) => {
          if (/Pelvis$/.test(o.name)) restHip = o.getWorldPosition(new THREE.Vector3()).y;
        });
        return { clips: g.animations, meta, restHip };
      }),
    );
  }
  return libCache.get(id)!;
}

/** Loads a person and returns a ready Character (models are cached; a second copy is cloned). */
export async function loadPerson(id: string): Promise<Character> {
  const def = PEOPLE[id];
  if (!def) throw new Error(`unknown person ${id}`);
  const first = !modelCache.has(def.model);
  if (first) modelCache.set(def.model, loadGLB(asset(def.model)));
  const g = await modelCache.get(def.model)!;
  const gltf = { scene: first ? g.scene : cloneSkinned(g.scene), animations: g.animations };
  let c: Character;
  if (def.library) {
    const lib = await library(def.library);
    c = new Character(gltf, lib.meta, lib);
  } else {
    c = new Character(gltf, await json<Record<string, ClipMeta>>(def.meta!));
  }
  c.name = def.name;
  return c;
}
