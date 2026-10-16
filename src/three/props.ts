import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// Furniture and props modelled in code (no third-party art). Each returns a group whose
// origin sits on the floor; interaction points are exposed for the characters.

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat = 1) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  return t;
}

export function woodFloor(size = 14) {
  const tex = canvasTexture(1024, 1024, (g) => {
    const rnd = mulberry(7);
    for (let row = 0; row < 16; row++) {
      let x = -rnd() * 300;
      while (x < 1024) {
        const L = 220 + rnd() * 260;
        const tone = 70 + rnd() * 30;
        g.fillStyle = `rgb(${tone + 30},${tone - 5},${tone - 30})`;
        g.fillRect(x, row * 64, L, 64);
        for (let k = 0; k < 18; k++) {
          g.strokeStyle = `rgba(30,15,5,${0.05 + rnd() * 0.08})`;
          g.beginPath();
          const y = row * 64 + rnd() * 64;
          g.moveTo(x, y);
          g.bezierCurveTo(x + L / 3, y + rnd() * 6 - 3, x + (2 * L) / 3, y + rnd() * 6 - 3, x + L, y);
          g.stroke();
        }
        g.fillStyle = 'rgba(0,0,0,0.5)';
        g.fillRect(x, row * 64, 2, 64);
        x += L;
      }
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.fillRect(0, row * 64, 1024, 2);
    }
  }, size / 3);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.42, metalness: 0.0 }));
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  m.name = 'floor';
  return m;
}

export function rug(w = 3.2, d = 2.2) {
  const tex = canvasTexture(1024, 700, (g) => {
    g.fillStyle = '#5a1018';
    g.fillRect(0, 0, 1024, 700);
    g.strokeStyle = '#c9a24a';
    g.lineWidth = 10;
    g.strokeRect(30, 30, 964, 640);
    g.lineWidth = 3;
    g.strokeRect(60, 60, 904, 580);
    g.fillStyle = 'rgba(201,162,74,0.55)';
    for (let i = 0; i < 9; i++)
      for (let j = 0; j < 6; j++) {
        g.beginPath();
        const cx = 120 + i * 98, cy = 120 + j * 92;
        g.moveTo(cx, cy - 22); g.lineTo(cx + 22, cy); g.lineTo(cx, cy + 22); g.lineTo(cx - 22, cy); g.closePath(); g.fill();
      }
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.004;
  m.receiveShadow = true;
  m.name = 'floor';
  return m;
}

/** A deep armchair. seatTop = height of the cushion top. The sitter faces +Z (local). */
export function armchair(seatTop: number, color = '#2b1b14') {
  const g = new THREE.Group();
  g.name = 'chair';
  const leather = new THREE.MeshStandardMaterial({ color, roughness: 0.48, metalness: 0.0 });
  const wood = new THREE.MeshStandardMaterial({ color: '#2a170d', roughness: 0.5 });
  const W = 0.86, D = 0.82;
  const box = (w: number, h: number, d: number, r: number, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    return m;
  };
  const baseH = seatTop - 0.14;
  box(W, baseH - 0.08, D, 0.04, leather, 0, 0.08 + (baseH - 0.08) / 2, 0);
  box(W - 0.24, 0.14, D - 0.12, 0.06, leather, 0, baseH + 0.07, 0.05); // cushion
  box(W, 0.62, 0.2, 0.08, leather, 0, baseH + 0.31, -D / 2 + 0.1); // back
  box(0.16, 0.34, D, 0.07, leather, -W / 2 + 0.08, baseH + 0.12, 0); // arms
  box(0.16, 0.34, D, 0.07, leather, W / 2 - 0.08, baseH + 0.12, 0);
  for (const [x, z] of [[-0.36, -0.34], [0.36, -0.34], [-0.36, 0.34], [0.36, 0.34]]) box(0.06, 0.08, 0.06, 0.02, wood, x, 0.04, z);
  g.userData.seatLocal = new THREE.Vector3(0, seatTop, -0.06);
  return g;
}

export function sideTable() {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.035, 40), new THREE.MeshStandardMaterial({ color: '#d9d2c3', roughness: 0.15, metalness: 0.1 }));
  top.position.y = 0.62;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.6, 20), new THREE.MeshStandardMaterial({ color: '#b08a3c', roughness: 0.3, metalness: 1 }));
  stem.position.y = 0.3;
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.03, 32), stem.material);
  foot.position.y = 0.015;
  for (const m of [top, stem, foot]) {
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  }
  g.userData.topY = 0.64;
  return g;
}

