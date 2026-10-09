import { useEffect, useMemo, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { lagos } from '../../content/browser';
import { buildVerdict, ENDING_NAMES } from '../../engine/verdict';
import type { EndingId, RunState } from '../../engine/types';
import { backend, storage } from '../../backend';
import { sound } from '../audio';
import { Btn } from '../kit';
import { decodeCard, encodeCard, shareUrl, toCard, type CardData } from './payload';
import { ReceiptsCard, VerdictCard, WideCard } from './VerdictCard';

export async function exportPng(node: HTMLElement, scale: number): Promise<string> {
  try {
    return await toPng(node, { pixelRatio: scale, cacheBust: true });
  } catch {
    // Cross-origin font embedding can fail on some browsers; fall back to system fonts.
    return await toPng(node, { pixelRatio: scale, cacheBust: true, skipFonts: true });
  }
}

function download(dataUrl: string, name: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = name;
  a.click();
}

export function ScaledCard({ children, width, height }: { children: React.ReactNode; width: number; height: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(1.25, el.clientWidth / width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);
  return (
    <div ref={box} className="w-full">
      <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: 'top left', marginBottom: height * (scale - 1) }}>{children}</div>
    </div>
  );
}

export function VerdictScreen({ run, onAgain, onNewCharacter }: { run: RunState; onAgain: () => void; onNewCharacter: () => void }) {
  const verdict = useMemo(() => buildVerdict(lagos, run), [run]);
  const card = useMemo(() => toCard(verdict), [verdict]);
  const url = useMemo(() => shareUrl(card), [card]);
  const [tab, setTab] = useState<'card' | 'receipts'>('card');
  const [busy, setBusy] = useState('');
  const [phone, setPhone] = useState('');
  const [joined, setJoined] = useState(!!storage.get('wahala.waitlist', null));
  const cardRef = useRef<HTMLDivElement>(null);
  const wideRef = useRef<HTMLDivElement>(null);
  const receiptRef = useRef<HTMLDivElement>(null);
  const challenge = useMemo(() => {
    const raw = storage.get<string | null>('wahala.challenge', null);
    return raw ? decodeCard(raw) : null;
  }, []);

  useEffect(() => {
    sound.stopAmbience();
    sound.play('reveal');
    const t = storage.get<Record<string, EndingId[]>>('wahala.trophies', {});
    const mine = new Set(t[run.characterId] ?? []);
    mine.add(run.ending!);
    t[run.characterId] = [...mine];
    storage.set('wahala.trophies', t);
  }, []);

  const text = `${verdict.title}. I dated ${verdict.partnerName} on Wahala and ${verdict.endingName === 'Survived Phase 1' ? 'survived' : `got "${verdict.endingName}"`} on Day ${verdict.daysSurvived}. Date ${verdict.partnerName.split(' ')[0]} yourself:`;

  async function share(channel: 'download' | 'wide' | 'whatsapp' | 'x' | 'story' | 'copy' | 'receipts') {
    backend.track('card_shared', { channel, ending: verdict.ending });
    sound.play('tap');
    if (channel === 'whatsapp') return window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, '_blank');
    if (channel === 'x') return window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
    if (channel === 'copy') {
      await navigator.clipboard?.writeText(url).catch(() => {});
      setBusy('Link copied');
      return setTimeout(() => setBusy(''), 1500);
    }
    setBusy('Rendering…');
    try {
      if (channel === 'download' && cardRef.current) download(await exportPng(cardRef.current, 3), `wahala-verdict-${verdict.runId}.png`);
      if (channel === 'wide' && wideRef.current) download(await exportPng(wideRef.current, 3), `wahala-verdict-x-${verdict.runId}.png`);
      if (channel === 'receipts' && receiptRef.current) download(await exportPng(receiptRef.current, 3), `wahala-receipts-${verdict.runId}.png`);
      if (channel === 'story' && cardRef.current) {
        const png = await exportPng(cardRef.current, 3);
        const file = new File([await (await fetch(png)).blob()], 'wahala-verdict.png', { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text, url });
        else download(png, 'wahala-verdict.png');
      }
    } finally {
      setBusy('');
    }
  }

  async function joinWaitlist() {
    if (!/^\+?\d[\d\s-]{9,15}$/.test(phone.trim())) return setBusy('Enter a valid WhatsApp number');
    await backend.joinWaitlist(phone.trim());
    backend.track('waitlist_joined');
    setJoined(true);
  }

  const trophies = storage.get<Record<string, EndingId[]>>('wahala.trophies', {})[run.characterId] ?? [];

  return (
    <div className="h-full overflow-y-auto no-scrollbar">
      <div className="px-4 pb-10 pt-5">
        <div className="mb-3 flex gap-2">
          {(['card', 'receipts'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`press pill flex-1 py-2.5 text-sm font-bold ${tab === t ? 'bg-white text-black' : 'bg-white/5 text-white/70'}`}>
              {t === 'card' ? 'Verdict Card' : 'Wahala Receipts'}
            </button>
          ))}
        </div>

        <div className="anim-pop overflow-hidden rounded-[22px] shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
          <ScaledCard width={360} height={640}>
            {tab === 'card' ? <VerdictCard ref={cardRef} c={card} url={url} /> : <ReceiptsCard ref={receiptRef} c={card} url={url} />}
          </ScaledCard>
        </div>
        {/* Offscreen renders for export. */}
        <div style={{ position: 'fixed', left: -10000, top: 0 }} aria-hidden>
          {tab === 'receipts' && <VerdictCard ref={cardRef} c={card} url={url} />}
          {tab === 'card' && <ReceiptsCard ref={receiptRef} c={card} url={url} />}
          <WideCard ref={wideRef} c={card} url={url} />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <ShareBtn icon="💬" label="WhatsApp" onClick={() => share('whatsapp')} tone="#25D366" />
          <ShareBtn icon="📸" label="IG Story" onClick={() => share('story')} tone="#E1306C" />
          <ShareBtn icon="𝕏" label="Post to X" onClick={() => share('x')} />
          <ShareBtn icon="🔗" label="Copy link" onClick={() => share('copy')} />
          <ShareBtn icon="⬇️" label="Download 9:16" onClick={() => share('download')} />
          <ShareBtn icon="⬇️" label="Download for X" onClick={() => share('wide')} />
        </div>
        <button onClick={() => share('receipts')} className="press pill mt-2 w-full border-2 border-white/12 py-3 text-sm font-bold">
          🧾 Download Receipts image
        </button>
        {busy && <p className="mt-2 text-center text-sm text-white/60">{busy}</p>}

        {challenge && (
          <div className="mt-8">
            <div className="font-display text-xl font-extrabold">Challenge: you vs {challenge.n}</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[card, challenge].map((c, i) => (
                <div key={i} className="overflow-hidden rounded-xl">
                  <ScaledCard width={360} height={640}>
                    <VerdictCard c={c} url={url} />
                  </ScaledCard>
                </div>
              ))}
            </div>
            <p className="mt-2 text-center text-sm text-white/60">
              {card.d > challenge.d ? 'You lasted longer. Screenshot this.' : card.d < challenge.d ? `${challenge.n} lasted longer. Rematch?` : card.gw && !challenge.gw ? 'Same days, but you hit your goal.' : 'Dead heat. Lagos is undefeated.'}
            </p>
          </div>
        )}

        <div className="mt-8 rounded-[26px] border-2 border-[#F59E0B]/40 bg-[#F59E0B]/[0.06] p-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#F59E0B]">Phase 2 · The Situationship</div>
          <h3 className="font-display mt-1 text-2xl font-extrabold leading-tight">{run.ending === 'survived' || run.ending === 'locked_in' ? `"You're exclusive. For now." Days 8 to 14 are coming.` : 'Days 8 to 14 are coming. Will you make it there?'}</h3>
          {joined ? (
            <p className="mt-3 text-sm text-[#10B981]">You're on the list. We'll WhatsApp you the moment Phase 2 opens.</p>
          ) : (
            <div className="mt-3 flex gap-2">
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="WhatsApp number" className="h-12 min-w-0 flex-1 rounded-2xl border-2 border-white/12 bg-black/40 px-3 outline-none focus:border-[#F59E0B]" />
              <Btn tone="gold" onClick={joinWaitlist} className="!min-h-[48px] !px-4 !text-sm">
                Notify me
              </Btn>
            </div>
          )}
        </div>

        <div className="mt-6">
          <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">Your {verdict.partnerName} trophy shelf</div>
          <div className="mt-2 grid grid-cols-5 gap-1.5">
            {(Object.keys(ENDING_NAMES) as EndingId[]).map((e) => (
              <div key={e} className={`rounded-xl p-2 text-center text-[9px] font-bold leading-tight ${trophies.includes(e) ? 'bg-[#F59E0B] text-black' : 'bg-white/[0.04] text-white/25'}`}>
                {trophies.includes(e) ? ENDING_NAMES[e] : '???'}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2">
          <Btn onClick={onAgain}>Date {verdict.partnerName.split(' ')[0]} again (new truth)</Btn>
          <Btn tone="ghost" onClick={onNewCharacter}>
            New setup
          </Btn>
        </div>
      </div>
    </div>
  );
}

function ShareBtn({ icon, label, onClick, tone }: { icon: string; label: string; onClick: () => void; tone?: string }) {
  return (
    <button onClick={onClick} className="press pill flex min-h-[50px] items-center justify-center gap-2 border-2 border-white/10 bg-white/[0.05] text-[14px] font-bold" style={tone ? { borderColor: `${tone}88` } : undefined}>
      <span>{icon}</span> {label}
    </button>
  );
}

export function useChallengeFromUrl() {
  useEffect(() => {
    const p = new URLSearchParams(location.search).get('challenge');
    if (p && decodeCard(p)) storage.set('wahala.challenge', p);
  }, []);
}

export { encodeCard, type CardData };
