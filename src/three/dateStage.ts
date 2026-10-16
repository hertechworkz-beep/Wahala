import * as THREE from 'three';
import { HIP_ABOVE_SEAT, type Character } from './character';
import { createEngine, within } from './engine';
import { buildNav } from './nav';
import { loadPerson, PEOPLE } from './people';
import { handbag, wineGlass } from './props';
import { buildVenue, touchTarget, type Seat } from './venue';
import { speak } from './voice';
import { sound } from '../ui/audio';
import type { DateScene, Line } from './scenes/firstDate';

// The date director: runs any DateScene. You control your own body by tapping the world: walk,
// choose a table, sit, pick up your glass, drink. Your date arrives, greets you, sits across,
// talks; the waiter serves; other diners live their own evening and react if you bother them.

export interface DateEvents {
  onProgress?: (p: number) => void;
  onReady?: () => void;
  onHint?: (h: string) => void;
  onSay?: (who: string, text: string, seconds: number) => void;
  onSayEnd?: () => void;
}

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

export async function startDateStage(canvas: HTMLCanvasElement, cfg: DateScene, ev: DateEvents = {}, opts: { capture?: boolean } = {}) {
  let tapHandler = (_x: number, _y: number): string | void => {};
  const E = createEngine(canvas, cfg.venue.mood, (x, y) => tapHandler(x, y));
  const { scene, camera, controls } = E;

  // People (loaded together; progress is the share that has arrived)
  const ids = [cfg.player.who, cfg.date.who, ...cfg.extras.map((e) => e.who)];
  let done = 0;
  ev.onProgress?.(0.03);
  const people = await Promise.all(
    ids.map((id) =>
      loadPerson(id).then((c) => {
        ev.onProgress?.(0.05 + (++done / ids.length) * 0.8);
        return c;
      }),
    ),
  );
  const [player, date, ...extras] = people;

  // Venue, with chairs at the height our two leads sit at
  const seatTop = (player.seatedHip('table').y + date.seatedHip('table').y) / 2 - HIP_ABOVE_SEAT;
  const V = buildVenue(cfg.venue, { seatTop, lite: E.lite });
  scene.add(V.group);
  const m = cfg.venue.mood;
  scene.add(new THREE.HemisphereLight('#ffe7cf', '#2a1610', m.ambient));
  const key = new THREE.DirectionalLight(m.key.color, m.key.intensity);
  key.position.set(...m.key.at);
  key.castShadow = true;
  key.shadow.mapSize.set(E.lite ? 1024 : 2048, E.lite ? 1024 : 2048);
  const half = Math.max(cfg.venue.room.width, cfg.venue.room.depth) / 2 + 0.5;
  Object.assign(key.shadow.camera, { left: -half, right: half, top: half, bottom: -half });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  scene.add(key);

  const nav = await buildNav(V.floor, V.obstacles);
  for (const c of people) {
    c.route = nav.route;
    c.root.add(touchTarget(0.55, 1.75, 0.45));
    scene.add(c.root);
  }
  ev.onProgress?.(0.95);

  // Voices and speech bubbles
  const voiceOf = (c: Character) => PEOPLE[ids[people.indexOf(c)]].voice;
  const keyOf = (c: Character) => (c === date ? cfg.date.voiceKey : c === player ? 'player' : ids[people.indexOf(c)]);
  let talking = 0;
  const say = async (c: Character, line: Line, expr?: string) => {
    const s = await speak(keyOf(c), line.id, line.text, voiceOf(c));
    c.mouthLevel = s.level;
    c.speak(s.seconds);
    if (expr) c.express(expr, s.seconds + 1.5);
    ev.onSay?.(c === player ? 'You' : c.name, line.text, s.seconds);
    const mine = ++talking;
    c.after(s.seconds + 0.5, () => mine === talking && ev.onSayEnd?.());
    return s.seconds;
  };

  // Scene clock and timers (separate from each character's own)
  let clock = 0;
  const timers: { at: number; fn: () => void }[] = [];
  const after = (sec: number, fn: () => void) => timers.push({ at: clock + sec, fn });

  // Extras: seated diners and the waiter on his rounds
  const seatOf = new Map<Character, Seat>();
  const waiterPatrol: { c: Character; route: string[]; i: number; busy: boolean }[] = [];
  cfg.extras.forEach((e, i) => {
    const c = extras[i];
    if ('seat' in e) {
      const s = V.seats[e.seat];
      c.seatAt(s.point, s.facing, s.style);
      s.taken = c.name;
      seatOf.set(c, s);
      // their own evening: chat, laugh, phone
      const live = () => {
        const habit = e.habit ?? 'chat';
        if (habit === 'phone') c.gesture('phone', 8);
        else if (Math.random() < 0.6) {
          c.speak(2 + Math.random() * 3);
          if (Math.random() < 0.5) c.express('smile', 4);
        } else if (c.has('laugh')) {
          c.gesture('laugh', 3.5);
          c.express('smile', 4);
        } else c.talkSeated(3);
        c.after(5 + Math.random() * 7, live);
      };
      c.after(1 + Math.random() * 4, live);
    } else {
      const route = e.patrol;
      c.root.position.copy(V.spots[route[0]]);
      const w = { c, route, i: 0, busy: false };
      waiterPatrol.push(w);
      const next = () => {
        if (w.busy) return;
        w.i = (w.i + 1) % route.length;
        c.walkTo(V.spots[route[w.i]], () => c.after(3 + Math.random() * 4, next));
      };
      c.after(2, next);
      (w as any).resume = next;
    }
  });
  const waiter = waiterPatrol[0];

  // You: at the entrance with your bag
  player.root.position.copy(V.spots[cfg.player.start]);
  player.root.rotation.y = Math.PI;
  const bag = handbag(cfg.player.bag);
  bag.scale.setScalar(0.85);
  const bagTouch = touchTarget(0.34, 0.3, 0.2);
  bagTouch.position.y = -0.3;
  bag.add(bagTouch);
  bag.traverse((o: any) => (o.castShadow = true));
  player.carry(bag);

  // Your date waits outside until you've sat down
  date.root.visible = false;
  date.root.position.copy(V.spots[cfg.date.enterFrom]);
  let yourSeat: Seat | null = null;
  let theirSeat: Seat | null = null;
  let dateState: 'away' | 'arriving' | 'seated' | 'leftAlone' = 'away';
  const glasses = new Map<Character, THREE.Object3D>();
  let served = false;

  // Free chairs glow gently while you're choosing
  const rings: { ring: THREE.Mesh; seat: Seat }[] = [];
  for (const s of Object.values(V.seats)) {
    if (s.taken) continue;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.24, 40), new THREE.MeshBasicMaterial({ color: '#F59E0B', transparent: true, opacity: 0, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(s.point).setY(0.012);
    scene.add(ring);
    rings.push({ ring, seat: s });
  }
  const marker = new THREE.Mesh(new THREE.RingGeometry(0.09, 0.12, 32), new THREE.MeshBasicMaterial({ color: '#F59E0B', transparent: true, opacity: 0 }));
  marker.rotation.x = -Math.PI / 2;
  scene.add(marker);
  let markerT = 0;
  const showMarker = (p: THREE.Vector3) => {
    marker.position.set(p.x, 0.012, p.z);
    markerT = 1.2;
  };

  function sitPlayer(s: Seat) {
    if (yourSeat === s) return;
    if (yourSeat) yourSeat.taken = null;
    yourSeat = s;
    s.taken = 'You';
    showMarker(s.point.clone().setY(0));
    ev.onHint?.('');
    player.sitOn(s.point, s.facing, s.style, () => {
      if (yourSeat !== s) return;
      // the bag goes on the table, on the other side of your plate from the glass
      player.putDown(s.bagSpot.clone().setY(s.bagSpot.y + bag.userData.baseOffset * 0.85), scene, s.facing + Math.PI / 2);
      onPlayerSeated(s);
    });
  }

  function onPlayerSeated(s: Seat) {
    const across = s.across ? V.seats[s.across] : null;
    if (dateState === 'away' && across && !across.taken) {
      theirSeat = across;
      across.taken = date.name;
      dateState = 'arriving';
      after(cfg.date.delay, dateArrives);
    } else if (dateState === 'leftAlone' && theirSeat && s === V.seats[theirSeat.across!]) {
      dateState = 'seated';
      date.express('smile', 4);
      say(date, pick(cfg.lines.welcomeBack));
    }
  }

  function dateArrives() {
    const s = theirSeat!;
    date.root.visible = true;
    date.root.position.copy(V.spots[cfg.date.enterFrom]);
    date.root.rotation.y = Math.PI;
    sound.effect('door');
    // walk to just short of the table, greet, then take the seat
    const t = V.tables[s.table!];
    const toward = date.root.position.clone().sub(t.position).setY(0).normalize();
    const greetAt = nav.closest(t.position.clone().add(toward.multiplyScalar(1.5)));
    date.walkTo(greetAt, () => {
      date.face(player.root.position, () => {
        date.wave();
        date.express('smile', 5);
        say(date, pick(cfg.lines.arrive)).then((sec) =>
          date.after(Math.max(1.5, sec - 0.5), () =>
            date.sitOn(s.point, s.facing, s.style, () => {
              dateState = 'seated';
              after(2, waiterServes);
            }),
          ),
        );
      });
    });
  }

  function waiterServes() {
    if (served || !waiter || !yourSeat || !theirSeat) return;
    served = true;
    waiter.busy = true;
    const t = V.tables[yourSeat.table!];
    // stand at the open side of the table (perpendicular to the two chairs)
    const across = theirSeat.point.clone().sub(yourSeat.point).setY(0).normalize();
    const side = new THREE.Vector3(-across.z, 0, across.x);
    const a = t.position.clone().add(side.clone().multiplyScalar(0.85));
    const b = t.position.clone().sub(side.clone().multiplyScalar(0.85));
    const spot = a.distanceTo(waiter.c.root.position) < b.distanceTo(waiter.c.root.position) ? a : b;
    waiter.c.walkTo(spot, () => {
      waiter.c.face(t.position, () => {
        waiter.c.gesture('invite_sit', 2.5);
        say(waiter.c, pick(cfg.lines.waiterServe));
        waiter.c.after(1.2, () => {
          for (const [c, s] of [[player, yourSeat!], [date, theirSeat!]] as const) {
            const g = wineGlass();
            const touch = touchTarget(0.22, 0.34, 0.22);
            touch.position.y = -0.14;
            g.add(touch);
            g.position.copy(s.place).setY(t.userData.topY + g.userData.baseOffset);
            g.traverse((o: any) => (o.castShadow = true));
            scene.add(g);
            glasses.set(c, g);
          }
          sound.effect('clink');
        });
        waiter.c.after(3.5, () => {
          waiter.busy = false;
          (waiter as any).resume();
        });
      });
    });
  }

  function toast() {
    const mine = glasses.get(player), theirs = glasses.get(date);
    if (!mine || !theirs) return;
    if (date.held !== theirs) date.hold(theirs);
    if (player.held !== mine) player.hold(mine);
    date.after(0.8, () => {
      say(date, pick(cfg.lines.toast), 'smile');
      date.after(1.6, () => {
        sound.effect('clink');
        date.sip();
        player.sip();
      });
    });
  }

  // Taps
  let lastFloorTap = { t: -1, x: 0, y: 0 };
  tapHandler = (x, y) => {
    sound.unlock();
    const glassList = [...glasses.values()];
    const chairs = Object.values(V.seats).map((s) => s.chair);
    const h = E.pick(x, y, [date.root, ...extras.map((c) => c.root), ...glassList, bag, ...chairs, ...V.floor]);
    if (!h) return 'nothing';
    const o = h.object;
    const hit = `${o.name || o.type}@${h.point.toArray().map((v) => v.toFixed(2))}`;
    void hit;
    // your own glass
    const mine = glasses.get(player);
    if (mine && within(o, mine)) {
      if (!yourSeat || !player.seated) return;
      if (player.held === mine) player.sip();
      else player.hold(mine);
      return;
    }
    if (glassList.some((g) => within(o, g))) return; // someone else's
    if (within(o, date.root) && date.root.visible) {
      if (dateState !== 'seated') return void date.wave();
      if (player.held) return toast();
      date.talkSeated(4);
      say(date, pick(cfg.lines.smalltalk)).then((sec) => after(sec + 0.6, () => player.seated && say(player, pick(cfg.lines.playerReply), 'smile')));
      return;
    }
    for (const c of extras) {
      if (!within(o, c.root)) continue;
      if (c === waiter?.c) return void (c.face(player.root.position), say(c, pick(cfg.lines.waiterTapped)));
      c.express('surprised', 2);
      say(c, pick(cfg.lines.dinerTapped));
      return;
    }
    const seat = Object.values(V.seats).find((s) => within(o, s.chair));
    if (seat) {
      if (seat.taken && seat.taken !== 'You') {
        const occupant = extras.find((c) => seatOf.get(c) === seat) ?? (seat === theirSeat ? date : null);
        if (occupant && occupant !== date) {
          occupant.express('angry', 3);
          say(occupant, pick(cfg.lines.seatTaken));
        }
        return;
      }
      sitPlayer(seat);
      return `sit ${seat.id}`;
    }
    // the floor: walk (a quick second tap runs)
    const p = h.point.clone().setY(0);
    const now = performance.now();
    const run = now - lastFloorTap.t < 380 && Math.hypot(x - lastFloorTap.x, y - lastFloorTap.y) < 40;
    lastFloorTap = { t: now, x, y };
    if (player.held && !player.seated) return; // hands full of glass: stay put
    if (player.held) {
      // put the glass back first
      const g = player.held;
      player.held = null;
      scene.attach(g);
      g.position.copy(yourSeat!.place).setY(V.tables[yourSeat!.table!].userData.topY + g.userData.baseOffset);
      g.quaternion.identity();
      (player as any).setUpper(null, 0.3);
    }
    if (yourSeat && dateState === 'seated') {
      dateState = 'leftAlone';
      date.express('sad', 5);
      date.after(1.2, () => say(date, pick(cfg.lines.leftAlone)));
    }
    if (yourSeat) {
      yourSeat.taken = null;
      yourSeat = null;
      // pick the bag back up on the way
      player.standUp(() => player.carry(bag));
    }
    player.walkTo(p, undefined, run);
    showMarker(p);
    return `walk ${hit}`;
  };

  // Loop
  sound.setAmbience(cfg.venue.ambience as any, `${cfg.venue.id}:ambience`);
  const step = (dt: number) => {
    clock += dt;
    for (const t of [...timers]) if (clock >= t.at) (timers.splice(timers.indexOf(t), 1), t.fn());
    for (const c of people) c.update(dt);
    V.tick(clock);
    // you look at your date when both are seated
    const focus = () => {
      if (yourSeat && dateState === 'seated' && player.seated) return player.root.position.clone().lerp(date.root.position, 0.5).setY(0.95);
      return player.root.position.clone().setY(player.seated ? 0.9 : 1.2);
    };
    if (!(window as any).__camLock) E.follow(focus, dt);
    markerT = Math.max(0, markerT - dt);
    (marker.material as THREE.MeshBasicMaterial).opacity = Math.min(0.9, markerT);
    const choosing = !yourSeat;
    for (const { ring, seat } of rings) {
      const mat = ring.material as THREE.MeshBasicMaterial;
      const want = choosing && !seat.taken ? 0.35 + Math.sin(clock * 3) * 0.2 : 0;
      mat.opacity += (want - mat.opacity) * Math.min(1, dt * 4);
    }
  };
  controls.target.copy(player.root.position).setY(1.2);
  camera.position.set(player.root.position.x + 0.8, 2.6, player.root.position.z + 3.2);
  const frame = E.start(step, opts.capture);
  ev.onProgress?.(1);
  ev.onReady?.();
  ev.onHint?.('Pick a table.');

  return {
    step: frame,
    tap: (x: number, y: number) => tapHandler(x, y),
    screenOf: E.screenOf,
    clips: () => player.clipNames,
    act(name: string) {
      if (name === 'walk' || name === 'run') return player.walkTo(nav.closest(player.root.position.clone().add(new THREE.Vector3(0, 0, -2))), undefined, name === 'run');
      if (['idle', 'idle2', 'dance', 'dance2'].includes(name)) return player.loop(name);
      if (['smile', 'flirty', 'angry', 'sad', 'surprised', 'neutral'].includes(name)) return player.express(name, 4);
      return player.gesture(name);
    },
    dispose() {
      E.dispose();
      if ('speechSynthesis' in window) speechSynthesis.cancel();
    },
    debug: { E, player, date, extras, V, nav, scene, camera, controls, seats: V.seats, glasses },
  };
}
