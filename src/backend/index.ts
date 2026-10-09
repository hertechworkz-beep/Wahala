// Backend adapter (rule 10: the server validates purchases, Parlour posts, counters and
// rarity). The game never blocks on it: if it's down or not configured, play continues.
// LocalBackend is what ships until Supabase + Paystack are wired up (see supabase/).

export type Product = 'bailout' | 'clue';

export interface ParlourPost {
  id: string;
  kind: 'gossip' | 'receipt' | 'sponsored';
  text: string;
  at: number;
  reactions: Record<Reaction, number>;
  mine?: boolean;
}
export type Reaction = 'fire' | 'laugh' | 'flag' | 'clown';

export interface Counters {
  datingNow: number;
  ghostedToday: number;
}

export interface Backend {
  readonly paymentsEnabled: boolean;
  readonly live: boolean;
  /** Starts a purchase and resolves true only after the server verified it with Paystack. */
  purchase(product: Product, runId: string): Promise<{ granted: boolean; reason?: string }>;
  /** Free Bail-Out credits earned by invites, as recorded by the server. */
  freeBailouts(): Promise<number>;
  useFreeBailout(runId: string): Promise<boolean>;
  counters(characterId: string): Promise<Counters | null>;
  parlourFeed(): Promise<ParlourPost[]>;
  leak(text: string): Promise<ParlourPost>;
  react(postId: string, r: Reaction): Promise<void>;
  report(postId: string): Promise<void>;
  joinWaitlist(phone: string): Promise<boolean>;
  track(event: string, props?: Record<string, unknown>): void;
}

const LS = {
  get<T>(k: string, d: T): T {
    try {
      const v = localStorage.getItem(k);
      return v ? (JSON.parse(v) as T) : d;
    } catch {
      return d;
    }
  },
  set(k: string, v: unknown) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* storage blocked: fine */
    }
  },
};

const emptyReactions = (): Record<Reaction, number> => ({ fire: 0, laugh: 0, flag: 0, clown: 0 });

class LocalBackend implements Backend {
  readonly paymentsEnabled = false;
  readonly live = false;

  async purchase(): Promise<{ granted: boolean; reason?: string }> {
    // Never grant from the frontend. Payments stay off until server verification is live.
    return { granted: false, reason: 'Payments open once server-side verification is live.' };
  }
  async freeBailouts() {
    return 0;
  }
  async useFreeBailout() {
    return false;
  }
  async counters() {
    // Real numbers only (rule 11). No server, no counters.
    return null;
  }
  async parlourFeed(): Promise<ParlourPost[]> {
    return LS.get<ParlourPost[]>('wahala.parlour.mine', []);
  }
  async leak(text: string): Promise<ParlourPost> {
    const post: ParlourPost = { id: `p${Date.now().toString(36)}`, kind: 'receipt', text, at: Date.now(), reactions: emptyReactions(), mine: true };
    LS.set('wahala.parlour.mine', [post, ...LS.get<ParlourPost[]>('wahala.parlour.mine', [])].slice(0, 30));
    return post;
  }
  async react(postId: string, r: Reaction) {
    const posts = LS.get<ParlourPost[]>('wahala.parlour.mine', []);
    const p = posts.find((x) => x.id === postId);
    if (p) p.reactions[r]++;
    LS.set('wahala.parlour.mine', posts);
  }
  async report(postId: string) {
    LS.set('wahala.parlour.reported', [...LS.get<string[]>('wahala.parlour.reported', []), postId]);
  }
  async joinWaitlist(phone: string) {
    LS.set('wahala.waitlist', { phone, at: Date.now() });
    return true;
  }
  track(event: string, props: Record<string, unknown> = {}) {
    const buf = LS.get<unknown[]>('wahala.events', []);
    buf.push({ event, props, at: Date.now() });
    LS.set('wahala.events', buf.slice(-200));
    if (import.meta.env.DEV) console.debug('[track]', event, props);
  }
}

export const backend: Backend = new LocalBackend();
export const storage = LS;

/** Display names: no slurs, no real public figures (rule 11). Small seed list; the server list is authoritative. */
const BLOCKED = ['nigger', 'nigga', 'fuck', 'bitch', 'whore', 'ashawo', 'olodo', 'tinubu', 'obi', 'atiku', 'wizkid', 'davido', 'burna', 'tiwa savage', 'dangote', 'otedola', 'sanwo', 'buhari'];
export function nameAllowed(name: string): { ok: boolean; reason?: string } {
  const n = name.trim().toLowerCase();
  if (n.length < 2) return { ok: false, reason: 'At least 2 letters.' };
  if (n.length > 18) return { ok: false, reason: 'Keep it under 18 letters.' };
  if (!/^[\p{L}\p{N} _.'-]+$/u.test(n)) return { ok: false, reason: 'Letters and numbers only.' };
  if (BLOCKED.some((b) => n.includes(b))) return { ok: false, reason: "That name isn't allowed in the Parlour." };
  return { ok: true };
}
