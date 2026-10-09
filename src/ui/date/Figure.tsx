import { useId } from 'react';
import type { PortraitLook } from '../../engine/types';
import { shade } from '../art/Portrait';

// Full-body avatar for the dress-up and the floor plan. Everything worn is drawn: outfit,
// shoes, jewellery, bag, hairstyle and a perfume aura. Replaceable later with layered art
// (one image per slot) without touching the scene logic.

export interface Worn {
  shoes?: string;
  jewellery?: string;
  bag?: string;
  perfume?: string;
}

export function Figure({ look, feminine, worn = {}, size = 220, className = '', pose = 'stand' }: { look: PortraitLook; feminine: boolean; worn?: Worn; size?: number; className?: string; pose?: 'stand' | 'wave' }) {
  const uid = useId().replace(/[:«»]/g, '') + look.outfit.slice(1) + (worn.perfume ?? '');
  const skin = look.skin;
  const skinD = shade(skin, -26);
  const skinL = shade(skin, 22);
  const cloth = look.outfit;
  const acc = look.outfitAccent;
  const w = look.build === 'broad' ? 1.14 : look.build === 'slim' ? 0.9 : 1;
  const style = look.outfitStyle;
  const trousers = !feminine || style === 'jacket';
  const sx = (x: number) => 100 + (x - 100) * w;

  return (
    <svg viewBox="0 0 200 440" width={size} height={(size * 440) / 200} className={className} aria-hidden>
      <defs>
        <linearGradient id={`c${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={shade(cloth, 26)} />
          <stop offset="100%" stopColor={shade(cloth, -34)} />
        </linearGradient>
        <linearGradient id={`s${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={skinD} />
          <stop offset="45%" stopColor={skin} />
          <stop offset="100%" stopColor={skinD} />
        </linearGradient>
        <pattern id={`p${uid}`} width="16" height="16" patternUnits="userSpaceOnUse">
          <circle cx="8" cy="8" r="2.6" fill={acc} opacity="0.8" />
          <path d="M2 2 L5 5 M14 2 L11 5 M2 14 L5 11 M14 14 L11 11" stroke={acc} strokeWidth="1.1" opacity="0.7" />
        </pattern>
        <radialGradient id={`a${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={worn.perfume === 'p_oud' ? '#f5b041' : '#f9a8d4'} stopOpacity="0.55" />
          <stop offset="100%" stopColor={worn.perfume === 'p_oud' ? '#f5b041' : '#f9a8d4'} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Perfume aura */}
      {worn.perfume && worn.perfume !== 'p_none' && (
        <g className="anim-aura">
          <ellipse cx="100" cy="220" rx="96" ry="200" fill={`url(#a${uid})`} />
          {[0, 1, 2, 3, 4].map((i) => (
            <circle key={i} cx={30 + i * 36} cy={120 + ((i * 71) % 220)} r={worn.perfume === 'p_oud' ? 2.2 : 3} fill={worn.perfume === 'p_oud' ? '#ffd27a' : '#fbcfe8'} className="anim-sparkle" style={{ animationDelay: `${i * 0.37}s` }} />
          ))}
        </g>
      )}
      <ellipse cx="100" cy="418" rx={50 * w} ry="8" fill="#000" opacity="0.35" />

      {/* Back hair */}
      {feminine && look.hair === 'frontal' && <path d="M72 50 Q66 120 74 172 L126 172 Q134 120 128 50 Z" fill={look.hairColor} />}
      {feminine && look.hair === 'braids' && (
        <g stroke={look.hairColor} strokeWidth="5" strokeLinecap="round">
          {[-26, -20, -14, 14, 20, 26].map((dx) => (
            <path key={dx} d={`M${100 + dx} 52 Q${100 + dx * 1.15} 120 ${100 + dx * 1.05} 190`} fill="none" />
          ))}
        </g>
      )}

      {/* Legs */}
      {!trousers && (
        <g fill={`url(#s${uid})`}>
          <path d={`M${sx(86)} 290 L${sx(84)} 398 L${sx(94)} 398 L${sx(98)} 290 Z`} />
          <path d={`M${sx(102)} 290 L${sx(106)} 398 L${sx(116)} 398 L${sx(114)} 290 Z`} />
        </g>
      )}
      {trousers && (
        <g fill={style === 'jacket' ? shade(cloth, -18) : shade(cloth, -8)}>
          <path d={`M${sx(76)} 236 L${sx(80)} 398 L${sx(97)} 398 L${sx(100)} 262 L${sx(103)} 398 L${sx(120)} 398 L${sx(124)} 236 Z`} />
        </g>
      )}

      {/* Shoes */}
      <Shoes id={worn.shoes} x1={sx(89)} x2={sx(111)} trousers={trousers} />

      {/* Outfit */}
      {style === 'dress' && (
        <g>
          <path d={`M${sx(78)} 104 Q${sx(70)} 160 ${sx(80)} 200 Q${sx(66)} 250 ${sx(60)} 304 L${sx(140)} 304 Q${sx(134)} 250 ${sx(120)} 200 Q${sx(130)} 160 ${sx(122)} 104 Q100 118 ${sx(78)} 104 Z`} fill={`url(#c${uid})`} />
          <path d={`M${sx(80)} 200 Q100 208 ${sx(120)} 200`} stroke={acc} strokeWidth="3.5" fill="none" />
          {cloth === '#b8862b' && [0, 1, 2, 3, 4, 5, 6, 7].map((i) => <circle key={i} cx={sx(76 + (i % 4) * 16)} cy={140 + Math.floor(i / 4) * 90 + (i % 2) * 20} r="2" fill="#fff3c4" opacity="0.9" className="anim-sparkle" style={{ animationDelay: `${i * 0.2}s` }} />)}
        </g>
      )}
      {style === 'agbada' && feminine && (
        <g>
          <path d={`M${sx(76)} 104 Q100 116 ${sx(124)} 104 L${sx(126)} 200 L${sx(74)} 200 Z`} fill={`url(#c${uid})`} />
          <path d={`M${sx(74)} 196 L${sx(126)} 196 L${sx(134)} 396 L${sx(66)} 396 Z`} fill={cloth} />
          <path d={`M${sx(74)} 196 L${sx(126)} 196 L${sx(134)} 396 L${sx(66)} 396 Z`} fill={`url(#p${uid})`} />
          <path d={`M${sx(76)} 104 Q${sx(58)} 108 ${sx(60)} 134 L${sx(78)} 132 Z M${sx(124)} 104 Q${sx(142)} 108 ${sx(140)} 134 L${sx(122)} 132 Z`} fill={shade(cloth, 14)} />
        </g>
      )}
      {style === 'agbada' && !feminine && (
        <g>
          <path d={`M${sx(74)} 104 Q${sx(24)} 150 ${sx(20)} 250 L${sx(54)} 262 L${sx(62)} 392 L${sx(138)} 392 L${sx(146)} 262 L${sx(180)} 250 Q${sx(176)} 150 ${sx(126)} 104 Q100 116 ${sx(74)} 104 Z`} fill={`url(#c${uid})`} />
          <path d={`M88 106 Q100 150 112 106`} stroke={acc} strokeWidth="4" fill="none" />
          <path d={`M${sx(84)} 140 Q100 170 ${sx(116)} 140`} stroke={acc} strokeWidth="2" fill="none" opacity="0.8" />
          <path d={`M${sx(22)} 246 L${sx(54)} 258 M${sx(178)} 246 L${sx(146)} 258`} stroke={acc} strokeWidth="3" />
        </g>
      )}
      {(style === 'kaftan' || style === 'senator') && (
        <g>
          <path d={`M${sx(74)} 104 Q100 116 ${sx(126)} 104 L${sx(130)} 330 L${sx(70)} 330 Z`} fill={`url(#c${uid})`} />
          <path d="M100 108 L100 170" stroke={acc} strokeWidth="2.5" />
          {[124, 140, 156].map((y) => <circle key={y} cx="104" cy={y} r="1.6" fill={acc} />)}
        </g>
      )}
      {(style === 'jacket' || style === 'shirt' || style === 'top') && (
        <g>
          <path d={`M${sx(74)} 104 Q100 114 ${sx(126)} 104 L${sx(128)} 246 L${sx(72)} 246 Z`} fill={`url(#c${uid})`} />
          {style === 'jacket' && (
            <>
              <path d="M92 108 L100 168 L108 108 Z" fill={acc} />
              <path d={`M92 108 L100 168 L${sx(86)} 246 M108 108 L100 168 L${sx(114)} 246`} stroke={shade(cloth, -40)} strokeWidth="2" fill="none" />
              <circle cx="100" cy="190" r="2.4" fill={shade(acc, -40)} />
            </>
          )}
        </g>
      )}

      {/* Arms */}
      <Arms style={style} feminine={feminine} cloth={cloth} skinGrad={`url(#s${uid})`} sx={sx} wave={pose === 'wave'} />

      {/* Neck and head */}
      <path d="M92 80 L92 104 Q100 112 108 104 L108 80 Z" fill={skinD} />
      {look.hair === 'gele' && <Gele color={look.hairColor} />}
      <ellipse cx="100" cy="58" rx="21" ry="26" fill={skin} />
      <ellipse cx="94" cy="50" rx="10" ry="12" fill={skinL} opacity="0.35" />
      <ellipse cx="79" cy="60" rx="4" ry="6" fill={skinD} />
      <ellipse cx="121" cy="60" rx="4" ry="6" fill={skinD} />
      <FrontHair hair={look.hair} color={look.hairColor} feminine={feminine} />
      {/* face */}
      <path d="M86 50 Q91 47 96 50 M104 50 Q109 47 114 50" stroke="#1a0f0a" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <g className="anim-blink">
        <ellipse cx="91" cy="56" rx="2.6" ry="2" fill="#1a0f0a" />
        <ellipse cx="109" cy="56" rx="2.6" ry="2" fill="#1a0f0a" />
      </g>
      <path d="M99 58 Q97 66 100 67" stroke={skinD} strokeWidth="1.4" fill="none" />
      <path d="M93 72 Q100 77 107 72" stroke={feminine ? '#7a2230' : shade(skin, -55)} strokeWidth={feminine ? 2.6 : 2} fill="none" strokeLinecap="round" />
      {look.beard && (
        <path
          d={look.beardStyle === 'goatee' ? 'M95 75 Q100 86 105 75 Q100 80 95 75 Z' : look.beardStyle === 'stubble' ? 'M80 62 Q82 84 100 86 Q118 84 120 62 Q116 80 100 82 Q84 80 80 62 Z' : 'M79 58 Q78 90 100 94 Q122 90 121 58 Q118 78 100 80 Q82 78 79 58 Z'}
          fill={look.hairColor === '#a3131a' ? '#2a1d17' : look.hairColor}
          opacity={look.beardStyle === 'stubble' ? 0.45 : 0.95}
        />
      )}
      {feminine && look.accessory === 'earrings' && (
        <>
          <circle cx="79" cy="68" r="2.4" fill="#e8c14a" />
          <circle cx="121" cy="68" r="2.4" fill="#e8c14a" />
        </>
      )}

      {/* Jewellery */}
      {worn.jewellery === 'j_gold_chain' && <path d="M90 100 Q100 128 110 100" stroke="#e8c14a" strokeWidth="3" fill="none" strokeDasharray="3 2" />}
      {worn.jewellery === 'j_coral' && (
        <g fill="#d1462f" stroke="#7a1d12" strokeWidth="0.6">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => {
            const a = Math.PI * (0.15 + (i / 8) * 0.7);
            return <circle key={i} cx={100 - Math.cos(a) * 14} cy={98 + Math.sin(a) * 18} r="3.2" />;
          })}
          {[0, 1, 2, 3, 4, 5, 6].map((i) => {
            const a = Math.PI * (0.18 + (i / 6) * 0.64);
            return <circle key={`b${i}`} cx={100 - Math.cos(a) * 18} cy={102 + Math.sin(a) * 26} r="2.8" />;
          })}
        </g>
      )}
      {worn.jewellery === 'j_pearls' && (
        <g fill="#f8f4e8">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => {
            const a = Math.PI * (0.12 + (i / 9) * 0.76);
            return <circle key={i} cx={100 - Math.cos(a) * 13} cy={97 + Math.sin(a) * 14} r="2" />;
          })}
        </g>
      )}
      {worn.jewellery === 'j_watch' && <rect x={sx(136) - (style === 'agbada' && !feminine ? 72 : 0)} y="226" width="9" height="7" rx="2" fill="#c0c6cc" stroke="#6b7280" />}

      {/* Bag */}
      {worn.bag === 'b_clutch' && <rect x={sx(42)} y="224" width="26" height="14" rx="3" fill="#d4a017" stroke="#8a6508" />}
      {worn.bag === 'b_designer' && (
        <g>
          <path d={`M${sx(48)} 200 Q${sx(56)} 186 ${sx(64)} 200`} stroke="#3b2a1a" strokeWidth="3" fill="none" />
          <rect x={sx(38)} y="200" width="36" height="30" rx="4" fill="#6b4423" />
          <path d={`M${sx(40)} 208 h32 M${sx(40)} 216 h32 M${sx(40)} 224 h32`} stroke="#c9a86a" strokeWidth="1" strokeDasharray="2 3" />
          <rect x={sx(52)} y="204" width="8" height="5" fill="#e8c14a" />
        </g>
      )}
      {worn.bag === 'b_tote' && (
        <g>
          <path d={`M${sx(44)} 196 Q${sx(56)} 170 ${sx(68)} 196`} stroke="#d6cfc2" strokeWidth="3" fill="none" />
          <rect x={sx(36)} y="196" width="40" height="40" rx="3" fill="#ece6d8" />
          <text x={sx(56)} y="221" fontSize="7" textAnchor="middle" fill="#555" fontFamily="sans-serif">LAGOS</text>
        </g>
      )}
    </svg>
  );
}

