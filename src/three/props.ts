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
  g.userData.seatLocal = new THREE.Vector3(0, seatTop, 0.06);
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
