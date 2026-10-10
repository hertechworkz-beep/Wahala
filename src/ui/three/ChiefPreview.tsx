import { useEffect, useRef, useState } from 'react';
import { navigate } from '../kit';

export default function ChiefPreview() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [hint, setHint] = useState('');
  const [line, setLine] = useState<{ who: string; text: string; id: number } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let stage: Awaited<ReturnType<typeof import('../../three/chiefStage').startChiefStage>> | null = null;
    let alive = true;
    import('../../three/chiefStage')
      .then(({ startChiefStage }) =>
        startChiefStage(canvas.current!, {
          onProgress: setProgress,
          onReady: () => setReady(true),
          onHint: setHint,
          onSay: (who, text) => setLine({ who, text, id: Date.now() }),
          onSayEnd: () => setLine(null),
        }, { capture: location.search.includes('capture') || location.hash.includes('capture') }),
      )
      .then((s) => {
        if (!alive) s.dispose();
        else {
          stage = s;
          (window as any).__stage = s;
        }
      })
      .catch((e) => setError(String(e?.message ?? e)));
    return () => {
      alive = false;
      stage?.dispose();
    };
  }, []);

  return (
    <div className="relative h-full overflow-hidden bg-black">
      <canvas ref={canvas} className="absolute inset-0 h-full w-full touch-none" data-stage />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3 pt-[max(12px,env(safe-area-inset-top))]">
        <button className="pointer-events-auto rounded-full bg-black/55 px-3 py-1.5 text-[13px] font-bold backdrop-blur" onClick={() => navigate('/')}>
          ← Wahala
        </button>
        <div className="rounded-full bg-black/55 px-3 py-1.5 text-right text-[11px] font-bold uppercase tracking-wider text-[#F59E0B] backdrop-blur">Chief preview · 3D</div>
      </div>
      {line && (
        <div key={line.id} className="anim-rise pointer-events-none absolute inset-x-4 top-[18%] mx-auto max-w-[420px] rounded-2xl bg-black/70 px-4 py-2.5 text-center backdrop-blur">
          <span className="text-[11px] font-black uppercase tracking-wider text-[#F59E0B]">{line.who} </span>
          <span className="text-[15px]">{line.text}</span>
        </div>
      )}
      {ready && hint && (
        <div className="pointer-events-none absolute inset-x-4 bottom-[max(18px,env(safe-area-inset-bottom))] mx-auto max-w-[420px] rounded-2xl bg-black/55 px-4 py-2.5 text-center text-[13px] text-white/85 backdrop-blur">{hint}</div>
      )}
      {!ready && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0b0809]">
          <div className="text-[13px] font-bold uppercase tracking-[0.25em] text-white/60">Loading Chief</div>
          <div className="h-1.5 w-48 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-[#F59E0B] transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        </div>
      )}
      {error && <div className="absolute inset-x-4 top-1/3 rounded-2xl bg-red-950/80 p-4 text-sm">3D failed to start: {error}</div>}
    </div>
  );
}