function Arms({ style, feminine, cloth, skinGrad, sx, wave }: { style: string; feminine: boolean; cloth: string; skinGrad: string; sx: (x: number) => number; wave: boolean }) {
  if (style === 'agbada' && !feminine) {
    return (
      <g fill={skinGrad}>
        <ellipse cx={sx(36)} cy="252" rx="6" ry="7" />
        <ellipse cx={sx(164)} cy="252" rx="6" ry="7" />
      </g>
    );
  }
  const sleeve = style === 'dress' ? 0 : style === 'agbada' ? 0.28 : 1;
  const L = { s: [sx(76), 108], h: [sx(56), 234] };
  const R = wave ? { s: [sx(124), 108], h: [sx(150), 40] } : { s: [sx(124), 108], h: [sx(144), 234] };
  const arm = (a: typeof L, k: string) => {
    const mx = a.s[0] + (a.h[0] - a.s[0]) * sleeve;
    const my = a.s[1] + (a.h[1] - a.s[1]) * sleeve;
    return (
      <g key={k}>
        <path d={`M${a.s[0]} ${a.s[1]} L${a.h[0]} ${a.h[1]}`} stroke={skinGrad} strokeWidth="11" strokeLinecap="round" />
        {sleeve > 0 && <path d={`M${a.s[0]} ${a.s[1]} L${mx} ${my}`} stroke={style === 'jacket' ? cloth : shade(cloth, 10)} strokeWidth={style === 'agbada' ? 18 : 13} strokeLinecap="round" />}
        <circle cx={a.h[0]} cy={a.h[1]} r="6.5" fill={skinGrad} />
      </g>
    );
  };
  return <g>{[arm(L, 'l'), arm(R, 'r')]}</g>;
}

