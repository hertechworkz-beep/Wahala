import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

// A rigged character (MakeHuman body, Rocketbox motion) with real locomotion and interaction:
// walking at the clip's own speed (no foot sliding), turning, sitting aligned to a seat,
// upper-body actions layered over the legs, objects held in the hand bone, blinking and
// mouth movement while speaking.

export interface ClipMeta {
  frames: number;
  duration: number;
  speed: number;
  loop: boolean;
  root: 'inplace' | 'keep' | 'static';
}

// Skeleton profiles: the game talks about bones by role; each rig names them its own way.
const PROFILES = {
  game_engine: {
    detect: 'pelvis',
    upper: /^(spine_02|spine_03|neck_01|head|clavicle_|upperarm_|lowerarm_|hand_|thumb_|index_|middle_|ring_|pinky_)/,
    names: { pelvis: 'pelvis', head: 'head', hand_r: 'hand_r', thumb_02_r: 'thumb_02_r', index_01_r: 'index_01_r', index_02_r: 'index_02_r', middle_01_r: 'middle_01_r', ring_01_r: 'ring_01_r', hand_l: 'hand_l', middle_01_l: 'middle_01_l' },
  },
  rocketbox: {
    // Microsoft Rocketbox (3ds Max Biped). three.js turns "Bip01 Pelvis" into "Bip01_Pelvis".
    detect: 'Bip01_Pelvis',
    upper: /^Bip01_(Spine1|Spine2|Neck|Head|[LR]_(Clavicle|UpperArm|Forearm|Hand|Finger))/,
    names: { pelvis: 'Bip01_Pelvis', head: 'Bip01_Head', hand_r: 'Bip01_R_Hand', thumb_02_r: 'Bip01_R_Finger01', index_01_r: 'Bip01_R_Finger1', index_02_r: 'Bip01_R_Finger11', middle_01_r: 'Bip01_R_Finger2', ring_01_r: 'Bip01_R_Finger3', hand_l: 'Bip01_L_Hand', middle_01_l: 'Bip01_L_Finger2' },
  },
  mixamo: {
    // three.js strips the ':' from "mixamorig:Hips"
    detect: 'mixamorigHips',
    proceduralGrip: true, // finger motion isn't retargeted onto this rig; the grip is posed in code
    upper: /^(mixamorig(Spine1|Spine2|Neck|Head|LeftShoulder|RightShoulder|LeftArm|RightArm|LeftForeArm|RightForeArm|LeftHand|RightHand)|headfront)/,
    names: { pelvis: 'mixamorigHips', head: 'mixamorigHead', hand_r: 'mixamorigRightHand', thumb_02_r: 'mixamorigRightHandThumb2', index_01_r: 'mixamorigRightHandIndex1', index_02_r: 'mixamorigRightHandIndex2', middle_01_r: 'mixamorigRightHandMiddle1', ring_01_r: 'mixamorigRightHandRing1', hand_l: 'mixamorigLeftHand', middle_01_l: 'mixamorigLeftHandMiddle1' },
  },
};
type Role = keyof (typeof PROFILES)['game_engine']['names'];

/** How a character sits: which clips take them down, keep them seated and bring them back up. */
export const SIT_STYLES = {
  chair: { down: 'sit_down', idle: 'sit_idle', up: 'stand_up', talk: ['sit_talk', 'sit_shrug'] },
  // a dining table: you can't stand in front of the chair, so the body slides in from the side
  table: { down: 'table_down', idle: 'table_idle', up: 'table_up', talk: ['table_shrug', 'table_thoughtful'] },
} as const;
export type SitStyle = keyof typeof SIT_STYLES;
/** The hip joint sits this far above the cushion it rests on. */
export const HIP_ABOVE_SEAT = 0.08;

