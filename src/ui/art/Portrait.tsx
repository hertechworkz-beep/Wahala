import { useEffect, useId, useState } from 'react';
import type { PortraitLook } from '../../engine/types';

// Tasteful illustrated placeholder portraits. When `public/art/<id>_<expression>.webp`
// exists it is used instead, automatically (Immersion requirement 8).

export type Expression = 'charming' | 'suspicious' | 'angry' | 'caught' | 'happy' | 'sad' | string;

const artCache = new Map<string, boolean>();
export function useArt(path: string | undefined): boolean {
  const [ok, setOk] = useState(() => (path ? artCache.get(path) === true : false));
  useEffect(() => {
    if (!path) return;
    if (artCache.has(path)) {
      setOk(artCache.get(path)!);
      return;
    }
    const img = new Image();
    img.onload = () => {
      artCache.set(path, true);
      setOk(true);
    };
    img.onerror = () => {
      artCache.set(path, false);
      setOk(false);
    };
    img.src = path;
  }, [path]);
  return ok;
}

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

interface FaceExpr {
  brows: [number, number, number, number]; // left outer, left inner, right inner, right outer (y offsets)
  eyeOpen: number;
  look: number; // iris x shift
  mouth: 'smirk' | 'smile' | 'flat' | 'frown' | 'o' | 'sad' | 'clench';
  sweat?: boolean;
  flush?: string;
  blush?: boolean;
}

const EXPR: Record<string, FaceExpr> = {
  charming: { brows: [0, 1, -2, -5], eyeOpen: 0.95, look: 1, mouth: 'smirk' },
  happy: { brows: [-3, -3, -3, -3], eyeOpen: 0.62, look: 0, mouth: 'smile', blush: true },
  suspicious: { brows: [1, 5, 6, 1], eyeOpen: 0.55, look: 4, mouth: 'flat' },
  angry: { brows: [-3, 9, 9, -3], eyeOpen: 0.72, look: 0, mouth: 'clench', flush: 'rgba(200,30,30,0.18)' },
  caught: { brows: [-9, -11, -11, -9], eyeOpen: 1.25, look: -2, mouth: 'o', sweat: true },
  sad: { brows: [3, -7, -7, 3], eyeOpen: 0.8, look: -1, mouth: 'sad' },
};

