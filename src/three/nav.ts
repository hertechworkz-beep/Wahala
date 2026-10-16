import * as THREE from 'three';
import { getNavMeshPositionsAndIndices, init, NavMeshQuery } from 'recast-navigation';
import { threeToSoloNavMesh } from '@recast-navigation/three';

// Walkable floor for a venue, generated automatically (Recast/Detour, the navmesh library used
// by Unity and Unreal) from the floor and the furniture's footprints. Characters ask it for a
// route and walk round tables and chairs instead of through them.

let ready: Promise<void> | null = null;

export interface Nav {
  /** Waypoints from `from` to `to` (the last one is the nearest walkable point to `to`). */
  route(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[];
  /** Nearest walkable point. */
  closest(p: THREE.Vector3): THREE.Vector3;
  debugMesh(): THREE.Object3D;
}

/**
 * @param floor  meshes people walk on
 * @param obstacles  objects in the way (their bounding boxes are used, which is what feet care about)
 * @param agentRadius  how far a body keeps from obstacles
 */
export async function buildNav(floor: THREE.Mesh[], obstacles: THREE.Object3D[], agentRadius = 0.22): Promise<Nav> {
  await (ready ??= init());
  const solids: THREE.Mesh[] = [];
  for (const o of obstacles) {
    o.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(o);
    if (box.isEmpty()) continue;
    const size = box.getSize(new THREE.Vector3());
    const m = new THREE.Mesh(new THREE.BoxGeometry(size.x, Math.max(size.y, 2), size.z));
    m.position.copy(box.getCenter(new THREE.Vector3())).setY(Math.max(size.y, 2) / 2);
    m.updateMatrixWorld(true);
    solids.push(m);
  }
  for (const f of floor) f.updateWorldMatrix(true, false);
  const cs = 0.05, ch = 0.05;
  const { success, navMesh } = threeToSoloNavMesh([...floor, ...solids], {
    cs,
    ch,
    walkableRadius: Math.ceil(agentRadius / cs),
    walkableHeight: Math.ceil(1.6 / ch),
    walkableClimb: Math.ceil(0.1 / ch),
    walkableSlopeAngle: 30,
    maxEdgeLen: Math.ceil(4 / cs),
    maxSimplificationError: 1.1,
    minRegionArea: 4,
  });
  if (!success || !navMesh) throw new Error('navmesh failed');
  const query = new NavMeshQuery(navMesh);
  const half = { x: 3, y: 1, z: 3 };
  const v = (p: { x: number; y: number; z: number }) => new THREE.Vector3(p.x, 0, p.z);
  return {
    route(from, to) {
      const a = query.findClosestPoint(from, { halfExtents: half }).point;
      const b = query.findClosestPoint(to, { halfExtents: half }).point;
      const r = query.computePath(a, b, { halfExtents: half });
      if (!r.success || !r.path.length) return [to.clone()];
      const pts = r.path.map(v);
      // drop the start point (where we already stand)
      if (pts.length && pts[0].distanceTo(from) < 0.3) pts.shift();
      return pts;
    },
    closest(p) {
      return v(query.findClosestPoint(p, { halfExtents: half }).point);
    },
    debugMesh() {
      const [positions, indices] = getNavMeshPositionsAndIndices(navMesh);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      g.setIndex(indices);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: '#2dd4bf', transparent: true, opacity: 0.25, depthWrite: false }));
      m.position.y = 0.02;
      return m;
    },
  };
}
