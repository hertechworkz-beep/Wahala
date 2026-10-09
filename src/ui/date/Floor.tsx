import type { ReactNode } from 'react';
import { art } from './parts';
import { EDGES, NODES, type NodeId } from './plan';

export { NODES, EDGES, type NodeId };

// Top-down plan of the Ikoyi terrace restaurant. The same graph is used for choosing a table,
// watching Chief walk in, and the Wife Escape (where moving between nodes is the game).

export interface TokenSpec {
  id: string;
  at: { x: number; y: number };
  kind: 'you' | 'chief' | 'wife' | 'waiter' | 'guard' | 'friend' | 'diner';
  color?: string;
  label?: string;
  hidden?: boolean;
  facing?: number;
}

export function FloorPlan({ tokens, highlight = [], onNode, children, dark }: { tokens: TokenSpec[]; highlight?: NodeId[]; onNode?: (n: NodeId) => void; children?: ReactNode; dark?: boolean }) {
  return (
    <svg viewBox="0 0 370 460" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="lagoon" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0b2340" />
          <stop offset="100%" stopColor="#123a5c" />
        </linearGradient>
        <pattern id="tiles" width="24" height="24" patternUnits="userSpaceOnUse">
          <rect width="24" height="24" fill="#2a1c17" />
          <path d="M0 0 H24 V24" stroke="#3a2820" strokeWidth="1" fill="none" />
        </pattern>
        <clipPath id="chiefFace">
          <circle cx="0" cy="0" r="15" />
        </clipPath>
      </defs>
      {/* lagoon + city lights */}
      <rect x="0" y="0" width="370" height="40" fill="url(#lagoon)" />
      {Array.from({ length: 18 }).map((_, i) => (
        <rect key={i} x={8 + i * 20} y={6 + ((i * 7) % 12)} width="3" height={10 + ((i * 13) % 14)} fill="#f8d48a" opacity="0.55" style={{ animation: `flicker ${3 + (i % 4)}s ${i * 0.3}s infinite` }} />
      ))}
      <rect x="0" y="40" width="370" height="420" fill="url(#tiles)" />
      <rect x="0" y="38" width="370" height="4" fill="#d4b483" opacity="0.6" />
      {/* bar */}
      <path d="M14 262 h96 v22 h-74 v60 h-22 z" fill="#4a2f22" stroke="#b08a5a" strokeWidth="1.5" />
      {[0, 1, 2, 3].map((i) => <circle key={i} cx={30 + i * 20} cy="273" r="3" fill="#9be7ff" opacity="0.5" />)}
      {/* restroom */}
      <rect x="6" y="160" width="52" height="70" fill="#1d1a22" stroke="#555" />
      <text x="32" y="246" textAnchor="middle" fontSize="9" fill="#bbb">WC</text>
      {/* kitchen */}
      <rect x="306" y="380" width="64" height="80" fill="#2f2f33" stroke="#777" />
      <text x="338" y="452" textAnchor="middle" fontSize="9" fill="#ddd">KITCHEN</text>
      {/* stage */}
      <circle cx="320" cy="300" r="26" fill="#3b2433" stroke="#d4af37" strokeWidth="1" opacity="0.8" />
      {/* plants */}
      {[{ x: 344, y: 186 }, { x: 18, y: 120 }, { x: 352, y: 52 }].map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="15" fill="#14532d" />
          <circle cx={p.x - 5} cy={p.y - 4} r="8" fill="#166534" />
        </g>
      ))}
      {/* tables */}
      {[{ x: 92, y: 74 }, { x: 292, y: 72 }, { x: 180, y: 160 }, { x: 110, y: 200 }, { x: 250, y: 160 }, { x: 240, y: 252 }, { x: 120, y: 252 }].map((t, i) => (
        <g key={i}>
          <circle cx={t.x} cy={t.y} r="17" fill="#efe7d6" opacity="0.92" />
          <circle cx={t.x} cy={t.y} r="3" fill="#ffcf6b" style={{ animation: 'candle 1.6s ease-in-out infinite' }} />
        </g>
      ))}
      {/* entrance */}
      <rect x="120" y="448" width="60" height="12" fill="#d4af37" opacity="0.7" />
      {/* graph */}
      {onNode &&
        EDGES.map(([a, b]) => <line key={`${a}${b}`} x1={NODES[a].x} y1={NODES[a].y} x2={NODES[b].x} y2={NODES[b].y} stroke="#fff" strokeOpacity="0.1" strokeWidth="2" strokeDasharray="4 5" />)}
      {highlight.map((n) => {
        const p = NODES[n];
        const spec = NODES[n] as { hide?: boolean; exit?: boolean };
        return (
          <g key={n} data-node={n} onClick={() => onNode?.(n)} style={{ cursor: 'pointer' }}>
            <circle cx={p.x} cy={p.y} r="26" fill="transparent" />
            <circle cx={p.x} cy={p.y} r="19" fill={spec.exit ? 'rgba(16,185,129,0.25)' : spec.hide ? 'rgba(245,158,11,0.22)' : 'rgba(255,255,255,0.14)'} stroke={spec.exit ? '#10B981' : spec.hide ? '#F59E0B' : '#fff'} strokeWidth="2" className="anim-node" />
            <text x={p.x} y={p.y + 32} textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff" stroke="#000" strokeWidth="3" paintOrder="stroke">
              {p.label}
            </text>
          </g>
        );
      })}
      {children}
      {tokens.map((t) => (
        <Token key={t.id} t={t} />
      ))}
      {dark && <rect width="370" height="460" fill="#000" opacity="0.35" pointerEvents="none" />}
    </svg>
  );
}

