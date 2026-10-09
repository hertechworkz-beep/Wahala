import { useEffect, useState } from 'react';
import { lagos } from '../../content/browser';
import { getCharacter, resolveSpot, spotAvailable } from '../../engine/engine';
import { fill, naira } from '../../engine/text';
import type { ChoiceResult, PhoneEvent, RunState } from '../../engine/types';
import { backend, type ParlourPost, type Reaction } from '../../backend';
import { sound } from '../audio';
import { fillSlot } from '../brands';

export interface Notif extends PhoneEvent {
  id: number;
  at: number;
}

const ICON: Record<PhoneEvent['kind'], string> = { text: '💬', voice_note: '🎙️', call: '📞', alert: '🏦', gist: '🗣️', missed_call: '📵' };

/** Notifications slide in from the top because something happened in the story. */
export function NotifStack({ items, onOpen, onDismiss }: { items: Notif[]; onOpen: (n: Notif) => void; onDismiss: (id: number) => void }) {
  return (
    <div className="pointer-events-none absolute inset-x-3 top-[118px] z-40 space-y-2">
      {items.slice(-2).map((n) => (
        <Toast key={n.id} n={n} onOpen={onOpen} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function Toast({ n, onOpen, onDismiss }: { n: Notif; onOpen: (n: Notif) => void; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(n.id), 4200);
    return () => clearTimeout(t);
  }, [n.id]);
  const money = n.kind === 'alert';
  const credit = money && /credit/i.test(n.text);
  return (
    <button onClick={() => onOpen(n)} className={`pointer-events-auto anim-slide-down flex w-full items-start gap-3 rounded-2xl border p-3 text-left shadow-2xl backdrop-blur-xl ${money ? (credit ? 'border-[#10B981]/50 bg-[#052e22]/90' : 'border-[#EF4444]/40 bg-[#2a0b0b]/90') : 'border-white/15 bg-[#15171f]/92'}`}>
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg ${money ? (credit ? 'bg-[#10B981]' : 'bg-[#EF4444]') : 'bg-white/10'}`}>{ICON[n.kind]}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[13px] font-bold">{n.from}</span>
          <span className="text-[10px] text-white/40">now</span>
        </div>
        <div className={`line-clamp-2 text-[13px] ${money ? 'num !font-bold' : 'text-white/80'}`}>{n.text}</div>
      </div>
    </button>
  );
}

type App = 'home' | 'messages' | 'parlour' | 'bank' | 'settings' | `spot:${string}`;

export function PhoneSheet({
  run,
  open,
  onClose,
  messages,
  onSpot,
  spotResult,
  clearSpotResult,
  muted,
  onMute,
  reduced,
  onReduced,
  onRestart,
  initialApp = 'home',
}: {
  run: RunState;
  open: boolean;
  onClose: () => void;
  messages: Notif[];
  onSpot: (spot: string, option: string, label: string, loan: boolean) => void;
  spotResult: { spot: string; result: ChoiceResult } | null;
  clearSpotResult: () => void;
  muted: boolean;
  onMute: () => void;
  reduced: boolean;
  onReduced: () => void;
  onRestart: () => void;
  initialApp?: App;
}) {
  const [app, setApp] = useState<App>(initialApp);
  useEffect(() => {
    if (open) setApp(initialApp);
  }, [open, initialApp]);
  if (!open) return null;
  const ch = getCharacter(lagos, run.characterId);
  const bank = fillSlot('phone_apps', 'neutral');

  return (
    <div className="absolute inset-0 z-50 flex items-end bg-black/50 backdrop-blur-sm anim-fade" onClick={onClose}>
      <div className="anim-slide-up relative mx-2 mb-2 h-[86%] w-full overflow-hidden rounded-[38px] border-[6px] border-[#22252e] bg-[#0d0f14]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pb-1 pt-3 text-[11px] font-bold text-white/70">
          <span>{['7:02', '9:41', '1:15', '11:58', '6:30', '2:04', '8:00'][run.day - 1]}</span>
          <span className="h-5 w-24 rounded-full bg-black" />
          <span>📶 MTN 🔋</span>
        </div>
        <div className="h-[calc(100%-36px)] overflow-y-auto no-scrollbar">
          {app === 'home' && (
            <div className="p-5">
              <div className="mb-4 text-center">
                <div className="text-xs uppercase tracking-[0.3em] text-white/40">Day {run.day} · Lagos</div>
                <div className="font-display mt-1 text-sm text-white/70">{spotAvailable(run) ? 'One city spot today. Choose well.' : "Today's spot is used. Back tomorrow."}</div>
              </div>
              <div className="grid grid-cols-4 gap-x-3 gap-y-5">
                {lagos.spots.map((s) => (
                  <AppIcon key={s.id} icon={s.icon} label={s.name.split(' ')[0] === 'Bestie' ? 'Bestie' : s.name.split(' / ')[0].replace('Glow ', '').replace(' Network', '').replace(' Night', '')} onClick={() => setApp(`spot:${s.id}`)} dim={!spotAvailable(run)} tone="gold" />
                ))}
                <AppIcon icon="💬" label="Messages" onClick={() => setApp('messages')} badge={messages.length} />
                <AppIcon icon="🗣️" label="Parlour" onClick={() => setApp('parlour')} tone="pink" />
                <AppIcon icon="🏦" label="Bank" onClick={() => setApp('bank')} tone="money" />
                <AppIcon icon="⚙️" label="Settings" onClick={() => setApp('settings')} />
              </div>
              <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-[13px] text-white/60">
                <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/40">Dating</div>
                <b className="text-white">{ch.name}</b> · {ch.archetype}
                <div className="mt-1 text-white/50">{ch.signature_catch}</div>
              </div>
            </div>
          )}
          {app.startsWith('spot:') && <SpotApp run={run} spotId={app.slice(5)} onBack={() => (clearSpotResult(), setApp('home'))} onSpot={onSpot} result={spotResult?.spot === app.slice(5) ? spotResult.result : null} />}
          {app === 'messages' && (
            <AppFrame title="Messages" onBack={() => setApp('home')}>
              {messages.length === 0 && <p className="p-6 text-center text-sm text-white/40">Quiet. Too quiet.</p>}
              <div className="space-y-2 p-4">
                {[...messages].reverse().map((m) => (
                  <div key={m.id} className="rounded-2xl bg-white/[0.05] p-3">
                    <div className="flex items-center gap-2 text-[12px] font-bold">
                      {ICON[m.kind]} {m.from} <span className="ml-auto text-[10px] font-normal text-white/30">Day {m.at}</span>
                    </div>
                    <div className="mt-1 text-[14px] text-white/80">{m.text}</div>
                  </div>
                ))}
              </div>
            </AppFrame>
          )}
          {app === 'parlour' && <ParlourApp onBack={() => setApp('home')} characterName={ch.short} characterId={ch.id} />}
          {app === 'bank' && (
            <AppFrame title={bank?.sponsored ? bank.text : 'Bank'} onBack={() => setApp('home')}>
              <div className="p-5">
                <div className="rounded-3xl bg-gradient-to-br from-[#065f46] to-[#022c22] p-5">
                  <div className="text-xs uppercase tracking-widest text-white/60">Available balance</div>
                  <div className="num mt-1 text-4xl text-white">{naira(run.meters.wallet)}</div>
                  {run.meters.debt > 0 && <div className="mt-2 text-sm font-bold text-[#fca5a5]">Loan app debt: {naira(run.meters.debt)}</div>}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                  <Stat label="Spent" v={naira(run.money.spent, { short: true })} />
                  <Stat label="Received" v={naira(run.money.received, { short: true })} />
                  <Stat label="Salary" v={naira(run.money.earned, { short: true })} />
                </div>
                <div className="mt-5 text-[10px] font-bold uppercase tracking-widest text-white/40">Transactions</div>
                <div className="mt-2 space-y-1.5">
                  {run.log
                    .filter((e) => e.deltas.wallet)
                    .slice(-12)
                    .reverse()
                    .map((e) => (
                      <div key={e.seq} className="flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2 text-[13px]">
                        <span className="truncate pr-3 text-white/70">
                          Day {e.day} · {e.card.startsWith('system') ? 'Salary / market' : e.card.startsWith('spot:') ? e.choiceLabel.split(':')[0] : ch.short}
                        </span>
                        <span className={`num ${e.deltas.wallet! > 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>{naira(e.deltas.wallet!, { sign: true })}</span>
                      </div>
                    ))}
                </div>
                {bank && !bank.sponsored && (
                  <a href={bank.link} className="mt-6 block text-center text-[11px] text-white/35 underline">
                    {bank.text} · {bank.sub}
                  </a>
                )}
              </div>
            </AppFrame>
          )}
          {app === 'settings' && (
            <AppFrame title="Settings" onBack={() => setApp('home')}>
              <div className="space-y-3 p-5">
                <Toggle label="Sound" on={!muted} onClick={onMute} />
                <Toggle label="Lite mode (less animation)" on={reduced} onClick={onReduced} />
                <button onClick={onRestart} className="press mt-6 w-full rounded-2xl border-2 border-[#EF4444]/40 p-4 text-left text-[#EF4444]">
                  Abandon this run
                </button>
                <p className="pt-4 text-center text-[11px] text-white/30">Run #{run.seed.toString(36)} · replayable for support</p>
              </div>
            </AppFrame>
          )}
        </div>
        <button onClick={onClose} className="absolute bottom-2 left-1/2 h-1.5 w-32 -translate-x-1/2 rounded-full bg-white/40" aria-label="Close phone" />
      </div>
    </div>
  );
}