/** A red-wine glass. Origin at the bowl's centre, so it sits in a hand naturally. */
export function wineGlass() {
  const g = new THREE.Group();
  g.name = 'glass';
  const pts: THREE.Vector2[] = [];
  const prof = [[0.0, -0.13], [0.035, -0.13], [0.036, -0.126], [0.004, -0.118], [0.0035, -0.06], [0.006, -0.05], [0.03, -0.035], [0.042, 0.0], [0.04, 0.035], [0.034, 0.06]];
  for (const [x, y] of prof) pts.push(new THREE.Vector2(x, y));
  const glassMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.05, transmission: 0.95, thickness: 0.004, transparent: true, opacity: 0.35, ior: 1.5 });
  const shell = new THREE.Mesh(new THREE.LatheGeometry(pts, 32), glassMat);
  shell.material.side = THREE.DoubleSide;
  const wine = new THREE.Mesh(new THREE.SphereGeometry(0.038, 24, 12, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), new THREE.MeshStandardMaterial({ color: '#4a0410', roughness: 0.1 }));
  wine.position.y = 0.002;
  const surface = new THREE.Mesh(new THREE.CircleGeometry(0.038, 24), new THREE.MeshStandardMaterial({ color: '#5a0815', roughness: 0.05 }));
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = 0.002;
  g.add(shell, wine, surface);
  g.userData.baseOffset = 0.13; // from origin down to the foot
  return g;
}

export function mulberry(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A floor-standing speaker with a glowing ring; `setOn` lights it up and makes the cone pulse. */
export function speaker() {
  const g = new THREE.Group();
  g.name = 'speaker';
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.42, 1.0, 0.36, 3, 0.03), new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.6 }));
  body.position.y = 0.5;
  body.castShadow = body.receiveShadow = true;
  const coneMat = new THREE.MeshStandardMaterial({ color: '#222', roughness: 0.9 });
  const cone = new THREE.Mesh(new THREE.CircleGeometry(0.15, 32), coneMat);
  cone.position.set(0, 0.36, 0.181);
  const tweet = new THREE.Mesh(new THREE.CircleGeometry(0.06, 24), coneMat);
  tweet.position.set(0, 0.74, 0.181);
  const ringMat = new THREE.MeshStandardMaterial({ color: '#F59E0B', emissive: '#F59E0B', emissiveIntensity: 0.15 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.008, 8, 48), ringMat);
  ring.position.copy(cone.position);
  g.add(body, cone, tweet, ring);
  let on = false;
  g.userData.setOn = (v: boolean) => (on = v);
  g.userData.isOn = () => on;
  g.userData.tick = (t: number) => {
    ringMat.emissiveIntensity = on ? 1.2 + Math.sin(t * 12) * 0.6 : 0.15;
    cone.scale.setScalar(on ? 1 + Math.max(0, Math.sin(t * 12.6)) * 0.05 : 1);
  };
  return g;
}

const std = (color: string, roughness = 0.6, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
function add(g: THREE.Group, geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = shadow;
  g.add(m);
  return m;
}

/** A dining chair. The sitter faces +Z (local); `seatLocal` is the top of the cushion. */
export function diningChair(seatTop = 0.47, color = '#3b1f14', fabric = '#8a6a3a') {
  const g = new THREE.Group();
  g.name = 'chair';
  const wood = std(color, 0.45), cloth = std(fabric, 0.85);
  const W = 0.46, D = 0.46;
  add(g, new RoundedBoxGeometry(W, 0.06, D, 2, 0.02), cloth, 0, seatTop - 0.03, 0);
  add(g, new RoundedBoxGeometry(W, 0.03, D, 2, 0.01), wood, 0, seatTop - 0.075, 0);
  // an open back (two posts and a curved rail) so clothes that brush it don't vanish into a board
  for (const x of [-0.2, 0.2]) add(g, new THREE.BoxGeometry(0.035, 0.5, 0.035), wood, x, seatTop + 0.22, -D / 2 + 0.02);
  add(g, new RoundedBoxGeometry(W, 0.12, 0.035, 2, 0.015), wood, 0, seatTop + 0.42, -D / 2 + 0.02);
  for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) add(g, new THREE.BoxGeometry(0.035, seatTop - 0.09, 0.035), wood, x, (seatTop - 0.09) / 2, z);
  g.userData.seatLocal = new THREE.Vector3(0, seatTop, 0.07); // sit a little forward, clear of the back
  return g;
}

