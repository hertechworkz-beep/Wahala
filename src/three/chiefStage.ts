import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Character, loadGLB, type ClipMeta } from './character';
import { armchair, rug, sideTable, wineGlass, woodFloor } from './props';
import { speak } from './voice';

// Chief preview: a lounge where you control Chief directly to judge him standing, walking,
// sitting, greeting and holding a glass. Every action is a tap on the world.

export interface StageEvents {
  onProgress?: (p: number) => void;
  onReady?: () => void;
  onHint?: (h: string) => void;
  onSay?: (who: string, text: string, seconds: number) => void;
  onSayEnd?: () => void;
}

export async function startChiefStage(canvas: HTMLCanvasElement, ev: StageEvents = {}, opts: { capture?: boolean } = {}) {
  const lite = (navigator.hardwareConcurrency ?? 8) <= 4 || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lite, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, lite ? 1.25 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#120c0b');
  scene.fog = new THREE.Fog('#120c0b', 7, 16);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
  scene.environmentIntensity = 0.45;

  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 60);
  camera.position.set(1.4, 2.3, 5.4);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 1.0;
  controls.maxDistance = 6.5;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.target.set(0.3, 1.0, -0.2);

  // Light: warm lamps and a soft key that casts shadows.
  scene.add(new THREE.HemisphereLight('#ffe7cf', '#2a1610', 0.55));
  const key = new THREE.DirectionalLight('#ffd9b0', 2.2);
  key.position.set(2.5, 4.5, 3);
  key.castShadow = true;
  key.shadow.mapSize.set(lite ? 1024 : 2048, lite ? 1024 : 2048);
  key.shadow.camera.left = -4; key.shadow.camera.right = 4; key.shadow.camera.top = 4; key.shadow.camera.bottom = -4;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  scene.add(key);
  const lamp = new THREE.PointLight('#ffb36b', 6, 6, 1.6);
  lamp.position.set(-1.6, 1.9, -1.2);
  scene.add(lamp);
  const rim = new THREE.SpotLight('#ff6a5a', 18, 9, 0.6, 0.5);
  rim.position.set(-2.5, 3, -3);
  scene.add(rim);

  const floor = woodFloor(16);
  scene.add(floor, rug());
  // A back wall with panels and a lamp, so the room has depth.
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(16, 5), new THREE.MeshStandardMaterial({ color: '#2a1a16', roughness: 0.9 }));
  wall.position.set(0, 2.5, -3.2);
  wall.receiveShadow = true;
  scene.add(wall);
  for (let i = -3; i <= 3; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.6, 0.03), new THREE.MeshStandardMaterial({ color: '#3a241d', roughness: 0.6 }));
    p.position.set(i * 2, 1.7, -3.17);
    scene.add(p);
  }
  const lampShade = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.3, 24, 1, true), new THREE.MeshStandardMaterial({ color: '#f3d7a8', emissive: '#ffb36b', emissiveIntensity: 0.9, side: THREE.DoubleSide }));
  lampShade.position.set(-1.6, 1.9, -1.2);
  const lampPole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.75, 8), new THREE.MeshStandardMaterial({ color: '#b08a3c', metalness: 1, roughness: 0.3 }));
  lampPole.position.set(-1.6, 0.88, -1.2);
  scene.add(lampShade, lampPole);

  // Chief
  ev.onProgress?.(0.05);
  const base = import.meta.env.BASE_URL;
  const [gltf, meta] = await Promise.all([
    loadGLB(`${base}models/${import.meta.env.VITE_HASH_ROUTER === '1' ? 'chief.gltf.json' : 'chief.glb'}`),
    fetch(`${base}models/chief.clips.json`).then((r) => r.json() as Promise<Record<string, ClipMeta>>),
  ]);
  ev.onProgress?.(0.8);
  const chief = new Character(gltf as any, meta);
  scene.add(chief.root);
  chief.root.position.set(-0.5, 0, 0.5);
  chief.root.rotation.y = 0.35;

  // Furniture that fits his body: the cushion top sits under his seated hips.
  const hip = chief.seatedHip();
  const chair = armchair(Math.max(0.38, hip.y - 0.1));
  chair.position.set(1.35, 0, -0.9);
  chair.rotation.y = -0.45;
  scene.add(chair);
  const table = sideTable();
  table.position.set(0.55, 0, -1.25);
  scene.add(table);
  const glass = wineGlass();
  glass.position.set(0.55, table.userData.topY + glass.userData.baseOffset, -1.25);
  glass.traverse((o: any) => (o.castShadow = true));
  scene.add(glass);

  // Destination marker
  const marker = new THREE.Mesh(new THREE.RingGeometry(0.09, 0.12, 32), new THREE.MeshBasicMaterial({ color: '#F59E0B', transparent: true, opacity: 0 }));
  marker.rotation.x = -Math.PI / 2;
  marker.position.y = 0.01;
  scene.add(marker);

  const say = async (id: string, text: string) => {
    const s = await speak('chief', id, text, { male: true, pitch: 0.7, rate: 0.9 });
    chief.mouthLevel = s.level;
    chief.speak(s.seconds);
    ev.onSay?.('Chief', text, s.seconds);
    chief.after(s.seconds + 0.5, () => ev.onSayEnd?.());
  };

  // Taps
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let down: { x: number; y: number; t: number } | null = null;
  canvas.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY, t: performance.now() }));
  canvas.addEventListener('pointerup', (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const quick = performance.now() - down.t < 450;
    down = null;
    if (moved > 12 || !quick) return; // that was a camera drag
    tap(e.clientX, e.clientY);
  });
  function tap(clientX: number, clientY: number) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects([chief.root, chair, glass, table, floor], true);
    if (!hits.length) return;
    const h = hits[0];
    const isIn = (root: THREE.Object3D) => {
      let o: THREE.Object3D | null = h.object;
      while (o) {
        if (o === root) return true;
        o = o.parent;
      }
      return false;
    };
    if (isIn(glass)) {
      if (chief.held === glass) return chief.sip();
      const spot = new THREE.Vector3(0.55, 0, -0.72);
      chief.walkTo(spot, () => {
        chief.after(0.1, () => chief.hold(glass));
        ev.onHint?.('Tap the glass again to drink. Tap Chief to toast.');
      });
      showMarker(spot);
    } else if (isIn(chief.root)) {
      if (chief.held) {
        chief.sip();
        say('chief_toast', 'To new things. And to beautiful company.');
      } else {
        chief.wave();
        say('chief_greet', 'Ah-ah! So you came. Good evening, my dear.');
      }
    } else if (isIn(chair)) {
      const seat = (chair.userData.seatLocal as THREE.Vector3).clone().applyMatrix4(chair.matrixWorld);
      chief.sitOn(seat, chair.rotation.y);
      showMarker(seat.clone().setY(0));
      ev.onHint?.('Tap the floor to stand up and walk.');
    } else {
      const p = h.point.clone().setY(0);
      p.x = Math.max(-5, Math.min(5, p.x));
      p.z = Math.max(-2.7, Math.min(5, p.z));
      chief.walkTo(p);
      showMarker(p);
    }
  }
  let markerT = 0;
  function showMarker(p: THREE.Vector3) {
    marker.position.set(p.x, 0.01, p.z);
    markerT = 1.2;
  }

  // Loop
  const clock = new THREE.Clock();
  let raf = 0;
  const camOffset = new THREE.Vector3();
  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  resize();
  const step = (dt: number) => {
    chief.update(dt);
    // camera follows Chief, keeping the user's chosen angle
    const chest = chief.root.position.clone().add(new THREE.Vector3(0, chief.seated ? 0.85 : 1.25, 0));
    camOffset.subVectors(camera.position, controls.target);
    controls.target.lerp(chest, Math.min(1, dt * 3));
    camera.position.copy(controls.target).add(camOffset);
    controls.update();
    markerT = Math.max(0, markerT - dt);
    (marker.material as THREE.MeshBasicMaterial).opacity = Math.min(0.9, markerT);
    marker.scale.setScalar(1 + (1.2 - markerT) * 0.4);
    renderer.render(scene, camera);
  };
  const loop = () => {
    raf = requestAnimationFrame(loop);
    step(Math.min(0.05, clock.getDelta()));
  };
  ev.onProgress?.(1);
  ev.onReady?.();
  ev.onHint?.('Tap the floor to walk. Tap the chair to sit. Tap the glass, or tap Chief.');
  if (!opts.capture) loop();
  else step(0);

  return {
    step,
    tap,
    screenOf(p: THREE.Vector3) {
      const v = p.clone().project(camera);
      const r = canvas.getBoundingClientRect();
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
    },
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      renderer.dispose();
      pmrem.dispose();
      if ('speechSynthesis' in window) speechSynthesis.cancel();
    },
    // for the automated walkthrough (screen recording)
    debug: { chief, chair, glass, camera, controls, tap: (o: 'chair' | 'glass' | 'chief' | THREE.Vector3) => o },
  };
}