function Stat({ label, v }: { label: string; v: string }) {
  return (
    <div className="rounded-xl bg-white/[0.04] p-2">
      <div className="text-white/40">{label}</div>
      <div className="num mt-0.5 text-sm">{v}</div>
    </div>
  );
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="press flex w-full items-center justify-between rounded-2xl bg-white/[0.04] p-4">
      <span>{label}</span>
      <span className={`flex h-7 w-12 items-center rounded-full p-1 transition-colors ${on ? 'bg-[#10B981]' : 'bg-white/15'}`}>
        <span className={`h-5 w-5 rounded-full bg-white transition-transform ${on ? 'translate-x-5' : ''}`} />
      </span>
    </button>
  );
}

function AppIcon({ icon, label, onClick, badge, dim, tone }: { icon: string; label: string; onClick: () => void; badge?: number; dim?: boolean; tone?: 'gold' | 'pink' | 'money' }) {
  const bg = tone === 'gold' ? 'from-[#F59E0B]/30 to-[#F59E0B]/5' : tone === 'pink' ? 'from-[#F43F5E]/35 to-[#F43F5E]/5' : tone === 'money' ? 'from-[#10B981]/35 to-[#10B981]/5' : 'from-white/15 to-white/5';
  return (
    <button onClick={() => (sound.play('tap'), onClick())} className={`press flex flex-col items-center gap-1.5 ${dim ? 'opacity-45' : ''}`}>
      <span className={`relative flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br text-2xl ${bg}`}>
        {icon}
        {!!badge && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F43F5E] px-1 text-[10px] font-bold">{badge}</span>}
      </span>
      <span className="text-[11px] text-white/80">{label}</span>
    </button>
  );
}