/** A round restaurant table with a white cloth. `topY` is the height of the top surface. */
export function roundTable(radius = 0.42, topY = 0.75) {
  const g = new THREE.Group();
  g.name = 'table';
  const cloth = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius + 0.02, 0.1, 40, 1, true), std('#f2ede4', 0.9));
  cloth.position.y = topY - 0.05;
  cloth.material.side = THREE.DoubleSide;
  cloth.castShadow = true;
  g.add(cloth);
  add(g, new THREE.CylinderGeometry(radius, radius, 0.02, 40), std('#f7f3ec', 0.85), 0, topY - 0.01, 0);
  add(g, new THREE.CylinderGeometry(0.05, 0.07, topY - 0.05, 16), std('#2a1a12', 0.4, 0.3), 0, (topY - 0.05) / 2, 0);
  add(g, new THREE.CylinderGeometry(0.28, 0.3, 0.03, 32), std('#2a1a12', 0.4, 0.3), 0, 0.015, 0);
  g.userData.topY = topY;
  return g;
}

/** Plate with folded napkin. */
export function placeSetting() {
  const g = new THREE.Group();
  add(g, new THREE.CylinderGeometry(0.12, 0.1, 0.015, 32), std('#ffffff', 0.25), 0, 0.008, 0, false);
  add(g, new THREE.CylinderGeometry(0.08, 0.08, 0.004, 32), std('#e9e4da', 0.3), 0, 0.017, 0, false);
  add(g, new THREE.BoxGeometry(0.012, 0.004, 0.17), std('#c9c9c9', 0.2, 1), 0.15, 0.003, 0, false);
  add(g, new THREE.BoxGeometry(0.012, 0.004, 0.17), std('#c9c9c9', 0.2, 1), -0.15, 0.003, 0, false);
  return g;
}

/** A candle in a glass with a flickering flame and its own small light. */
export function candle(withLight = true) {
  const g = new THREE.Group();
  add(g, new THREE.CylinderGeometry(0.03, 0.03, 0.07, 16), new THREE.MeshPhysicalMaterial({ color: '#ffffff', transmission: 0.9, roughness: 0.1, transparent: true, opacity: 0.4 }), 0, 0.035, 0, false);
  add(g, new THREE.CylinderGeometry(0.022, 0.022, 0.045, 16), std('#f4ead2', 0.7), 0, 0.023, 0, false);
  const flameMat = new THREE.MeshBasicMaterial({ color: '#ffcf7a' });
  const flame = add(g, new THREE.SphereGeometry(0.008, 8, 6), flameMat, 0, 0.058, 0, false);
  flame.scale.set(1, 2, 1);
  let light: THREE.PointLight | null = null;
  if (withLight) {
    light = new THREE.PointLight('#ffb35c', 0.6, 1.6, 2);
    light.position.y = 0.12;
    g.add(light);
  }
  g.userData.tick = (t: number) => {
    const f = 0.85 + Math.sin(t * 17.3) * 0.08 + Math.sin(t * 7.1) * 0.07;
    flame.scale.set(1, 2 * f, 1);
    if (light) light.intensity = 0.6 * f;
  };
  return g;
}

/** A structured handbag. Origin at the top of the handle, so it hangs from the hand. */
export function handbag(color = '#c0392b') {
  const g = new THREE.Group();
  g.name = 'bag';
  const leather = std(color, 0.4);
  const body = add(g, new RoundedBoxGeometry(0.26, 0.18, 0.1, 3, 0.025), leather, 0, -0.2, 0);
  body.castShadow = true;
  add(g, new RoundedBoxGeometry(0.26, 0.06, 0.104, 3, 0.02), std('#8e1f16', 0.45), 0, -0.135, 0);
  add(g, new THREE.BoxGeometry(0.04, 0.02, 0.106), std('#d4af37', 0.25, 1), 0, -0.15, 0);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.008, 8, 24, Math.PI), std('#8e1f16', 0.4));
  handle.position.y = -0.11;
  g.add(handle);
  g.userData.baseOffset = 0.29; // origin to the bottom
  return g;
}