/** Facial expressions as ARKit blendshape weights (works on any avatar exported with ARKit shapes). */
export const EXPRESSIONS: Record<string, Record<string, number>> = {
  smile: { mouthSmileLeft: 0.7, mouthSmileRight: 0.7, cheekSquintLeft: 0.35, cheekSquintRight: 0.35, eyeSquintLeft: 0.15, eyeSquintRight: 0.15 },
  flirty: { mouthSmileLeft: 0.55, mouthSmileRight: 0.3, eyeSquintLeft: 0.3, eyeSquintRight: 0.25, browOuterUpLeft: 0.35 },
  angry: { browDownLeft: 0.85, browDownRight: 0.85, mouthFrownLeft: 0.5, mouthFrownRight: 0.5, noseSneerLeft: 0.35, noseSneerRight: 0.35, mouthPressLeft: 0.3, mouthPressRight: 0.3 },
  sad: { browInnerUp: 0.85, mouthFrownLeft: 0.6, mouthFrownRight: 0.6, eyeLookDownLeft: 0.3, eyeLookDownRight: 0.3, mouthShrugLower: 0.3 },
  surprised: { browInnerUp: 0.7, browOuterUpLeft: 0.7, browOuterUpRight: 0.7, eyeWideLeft: 0.6, eyeWideRight: 0.6, jawOpen: 0.22 },
  neutral: {},
};
const VISEMES = ['viseme_aa', 'viseme_O', 'viseme_E', 'viseme_I', 'viseme_U', 'viseme_PP', 'viseme_FF', 'viseme_DD', 'viseme_SS', 'viseme_nn'];

function filterClip(clip: THREE.AnimationClip, keep: (bone: string) => boolean, name: string) {
  const tracks = clip.tracks.filter((t) => keep(t.name.split('.')[0]));
  return new THREE.AnimationClip(name, clip.duration, tracks);
}

export async function loadGLB(url: string) {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  return loader.loadAsync(url);
}

type Base = string; // idle, walk, run, sit_down, sit_idle, stand_up, dance...
type Upper = string | null; // wave, drink_idle, drink, talk, phone, cheer...

export class Character {
  root = new THREE.Group(); // stands on the floor; +Z is forward
  model: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  bones: Record<string, THREE.Bone> = {};
  morphMeshes: THREE.Mesh[] = [];
  meta: Record<string, ClipMeta>;
  profile: (typeof PROFILES)[keyof typeof PROFILES] = PROFILES.game_engine;
  clipNames: string[] = [];
  gait: 'walk' | 'run' = 'walk';
  bone(role: Role) {
    return this.bones[this.profile.names[role]];
  }
  private full: Record<string, THREE.AnimationAction> = {};
  private lower: Record<string, THREE.AnimationAction> = {};
  private upperActs: Record<string, THREE.AnimationAction> = {};
  base: Base = 'idle';
  upper: Upper = null;
  private target: THREE.Vector3 | null = null;
  private onArrive: (() => void) | null = null;
  private faceTo: number | null = null;
  seat: { point: THREE.Vector3; facing: number } | null = null;
  private pelvisAt: Record<string, THREE.Vector3> = {};
  held: THREE.Object3D | null = null;
  private holdLocal = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
  private speaking = 0;
  private gripSign = 1;
  private fingerRest = new Map<THREE.Bone, THREE.Quaternion>();
  private grip = 0; // 0 open .. 1 closed round a held object
  private mouth = 0;
  private blinkT = 2;
  private busyUntil = 0;
  sipWindow = { start: 0, end: 3.4 };
  clock = 0;
  onStateChange?: (s: string) => void;

  private arkit: { mesh: THREE.Mesh; idx: Record<string, number> }[] = [];
  private exprNow: Record<string, number> = {};
  private exprTarget: Record<string, number> = {};
  private exprName = 'neutral';
  private visemeT = 0;
  private viseme = 'viseme_aa';
  /** Turns a floor point into a walkable route (set by the world's navigation mesh). */
  route?: (from: THREE.Vector3, to: THREE.Vector3) => THREE.Vector3[];
  private waypoints: THREE.Vector3[] = [];
  private carried: { obj: THREE.Object3D; side: 'l' | 'r' } | null = null;
  private carryLocal: { side: 'l' | 'r'; pos: THREE.Vector3; quat: THREE.Quaternion } | null = null;
  name = '';

