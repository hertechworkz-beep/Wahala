// Spoken lines. A recorded clip at /audio/voices/<who>/<id>.mp3 always wins (and drives the
// mouth from its loudness). Until recordings arrive, the phone's own speech engine reads the
// line, preferring a Nigerian English voice, as a temporary stand-in.

const base = () => import.meta.env.BASE_URL;
let ctx: AudioContext | null = null;

export interface Spoken {
  seconds: number;
  level: () => number | null; // mouth openness 0..1 from audio, or null when unknown
}

async function hasClip(url: string) {
  try {
    const r = await fetch(url, { method: 'HEAD' });
    return r.ok && (r.headers.get('content-type') ?? '').includes('audio');
  } catch {
    return false;
  }
}

function pickVoice(male: boolean): SpeechSynthesisVoice | undefined {
  const vs = speechSynthesis.getVoices();
  const en = vs.filter((v) => v.lang.startsWith('en'));
  const ng = en.filter((v) => /NG|Nigeria/i.test(v.lang + v.name));
  const pool = ng.length ? ng : en.filter((v) => /GB|ZA|KE|GH/i.test(v.lang)).concat(en);
  const want = male ? /male|man|daniel|george|fred|guy|david|james/i : /female|woman|samantha|karen|moira|tessa|serena|zira/i;
  return pool.find((v) => want.test(v.name)) ?? pool[0];
}

export async function speak(who: string, id: string, text: string, opts: { male?: boolean; pitch?: number; rate?: number } = {}): Promise<Spoken> {
  const url = `${base()}audio/voices/${who}/${id}.mp3`;
  if (await hasClip(url)) {
    ctx ??= new AudioContext();
    const el = new Audio(url);
    const src = ctx.createMediaElementSource(el);
    const an = ctx.createAnalyser();
    an.fftSize = 512;
    src.connect(an).connect(ctx.destination);
    const buf = new Uint8Array(an.fftSize);
    await el.play().catch(() => {});
    const seconds = isFinite(el.duration) && el.duration > 0 ? el.duration : 2.5;
    return {
      seconds,
      level: () => {
        an.getByteTimeDomainData(buf);
        let s = 0;
        for (const v of buf) s += Math.abs(v - 128);
        return Math.min(1, (s / buf.length) / 18);
      },
    };
  }
  const seconds = Math.min(5, 0.6 + text.split(/\s+/).length * 0.33);
  if ('speechSynthesis' in window) {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice(opts.male ?? true);
    if (v) u.voice = v;
    u.lang = v?.lang ?? 'en-NG';
    u.pitch = opts.pitch ?? (opts.male ? 0.72 : 1.1);
    u.rate = opts.rate ?? 0.92;
    speechSynthesis.speak(u);
  }
  return { seconds, level: () => null };
}