function AppFrame({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <div>
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-white/5 bg-[#0d0f14]/95 px-4 py-3 backdrop-blur">
        <button onClick={onBack} className="press text-xl" aria-label="Back">
          ‹
        </button>
        <div className="font-display text-lg font-extrabold">{title}</div>
      </div>
      {children}
    </div>
  );
}

function SpotApp({ run, spotId, onBack, onSpot, result }: { run: RunState; spotId: string; onBack: () => void; onSpot: (spot: string, option: string, label: string, loan: boolean) => void; result: ChoiceResult | null }) {
  const spot = lagos.spots.find((s) => s.id === spotId)!;
  const ch = getCharacter(lagos, run.characterId);
  const options = resolveSpot(lagos, run, spotId);
  const can = spotAvailable(run);
  const [loan, setLoan] = useState<string | null>(null);
  const glow = spot.id === 'clinic' ? fillSlot('glow_spots', 'neutral') : null;
  return (
    <AppFrame title={`${spot.icon} ${spot.name}`} onBack={onBack}>
      <div className="p-5">
        <p className="text-sm text-white/60">{fill(spot.blurb, { character: ch })}</p>
        {glow && (
          <a href={glow.link} className="mt-2 block text-[11px] text-[#F59E0B]/70 underline">
            {glow.text} · {glow.sponsored ? 'Sponsored' : glow.sub}
          </a>
        )}
        {result ? (
          <div className="anim-pop mt-5 rounded-3xl border-2 border-[#F59E0B]/40 bg-[#F59E0B]/[0.07] p-5">
            <p className="text-[16px] leading-snug">{result.text}</p>
            {result.notes.map((n, i) => (
              <p key={i} className={`mt-3 rounded-xl p-3 text-[14px] ${n.startsWith('Intel') || n.startsWith('Bestie') ? 'bg-black/40 font-medium text-[#fde68a]' : 'text-white/70'}`}>
                {n}
              </p>
            ))}
            {!!result.deltas.chemistry && result.deltas.chemistry > 0 && <p className="num mt-3 text-[#F59E0B]">+{result.deltas.chemistry} Chemistry</p>}
            <button onClick={onBack} className="press pill mt-5 w-full bg-white/10 py-3 font-bold">
              Done
            </button>
          </div>
        ) : !can ? (
          <p className="mt-6 rounded-2xl bg-white/[0.04] p-4 text-center text-sm text-white/50">You've used today's city spot. Come back tomorrow.</p>
        ) : (
          <div className="mt-5 space-y-2.5">
            {options.map((o) => (
              <div key={o.id}>
                <button
                  disabled={!o.available}
                  onClick={() => onSpot(spotId, o.id, o.label, false)}
                  className="press w-full rounded-2xl border-2 border-white/10 bg-white/[0.04] p-4 text-left disabled:opacity-50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[15px] font-medium">{o.label}</span>
                    {o.cost > 0 && <span className="num shrink-0 text-[#10B981]">{naira(o.cost, { short: true })}</span>}
                  </div>
                  {!o.available && <div className="mt-1 text-[12px] italic text-[#EF4444]/90">{o.reason}</div>}
                </button>
                {!o.available && o.canLoan && (
                  <button onClick={() => (loan === o.id ? onSpot(spotId, o.id, o.label, true) : setLoan(o.id))} className="mt-1 w-full rounded-xl bg-[#EF4444]/10 px-3 py-2 text-left text-[12px] text-[#fca5a5]">
                    {loan === o.id ? `Tap again: borrow at 50% interest. Collectors WILL call your contacts.` : '💸 Use QuickCash Loan App'}
                  </button>
                )}
              </div>
            ))}
            <p className="pt-2 text-center text-[11px] text-white/35">One city spot per day.</p>
          </div>
        )}
      </div>
    </AppFrame>
  );
}

const REACTIONS: { r: Reaction; e: string }[] = [
  { r: 'fire', e: '🔥' },
  { r: 'laugh', e: '😂' },
  { r: 'flag', e: '🚩' },
  { r: 'clown', e: '🤡' },
];

export function ParlourApp({ onBack, characterName, characterId }: { onBack: () => void; characterName: string; characterId: string }) {
  const [posts, setPosts] = useState<ParlourPost[]>([]);
  const [counters, setCounters] = useState<{ datingNow: number; ghostedToday: number } | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  useEffect(() => {
    backend.parlourFeed().then(setPosts);
    backend.counters(characterId).then(setCounters);
  }, [characterId]);
  const sponsor = fillSlot('parlour_post', 'neutral');
  const gossip = lagos.gossip;
  return (
    <AppFrame title="The Parlour" onBack={onBack}>
      <div className="space-y-3 p-4">
        {counters ? (
          <div className="rounded-2xl bg-[#F43F5E]/10 p-3 text-sm">
            <b>{counters.datingNow.toLocaleString()}</b> people are dating {characterName} right now. <b>{counters.ghostedToday}</b> ghosted today.
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 p-3 text-[12px] text-white/45">Live counters switch on when the Parlour server is online. Below: your leaks, and in-world gist from Lagos.</div>
        )}
        {posts
          .filter((p) => !hidden.includes(p.id))
          .map((p) => (
            <Post key={p.id} badge="YOUR LEAK · only you see this until the Parlour is live" text={p.text} reactions={p.reactions} onReact={(r) => backend.react(p.id, r).then(() => backend.parlourFeed().then(setPosts))} onReport={() => (backend.report(p.id), setHidden([...hidden, p.id]))} />
          ))}
        {sponsor && (
          <a href={sponsor.link} className="block rounded-2xl border border-[#F59E0B]/30 bg-[#F59E0B]/[0.06] p-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#F59E0B]">{sponsor.sponsored ? 'Sponsored' : 'Advertise'}</div>
            <div className="mt-1 text-sm">{sponsor.text}</div>
          </a>
        )}
        {gossip
          .filter((g) => !hidden.includes(g))
          .map((g) => (
            <Post key={g} badge="IN-WORLD GIST · not real players" text={g.replace(/^Gist: /, '')} onReport={() => setHidden([...hidden, g])} />
          ))}
      </div>
    </AppFrame>
  );
}

function Post({ badge, text, reactions, onReact, onReport }: { badge: string; text: string; reactions?: Record<Reaction, number>; onReact?: (r: Reaction) => void; onReport: () => void }) {
  return (
    <div className="rounded-2xl bg-white/[0.04] p-4">
      <div className="text-[9px] font-bold uppercase tracking-widest text-white/35">{badge}</div>
      <p className="mt-1.5 text-[14px] leading-snug text-white/85">{text}</p>
      <div className="mt-3 flex items-center gap-1.5">
        {REACTIONS.map(({ r, e }) => (
          <button key={r} onClick={() => (sound.play('tap'), onReact?.(r))} className="press rounded-full bg-white/[0.06] px-2.5 py-1 text-[13px]">
            {e} {reactions ? reactions[r] || '' : ''}
          </button>
        ))}
        <span className="flex-1" />
        <button onClick={onReport} className="text-[11px] text-white/35">
          Report · Block
        </button>
      </div>
    </div>
  );
}
