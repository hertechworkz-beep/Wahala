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
    names: { pelvis: 'pelvis', head: 'head', hand_r: 'hand_r', thumb_02_r: 'thumb_02_r', index_01_r: 'index_01_r', index_02_r: 'index_02_r', middle_01_r: 'middle_01_r', ring_01_r: 'ring_01_r' },
  },
  mixamo: {
    // three.js strips the ':' from "mixamorig:Hips"
    detect: 'mixamorigHips',
    proceduralGrip: true, // finger motion isn't retargeted onto this rig; the grip is posed in code
    upper: /^(mixamorig(Spine1|Spine2|Neck|Head|LeftShoulder|RightShoulder|LeftArm|RightArm|LeftForeArm|RightForeArm|LeftHand|RightHand)|headfront)/,
    names: { pelvis: 'mixamorigHips', head: 'mixamorigHead', hand_r: 'mixamorigRightHand', thumb_02_r: 'mixamorigRightHandThumb2', index_01_r: 'mixamorigRightHandIndex1', index_02_r: 'mixamorigRightHandIndex2', middle_01_r: 'mixamorigRightHandMiddle1', ring_01_r: 'mixamorigRightHandRing1' },
  },
};
type Role = keyof (typeof PROFILES)['game_engine']['names'];

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

  constructor(gltf: { scene: THREE.Object3D; animations: THREE.AnimationClip[] }, meta: Record<string, ClipMeta>) {
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
        const m = o.material as THREE.MeshStandardMaterial;
        if (m && m.map && m.alphaTest > 0) {
          m.alphaToCoverage = true;
          m.side = THREE.DoubleSide;
        }
      }
    });
    this.profile = this.bones[PROFILES.mixamo.detect] ? PROFILES.mixamo : PROFILES.game_engine;
    const UPPER = this.profile.upper;
    this.mixer = new THREE.AnimationMixer(this.model);
    for (const c of gltf.animations) {
      this.full[c.name] = this.mixer.clipAction(c);
      this.lower[c.name] = this.mixer.clipAction(filterClip(c, (b) => !UPPER.test(b), c.name + '_lower'));
      this.upperActs[c.name] = this.mixer.clipAction(filterClip(c, (b) => UPPER.test(b), c.name + '_upper'));
    }
    this.clipNames = gltf.animations.map((c) => c.name);
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
    this.pelvisAt.sitDownStart = sample('sit_down', 0);
    this.pelvisAt.sitDownEnd = sample('sit_down', d('sit_down'));
    this.pelvisAt.sitIdle = sample('sit_idle', 0);
    this.pelvisAt.standStart = sample('stand_up', 0);
    this.pelvisAt.standEnd = sample('stand_up', d('stand_up'));
    this.pelvisAt.idle = sample('idle', 0);
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
  seatedHip() {
    return this.pelvisAt.sitIdle.clone();
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

  get seated() {
    return this.base === 'sit_down' || this.base === 'sit_idle' || this.base === 'stand_up';
  }

  /** Walk to a point on the floor (character space is the world here). */
  walkTo(p: THREE.Vector3, onArrive?: () => void, run = false) {
    if (this.clock < this.busyUntil) return void this.after(this.busyUntil - this.clock + 0.05, () => this.walkTo(p, onArrive, run));
    if (this.seated) {
      this.standUp(() => this.walkTo(p, onArrive, run));
      return;
    }
    if (this.upper && !this.held) this.setUpper(null, 0.2);
    this.target = p.clone().setY(0);
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
  sitOn(point: THREE.Vector3, facing: number) {
    if (this.seated) return;
    // Standing spot: from where sit_down starts to where the hips end up, rotated to face out of the chair.
    const end = this.pelvisAt.sitDownEnd.clone();
    const start = this.pelvisAt.sitDownStart.clone();
    const shift = new THREE.Vector3(end.x - start.x, 0, end.z - start.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), facing);
    const seatOffset = new THREE.Vector3(end.x, 0, end.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), facing);
    const stand = point.clone().setY(0).sub(seatOffset);
    void shift;
    this.walkTo(stand, () => {
      this.faceTo = facing;
      this.seat = { point: point.clone(), facing };
      const go = () => {
        if (this.faceTo !== null && Math.abs(angleDiff(this.root.rotation.y, facing)) > 0.05) return requestAnimationFrame(go);
        this.play('sit_down', 0.35);
        this.busyUntil = this.clock + this.full['sit_down'].getClip().duration;
        this.after(this.full['sit_down'].getClip().duration - 0.25, () => {
          // sit_idle's hips may sit a little differently: keep the hips where sit_down left them.
          const a = this.pelvisAt.sitDownEnd, b = this.pelvisAt.sitIdle;
          const d = new THREE.Vector3(a.x - b.x, 0, a.z - b.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.root.rotation.y);
          this.root.position.add(d);
          this.play('sit_idle', 0.25);
        });
      };
      go();
    });
  }

  standUp(then?: () => void) {
    if (this.clock < this.busyUntil) return void this.after(this.busyUntil - this.clock + 0.05, () => this.standUp(then));
    if (!this.seated) return then?.();
    const a = this.pelvisAt.sitIdle, b = this.pelvisAt.standStart;
    this.root.position.add(new THREE.Vector3(a.x - b.x, 0, a.z - b.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.root.rotation.y));
    this.play('stand_up', 0.25);
    const dur = this.full['stand_up'].getClip().duration;
    this.busyUntil = this.clock + dur;
    this.after(dur - 0.2, () => {
      this.busyUntil = 0;
      // bake where the hips walked to into the character's position, then stand idle
      const e = this.pelvisAt.standEnd, i = this.pelvisAt.idle;
      this.root.position.add(new THREE.Vector3(e.x - i.x, 0, e.z - i.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.root.rotation.y));
      this.seat = null;
      this.play('idle', 0.25);
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
    const clip = this.upperActs['sit_talk'] ? 'sit_talk' : this.upperActs['sit_shrug'] ? 'sit_shrug' : null;
    if (!clip || this.base !== 'sit_idle') return;
    this.setUpper(clip, 0.4);
    this.after(Math.max(2.5, seconds), () => this.upper === clip && this.setUpper(null, 0.5));
  }
  mouthLevel = (): number | null => null;

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
      if (dist < 0.06) {
        this.target = null;
        this.play('idle', 0.3);
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
