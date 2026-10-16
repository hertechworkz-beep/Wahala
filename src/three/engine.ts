import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// The shared 3D core every scene runs on: renderer tuned for phones, a camera that follows
// someone while the player can still drag to look around, taps on the world, and a fixed-step
// option for recording.

export interface Engine {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  lite: boolean;
  /** The object under a screen point, from a list of candidates. */
  pick(clientX: number, clientY: number, among: THREE.Object3D[]): THREE.Intersection | null;
  screenOf(p: THREE.Vector3): { x: number; y: number };
  follow(target: () => THREE.Vector3, dt: number): void;
  start(step: (dt: number) => void, capture?: boolean): (dt: number, render?: boolean) => void;
  dispose(): void;
}

export function createEngine(canvas: HTMLCanvasElement, mood: { background: string; ambient: number; exposure?: number }, onTap: (x: number, y: number) => void): Engine {
  const lite = (navigator.hardwareConcurrency ?? 8) <= 4 || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lite, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, lite ? 1.25 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = mood.exposure ?? 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(mood.background);
  scene.fog = new THREE.Fog(mood.background, 9, 22);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
  scene.environmentIntensity = 0.4;

  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 60);
  camera.position.set(0, 2.6, 6);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 1.2;
  controls.maxDistance = 7;
  controls.maxPolarAngle = Math.PI * 0.47;

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let down: { x: number; y: number; t: number } | null = null;
  const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY, t: performance.now() });
  const onUp = (e: PointerEvent) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const quick = performance.now() - down.t < 450;
    down = null;
    if (moved > 12 || !quick) return; // a camera drag, not a tap
    onTap(e.clientX, e.clientY);
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);

  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.7 ? 55 : 45; // portrait phones see a little wider
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  resize();

  const camOffset = new THREE.Vector3();
  let raf = 0;
  const clock = new THREE.Clock();
  return {
    renderer,
    scene,
    camera,
    controls,
    lite,
    pick(clientX, clientY, among) {
      scene.updateMatrixWorld();
      camera.updateMatrixWorld();
      const r = canvas.getBoundingClientRect();
      ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      // skip anything hidden (an invisible touch target counts as visible; its parents must be shown)
      const shown = (o: THREE.Object3D | null): boolean => {
        for (let p = o; p; p = p.parent) if (!p.visible) return false;
        return true;
      };
      return ray.intersectObjects(among, true).find((h) => shown(h.object.name === 'touch' ? h.object.parent : h.object)) ?? null;
    },
    screenOf(p) {
      camera.updateMatrixWorld();
      const v = p.clone().project(camera);
      const r = canvas.getBoundingClientRect();
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
    },
    follow(target, dt) {
      camOffset.subVectors(camera.position, controls.target);
      controls.target.lerp(target(), Math.min(1, dt * 2.5));
      camera.position.copy(controls.target).add(camOffset);
      controls.update();
    },
    start(step, capture) {
      const frame = (dt: number, render = true) => {
        step(dt);
        if (render) renderer.render(scene, camera);
      };
      const loop = () => {
        raf = requestAnimationFrame(loop);
        frame(Math.min(0.05, clock.getDelta()));
      };
      if (!capture) loop();
      else frame(0);
      return frame;
    },
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      renderer.dispose();
      pmrem.dispose();
    },
  };
}

/** True if `o` is `root` or inside it. */
export function within(o: THREE.Object3D | null, root: THREE.Object3D) {
  while (o) {
    if (o === root) return true;
    o = o.parent;
  }
  return false;
}