function Shoes({ id, x1, x2, trousers }: { id?: string; x1: number; x2: number; trousers: boolean }) {
  const y = 400;
  const one = (x: number, k: string) => {
    switch (id) {
      case 's_heels':
        return (
          <g key={k}>
            <path d={`M${x - 8} ${y} Q${x - 9} ${y + 10} ${x + 9} ${y + 12} L${x + 12} ${y + 12} L${x + 6} ${y - 3} Z`} fill="#c1121f" />
            <path d={`M${x - 7} ${y + 2} L${x - 8} ${y + 15}`} stroke="#c1121f" strokeWidth="2.5" />
          </g>
        );
      case 's_flats':
        return <ellipse key={k} cx={x + 2} cy={y + 8} rx="11" ry="5" fill="#d4a017" />;
      case 's_sneakers':
        return (
          <g key={k}>
            <path d={`M${x - 10} ${y - 2} L${x + 6} ${y - 2} Q${x + 15} ${y + 4} ${x + 14} ${y + 12} L${x - 11} ${y + 12} Z`} fill="#f4f4f5" />
            <rect x={x - 11} y={y + 9} width="26" height="4" fill="#d4d4d8" />
          </g>
        );
      case 's_loafers':
        return <path key={k} d={`M${x - 10} ${y} L${x + 6} ${y} Q${x + 16} ${y + 4} ${x + 15} ${y + 11} L${x - 10} ${y + 11} Z`} fill="#3b1f12" stroke="#c9a86a" strokeWidth="1" />;
      case 's_sandals':
        return (
          <g key={k}>
            <ellipse cx={x + 2} cy={y + 10} rx="12" ry="3.5" fill="#6b4423" />
            <path d={`M${x - 6} ${y + 2} L${x + 8} ${y + 8} M${x + 8} ${y + 2} L${x - 4} ${y + 8}`} stroke="#6b4423" strokeWidth="2.5" />
          </g>
        );
      default:
        return <ellipse key={k} cx={x + 2} cy={y + 8} rx="10" ry="5" fill={trousers ? '#111' : '#3a2a20'} opacity="0.85" />;
    }
  };
  return <g>{[one(x1 - 2, 'l'), one(x2, 'r')]}</g>;
}

