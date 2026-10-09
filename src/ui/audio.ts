// Soundscapes and UI sounds, synthesised with WebAudio so the game ships with zero audio
// downloads (fast on 3G). Drop real files into public/audio/<id>.mp3 to replace any layer.

type LayerId = string;

class Sound {
  ctx: AudioContext | null = null;
  master!: GainNode;
  amb!: GainNode;
  sfx!: GainNode;
  noise!: AudioBuffer;
  muted = false;
  lowEnd = false;
  private layers: { id: LayerId; stop: () => void }[] = [];
  private current = '';
  private fileCache = new Map<string, boolean>();
  private listeners = new Set<() => void>();

  constructor() {
    try {
      this.muted = localStorage.getItem('wahala.muted') === '1';
    } catch {
      /* ignore */
    }
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Must be called from a user gesture (browsers block autoplay). */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(this.ctx.destination);
    this.amb = this.ctx.createGain();
    this.amb.gain.value = 0.55;
    this.amb.connect(this.master);
    this.sfx = this.ctx.createGain();
    this.sfx.gain.value = 0.8;
    this.sfx.connect(this.master);
    const len = this.ctx.sampleRate * 2;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  setMuted(m: boolean) {
    this.muted = m;
    try {
      localStorage.setItem('wahala.muted', m ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
    if (m && 'speechSynthesis' in window) speechSynthesis.cancel();
    this.listeners.forEach((f) => f());
  }

  /** Ambience lowers under dialogue. */
  duck(on: boolean) {
    if (!this.ctx) return;
    this.amb.gain.setTargetAtTime(on ? 0.28 : 0.55, this.ctx.currentTime, 0.25);
  }

  setAmbience(ids: string[], key: string) {
    if (!this.ctx || key === this.current) return;
    this.current = key;
    const old = this.layers;
    this.layers = [];
    old.forEach((l) => l.stop());
    const list = this.lowEnd ? ids.slice(0, 1) : ids;
    for (const id of list) this.startLayer(id);
  }

  stopAmbience() {
    this.current = '';
    this.layers.forEach((l) => l.stop());
    this.layers = [];
  }

  private async startLayer(id: string) {
    const key = this.current;
    if (await this.hasFile(id)) {
      if (key !== this.current) return;
      const el = new Audio(`/audio/${id}.mp3`);
      el.loop = true;
      const src = this.ctx!.createMediaElementSource(el);
      src.connect(this.amb);
      el.play().catch(() => {});
      this.layers.push({ id, stop: () => el.pause() });
      return;
    }
    const stop = this.synthLayer(id);
    if (stop) this.layers.push({ id, stop });
  }

  private async hasFile(id: string): Promise<boolean> {
    if (this.fileCache.has(id)) return this.fileCache.get(id)!;
    let ok = false;
    try {
      const r = await fetch(`/audio/${id}.mp3`, { method: 'HEAD' });
      ok = r.ok && (r.headers.get('content-type') ?? '').includes('audio');
    } catch {
      ok = false;
    }
    this.fileCache.set(id, ok);
    return ok;
  }

  // ---------------------------------------------------------------- synth building blocks

  private noiseSrc(): AudioBufferSourceNode {
    const s = this.ctx!.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    return s;
  }

  private filtered(type: BiquadFilterType, freq: number, q: number, gain: number, dest: AudioNode = this.amb) {
    const ctx = this.ctx!;
    const src = this.noiseSrc();
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(dest);
    src.start();
    return { src, f, g, stop: () => { try { src.stop(); } catch { /* */ } } };
  }

  private lfo(param: AudioParam, rate: number, depth: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.frequency.value = rate;
    const g = ctx.createGain();
    g.gain.value = depth;
    o.connect(g).connect(param);
    o.start();
    return () => { try { o.stop(); } catch { /* */ } };
  }

  private every(ms: () => number, fn: () => void) {
    let alive = true;
    let t: number;
    const tick = () => {
      if (!alive) return;
      fn();
      t = window.setTimeout(tick, ms());
    };
    t = window.setTimeout(tick, ms());
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }

  private tone(freq: number, dur: number, opts: { type?: OscillatorType; gain?: number; dest?: AudioNode; at?: number; slide?: number; attack?: number } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + (opts.at ?? 0);
    const o = ctx.createOscillator();
    o.type = opts.type ?? 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * opts.slide), t0 + dur);
    const g = ctx.createGain();
    const peak = opts.gain ?? 0.2;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + (opts.attack ?? 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(opts.dest ?? this.sfx);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  private burst(dur: number, freq: number, gain: number, dest: AudioNode = this.sfx, at = 0, type: BiquadFilterType = 'bandpass') {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + at;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f).connect(g).connect(dest);
    s.start(t0, Math.random());
    s.stop(t0 + dur + 0.05);
  }

  private beat(bpm: number, dest: AudioNode, radio = false) {
    const ctx = this.ctx!;
    const step = 60 / bpm / 2;
    let n = 0;
    let next = ctx.currentTime + 0.1;
    const out = ctx.createGain();
    out.gain.value = radio ? 0.5 : 1;
    let node: AudioNode = out;
    if (radio) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1400;
      bp.Q.value = 0.8;
      out.connect(bp);
      node = bp;
    } else {
      // Heard through the club walls: muffled.
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 900;
      out.connect(lp);
      node = lp;
    }
    node.connect(dest);
    const timer = window.setInterval(() => {
      while (next < ctx.currentTime + 0.25) {
        const pos = n % 16;
        const at = next - ctx.currentTime;
        if (pos % 4 === 0 || pos === 6 || pos === 11) this.tone(radio ? 110 : 62, 0.32, { slide: 0.5, gain: 0.55, dest: out, at, attack: 0.005 });
        if (pos % 2 === 1) this.burst(0.05, 8000, 0.12, out, at, 'highpass');
        if (pos === 4 || pos === 12) this.burst(0.12, 1800, 0.18, out, at);
        // Log drum flavour on the offbeats.
        if (pos === 3 || pos === 10 || pos === 14) this.tone([98, 110, 82][pos % 3], 0.18, { type: 'triangle', slide: 0.8, gain: 0.22, dest: out, at });
        next += step;
        n++;
      }
    }, 80);
    return () => clearInterval(timer);
  }

  private synthLayer(id: string): (() => void) | undefined {
    const ctx = this.ctx!;
    const stops: (() => void)[] = [];
    switch (id) {
      case 'restaurant': {
        const m = this.filtered('bandpass', 450, 0.7, 0.05);
        stops.push(m.stop, this.lfo(m.g.gain, 0.15, 0.02));
        stops.push(this.every(() => 2500 + Math.random() * 5000, () => this.tone(2600 + Math.random() * 900, 0.4, { gain: 0.03, dest: this.amb })));
        break;
      }
      case 'lagoon_breeze':
      case 'ac_hum': {
        const w = this.filtered('lowpass', id === 'ac_hum' ? 180 : 500, 0.5, id === 'ac_hum' ? 0.05 : 0.07);
        stops.push(w.stop, this.lfo(w.f.frequency, 0.08, 150));
        break;
      }
      case 'club_bass':
        stops.push(this.beat(112, this.amb));
        break;
      case 'afrobeats_radio':
        stops.push(this.beat(104, this.amb, true));
        break;
      case 'crowd':
      case 'salon_chatter':
      case 'market': {
        const c = this.filtered('bandpass', id === 'salon_chatter' ? 900 : 600, 1.2, 0.06);
        stops.push(c.stop, this.lfo(c.g.gain, 0.4, 0.03), this.lfo(c.f.frequency, 0.23, 250));
        break;
      }
      case 'car_engine': {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = 38;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 120;
        const g = ctx.createGain();
        g.gain.value = 0.08;
        o.connect(f).connect(g).connect(this.amb);
        o.start();
        stops.push(() => o.stop(), this.lfo(o.frequency, 0.1, 4));
        const road = this.filtered('lowpass', 300, 0.6, 0.05);
        stops.push(road.stop);
        break;
      }
      case 'hair_dryer':
      case 'fan': {
        const h = this.filtered(id === 'fan' ? 'lowpass' : 'highpass', id === 'fan' ? 400 : 3000, 0.5, id === 'fan' ? 0.05 : 0.025);
        stops.push(h.stop);
        if (id === 'fan') stops.push(this.lfo(h.g.gain, 1.6, 0.02));
        break;
      }
      case 'traffic': {
        const r = this.filtered('lowpass', 700, 0.5, 0.06);
        stops.push(r.stop);
        stops.push(
          this.every(() => 1800 + Math.random() * 4500, () => {
            const f = 330 + Math.random() * 120;
            this.tone(f, 0.25, { type: 'square', gain: 0.04, dest: this.amb });
            this.tone(f * 1.26, 0.25, { type: 'square', gain: 0.03, dest: this.amb });
            if (Math.random() < 0.5) this.tone(f, 0.18, { type: 'square', gain: 0.04, dest: this.amb, at: 0.35 });
          }),
        );
        break;
      }
      case 'conductors': {
        const lines = ['Obalende! CMS! Enter with your change!', 'Oshodi Oshodi Oshodi!', 'CMS! CMS! One chance!', 'Yaba, Yaba! Wole!'];
        stops.push(
          this.every(() => 7000 + Math.random() * 9000, () => {
            if (this.muted || !('speechSynthesis' in window)) return;
            const u = new SpeechSynthesisUtterance(lines[Math.floor(Math.random() * lines.length)]);
            u.rate = 1.35;
            u.pitch = 0.8 + Math.random() * 0.4;
            u.volume = 0.35;
            speechSynthesis.speak(u);
          }),
        );
        stops.push(() => 'speechSynthesis' in window && speechSynthesis.cancel());
        break;
      }
      case 'generator': {
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.value = 50;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 160;
        const g = ctx.createGain();
        g.gain.value = 0.035;
        o.connect(f).connect(g).connect(this.amb);
        o.start();
        stops.push(() => o.stop(), this.lfo(g.gain, 7, 0.01));
        break;
      }
      case 'rain': {
        const r1 = this.filtered('highpass', 1200, 0.4, 0.05);
        const r2 = this.filtered('lowpass', 500, 0.4, 0.04);
        stops.push(r1.stop, r2.stop);
        stops.push(this.every(() => 80 + Math.random() * 300, () => this.burst(0.03, 3000 + Math.random() * 3000, 0.04, this.amb)));
        break;
      }
      case 'clinic_calm': {
        const chords = [
          [261.6, 329.6, 392],
          [220, 277.2, 329.6],
          [246.9, 311.1, 370],
        ];
        let i = 0;
        const play = () => {
          chords[i % 3].forEach((f) => this.tone(f, 5.5, { gain: 0.025, dest: this.amb, attack: 1.5 }));
          i++;
        };
        play();
        stops.push(this.every(() => 5000, play));
        break;
      }
      default:
        return undefined;
    }
    return () => stops.forEach((s) => s());
  }

  // ---------------------------------------------------------------- UI sounds

  play(name: 'tap' | 'ping' | 'cash' | 'loss' | 'sting' | 'reveal' | 'swoosh' | 'buzz' | 'type' | 'ring' | 'boom' | 'chem' | 'heartbeat') {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'tap':
        this.tone(660, 0.06, { gain: 0.08, type: 'triangle' });
        break;
      case 'type':
        this.tone(1200 + Math.random() * 300, 0.025, { gain: 0.02, type: 'square' });
        break;
      case 'ping':
        this.tone(1318, 0.18, { gain: 0.12 });
        this.tone(1760, 0.3, { gain: 0.1, at: 0.09 });
        break;
      case 'cash':
        this.burst(0.08, 5000, 0.25);
        [1568, 2093, 2637].forEach((f, i) => this.tone(f, 0.4, { gain: 0.1, at: 0.06 + i * 0.05, type: 'triangle' }));
        break;
      case 'loss':
        this.tone(330, 0.3, { gain: 0.12, type: 'sawtooth', slide: 0.6 });
        break;
      case 'chem':
        [784, 988, 1175].forEach((f, i) => this.tone(f, 0.35, { gain: 0.07, at: i * 0.06 }));
        break;
      case 'swoosh':
        this.burst(0.35, 1200, 0.15);
        break;
      case 'buzz':
        for (let i = 0; i < 3; i++) this.tone(140, 0.12, { type: 'square', gain: 0.07, at: i * 0.18 });
        if (navigator.vibrate) navigator.vibrate([90, 60, 90]);
        break;
      case 'ring':
        for (let i = 0; i < 2; i++) {
          this.tone(880, 0.35, { gain: 0.09, at: i * 0.45 });
          this.tone(1108, 0.35, { gain: 0.07, at: i * 0.45 });
        }
        if (navigator.vibrate) navigator.vibrate([300, 200, 300]);
        break;
      case 'sting':
        [110, 116.5, 164.8].forEach((f) => this.tone(f, 1.6, { type: 'sawtooth', gain: 0.09, slide: 0.94, attack: 0.02 }));
        this.burst(1.2, 200, 0.2);
        break;
      case 'reveal':
        [220, 277, 330, 440].forEach((f, i) => this.tone(f, 1.4, { gain: 0.07, at: i * 0.12, type: 'triangle' }));
        break;
      case 'boom':
        this.tone(80, 0.9, { gain: 0.5, slide: 0.4 });
        this.burst(0.5, 300, 0.3);
        break;
      case 'heartbeat':
        this.tone(60, 0.15, { gain: 0.35, slide: 0.6 });
        this.tone(55, 0.15, { gain: 0.3, slide: 0.6, at: 0.22 });
        break;
    }
  }
}

export const sound = new Sound();

/** Low-end phones and slow connections get lighter ambience (Living Lagos rule 7). */
export function detectLowEnd(): boolean {
  const nav = navigator as any;
  const conn = nav.connection;
  const slow = conn && (conn.saveData || ['slow-2g', '2g', '3g'].includes(conn.effectiveType));
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4) || (nav.deviceMemory && nav.deviceMemory <= 2);
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  return !!(slow || weak || reduce);
}