const TOKEN_COLORS: Record<TokenSpec['kind'], string> = { you: '#F43F5E', chief: '#a3131a', wife: '#7c3aed', waiter: '#e5e7eb', guard: '#111827', friend: '#0ea5e9', diner: '#78716c' };

function Token({ t }: { t: TokenSpec }) {
  const c = t.color ?? TOKEN_COLORS[t.kind];
  return (
    <g style={{ transform: `translate(${t.at.x}px, ${t.at.y}px)`, transition: 'transform 0.45s cubic-bezier(0.3, 0, 0.3, 1)', opacity: t.hidden ? 0.45 : 1 }}>
      <ellipse cx="0" cy="13" rx="13" ry="4" fill="#000" opacity="0.4" />
      {t.kind === 'chief' ? (
        <g>
          <circle r="17" fill="#a3131a" />
          <image href={art('chief_charming.webp')} x="-22" y="-12" width="44" height="57" clipPath="url(#chiefFace)" preserveAspectRatio="xMidYMin slice" />
          <circle r="16" fill="none" stroke="#e7b54a" strokeWidth="2" />
        </g>
      ) : (
        <g>
          <circle r={t.kind === 'diner' ? 9 : 14} fill={c} stroke={t.kind === 'you' ? '#fff' : '#000'} strokeWidth={t.kind === 'you' ? 3 : 1.5} />
          {t.kind === 'waiter' && <ellipse cx="10" cy="-8" rx="11" ry="3" fill="#cbd5e1" stroke="#64748b" />}
          {t.kind === 'friend' && <path d="M0 0 L60 -28 L60 28 Z" fill="#38bdf8" opacity="0.18" transform={`rotate(${t.facing ?? 0})`} />}
          {t.kind === 'wife' && <path d="M-12 -10 Q0 -26 12 -10 Q0 -16 -12 -10 Z" fill="#facc15" />}
        </g>
      )}
      {t.label && (
        <text y="-22" textAnchor="middle" fontSize="10" fontWeight="800" fill="#fff" stroke="#000" strokeWidth="3" paintOrder="stroke">
          {t.label}
        </text>
      )}
    </g>
  );
}