  /**
   * @param gltf  the avatar (and its own clips, if any)
   * @param meta  per-clip facts (speed, loop, root motion)
   * @param library  clips shared by every avatar on the same skeleton; `restHip` is the pelvis height of
   *                 the skeleton they were made on, so taller or shorter avatars don't float or sink
   */
  constructor(gltf: { scene: THREE.Object3D; animations: THREE.AnimationClip[] }, meta: Record<string, ClipMeta>, library?: { clips: THREE.AnimationClip[]; restHip?: number }) {
    this.model = gltf.scene;
    this.meta = meta;
    this.root.add(this.model);
    this.model.traverse((o: any) => {
      if (o.isBone) this.bones[o.name] = o;
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        o.frustumCulled = false;
        if (o.morphTargetDictionary && 'mouthOpen' in o.morphTargetDictionary) this.morphMeshes.push(o);
        if (o.morphTargetDictionary && 'eyeBlinkLeft' in o.morphTargetDictionary) this.arkit.push({ mesh: o, idx: o.morphTargetDictionary });
        const m = o.material as THREE.MeshStandardMaterial;
        if (m && m.map && m.alphaTest > 0) {
          m.alphaToCoverage = true;
          m.side = THREE.DoubleSide;
        }
      }
    });
    this.profile = this.bones[PROFILES.mixamo.detect] ? PROFILES.mixamo : this.bones[PROFILES.rocketbox.detect] ? PROFILES.rocketbox : PROFILES.game_engine;
    const UPPER = this.profile.upper;
    this.mixer = new THREE.AnimationMixer(this.model);
    let clips = gltf.animations;
    if (library) {
      const pel = this.bone('pelvis');
      this.model.updateMatrixWorld(true);
      const hip = pel.getWorldPosition(new THREE.Vector3()).y;
      const k = library.restHip ? hip / library.restHip : 1;
      const pelName = pel.name;
      clips = library.clips.map((c) => {
        if (Math.abs(k - 1) < 0.005) return c;
        const cc = c.clone();
        for (const t of cc.tracks) if (t.name === `${pelName}.position`) for (let i = 0; i < t.values.length; i++) t.values[i] *= k;
        return cc;
      });
    }
    for (const c of clips) {
      this.full[c.name] = this.mixer.clipAction(c);
      this.lower[c.name] = this.mixer.clipAction(filterClip(c, (b) => !UPPER.test(b), c.name + '_lower'));
      this.upperActs[c.name] = this.mixer.clipAction(filterClip(c, (b) => UPPER.test(b), c.name + '_upper'));
    }
    this.clipNames = clips.map((c) => c.name);
    for (const [n, a] of Object.entries({ ...this.full, ...this.lower, ...this.upperActs })) {
      const m = meta[n.replace(/_(lower|upper)$/, '')];
      if (m && !m.loop) {
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = true;
      }
    }
    this.calibrate();
    this.play('idle', 0);
  }

  /** Measures where the hips are at key moments of the sitting clips, in character space. */
  private calibrate() {
    const pel = this.bone('pelvis');
    const sample = (name: string, t: number) => {
      this.mixer.stopAllAction();
      const a = this.full[name];
      a.reset().play();
      a.time = Math.min(t, a.getClip().duration - 1e-3);
      a.weight = 1;
      this.mixer.update(0);
      this.root.updateMatrixWorld(true);
      const p = pel.getWorldPosition(new THREE.Vector3());
      return this.root.worldToLocal(p);
    };
    const d = (n: string) => this.full[n].getClip().duration;
    for (const [style, c] of Object.entries(SIT_STYLES)) {
      if (!this.full[c.down] || !this.full[c.idle] || !this.full[c.up]) continue;
      this.pelvisAt[`${style}.downStart`] = sample(c.down, 0);
      this.pelvisAt[`${style}.downEnd`] = sample(c.down, d(c.down));
      this.pelvisAt[`${style}.idle`] = sample(c.idle, 0);
      this.pelvisAt[`${style}.upStart`] = sample(c.up, 0);
      this.pelvisAt[`${style}.upEnd`] = sample(c.up, d(c.up));
    }
    this.pelvisAt.idle = sample('idle', 0);
    // Carrying a bag: which hand the carry clip uses (the one that moves most from idle), and where
    // the handle sits in that hand (at the middle knuckle, hanging upright).
    if (this.full['bag_idle']) {
      const hands = { l: this.bone('hand_l'), r: this.bone('hand_r') };
      if (hands.l && hands.r) {
        sample('idle', 1);
        const before = { l: hands.l.getWorldPosition(new THREE.Vector3()), r: hands.r.getWorldPosition(new THREE.Vector3()) };
        sample('bag_idle', 1);
        const moved = (k: 'l' | 'r') => hands[k].getWorldPosition(new THREE.Vector3()).distanceTo(before[k]);
        const side = moved('l') >= moved('r') ? 'l' : 'r';
        const hand = hands[side];
        const knuckle = this.bone(side === 'l' ? 'middle_01_l' : 'middle_01_r') ?? hand;
        const grip = knuckle.getWorldPosition(new THREE.Vector3()).lerp(hand.getWorldPosition(new THREE.Vector3()), 0.25);
        const hq = hand.getWorldQuaternion(new THREE.Quaternion());
        this.carryLocal = { side, pos: hand.worldToLocal(grip), quat: hq.invert() };
      }
    }
    // Where a glass sits in the right hand while holding a drink: from the finger joints.
    const ids = ['thumb_02_r', 'index_01_r', 'middle_01_r', 'ring_01_r', 'index_02_r'];
    sample('drink_idle', 1.0);
    const g = new THREE.Vector3();
    for (const n of ids) g.add(this.bone(n as Role).getWorldPosition(new THREE.Vector3()));
    g.multiplyScalar(1 / ids.length);
    const hand = this.bone('hand_r');
    const hw = hand.matrixWorld.clone();
    const inv = hw.clone().invert();
    this.holdLocal.pos.copy(g.clone().applyMatrix4(inv));
    const hq = new THREE.Quaternion();
    hw.decompose(new THREE.Vector3(), hq, new THREE.Vector3());
    this.holdLocal.quat.copy(hq.invert()); // upright in the world at this moment
    // The drinking clip is long; find the sip (glass closest to the mouth) and play just that.
    const head = this.bone('head');
    let best = { t: 0, d: Infinity };
    for (let t = 0; t < d('drink'); t += 0.1) {
      sample('drink', t);
      const dd = hand.getWorldPosition(new THREE.Vector3()).distanceTo(head.getWorldPosition(new THREE.Vector3()));
      if (dd < best.d) best = { t, d: dd };
    }
    this.sipWindow = { start: Math.max(0, best.t - 1.7), end: Math.min(d('drink'), best.t + 1.5) };
    if ((this.profile as any).proceduralGrip) {
      for (const side of ['Right', 'Left'] as const) for (const chain of this.fingers(side)) for (const b of chain) this.fingerRest.set(b, b.quaternion.clone());
      this.calibrateGrip();
    }
    this.mixer.stopAllAction();
  }

  private fingers(side: 'Right' | 'Left') {
    const B = (n: string) => this.bones[`mixamorig${side}Hand${n}`];
    return ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'].map((f) => [1, 2, 3].map((k) => B(f + k)).filter(Boolean));
  }

  /** Which way is "curl towards the palm" for this rig: try both, keep the one that closes on the grip point. */
  private calibrateGrip() {
    const hand = this.bone('hand_r');
    const fs = this.fingers('Right')[1];
    const tip = this.bones['mixamorigRightHandIndex4'] ?? fs[2];
    if (!fs.length || !tip) return;
    const target = this.holdLocal.pos.clone().applyMatrix4(hand.matrixWorld);
    const dist = (sign: number) => {
      const saved = fs.map((b) => b.quaternion.clone());
      this.gripSign = sign;
      this.applyGrip(1, ['Right']);
      this.root.updateMatrixWorld(true);
      const d = tip.getWorldPosition(new THREE.Vector3()).distanceTo(target);
      fs.forEach((b, i) => b.quaternion.copy(saved[i]));
      return d;
    };
    this.gripSign = dist(1) < dist(-1) ? 1 : -1;
  }

  /** Curls the fingers round an object: rotate each joint about the hand's knuckle line. */
  private applyGrip(amount: number, sides: ('Right' | 'Left')[] = ['Right']) {
    if (amount <= 0) return;
    for (const side of sides) {
      const fs = this.fingers(side);
      const a = this.bones[`mixamorig${side}HandIndex1`], p = this.bones[`mixamorig${side}HandPinky1`];
      if (!a || !p) continue;
      this.root.updateMatrixWorld(true);
      const lateral = a.getWorldPosition(new THREE.Vector3()).sub(p.getWorldPosition(new THREE.Vector3())).normalize();
      const curls = [[0.35, 0.3, 0.2], [0.95, 1.0, 0.6], [1.0, 1.05, 0.6], [1.0, 1.05, 0.6], [0.95, 1.0, 0.6]];
      fs.forEach((chain, fi) => {
        chain.forEach((b, k) => {
          const parentQ = b.parent!.getWorldQuaternion(new THREE.Quaternion());
          const axisLocal = lateral.clone().applyQuaternion(parentQ.clone().invert()).normalize();
          const ang = curls[fi][k] * amount * this.gripSign * (fi === 0 ? -0.8 : 1);
          b.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axisLocal, ang));
          b.updateMatrixWorld(true);
        });
      });
    }
  }

  /** Seated hip height in character space (for building chairs that fit). */
  seatedHip(style: SitStyle = 'chair') {
    return this.pelvisAt[`${style}.idle`].clone();
  }
  canSit(style: SitStyle) {
    return !!this.pelvisAt[`${style}.idle`];
  }

  private play(name: Base, fade = 0.3) {
    const prev = this.base;
    this.base = name;
    const useLower = !!this.upper;
    const next = (useLower ? this.lower : this.full)[name];
    for (const [n, a] of Object.entries(this.full)) if (n !== name || useLower) a.fadeOut(fade);
    for (const [n, a] of Object.entries(this.lower)) if (n !== name || !useLower) a.fadeOut(fade);
    next.reset().setEffectiveWeight(1).fadeIn(fade).play();
    if (prev !== name) this.onStateChange?.(name);
  }

  private setUpper(name: Upper, fade = 0.35) {
    if (this.upper === name) return;
    const had = this.upper;
    if (had) this.upperActs[had].fadeOut(fade);
    this.upper = name;
    // swap the legs layer between full-body and legs-only
    const b = this.base;
    if (name && !had) {
      this.full[b].fadeOut(fade);
      this.lower[b].reset().setEffectiveWeight(1).fadeIn(fade).play();
      this.lower[b].time = this.full[b].time;
    } else if (!name && had) {
      this.lower[b].fadeOut(fade);
      this.full[b].reset().setEffectiveWeight(1).fadeIn(fade).play();
      this.full[b].time = this.lower[b].time;
    }
    if (name) this.upperActs[name].reset().setEffectiveWeight(1).fadeIn(fade).play();
  }

  sitStyle: SitStyle = 'chair';
  get seated() {
    const c = SIT_STYLES[this.sitStyle];
    return this.base === c.down || this.base === c.idle || this.base === c.up;
  }

  /** Walk to a point on the floor (character space is the world here). */
  walkTo(p: THREE.Vector3, onArrive?: () => void, run = false) {
    if (this.clock < this.busyUntil) return void this.after(this.busyUntil - this.clock + 0.05, () => this.walkTo(p, onArrive, run));
    if (this.seated) {
      this.standUp(() => this.walkTo(p, onArrive, run));
      return;
    }
    if (this.upper && !this.held && !this.carried) this.setUpper(null, 0.2);
    const goal = p.clone().setY(0);
    this.waypoints = this.route ? this.route(this.root.position.clone().setY(0), goal) : [goal];
    if (!this.waypoints.length || this.waypoints[this.waypoints.length - 1].distanceTo(goal) > 0.02) this.waypoints.push(goal);
    this.target = this.waypoints.shift()!;
    this.onArrive = onArrive ?? null;
    this.faceTo = null;
    this.gait = run && this.full.run ? 'run' : 'walk';
    if (this.base !== this.gait) this.play(this.gait, 0.25);
  }

  has(clip: string) {
    return !!this.full[clip];
  }

  /** A full-body loop that runs until the next move (dancing). */
  loop(clip: string) {
    if (!this.full[clip] || this.seated || this.clock < this.busyUntil) return false;
    if (this.upper && !this.held) this.setUpper(null, 0.2);
    this.target = null;
    this.play(clip, 0.4);
    return true;
  }

  /** An upper-body action over whatever the legs are doing (wave, cheer, phone...). */
  gesture(clip: string, seconds?: number) {
    if (!this.upperActs[clip] || this.held) return false;
    this.setUpper(clip);
    const dur = seconds ?? Math.min(this.full[clip].getClip().duration, 6);
    this.after(dur - 0.3, () => this.upper === clip && this.setUpper(null));
    return true;
  }

  /** Walk to a seat, turn, and sit so the hips land on the cushion. */
  sitOn(point: THREE.Vector3, facing: number, style: SitStyle = 'chair', then?: () => void) {
    if (this.seated) return;
    if (!this.canSit(style)) style = 'chair';
    const c = SIT_STYLES[style];
    const P = (k: string) => this.pelvisAt[`${style}.${k}`];
    // Standing spot: where the root must be so that the clip's root motion puts the hips on the seat.
    const end = P('downEnd');
    const stand = point.clone().setY(0).sub(new THREE.Vector3(end.x, 0, end.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), facing));
    this.walkTo(stand, () => {
      this.faceTo = facing;
      this.seat = { point: point.clone(), facing };
      const go = () => {
        if (this.faceTo !== null && Math.abs(angleDiff(this.root.rotation.y, facing)) > 0.05) return void this.after(0.05, go);
        this.sitStyle = style;
        this.play(c.down, 0.35);
        const dur = this.full[c.down].getClip().duration;
        this.busyUntil = this.clock + dur;
        // small differences between chair height and the clip's seat height: lift or lower the body
        const dy = clamp(point.y + HIP_ABOVE_SEAT - end.y, -0.08, 0.08);
        this.lift(dy, dur * 0.8);
        this.after(dur - 0.25, () => {
          // the idle clip's hips may sit a little differently: keep the hips where the sit left them
          const a = P('downEnd'), b = P('idle');
          this.root.position.add(new THREE.Vector3(a.x - b.x, 0, a.z - b.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.root.rotation.y));
          this.play(c.idle, 0.25);
          then?.();
        });
      };
      go();
    });
  }

  /** Places the character already seated (people who were there before the scene began). */
  seatAt(point: THREE.Vector3, facing: number, style: SitStyle = 'chair') {
    if (!this.canSit(style)) style = 'chair';
    const idle = this.pelvisAt[`${style}.idle`];
    this.root.rotation.y = facing;
    this.root.position.copy(point).setY(0).sub(new THREE.Vector3(idle.x, 0, idle.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), facing));
    this.root.position.y = clamp(point.y + HIP_ABOVE_SEAT - idle.y, -0.08, 0.08);
    this.sitStyle = style;
    this.seat = { point: point.clone(), facing };
    this.play(SIT_STYLES[style].idle, 0);
    this.mixer.update(Math.random() * 10);
  }
  /** Tells the character to stop whatever it was walking to. */
  halt() {
    this.target = null;
    this.waypoints = [];
    this.onArrive = null;
  }
  get walking() {
    return !!this.target;
  }

  private lift(dy: number, seconds: number) {
    const y0 = this.root.position.y, t0 = this.clock;
    const tick = () => {
      const k = Math.min(1, (this.clock - t0) / Math.max(0.01, seconds));
      this.root.position.y = y0 + (dy - y0) * k * k * (3 - 2 * k);
      if (k < 1) this.after(0, tick);
    };
    tick();
  }

  standUp(then?: () => void) {
    if (this.clock < this.busyUntil) return void this.after(this.busyUntil - this.clock + 0.05, () => this.standUp(then));
    if (!this.seated) return then?.();
    const style = this.sitStyle, c = SIT_STYLES[style];
    const P = (k: string) => this.pelvisAt[`${style}.${k}`];
    const a = P('idle'), b = P('upStart');
    this.root.position.add(new THREE.Vector3(a.x - b.x, 0, a.z - b.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.root.rotation.y));
    this.play(c.up, 0.25);
    const dur = this.full[c.up].getClip().duration;
    this.busyUntil = this.clock + dur;
    this.lift(0, dur * 0.7);
    this.after(dur - 0.2, () => {
      this.busyUntil = 0;
      // bake where the hips walked to into the character's position, then stand idle
      const e = P('upEnd'), i = this.pelvisAt.idle;
      this.root.position.add(new THREE.Vector3(e.x - i.x, 0, e.z - i.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.root.rotation.y));
      this.seat = null;
      this.play('idle', 0.25);
      if (this.carried) this.setUpper(this.carryClip(), 0.3);
      then?.();
    });
  }

  private timers: { at: number; fn: () => void }[] = [];
  after(sec: number, fn: () => void) {
    this.timers.push({ at: this.clock + sec, fn });
  }

  /** Turn on the spot to face a point, then continue. */
  face(p: THREE.Vector3, then?: () => void) {
    const want = Math.atan2(p.x - this.root.position.x, p.z - this.root.position.z);
    this.faceTo = want;
    const wait = () => {
      if (this.faceTo !== null) return void this.after(0.05, wait);
      then?.();
    };
    wait();
  }

  wave() {
    if (this.upper === 'drink_idle' || this.upper === 'drink') return;
    if (this.seated) return this.talkSeated(3);
    this.setUpper('wave');
    this.after(this.full['wave'].getClip().duration - 0.4, () => this.upper === 'wave' && this.setUpper(null));
  }

  /** Takes an object into the right hand (it's parented to the hand bone; fingers close round it). */
  hold(obj: THREE.Object3D, ms = 450) {
    this.setUpper('drink_idle');
    const hand = this.bone('hand_r');
    const startW = obj.getWorldPosition(new THREE.Vector3());
    const startQ = obj.getWorldQuaternion(new THREE.Quaternion());
    const t0 = this.clock;
    this.held = obj;
    const step = () => {
      const k = Math.min(1, (this.clock - t0) / (ms / 1000));
      const e = k * k * (3 - 2 * k);
      const target = this.holdLocal.pos.clone().applyMatrix4(hand.matrixWorld);
      const hq = hand.getWorldQuaternion(new THREE.Quaternion()).multiply(this.holdLocal.quat);
      if (k < 1) {
        obj.parent?.remove(obj);
        this.root.parent?.add(obj);
        obj.position.lerpVectors(startW, target, e);
        obj.quaternion.slerpQuaternions(startQ, hq, e);
        requestAnimationFrame(step);
      } else {
        hand.add(obj);
        obj.position.copy(this.holdLocal.pos);
        obj.quaternion.copy(this.holdLocal.quat);
      }
    };
    step();
  }

  sip() {
    if (!this.held || this.upper === 'drink') return;
    this.setUpper('drink', 0.3);
    const a = this.upperActs['drink'];
    a.time = this.sipWindow.start;
    this.after(this.sipWindow.end - this.sipWindow.start, () => this.upper === 'drink' && this.setUpper('drink_idle', 0.4));
  }

  /** Mouth moves while a line is spoken; amplitude comes from audio when available. */
  speak(seconds: number) {
    this.speaking = Math.max(this.speaking, seconds);
    if (!this.upper && !this.seated) this.setUpper('talk');
    else if (!this.upper && this.seated) this.talkSeated(seconds);
    this.after(seconds, () => this.upper === 'talk' && this.setUpper(null));
  }

  /** Seated conversation: the upper body gestures while the hips stay in the chair. */
  talkSeated(seconds: number) {
    const opts = SIT_STYLES[this.sitStyle].talk.filter((n) => this.upperActs[n]);
    const clip = opts.length ? opts[Math.floor(Math.random() * opts.length)] : null;
    if (!clip || this.base !== SIT_STYLES[this.sitStyle].idle || this.held) return;
    this.setUpper(clip, 0.4);
    this.after(Math.max(2.5, seconds), () => this.upper === clip && this.setUpper(null, 0.5));
  }
  mouthLevel = (): number | null => null;

  /** Carries an object (a handbag) in one hand; the arm keeps a carrying pose while walking. */
  carry(obj: THREE.Object3D, side?: 'l' | 'r', local?: { pos: THREE.Vector3; quat?: THREE.Quaternion }) {
    side ??= this.carryLocal?.side ?? 'l';
    local ??= this.carryLocal && this.carryLocal.side === side ? this.carryLocal : undefined;
    const hand = side === 'l' ? this.bone('hand_l') : this.bone('hand_r');
    if (!hand) return;
    hand.add(obj);
    obj.position.copy(local?.pos ?? new THREE.Vector3());
    obj.quaternion.copy(local?.quat ?? new THREE.Quaternion());
    this.carried = { obj, side };
    if (!this.seated) this.setUpper(this.carryClip(), 0.3);
  }
  /** Puts the carried object down at a world position. */
  putDown(at: THREE.Vector3, parent: THREE.Object3D, rotY = 0) {
    if (!this.carried) return;
    const o = this.carried.obj;
    this.carried = null;
    parent.add(o);
    o.position.copy(parent.worldToLocal(at.clone()));
    o.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
    if (this.upper === 'bag_idle') this.setUpper(null, 0.3);
  }
  private carryClip() {
    return this.upperActs['bag_idle'] ? 'bag_idle' : null;
  }

  /** Sets a facial expression (ARKit avatars); it eases in and holds until changed. */
  express(name: string, seconds?: number) {
    const e = EXPRESSIONS[name];
    if (!e) return;
    this.exprName = name;
    this.exprTarget = { ...e };
    if (seconds) this.after(seconds, () => this.exprName === name && this.express('neutral'));
  }
  get expression() {
    return this.exprName;
  }

  /** ARKit face: blink, eyes, expression, and speech as jaw + visemes. */
  private drive(blink: number, dt: number) {
    if (!this.arkit.length) return;
    const k = Math.min(1, dt * 6);
    const names = new Set([...Object.keys(this.exprNow), ...Object.keys(this.exprTarget)]);
    for (const n of names) {
      const v = (this.exprNow[n] ?? 0) + ((this.exprTarget[n] ?? 0) - (this.exprNow[n] ?? 0)) * k;
      if (Math.abs(v) < 1e-3 && !this.exprTarget[n]) delete this.exprNow[n];
      else this.exprNow[n] = v;
    }
    this.visemeT -= dt;
    if (this.visemeT <= 0) {
      this.viseme = VISEMES[Math.floor(Math.random() * VISEMES.length)];
      this.visemeT = 0.07 + Math.random() * 0.09;
    }
    for (const { mesh, idx } of this.arkit) {
      const w = mesh.morphTargetInfluences!;
      w.fill(0);
      for (const [n, v] of Object.entries(this.exprNow)) if (idx[n] !== undefined) w[idx[n]] = v;
      const sm = this.exprNow.mouthSmileLeft ?? 0;
      if (idx.eyeBlinkLeft !== undefined) w[idx.eyeBlinkLeft] = Math.max(blink, sm * 0.15);
      if (idx.eyeBlinkRight !== undefined) w[idx.eyeBlinkRight] = Math.max(blink, sm * 0.15);
      if (this.mouth > 0.01) {
        if (idx.jawOpen !== undefined) w[idx.jawOpen] = Math.max(w[idx.jawOpen], this.mouth * 0.35);
        if (idx[this.viseme] !== undefined) w[idx[this.viseme]] = Math.min(1, this.mouth * 1.1);
      }
    }
  }

  update(dt: number) {
    this.clock += dt;
    for (const t of [...this.timers]) {
      if (this.clock >= t.at) {
        this.timers.splice(this.timers.indexOf(t), 1);
        t.fn();
      }
    }
    // Locomotion: move at the walk clip's own speed, turning toward the target.
    if (this.target && this.base === this.gait) {
      const to = this.target.clone().sub(this.root.position);
      to.y = 0;
      const dist = to.length();
      const speed = this.meta[this.gait]?.speed ?? 1.1;
      if (dist < 0.25 && this.waypoints.length) {
        this.target = this.waypoints.shift()!; // corner: carry on to the next waypoint without stopping
      } else if (dist < 0.06) {
        this.target = null;
        this.play('idle', 0.3);
        if (this.carried && !this.upper) this.setUpper(this.carryClip(), 0.3);
        const cb = this.onArrive;
        this.onArrive = null;
        cb?.();
      } else {
        const want = Math.atan2(to.x, to.z);
        const diff = angleDiff(this.root.rotation.y, want);
        this.root.rotation.y += clamp(diff, -dt * 4.5, dt * 4.5);
        // slow down while turning sharply and when arriving, so feet keep contact
        const k = Math.max(0.25, Math.cos(Math.min(Math.abs(diff), Math.PI / 2)));
        const v = Math.min(dist / dt, speed * k);
        const a = (this.upper ? this.lower : this.full)[this.gait];
        a.timeScale = v / speed;
        this.root.position.addScaledVector(new THREE.Vector3(Math.sin(this.root.rotation.y), 0, Math.cos(this.root.rotation.y)), v * dt);
      }
    } else if (this.faceTo !== null) {
      const diff = angleDiff(this.root.rotation.y, this.faceTo);
      if (Math.abs(diff) < 0.05) {
        this.root.rotation.y = this.faceTo;
        this.faceTo = null;
        if (this.base === 'walk') this.play('idle', 0.2);
      } else {
        if (this.base !== 'walk') this.play('walk', 0.2);
        this.full.walk.timeScale = 0.55;
        this.root.rotation.y += clamp(diff, -dt * 3.2, dt * 3.2);
      }
    }
    this.mixer.update(dt);
    if ((this.profile as any).proceduralGrip) {
      // While holding something the fingers are posed in code (start from rest each frame, then curl);
      // otherwise the clips (Meshy's own walk/run animate the fingers) are left alone.
      this.grip += ((this.held ? 1 : 0) - this.grip) * Math.min(1, dt * 6);
      if (this.grip > 0.002) {
        for (const [b, q] of this.fingerRest) b.quaternion.copy(q);
        this.applyGrip(this.grip);
      }
    }
    // Face: blink every few seconds, mouth while speaking.
    this.blinkT -= dt;
    let blink = 0;
    if (this.blinkT < 0.15) blink = Math.sin((Math.max(0, this.blinkT) / 0.15) * Math.PI);
    if (this.blinkT < 0) this.blinkT = 2 + Math.random() * 3.5;
    this.speaking = Math.max(0, this.speaking - dt);
    const lvl = this.mouthLevel();
    const target = this.speaking > 0 ? (lvl ?? 0.35 + 0.35 * Math.abs(Math.sin(this.clock * 13) * Math.sin(this.clock * 7.3))) : 0;
    this.mouth += (target - this.mouth) * Math.min(1, dt * 18);
    this.drive(blink, dt);
    for (const m of this.morphMeshes) {
      const d = m.morphTargetDictionary!, w = m.morphTargetInfluences!;
      w[d.mouthOpen] = this.mouth * 0.75;
      w[d.blinkL] = blink;
      w[d.blinkR] = blink;
      if (d.smile !== undefined) w[d.smile] = 0.25;
    }
  }
}

export function angleDiff(a: number, b: number) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