/** A long bar counter with stools and bottles on a back shelf. */
export function barCounter(length = 4) {
  const g = new THREE.Group();
  g.name = 'bar';
  add(g, new RoundedBoxGeometry(length, 1.05, 0.6, 2, 0.03), std('#1d120d', 0.5), 0, 0.525, 0);
  add(g, new RoundedBoxGeometry(length + 0.1, 0.05, 0.7, 2, 0.02), std('#d9c9a8', 0.2, 0.1), 0, 1.075, 0);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(length, 0.02, 0.02), new THREE.MeshBasicMaterial({ color: '#F59E0B' }));
  strip.position.set(0, 0.05, 0.31);
  g.add(strip);
  const shelf = add(g, new THREE.BoxGeometry(length, 0.04, 0.3), std('#3a2418', 0.5), 0, 1.6, -1.0);
  void shelf;
  const rnd = mulberry(4);
  const bottleMats = ['#2f5d3a', '#6b3a1e', '#c9a24a', '#1b2a4a', '#7a1020'].map((c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.15, transmission: 0.4, transparent: true, opacity: 0.85 }));
  for (let x = -length / 2 + 0.15; x < length / 2 - 0.1; x += 0.16 + rnd() * 0.08) {
    const h = 0.24 + rnd() * 0.1;
    add(g, new THREE.CylinderGeometry(0.035, 0.04, h, 12), bottleMats[Math.floor(rnd() * bottleMats.length)], x, 1.62 + h / 2, -1.0, false);
  }
  return g;
}

export function barStool() {
  const g = new THREE.Group();
  add(g, new THREE.CylinderGeometry(0.19, 0.19, 0.06, 24), std('#5a1018', 0.6), 0, 0.76, 0);
  add(g, new THREE.CylinderGeometry(0.025, 0.025, 0.74, 10), std('#b08a3c', 0.3, 1), 0, 0.37, 0);
  add(g, new THREE.CylinderGeometry(0.2, 0.2, 0.02, 24), std('#b08a3c', 0.3, 1), 0, 0.01, 0);
  return g;
}

/** A potted palm made of drooping leaf blades. */
export function plant(height = 1.5) {
  const g = new THREE.Group();
  add(g, new THREE.CylinderGeometry(0.22, 0.17, 0.42, 20), std('#d8cdb8', 0.7), 0, 0.21, 0);
  const leaf = std('#2f6b35', 0.6);
  leaf.side = THREE.DoubleSide;
  const rnd = mulberry(11);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + rnd() * 0.3;
    const len = height * (0.45 + rnd() * 0.25);
    const geo = new THREE.PlaneGeometry(0.12, len, 1, 6);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let k = 0; k < pos.count; k++) {
      const y = pos.getY(k) + len / 2;
      const t = y / len;
      pos.setXYZ(k, pos.getX(k) * (1 - t * 0.8), y * (1 - t * 0.35), t * t * len * 0.55);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, leaf);
    m.position.y = 0.4;
    m.rotation.set(-0.35 - rnd() * 0.3, a, 0);
    m.castShadow = true;
    g.add(m);
  }
  return g;
}

/** A warm pendant lamp hanging from the ceiling (a glowing shade; light added by the venue). */
export function pendant(dropTo = 1.9) {
  const g = new THREE.Group();
  add(g, new THREE.CylinderGeometry(0.004, 0.004, 3.2 - dropTo, 4), std('#111', 0.5), 0, (3.2 + dropTo) / 2, 0, false);
  const shade = add(g, new THREE.SphereGeometry(0.16, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#c9a24a', metalness: 1, roughness: 0.3, side: THREE.DoubleSide }), 0, dropTo, 0, false);
  void shade;
  add(g, new THREE.SphereGeometry(0.05, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffe0a8' }), 0, dropTo - 0.02, 0, false);
  return g;
}

/** A double door in a frame. */
export function door(width = 1.6, color = '#2a170d') {
  const g = new THREE.Group();
  g.name = 'door';
  add(g, new THREE.BoxGeometry(width + 0.2, 2.5, 0.12), std('#c9a24a', 0.3, 1), 0, 1.25, -0.02);
  add(g, new THREE.BoxGeometry(width / 2 - 0.02, 2.35, 0.06), std(color, 0.5), -width / 4, 1.18, 0.02);
  add(g, new THREE.BoxGeometry(width / 2 - 0.02, 2.35, 0.06), std(color, 0.5), width / 4, 1.18, 0.02);
  return g;
}