export function Portrait({
  look,
  expression = 'charming',
  feminine,
  artId,
  size = 300,
  ringing,
  className = '',
  idle = true,
}: {
  look: PortraitLook;
  expression?: Expression;
  feminine?: boolean;
  artId?: string;
  size?: number;
  ringing?: boolean;
  className?: string;
  idle?: boolean;
}) {
  const art = artId ? `/art/${artId}_${expression}.webp` : undefined;
  const hasArt = useArt(art);
  const uid = useId().replace(/:/g, '');
  if (hasArt && art) return <img src={art} alt="" width={size} className={`${idle ? 'anim-breathe' : ''} ${className}`} style={{ height: 'auto' }} />;

  const e = EXPR[expression] ?? EXPR.charming;
  const skin = look.skin;
  const skinDark = shade(skin, -28);
  const skinLight = shade(skin, 26);
  const lip = shade(skin, -45);
  const hair = look.hairColor;
  const broad = look.build === 'broad' ? 1.12 : look.build === 'slim' ? 0.92 : 1;
  const headRx = feminine ? 56 : 60;
  const headRy = feminine ? 70 : 72;

  return (
    <svg viewBox="0 0 300 360" width={size} height={(size * 360) / 300} className={className} aria-hidden>
      <defs>
        <radialGradient id={`face${uid}`} cx="45%" cy="40%" r="70%">
          <stop offset="0%" stopColor={skinLight} />
          <stop offset="60%" stopColor={skin} />
          <stop offset="100%" stopColor={skinDark} />
        </radialGradient>
        <linearGradient id={`cloth${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={shade(look.outfit, 22)} />
          <stop offset="100%" stopColor={shade(look.outfit, -30)} />
        </linearGradient>
        <pattern id={`pat${uid}`} width="22" height="22" patternUnits="userSpaceOnUse">
          <circle cx="11" cy="11" r="3.2" fill={look.outfitAccent} opacity="0.75" />
          <path d="M5 4 L8 7 M17 4 L14 7 M5 18 L8 15 M17 18 L14 15" stroke={look.outfitAccent} strokeWidth="1.4" opacity="0.6" />
        </pattern>
        {[0, 1].map((i) => (
          <clipPath id={`eye${uid}${i}`} key={i}>
            <path d={eyePath(i === 0 ? 122 : 178, 140, e.eyeOpen)} />
          </clipPath>
        ))}
      </defs>

      <g className={idle ? 'anim-breathe' : ''}>
        {/* Back hair */}
        {backHair(look, hair)}

        {/* Body + outfit */}
        <g transform={`translate(150 0) scale(${broad} 1) translate(-150 0)`}>
          <path d="M14 360 C 24 282, 86 246, 150 244 C 214 246, 276 282, 286 360 Z" fill={`url(#cloth${uid})`} />
          {outfitDetail(look, uid, feminine)}
        </g>

        {/* Neck */}
        <path d="M126 196 L126 238 Q150 256 174 238 L174 196 Z" fill={skinDark} />
        {look.hair === 'hijab' && <path d="M84 150 Q78 250 150 268 Q222 250 216 150 Q216 230 150 236 Q84 230 84 150 Z" fill={hair} />}
        {look.accessory === 'gold_chain' && <path d="M118 246 Q150 288 182 246" stroke="#e8c14a" strokeWidth="5" fill="none" strokeDasharray="6 3" />}
        {look.accessory === 'beads' && <path d="M118 246 Q150 284 182 246" stroke="#d1462f" strokeWidth="7" fill="none" strokeDasharray="5 3" strokeLinecap="round" />}

        {/* Ears */}
        {look.hair !== 'hijab' && (
          <>
            <ellipse cx={150 - headRx + 2} cy="146" rx="10" ry="16" fill={skin} />
            <ellipse cx={150 + headRx - 2} cy="146" rx="10" ry="16" fill={skin} />
            {look.accessory === 'earrings' && (
              <>
                <circle cx={150 - headRx + 2} cy="166" r="5" fill="#e8c14a" />
                <circle cx={150 + headRx - 2} cy="166" r="5" fill="#e8c14a" />
              </>
            )}
          </>
        )}

        {/* Head */}
        <ellipse cx="150" cy="140" rx={headRx} ry={headRy} fill={`url(#face${uid})`} />
        {e.flush && <ellipse cx="150" cy="150" rx={headRx - 4} ry={headRy - 6} fill={e.flush} />}
        {e.blush && (
          <>
            <ellipse cx="114" cy="168" rx="12" ry="6" fill="#ff6b8a" opacity="0.18" />
            <ellipse cx="186" cy="168" rx="12" ry="6" fill="#ff6b8a" opacity="0.18" />
          </>
        )}

        {/* Beard */}
        {look.beard && (
          <path
            d={`M${150 - headRx + 6} 150 Q${150 - headRx + 10} 205 150 214 Q${150 + headRx - 10} 205 ${150 + headRx - 6} 150 Q${150 + headRx - 14} 192 168 190 Q150 184 132 190 Q${150 - headRx + 14} 192 ${150 - headRx + 6} 150 Z`}
            fill={look.hair === 'cap' && look.hairColor !== '#f2efe6' ? '#2a2320' : hair === '#f2efe6' ? '#1d1714' : hair}
            opacity="0.92"
          />
        )}

        {/* Eyes */}
        {[0, 1].map((i) => {
          const cx = i === 0 ? 122 : 178;
          return (
            <g key={i}>
              <g className={idle ? 'anim-blink' : ''}>
                <path d={eyePath(cx, 140, e.eyeOpen)} fill="#f7f1ea" />
                <g clipPath={`url(#eye${uid}${i})`}>
                  <circle cx={cx + e.look} cy="141" r={expression === 'caught' ? 6 : 7.5} fill="#3a2414" />
                  <circle cx={cx + e.look} cy="141" r="3.6" fill="#0d0805" />
                  <circle cx={cx + e.look + 2.5} cy="138" r="1.8" fill="#fff" />
                </g>
                <path d={eyeLid(cx, 140, e.eyeOpen)} stroke="#1b110c" strokeWidth={feminine ? 3.4 : 2.4} fill="none" strokeLinecap="round" />
                {feminine && <path d={`M${i === 0 ? cx - 16 : cx + 16} 139 l ${i === 0 ? -5 : 5} -4`} stroke="#1b110c" strokeWidth="2.6" strokeLinecap="round" />}
              </g>
            </g>
          );
        })}

        {/* Brows */}
        <path d={`M104 ${120 + e.brows[0]} Q118 ${113 + (e.brows[0] + e.brows[1]) / 2} 136 ${119 + e.brows[1]}`} stroke={browColor(look)} strokeWidth={feminine ? 4 : 6} fill="none" strokeLinecap="round" />
        <path d={`M164 ${119 + e.brows[2]} Q182 ${113 + (e.brows[2] + e.brows[3]) / 2} 196 ${120 + e.brows[3]}`} stroke={browColor(look)} strokeWidth={feminine ? 4 : 6} fill="none" strokeLinecap="round" />

        {/* Nose */}
        <path d="M150 140 Q146 162 138 171 Q150 179 162 171 Q154 162 150 140" fill={skinDark} opacity="0.55" />
        <ellipse cx="142" cy="172" rx="4" ry="2.4" fill={shade(skin, -60)} opacity="0.6" />
        <ellipse cx="158" cy="172" rx="4" ry="2.4" fill={shade(skin, -60)} opacity="0.6" />

        {/* Mouth */}
        {mouth(e.mouth, lip, feminine)}

        {/* Glasses */}
        {look.accessory === 'glasses' && (
          <g stroke="#111" strokeWidth="3.5" fill="rgba(140,180,220,0.12)">
            <rect x="100" y="126" width="44" height="28" rx="10" />
            <rect x="156" y="126" width="44" height="28" rx="10" />
            <path d="M144 138 L156 138" />
          </g>
        )}

        {/* Front hair / cap */}
        {frontHair(look, hair, headRx)}

        {e.sweat && <path d="M206 112 Q214 126 206 132 Q198 126 206 112 Z" fill="#a8e1ff" opacity="0.9" />}
        {expression === 'angry' && <path d="M196 92 l8 -8 M204 96 l10 -4 M200 102 l10 2" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />}
      </g>

      {/* Phone lighting up in hand */}
      {ringing && (
        <g className="anim-ring" style={{ transformOrigin: '240px 320px' }}>
          <ellipse cx="236" cy="330" rx="34" ry="22" fill={skin} />
          <rect x="222" y="282" width="34" height="58" rx="7" fill="#111" stroke="#333" strokeWidth="2" />
          <rect x="226" y="288" width="26" height="44" rx="4" fill="#7dd3fc" opacity="0.95" />
          <circle cx="239" cy="310" r="40" fill="#7dd3fc" opacity="0.18" />
        </g>
      )}
    </svg>
  );
}

function browColor(look: PortraitLook) {
  return look.hairColor === '#f2efe6' || look.hair === 'cap' || look.hair === 'hijab' ? '#1d1410' : shade(look.hairColor, -10);
}

function eyePath(cx: number, cy: number, open: number) {
  const up = 11 * open;
  const down = 6.5 * Math.min(1.1, open + 0.15);
  return `M${cx - 16} ${cy} Q${cx} ${cy - up} ${cx + 16} ${cy} Q${cx} ${cy + down} ${cx - 16} ${cy} Z`;
}
function eyeLid(cx: number, cy: number, open: number) {
  return `M${cx - 17} ${cy + 0.5} Q${cx} ${cy - 11 * open - 1} ${cx + 17} ${cy + 0.5}`;
}

function mouth(kind: FaceExpr['mouth'], lip: string, feminine?: boolean) {
  const lipW = feminine ? 5 : 4;
  switch (kind) {
    case 'smirk':
      return (
        <g>
          <path d="M130 194 Q150 205 172 189" stroke={lip} strokeWidth={lipW} fill="none" strokeLinecap="round" />
          {feminine && <path d="M134 196 Q150 202 168 192 Q150 210 134 196 Z" fill={shade(lip, 25)} opacity="0.8" />}
        </g>
      );
    case 'smile':
      return (
        <g>
          <path d="M126 190 Q150 218 174 190 Q150 199 126 190 Z" fill="#3a0f0f" />
          <path d="M131 192 Q150 199 169 192 L167 197 Q150 202 133 197 Z" fill="#fff" />
          <path d="M126 190 Q150 218 174 190" stroke={lip} strokeWidth="3" fill="none" strokeLinecap="round" />
        </g>
      );
    case 'flat':
      return <path d="M133 198 Q150 197 167 194" stroke={lip} strokeWidth={lipW} fill="none" strokeLinecap="round" />;
    case 'frown':
    case 'sad':
      return <path d="M132 203 Q150 192 168 203" stroke={lip} strokeWidth={lipW} fill="none" strokeLinecap="round" />;
    case 'o':
      return (
        <g>
          <ellipse cx="150" cy="199" rx="8" ry="10" fill="#3a0f0f" />
          <ellipse cx="150" cy="199" rx="8" ry="10" fill="none" stroke={lip} strokeWidth="3" />
        </g>
      );
    case 'clench':
      return (
        <g>
          <rect x="132" y="192" width="36" height="12" rx="5" fill="#fff" stroke={lip} strokeWidth="3" />
          <path d="M141 192 v12 M150 192 v12 M159 192 v12" stroke="#bbb" strokeWidth="1.2" />
        </g>
      );
  }
}

function outfitDetail(look: PortraitLook, uid: string, feminine?: boolean) {
  const a = look.outfitAccent;
  switch (look.outfitStyle) {
    case 'agbada':
      return (
        <g>
          <path d="M14 360 C 24 282, 86 246, 150 244 C 214 246, 276 282, 286 360 Z" fill={`url(#pat${uid})`} opacity="0.55" />
          <path d="M112 246 L150 300 L188 246" stroke={a} strokeWidth="6" fill="none" />
          <path d="M150 300 L150 360" stroke={a} strokeWidth="4" strokeDasharray="8 5" />
          <circle cx="150" cy="318" r="6" fill={a} />
        </g>
      );
    case 'kaftan':
    case 'senator':
      return (
        <g>
          <path d="M128 244 Q150 254 172 244" stroke={a} strokeWidth="6" fill="none" />
          <path d="M150 252 L150 360" stroke={a} strokeWidth="4" />
          {[270, 292, 314, 336].map((y) => (
            <path key={y} d={`M140 ${y} L150 ${y + 8} L160 ${y}`} stroke={a} strokeWidth="2.5" fill="none" />
          ))}
        </g>
      );
    case 'shirt':
      return (
        <g>
          <path d="M120 244 L146 280 L134 252 Z M180 244 L154 280 L166 252 Z" fill={shade(look.outfit, -15)} />
          <path d="M150 280 L150 360" stroke={shade(look.outfit, -35)} strokeWidth="2" />
          {[296, 320, 344].map((y) => <circle key={y} cx="150" cy={y} r="3" fill={shade(look.outfit, -45)} />)}
        </g>
      );
    case 'jacket':
      return (
        <g>
          <path d="M120 246 L150 330 L180 246 L165 246 L150 300 L135 246 Z" fill={a} opacity="0.95" />
          <path d="M108 250 L142 330 L150 360 L64 360 Z M192 250 L158 330 L150 360 L236 360 Z" fill={shade(look.outfit, -12)} />
        </g>
      );
    case 'dress':
      return (
        <g>
          <path d={feminine ? 'M106 262 Q150 300 194 262' : 'M120 252 Q150 280 180 252'} stroke={a} strokeWidth="4" fill="none" />
          <path d="M86 270 Q150 330 214 270" stroke={shade(look.outfit, 30)} strokeWidth="3" fill="none" opacity="0.6" />
        </g>
      );
    case 'top':
      return <path d="M100 262 Q150 292 200 262 L200 272 Q150 300 100 272 Z" fill={a} opacity="0.9" />;
  }
}

function backHair(look: PortraitLook, hair: string) {
  switch (look.hair) {
    case 'frontal':
      return <path d="M84 120 Q78 60 150 54 Q222 60 216 120 L232 300 Q200 320 186 280 L186 200 L114 200 L114 280 Q100 320 68 300 Z" fill={hair} />;
    case 'braids':
      return (
        <g fill={hair}>
          {[-48, -36, -24, 24, 36, 48].map((dx) => (
            <rect key={dx} x={150 + dx * 1.6 - 6} y="120" width="12" height="190" rx="6" />
          ))}
        </g>
      );
    case 'locs':
      return (
        <g fill={hair}>
          {[-56, -44, -32, 32, 44, 56].map((dx) => (
            <rect key={dx} x={150 + dx * 1.45 - 7} y="110" width="14" height={dx % 3 ? 150 : 170} rx="7" />
          ))}
        </g>
      );
    default:
      return null;
  }
}

function frontHair(look: PortraitLook, hair: string, rx: number) {
  switch (look.hair) {
    case 'cap':
      return (
        <g>
          <path d={`M${150 - rx - 2} 104 Q${150 - rx} 46 150 44 Q${150 + rx} 46 ${150 + rx + 2} 104 Q150 92 ${150 - rx - 2} 104 Z`} fill={hair} />
          <path d={`M${150 - rx - 2} 104 Q150 92 ${150 + rx + 2} 104`} stroke={shade(hair, -40)} strokeWidth="5" fill="none" />
          <path d={`M${150 - 30} 70 Q150 58 ${150 + 30} 70`} stroke={shade(hair, 30)} strokeWidth="2" fill="none" opacity="0.5" />
        </g>
      );
    case 'low':
    case 'waves':
      return (
        <g>
          <path d={`M${150 - rx + 2} 118 Q${150 - rx} 62 150 62 Q${150 + rx} 62 ${150 + rx - 2} 118 Q${150 + rx - 10} 86 150 84 Q${150 - rx + 10} 86 ${150 - rx + 2} 118 Z`} fill={hair} />
          {look.hair === 'waves' &&
            [74, 82, 90].map((y) => <path key={y} d={`M${118} ${y} q8 -5 16 0 t16 0 t16 0 t16 0`} stroke={shade(hair, 40)} strokeWidth="1.6" fill="none" opacity="0.6" />)}
        </g>
      );
    case 'bald':
      return <ellipse cx="136" cy="86" rx="20" ry="8" fill="#fff" opacity="0.12" />;
    case 'frontal':
      return <path d={`M${150 - rx - 4} 140 Q${150 - rx - 6} 58 150 56 Q${150 + rx + 6} 58 ${150 + rx + 4} 140 Q${150 + rx - 6} 92 168 78 Q140 92 ${150 - rx + 8} 150 Z`} fill={hair} />;
    case 'braids':
      return (
        <g>
          <path d={`M${150 - rx} 120 Q${150 - rx} 58 150 58 Q${150 + rx} 58 ${150 + rx} 120 Q150 80 ${150 - rx} 120 Z`} fill={hair} />
          {[-30, -15, 0, 15, 30].map((dx) => <path key={dx} d={`M${150 + dx} 62 L${150 + dx * 1.6} 102`} stroke={shade(hair, 30)} strokeWidth="2" opacity="0.5" />)}
        </g>
      );
    case 'locs':
      return (
        <g>
          <path d={`M${150 - rx} 116 Q${150 - rx} 56 150 56 Q${150 + rx} 56 ${150 + rx} 116 Q150 84 ${150 - rx} 116 Z`} fill={hair} />
          {[-36, -12, 12, 36].map((dx) => <rect key={dx} x={150 + dx - 6} y="74" width="12" height={dx === -12 ? 70 : 44} rx="6" fill={shade(hair, 8)} />)}
        </g>
      );
    case 'bun':
      return (
        <g>
          <circle cx="150" cy="54" r="24" fill={hair} />
          <path d={`M${150 - rx} 122 Q${150 - rx} 62 150 62 Q${150 + rx} 62 ${150 + rx} 122 Q${150 + 20} 82 150 80 Q${150 - 20} 82 ${150 - rx} 122 Z`} fill={hair} />
        </g>
      );
    case 'hijab':
      return <path d={`M${150 - rx - 14} 150 Q${150 - rx - 14} 50 150 48 Q${150 + rx + 14} 50 ${150 + rx + 14} 150 Q${150 + rx - 2} 84 150 80 Q${150 - rx + 2} 84 ${150 - rx - 14} 150 Z`} fill={hair} />;
    case 'curls':
      return (
        <g fill={hair}>
          {[-50, -30, -10, 10, 30, 50].map((dx, i) => (
            <circle key={dx} cx={150 + dx} cy={70 + (i % 2) * 8} r="22" />
          ))}
        </g>
      );
  }
}