function Gele({ color }: { color: string }) {
  return (
    <g>
      <path d="M62 44 Q66 4 100 0 Q140 2 142 40 Q126 30 118 38 Q110 18 96 30 Q84 22 78 40 Q70 32 62 44 Z" fill={color} />
      <path d="M70 38 Q100 14 132 36" stroke={shade(color, 50)} strokeWidth="2" fill="none" />
      <path d="M76 26 Q100 6 124 24" stroke={shade(color, -30)} strokeWidth="1.5" fill="none" />
    </g>
  );
}

function FrontHair({ hair, color, feminine }: { hair: PortraitLook['hair']; color: string; feminine: boolean }) {
  switch (hair) {
    case 'frontal':
      return <path d="M78 52 Q76 26 100 26 Q126 26 122 54 Q116 36 98 36 Q86 38 82 56 Z" fill={color} />;
    case 'braids':
      return <path d="M78 50 Q80 28 100 28 Q122 28 122 50 Q112 36 100 37 Q88 36 78 50 Z" fill={color} />;
    case 'natural':
      return <circle cx="100" cy={feminine ? 22 : 34} r={feminine ? 18 : 22} fill={color} />;
    case 'gele':
      return <path d="M78 44 Q100 30 122 44 L122 40 Q100 24 78 40 Z" fill={shade(color, -20)} />;
    case 'low':
      return <path d="M79 52 Q80 30 100 30 Q120 30 121 52 Q116 38 100 37 Q84 38 79 52 Z" fill={color} opacity="0.92" />;
    case 'waves':
      return (
        <g>
          <path d="M79 52 Q80 30 100 30 Q120 30 121 52 Q116 38 100 37 Q84 38 79 52 Z" fill={color} />
          <path d="M84 40 Q92 34 100 38 Q108 34 116 40" stroke="#3a2a20" strokeWidth="1" fill="none" />
        </g>
      );
    case 'cap':
      return (
        <g>
          <path d="M78 46 L80 20 Q100 12 120 20 L122 46 Q100 40 78 46 Z" fill={color} />
          <path d="M78 46 Q100 40 122 46" stroke={shade(color, -30)} strokeWidth="2" fill="none" />
        </g>
      );
    case 'locs':
      return (
        <g stroke={color} strokeWidth="5" strokeLinecap="round">
          {[-18, -10, -2, 6, 14].map((dx) => (
            <path key={dx} d={`M${100 + dx} 32 Q${100 + dx * 1.4} 60 ${100 + dx * 1.5} 92`} fill="none" />
          ))}
        </g>
      );
    case 'bald':
      return <ellipse cx="96" cy="36" rx="8" ry="4" fill="#fff" opacity="0.12" />;
    default:
      return <path d="M79 52 Q80 30 100 30 Q120 30 121 52 Q116 38 100 37 Q84 38 79 52 Z" fill={color} />;
  }
}
