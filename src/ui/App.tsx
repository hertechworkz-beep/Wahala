import { Suspense, lazy, useEffect, useState } from 'react';
import { lagos } from '../content/browser';
import { getCharacter } from '../engine/engine';
import { naira } from '../engine/text';
import { backend, storage } from '../backend';
import { Portrait } from './art/Portrait';
import { sound } from './audio';
import { Btn, Logo, navigate } from './kit';
import { RunScreen } from './run/RunScreen';
import { ErrorBoundary } from './ErrorBoundary';
import { useRun } from './session';
import { Setup } from './setup/Setup';
import { decodeCard, encodeCard } from './verdict/payload';

// Sharing code (html-to-image, QR) loads only when a Verdict is shown: faster first load on 3G.
const VerdictScreen = lazy(() => import('./verdict/VerdictScreen').then((m) => ({ default: m.VerdictScreen })));
const SharedCard = lazy(() => import('./verdict/SharedCard'));
const Loading = () => <div className="flex h-full items-center justify-center text-white/40">Loading…</div>;

function useChallengeFromUrl() {
  useEffect(() => {
    const p = new URLSearchParams(location.search).get('challenge');
    if (p && decodeCard(p)) storage.set('wahala.challenge', p);
  }, []);
}

function usePath() {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const on = () => setPath(location.pathname);
    window.addEventListener('popstate', on);
    return () => window.removeEventListener('popstate', on);
  }, []);
  return path;
}

export function App() {
  const path = usePath();
  let page;
  if (path.startsWith('/v/')) page = <ShareLanding payload={path.slice(3)} />;
  else if (path.startsWith('/advertise')) page = <Advertise />;
  else if (path.startsWith('/play')) page = <Play />;
  else page = <Home />;
  return (
    <div className="frame">
      <ErrorBoundary>{page}</ErrorBoundary>
    </div>
  );
}

function Home() {
  const saved = storage.get<unknown>('wahala.run.v1', null);
  const chief = getCharacter(lagos, 'chief_emeka');
  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <div className="absolute inset-0" style={{ background: 'radial-gradient(90% 50% at 50% 30%, rgba(244,63,94,0.35), transparent 70%), radial-gradient(70% 40% at 80% 90%, rgba(245,158,11,0.25), transparent 70%)' }} />
      <div className="relative flex flex-1 flex-col items-center px-6 pt-14 text-center">
        <Logo size={72} />
        <div className="mt-2 text-[12px] font-bold uppercase tracking-[0.35em] text-white/55">The Dating Survival Sim</div>
        <div className="mt-1 text-[11px] uppercase tracking-[0.3em] text-[#F59E0B]">{lagos.season}</div>
        <div className="relative mt-6">
          <div className="absolute inset-0 rounded-full bg-[#F43F5E]/25 blur-3xl" />
          <Portrait look={chief.look} artId="chief" size={230} expression="charming" />
        </div>
        <p className="font-display mt-2 text-[22px] font-extrabold leading-tight">
          7 days. One Lagos lover.
          <br />
          <span className="text-[#F43F5E]">Survive the wahala.</span>
        </p>
        <p className="mt-2 max-w-xs text-[14px] text-white/55">No sign-up. 3 to 5 minutes. Ends with a Verdict Card you'll want to post. 18+.</p>
      </div>
      <div className="relative space-y-2 p-5 pb-[max(20px,env(safe-area-inset-bottom))]">
        {saved ? (
          <Btn className="w-full" onClick={() => (sound.unlock(), navigate('/play'))}>
            Continue your run →
          </Btn>
        ) : null}
        <Btn tone={saved ? 'ghost' : 'primary'} className="w-full" onClick={() => (sound.unlock(), saved && storage.set('wahala.run.v1', null), navigate('/play'))}>
          {saved ? 'Start a new run' : 'Start dating →'}
        </Btn>
        <div className="flex justify-center gap-4 pt-2 text-[12px] text-white/40">
          <a href="/advertise" onClick={(e) => (e.preventDefault(), navigate('/advertise'))} className="underline">
            Advertise on Wahala
          </a>
          <span>·</span>
          <span>Brands live inside the story</span>
        </div>
      </div>
    </div>
  );
}

