import { useEffect, useMemo, useRef, useState } from 'react';
import { lagos } from '../../content/browser';
import type { Character, DatePref, Gender, GoalId, PlayerSetup, VibeId } from '../../engine/types';
import { backend, nameAllowed, storage } from '../../backend';
import { naira } from '../../engine/text';
import { Portrait } from '../art/Portrait';
import { playerLook } from '../art/looks';
import { sound } from '../audio';
import { Btn, Chip, Logo, StepHeader } from '../kit';

type Step = 'age' | 'teen' | 'avatar' | 'pref' | 'vibegoal' | 'roster' | 'match';
const ORDER: Step[] = ['avatar', 'pref', 'vibegoal'];

export function Setup({ onStart, preselect }: { onStart: (p: PlayerSetup, characterId: string) => void; preselect?: string }) {
  const remembered = storage.get<Partial<PlayerSetup> | null>('wahala.player', null);
  const [step, setStep] = useState<Step>(storage.get('wahala.age_ok', false) ? 'avatar' : 'age');
  const [gender, setGender] = useState<Gender>(remembered?.gender ?? 'woman');
  const [name, setName] = useState(remembered?.name ?? '');
  const opts = lagos.avatar;
  const valid = (set: 'woman' | 'man', a?: Partial<PlayerSetup['avatar']>) =>
    !!a && a.set === set && opts.build[set].includes(a.build!) && opts.hair[set].includes(a.hair!) && opts.style[set].includes(a.style!);
  const rem = remembered?.avatar && valid(remembered.avatar.set as 'woman' | 'man', remembered.avatar) ? remembered.avatar : undefined;
  const [set, setSet] = useState<'woman' | 'man'>(rem?.set ?? 'woman');
  const [skin, setSkin] = useState(rem?.skin ?? opts.skins[7].hex);
  const [build, setBuild] = useState(rem?.build ?? opts.build.woman[2]);
  const [hair, setHair] = useState(rem?.hair ?? opts.hair.woman[0]);
  const [facial, setFacial] = useState(rem?.facial ?? opts.facial.man[2]);
  const [style, setStyle] = useState(rem?.style ?? opts.style.woman[0]);
  const [pref, setPref] = useState<DatePref>(remembered?.datePref ?? 'men');
  const [vibe, setVibe] = useState<VibeId>(remembered?.vibe ?? 'lover');
  const [goal, setGoal] = useState<GoalId>(remembered?.goal ?? 'love');
  const [matched, setMatched] = useState<Character | null>(null);
  const started = useRef(Date.now());

  const player: PlayerSetup = { name: name.trim() || 'You', gender, datePref: pref, vibe, goal, avatar: { set, skin, build, hair, style, ...(set === 'man' ? { facial } : {}) } };
  const idx = ORDER.indexOf(step);
  const back = idx > 0 ? () => setStep(ORDER[idx - 1]) : undefined;
  const nameCheck = nameAllowed(name);

  function switchSet(s: 'woman' | 'man') {
    if (s === set) return;
    setSet(s);
    setBuild(opts.build[s][s === 'woman' ? 2 : 0]);
    setHair(opts.hair[s][0]);
    setStyle(opts.style[s][0]);
  }

  function finishSetup() {
    storage.set('wahala.player', player);
    backend.track('setup_completed', { seconds: Math.round((Date.now() - started.current) / 1000), vibe, goal });
    const pre = preselect && lagos.characters.find((c) => c.id === preselect && lagos.launch[c.id]?.pass);
    if (pre) {
      setMatched(pre);
      setStep('match');
    } else setStep('roster');
  }

  if (step === 'age')
    return (
      <div className="flex h-full flex-col items-center justify-center px-8 text-center anim-fade">
        <Logo size={52} />
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[12px] uppercase tracking-[0.3em] text-white/50">{lagos.brand.name}: {lagos.brand.edition}</span>
          <AgeBadge />
        </div>
        <div className="card-surface mt-10 w-full p-6">
          <p className="text-[17px] leading-snug text-white/85">
            {lagos.brand.name}: {lagos.brand.edition} is an 18+ interactive story game with romance, secrets and choices that have consequences.
          </p>
          <h1 className="font-display mt-4 text-2xl font-extrabold">Are you 18 or older?</h1>
          <div className="mt-6 flex gap-3">
            <Btn tone="ghost" className="flex-1" onClick={() => setStep('teen')}>
              No
            </Btn>
            <Btn
              className="flex-1"
              onClick={() => {
                storage.set('wahala.age_ok', true);
                setStep('avatar');
              }}
            >
              Yes, I'm 18+
            </Btn>
          </div>
        </div>
      </div>
    );

  // No path: no names, numbers or emails are collected here, ever.
  if (step === 'teen') {
    const links = lagos.brand.social.filter((x) => x.url);
    return (
      <div className="flex h-full flex-col items-center justify-center px-8 text-center anim-fade">
        <Logo size={44} />
        <h1 className="font-display mt-8 text-3xl font-extrabold">{lagos.brand.name} High is coming.</h1>
        <p className="mt-3 text-white/60">Follow us for news.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {links.length ? (
            links.map((l) => (
              <a key={l.name} href={l.url!} target="_blank" rel="noopener noreferrer" className="press pill border-2 border-white/15 px-5 py-3 font-bold">
                {l.name}
              </a>
            ))
          ) : (
            <span className="text-sm text-white/40">Our socials are announced soon.</span>
          )}
        </div>
      </div>
    );
  }

  if (step === 'match' && matched) return <MatchReveal c={matched} onGo={() => onStart(player, matched.id)} />;
  if (step === 'roster') return <Roster pref={pref} onMatch={(c) => (setMatched(c), setStep('match'))} onBack={() => setStep('vibegoal')} />;

  return (
    <div className="flex h-full flex-col">
      {step === 'avatar' && (
        <>
          <StepHeader step={1} total={3} title="Create your avatar." sub="You play yourself. Someone in Lagos has a type; you'll only see a +Chemistry." />
          <div className="relative -mb-2 flex justify-center">
            <div className="absolute inset-x-0 top-6 mx-auto h-28 w-28 rounded-full bg-[#F43F5E]/20 blur-3xl" />
            <Portrait look={playerLook(player)} feminine={set === 'woman'} size={128} expression="charming" />
          </div>
          <div className="flex-1 space-y-3.5 overflow-y-auto px-5 pb-2 no-scrollbar">
            <div className="flex gap-2">
              {(['woman', 'man', 'nonbinary'] as Gender[]).map((g) => (
                <Chip key={g} active={gender === g} onClick={() => (setGender(g), g !== 'nonbinary' && switchSet(g))} className="flex-1 !min-h-[44px]">
                  {{ woman: 'Woman', man: 'Man', nonbinary: 'Non-binary' }[g]}
                </Chip>
              ))}
            </div>
            {gender === 'nonbinary' && (
              <div className="flex gap-2">
                <Chip active={set === 'woman'} onClick={() => switchSet('woman')} className="flex-1 !min-h-[44px]">
                  Femme looks
                </Chip>
                <Chip active={set === 'man'} onClick={() => switchSet('man')} className="flex-1 !min-h-[44px]">
                  Masc looks
                </Chip>
              </div>
            )}
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Display name, e.g. Lekki Baddie"
              maxLength={18}
              aria-label="Display name"
              className="h-12 w-full rounded-2xl border-2 border-white/12 bg-white/5 px-4 text-[16px] outline-none focus:border-[#F43F5E]"
            />
            {name && !nameCheck.ok && <p className="-mt-2 text-sm text-[#EF4444]">{nameCheck.reason}</p>}
            <div>
              <div className="mb-2 text-xs font-bold uppercase tracking-widest text-white/45">Skin tone</div>
              <div className="flex justify-between gap-1">
                {opts.skins.map((sk) => (
                  <button
                    key={sk.id}
                    aria-label={`Skin tone ${sk.id}`}
                    onClick={() => (sound.play('tap'), setSkin(sk.hex))}
                    className={`press h-7 flex-1 rounded-full border-2 ${skin === sk.hex ? 'border-white scale-110' : 'border-transparent'}`}
                    style={{ background: sk.hex }}
                  />
                ))}
              </div>
            </div>
            <TapRow label="Build" options={opts.build[set]} value={build} onPick={setBuild} />
            <TapRow label="Hair" options={opts.hair[set]} value={hair} onPick={setHair} />
            {set === 'man' && <TapRow label="Facial hair" options={opts.facial.man} value={facial} onPick={setFacial} />}
            <TapRow label="Style" options={opts.style[set]} value={style} onPick={setStyle} />
          </div>
          <div className="p-5 pt-3">
            <Btn className="w-full" disabled={!nameCheck.ok} onClick={() => setStep('pref')}>
              {nameCheck.ok ? 'Looking good' : 'Pick a display name'}
            </Btn>
          </div>
        </>
      )}

      {step === 'pref' && (
        <>
          <StepHeader step={2} total={3} title="Who do you date?" onBack={back} />
          <div className="flex-1 space-y-3 px-5 pt-8">
            {(['men', 'women', 'both'] as DatePref[]).map((p) => (
              <Chip key={p} active={pref === p} onClick={() => setPref(p)} className="w-full text-lg">
                {{ men: 'Men', women: 'Women', both: 'Both' }[p]}
              </Chip>
            ))}
          </div>
          <div className="p-5">
            <Btn className="w-full" onClick={() => setStep('vibegoal')}>
              Next
            </Btn>
          </div>
        </>
      )}

      {step === 'vibegoal' && (
        <>
          <StepHeader step={3} total={3} title="Your vibe. Your secret goal." sub="The vibe sets your money and how they first see you. Nobody knows your goal; your Verdict judges it." onBack={back} />
          <div className="flex-1 space-y-2 overflow-y-auto px-5 pt-4 pb-2 no-scrollbar">
            <div className="text-xs font-bold uppercase tracking-widest text-white/45">Vibe</div>
            {lagos.vibes.map((v) => (
              <button
                key={v.id}
                onClick={() => (sound.play('tap'), setVibe(v.id))}
                className={`press w-full rounded-3xl border-2 px-4 py-3 text-left ${vibe === v.id ? 'border-[#F43F5E] bg-[#F43F5E]/10' : 'border-white/10 bg-white/[0.03]'}`}
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-display text-lg font-extrabold">{v.label[gender]}</span>
                  <span className="num text-[#10B981]">
                    {naira(v.wallet, { short: true })}
                    {v.volatile ? '*' : ''}
                  </span>
                </div>
                <div className="mt-0.5 text-[13px] text-white/55">
                  {v.job} · They see: <i>{v.first_seen}</i>
                </div>
              </button>
            ))}
            <div className="pt-3 text-xs font-bold uppercase tracking-widest text-white/45">Secret goal</div>
            <div className="grid grid-cols-2 gap-2">
              {lagos.goals.map((g) => (
                <button key={g.id} onClick={() => (sound.play('tap'), setGoal(g.id))} className={`press rounded-3xl border-2 p-3 text-left ${goal === g.id ? 'border-[#F59E0B] bg-[#F59E0B]/10' : 'border-white/10 bg-white/[0.03]'}`}>
                  <div className="font-display text-[16px] font-extrabold leading-tight">{g.label}</div>
                  <div className="mt-1 text-[11.5px] leading-snug text-white/50">{g.wins}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="p-5 pt-3">
            <Btn tone="gold" className="w-full" onClick={finishSetup}>
              Pick your date 🔥
            </Btn>
          </div>
        </>
      )}
    </div>
  );
}

export function AgeBadge() {
  return <span className="rounded-md border-2 border-[#EF4444] px-1.5 py-0.5 text-[11px] font-extrabold leading-none text-[#EF4444]">18+</span>;
}

function TapRow({ label, options, value, onPick }: { label: string; options: string[]; value: string; onPick: (v: string) => void }) {
  return (
    <div>
      <div className="mb-2 text-xs font-bold uppercase tracking-widest text-white/45">{label}</div>
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 no-scrollbar">
        {options.map((o) => (
          <Chip key={o} active={value === o} onClick={() => onPick(o)} className="shrink-0 whitespace-nowrap">
            {o}
          </Chip>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- roster swipe

function Roster({ pref, onMatch, onBack }: { pref: DatePref; onMatch: (c: Character) => void; onBack: () => void }) {
  const list = useMemo(() => {
    const all = lagos.characters.filter((c) => pref === 'both' || (pref === 'men' ? c.gender === 'man' : c.gender === 'woman'));
    return [...all].sort((a, b) => Number(!!lagos.launch[b.id]?.pass) - Number(!!lagos.launch[a.id]?.pass));
  }, [pref]);
  const [i, setI] = useState(0);
  const [drag, setDrag] = useState(0);
  const [toast, setToast] = useState('');
  const startX = useRef<number | null>(null);
  const c = list[i % Math.max(1, list.length)];

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  function like() {
    if (!c) return;
    if (!lagos.launch[c.id]?.pass) {
      sound.play('buzz');
      setToast(`${c.short} drops soon. We'll ping you.`);
      setI(i + 1);
      return;
    }
    sound.play('chem');
    onMatch(c);
  }

  if (!c)
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <p className="text-white/60">No one here yet.</p>
        <Btn className="mt-4" onClick={onBack}>
          Change who you date
        </Btn>
      </div>
    );

  const playable = !!lagos.launch[c.id]?.pass;
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 pt-5">
        <button onClick={onBack} className="press flex h-10 w-10 items-center justify-center rounded-full bg-white/5">
          ←
        </button>
        <div className="font-display text-lg font-extrabold">Who are you dating?</div>
        <div className="w-10 text-right text-xs text-white/40">
          {(i % list.length) + 1}/{list.length}
        </div>
      </div>
      <div className="relative flex-1 px-5 pt-4">
        <div
          className="relative h-full touch-none select-none overflow-hidden rounded-[32px] border-2 border-white/10"
          style={{ transform: `translateX(${drag}px) rotate(${drag / 22}deg)`, transition: startX.current === null ? 'transform 0.3s' : 'none', background: `linear-gradient(180deg, ${c.look.outfit}55, #0b0c10 70%)` }}
          onPointerDown={(e) => (startX.current = e.clientX)}
          onPointerMove={(e) => startX.current !== null && setDrag(e.clientX - startX.current)}
          onPointerUp={() => {
            const d = drag;
            startX.current = null;
            setDrag(0);
            if (d > 90) like();
            else if (d < -90) setI(i + 1);
          }}
          onPointerCancel={() => ((startX.current = null), setDrag(0))}
        >
          <div className="absolute inset-x-0 top-6 flex justify-center">
            <Portrait look={c.look} feminine={c.gender === 'woman'} artId={c.id.split('_')[0]} size={250} expression="charming" />
          </div>
          {!playable && <div className="absolute right-4 top-4 rounded-full bg-[#F59E0B] px-3 py-1 text-xs font-bold text-black">DROPPING SOON</div>}
          {drag > 40 && <div className="absolute left-5 top-6 -rotate-12 rounded-xl border-4 border-[#10B981] px-3 py-1 font-display text-2xl font-extrabold text-[#10B981]">DATE</div>}
          {drag < -40 && <div className="absolute right-5 top-6 rotate-12 rounded-xl border-4 border-[#EF4444] px-3 py-1 font-display text-2xl font-extrabold text-[#EF4444]">NEXT</div>}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/85 to-transparent p-5 pt-16">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-[32px] font-extrabold leading-none">{c.name}</span>
              <span className="text-xl text-white/60">{c.age}</span>
            </div>
            <div className="mt-1 text-xs font-bold uppercase tracking-widest text-[#F59E0B]">
              {c.group} · {c.archetype}
            </div>
            <p className="mt-2 text-[15px] text-white/85">{c.public_card}</p>
            <p className="mt-2 text-sm text-[#F43F5E]">⚠ {c.signature_catch}</p>
          </div>
        </div>
        {toast && <div className="anim-pop absolute inset-x-8 top-1/2 rounded-2xl bg-black/85 p-4 text-center text-sm">{toast}</div>}
      </div>
      <div className="flex items-center justify-center gap-6 p-5">
        <button onClick={() => (sound.play('swoosh'), setI(i + 1))} className="press flex h-16 w-16 items-center justify-center rounded-full border-2 border-white/15 bg-white/5 text-2xl" aria-label="Next">
          ✕
        </button>
        <button onClick={like} className={`press flex h-20 w-20 items-center justify-center rounded-full text-3xl shadow-[0_8px_40px_rgba(244,63,94,0.5)] ${playable ? 'bg-[#F43F5E]' : 'bg-white/10'}`} aria-label="Date">
          {playable ? '♥' : '🔔'}
        </button>
      </div>
    </div>
  );
}

function MatchReveal({ c, onGo }: { c: Character; onGo: () => void }) {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    sound.play('reveal');
    backend.counters(c.id).then((r) => setCount(r ? r.datingNow : null));
  }, [c.id]);
  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 40%, ${c.look.outfit}88, #08090D 65%)` }} />
      <div className="relative anim-pop">
        <div className="font-display text-sm font-bold uppercase tracking-[0.35em] text-[#F59E0B]">It's a match</div>
        <div className="mt-4 flex justify-center">
          <Portrait look={c.look} feminine={c.gender === 'woman'} artId={c.id.split('_')[0]} size={220} expression="charming" />
        </div>
        <h1 className="font-display -mt-2 text-5xl font-extrabold">{c.name}</h1>
        <p className="mx-auto mt-3 max-w-xs text-white/70">7 days. One hidden truth. Read the signs, or don't.</p>
        {count !== null && <p className="mt-3 text-sm text-[#F43F5E]">{count.toLocaleString()} people are dating {c.short} right now.</p>}
        <Btn tone="gold" className="mt-8 w-full max-w-xs" onClick={onGo}>
          Day 1 →
        </Btn>
      </div>
    </div>
  );
}