function Play() {
  const session = useRun();
  const [view, setView] = useState<'run' | 'verdict'>(() => (session.run?.status === 'ended' ? 'verdict' : 'run'));
  useChallengeFromUrl();
  const preselect = new URLSearchParams(location.search).get('date') ?? undefined;
  useEffect(() => {
    if (!session.run) setView('run');
  }, [session.run]);

  if (!session.run) return <Setup preselect={preselect} onStart={(p, c) => (sound.unlock(), session.start(p, c), setView('run'))} />;
  if (view === 'verdict' && session.run.status === 'ended')
    return (
      <Suspense fallback={<Loading />}>
      <VerdictScreen
        run={session.run}
        onAgain={() => {
          const r = session.run!;
          session.start(r.player, r.characterId);
          setView('run');
        }}
        onNewCharacter={() => session.reset()}
      />
      </Suspense>
    );
  return <RunScreen key={session.run.seed} session={session} onVerdict={() => setView('verdict')} />;
}

function ShareLanding({ payload }: { payload: string }) {
  const card = decodeCard(payload);
  useEffect(() => {
    backend.track('share_link_opened', { ending: card?.e });
  }, []);
  if (!card)
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <Logo size={48} />
        <p className="mt-4 text-white/60">This Verdict link is broken. Lagos happens.</p>
        <Btn className="mt-6" onClick={() => navigate('/')}>
          Play Wahala
        </Btn>
      </div>
    );
  const first = card.p.split(' ')[0];
  return (
    <div className="h-full overflow-y-auto px-4 pb-8 pt-5 no-scrollbar">
      <div className="mb-3 flex items-center justify-between">
        <Logo size={28} />
        <span className="text-[11px] uppercase tracking-widest text-white/40">{card.n}'s Verdict</span>
      </div>
      <Suspense fallback={<Loading />}>
        <SharedCard c={card} />
      </Suspense>
      <div className="mt-5 space-y-2">
        <Btn className="w-full" onClick={() => navigate(`/play?date=${card.c}`)}>
          Date {first} yourself
        </Btn>
        <Btn tone="gold" className="w-full" onClick={() => navigate(`/play?date=${card.c}&challenge=${encodeCard(card)}`)}>
          Beat their score
        </Btn>
      </div>
    </div>
  );
}

function Advertise() {
  const inv = lagos.brands;
  return (
    <div className="h-full overflow-y-auto no-scrollbar">
      <div className="px-5 pb-10 pt-6">
        <button onClick={() => navigate('/')} className="text-sm text-white/50">
          ← Wahala
        </button>
        <h1 className="font-display mt-4 text-[38px] font-extrabold leading-none">
          Put your brand <span className="text-[#F43F5E]">inside the story.</span>
        </h1>
        <p className="mt-3 text-white/60">No banners over scenes. Your song plays in the club. Your billboard passes on the Link Bridge. Your restaurant hosts the date. Brands only appear in positive or neutral scenes, never next to scandals, scams or breakdowns.</p>
        <div className="mt-6 rounded-2xl border border-white/10 p-4 text-[13px] text-white/50">
          Live audience stats (players today, runs played, cards shared) appear here once the server is connected. We only show real numbers.
        </div>
        <h2 className="font-display mt-8 text-xl font-extrabold">Rate card</h2>
        <p className="text-[12px] text-white/45">Launch prices, per week. Introductory discount for the first 2 weeks.</p>
        <div className="mt-3 space-y-2">
          {[...inv.slots].sort((a, b) => a.rate - b.rate).map((s) => (
            <div key={s.id} className="rounded-2xl bg-white/[0.04] p-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-display text-[17px] font-bold">{s.name}</span>
                <span className="num text-[#10B981]">{naira(s.rate, { short: true })}/wk</span>
              </div>
              <div className="mt-1 text-[13px] text-white/55">{s.where}</div>
              <div className="mt-1 text-[11px] text-white/35">Max {s.cap_per_run} appearance{s.cap_per_run > 1 ? 's' : ''} per run</div>
            </div>
          ))}
        </div>
        <div className="mt-8 rounded-3xl border-2 border-[#F59E0B]/40 bg-[#F59E0B]/[0.06] p-5">
          <h3 className="font-display text-xl font-extrabold">Self-serve booking</h3>
          <p className="mt-1 text-sm text-white/60">Pick a slot and dates, upload your creative, pay with Paystack, and your booking goes to our approval queue. Opening soon.</p>
          <button disabled className="pill mt-4 block w-full bg-[#F59E0B]/40 py-3 text-center font-display font-bold text-black/70">
            Booking opens soon
          </button>
        </div>
      </div>
    </div>
  );
}
