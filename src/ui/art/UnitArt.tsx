// Hand-drawn unit emblems (inline SVG, 120×120). One small scene per course unit (u1…u10).
// Designed to sit on the coloured unit banners and in headers. Unknown ids fall back to a lantern.
import type { ReactElement } from 'react'

const INK = '#2b2533'
const RED = '#d9412e'
const RED_D = '#a52a1b'
const GOLD = '#fbbf24'
const GOLD_D = '#cc8a0a'
const JADE = '#2fbf8f'
const SKY = '#6cc4ff'
const W = '#ffffff'
const CREAM = '#fff6e6'

const shadow = <ellipse cx="60" cy="110" rx="36" ry="5" fill="#000" opacity="0.12" />

const SCENES: Record<string, ReactElement> = {
  // Greetings: red lantern + speech bubble
  u1: (
    <g>
      {shadow}
      <path d="M40 10 V22" stroke={INK} strokeWidth="3" />
      <rect x="30" y="20" width="20" height="7" rx="2" fill={GOLD} stroke={GOLD_D} strokeWidth="1.5" />
      <ellipse cx="40" cy="52" rx="26" ry="27" fill={RED} />
      <path d="M40 25 Q24 52 40 79 M40 25 Q56 52 40 79" fill="none" stroke={RED_D} strokeWidth="2" />
      <ellipse cx="32" cy="42" rx="6" ry="9" fill={W} opacity="0.25" />
      <rect x="30" y="77" width="20" height="7" rx="2" fill={GOLD} stroke={GOLD_D} strokeWidth="1.5" />
      <path d="M36 84 v18 M40 84 v22 M44 84 v18" stroke={GOLD_D} strokeWidth="2.5" strokeLinecap="round" />
      <g transform="translate(58 18)">
        <path d="M6 0 H52 a8 8 0 0 1 8 8 V34 a8 8 0 0 1 -8 8 H22 L10 52 L12 42 H6 a8 8 0 0 1 -6 -8 V8 a8 8 0 0 1 6 -8 Z" fill={W} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        <text x="30" y="27" textAnchor="middle" fontSize="15" fontWeight="700" fontFamily="Fredoka, Nunito, sans-serif" fill={INK}>nǐ hǎo</text>
      </g>
    </g>
  ),
  // Introduce yourself: name card + Swedish flag
  u2: (
    <g>
      {shadow}
      <g transform="rotate(-8 60 62)">
        <rect x="14" y="30" width="86" height="60" rx="10" fill={W} stroke={INK} strokeWidth="2.5" />
        <rect x="14" y="30" width="86" height="15" rx="10" fill={RED} />
        <rect x="14" y="38" width="86" height="7" fill={RED} />
        <circle cx="38" cy="68" r="13" fill={CREAM} stroke={INK} strokeWidth="2" />
        <circle cx="33" cy="66" r="2.3" fill={INK} /><circle cx="43" cy="66" r="2.3" fill={INK} />
        <path d="M33 73 Q38 77 43 73" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
        <rect x="58" y="58" width="32" height="6" rx="3" fill="#e4dbe9" />
        <rect x="58" y="70" width="22" height="6" rx="3" fill="#e4dbe9" />
      </g>
      <g transform="translate(78 8) rotate(10)">
        <path d="M0 0 v44" stroke={INK} strokeWidth="3" strokeLinecap="round" />
        <rect x="1" y="1" width="30" height="20" rx="2" fill="#2a6ebb" />
        <rect x="9" y="1" width="6" height="20" fill={GOLD} />
        <rect x="1" y="8" width="30" height="6" fill={GOLD} />
      </g>
    </g>
  ),
  // Numbers: abacus
  u3: (
    <g>
      {shadow}
      <rect x="14" y="18" width="92" height="84" rx="10" fill="#b8733c" />
      <rect x="22" y="26" width="76" height="68" rx="6" fill={CREAM} />
      <rect x="22" y="48" width="76" height="5" fill="#b8733c" />
      {[30, 44, 58, 72, 86].map((x, i) => (
        <g key={x}>
          <path d={`M${x} 26 V94`} stroke="#8a5528" strokeWidth="2" />
          <ellipse cx={x} cy={i % 2 ? 34 : 42} rx="6.5" ry="5" fill={[RED, JADE, GOLD, SKY, RED][i]} />
          <ellipse cx={x} cy={62 + (i % 3) * 4} rx="6.5" ry="5" fill={[JADE, GOLD, RED, JADE, SKY][i]} />
          <ellipse cx={x} cy={80} rx="6.5" ry="5" fill={[GOLD, SKY, JADE, RED, GOLD][i]} />
        </g>
      ))}
    </g>
  ),
  // Family: house with curved roof + heart
  u4: (
    <g>
      {shadow}
      <rect x="26" y="52" width="68" height="54" rx="4" fill={CREAM} stroke={INK} strokeWidth="2.5" />
      <path d="M10 56 Q24 50 30 34 H90 Q96 50 110 56 Q60 46 10 56 Z" fill={RED} stroke={RED_D} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M30 34 Q60 24 90 34" fill="none" stroke={GOLD} strokeWidth="4" strokeLinecap="round" />
      <path d="M50 106 V84 a10 10 0 0 1 20 0 V106 Z" fill={RED_D} />
      <circle cx="40" cy="72" r="7" fill={SKY} stroke={INK} strokeWidth="2" />
      <circle cx="80" cy="72" r="7" fill={SKY} stroke={INK} strokeWidth="2" />
      <path d="M60 22 c-4 -8 -16 -6 -14 3 c1 6 14 12 14 12 c0 0 13 -6 14 -12 c2 -9 -10 -11 -14 -3 Z" fill="#ff7b8a" stroke={RED_D} strokeWidth="2" transform="translate(0 -8)" />
    </g>
  ),
  // Food: noodle bowl, chopsticks, steam
  u5: (
    <g>
      {shadow}
      <path d="M44 30 q-8 -8 0 -16 q8 -8 0 -16" transform="translate(0 16)" fill="none" stroke={W} strokeWidth="4" strokeLinecap="round" opacity="0.8" />
      <path d="M64 28 q-8 -8 0 -16 q8 -8 0 -16" transform="translate(0 16)" fill="none" stroke={W} strokeWidth="4" strokeLinecap="round" opacity="0.8" />
      <path d="M78 58 L112 18" stroke="#b8733c" strokeWidth="5" strokeLinecap="round" />
      <path d="M70 58 L100 12" stroke="#d08c50" strokeWidth="5" strokeLinecap="round" />
      <ellipse cx="60" cy="60" rx="46" ry="11" fill="#f3c46b" />
      <path d="M30 58 q6 -8 12 0 t12 0 t12 0 t12 0 t12 0" fill="none" stroke="#e0a53a" strokeWidth="3" />
      <circle cx="44" cy="56" r="6" fill={W} /><circle cx="44" cy="56" r="3" fill={GOLD} />
      <path d="M14 60 H106 Q104 96 60 100 Q16 96 14 60 Z" fill={RED} stroke={RED_D} strokeWidth="2.5" />
      <path d="M26 74 H94" stroke={GOLD} strokeWidth="3" strokeDasharray="6 5" />
      <rect x="44" y="99" width="32" height="8" rx="3" fill={RED_D} />
    </g>
  ),
  // Time: clock, sun and moon
  u6: (
    <g>
      {shadow}
      <circle cx="22" cy="24" r="11" fill={GOLD} />
      <path d="M98 14 a12 12 0 1 0 10 18 a10 10 0 0 1 -10 -18 Z" fill="#fff2b3" />
      <circle cx="60" cy="62" r="40" fill={W} stroke={INK} strokeWidth="3" />
      <circle cx="60" cy="62" r="33" fill={CREAM} />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2
        return <circle key={i} cx={60 + Math.sin(a) * 28} cy={62 - Math.cos(a) * 28} r={i % 3 ? 1.8 : 3} fill={i % 3 ? '#b3aab9' : RED} />
      })}
      <path d="M60 62 V40" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      <path d="M60 62 L76 70" stroke={RED} strokeWidth="4" strokeLinecap="round" />
      <circle cx="60" cy="62" r="4" fill={INK} />
      <rect x="54" y="14" width="12" height="8" rx="3" fill={INK} />
    </g>
  ),
  // Shopping: bag + Chinese coin
  u7: (
    <g>
      {shadow}
      <path d="M42 36 a16 16 0 0 1 32 0" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      <path d="M22 38 H92 L98 104 H16 Z" fill={RED} stroke={RED_D} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M22 38 H92 L93 48 H21 Z" fill={RED_D} opacity="0.5" />
      <circle cx="57" cy="72" r="14" fill={GOLD} opacity="0.95" />
      <text x="57" y="79" textAnchor="middle" fontSize="18" fontWeight="800" fontFamily="Fredoka, Nunito, sans-serif" fill={RED_D}>¥</text>
      <g transform="translate(90 80)">
        <circle r="20" fill={GOLD} stroke={GOLD_D} strokeWidth="3" />
        <circle r="14" fill="none" stroke={GOLD_D} strokeWidth="1.5" opacity="0.6" />
        <rect x="-6" y="-6" width="12" height="12" rx="1.5" fill={GOLD_D} />
        <ellipse cx="-8" cy="-10" rx="4" ry="2.5" fill={W} opacity="0.5" />
      </g>
    </g>
  ),
  // Directions & transport: metro train
  u8: (
    <g>
      {shadow}
      <path d="M30 104 L44 84 M90 104 L76 84" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      <path d="M22 108 H98" stroke="#8b8497" strokeWidth="4" strokeLinecap="round" />
      <rect x="26" y="14" width="68" height="76" rx="18" fill="#3a8ee6" stroke={INK} strokeWidth="2.5" />
      <rect x="26" y="62" width="68" height="8" fill={W} opacity="0.9" />
      <rect x="34" y="24" width="52" height="30" rx="8" fill="#d8f0ff" stroke={INK} strokeWidth="2" />
      <path d="M40 30 L52 30" stroke={W} strokeWidth="3" strokeLinecap="round" />
      <circle cx="40" cy="80" r="5" fill={GOLD} /><circle cx="80" cy="80" r="5" fill={GOLD} />
      <rect x="50" y="8" width="20" height="8" rx="3" fill={RED} />
      <rect x="48" y="75" width="24" height="9" rx="3" fill={INK} opacity="0.6" />
    </g>
  ),
  // Hobbies: ping-pong paddle + ball + music note
  u9: (
    <g>
      {shadow}
      <g transform="rotate(-30 50 60)">
        <rect x="44" y="72" width="12" height="32" rx="5" fill="#b8733c" stroke={INK} strokeWidth="2" />
        <circle cx="50" cy="48" r="30" fill={RED} stroke={INK} strokeWidth="2.5" />
        <circle cx="50" cy="48" r="23" fill="none" stroke={RED_D} strokeWidth="2" />
        <ellipse cx="40" cy="36" rx="8" ry="5" fill={W} opacity="0.3" />
      </g>
      <circle cx="92" cy="30" r="10" fill={W} stroke={INK} strokeWidth="2.5" />
      <path d="M78 44 q-4 6 -10 6" stroke={W} strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.8" />
      <g transform="translate(92 62)">
        <path d="M6 0 V24" stroke={INK} strokeWidth="4" strokeLinecap="round" />
        <path d="M6 0 Q16 4 18 12" stroke={INK} strokeWidth="4" strokeLinecap="round" fill="none" />
        <ellipse cx="0" cy="26" rx="8" ry="6" fill={JADE} stroke={INK} strokeWidth="2" />
      </g>
    </g>
  ),
  // Feelings & weather: sun behind cloud, rain, heart
  u10: (
    <g>
      {shadow}
      <g transform="translate(44 40)">
        {Array.from({ length: 8 }, (_, i) => (
          <rect key={i} x="-3" y="-36" width="6" height="12" rx="3" fill={GOLD} transform={`rotate(${i * 45})`} />
        ))}
        <circle r="22" fill={GOLD} stroke={GOLD_D} strokeWidth="2" />
        <circle cx="-7" cy="-3" r="2.5" fill={INK} /><circle cx="7" cy="-3" r="2.5" fill={INK} />
        <path d="M-7 6 Q0 12 7 6" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      </g>
      <path d="M40 88 a16 16 0 0 1 4 -31 a22 22 0 0 1 42 -4 a16 16 0 0 1 12 35 Z" fill={W} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M52 96 l-3 8 M68 96 l-3 8 M84 96 l-3 8" stroke={SKY} strokeWidth="4" strokeLinecap="round" />
      <path d="M100 24 c-3 -6 -12 -4 -10 2 c1 4 10 9 10 9 c0 0 9 -5 10 -9 c2 -6 -7 -8 -10 -2 Z" fill="#ff7b8a" stroke={RED_D} strokeWidth="1.8" />
    </g>
  ),
}

export function UnitArt({ unitId, size = 96, className }: { unitId: string; size?: number; className?: string }) {
  const scene = SCENES[unitId] ?? SCENES.u1
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className={className} aria-hidden="true" style={{ overflow: 'visible' }}>
      {scene}
    </svg>
  )
}

export const UNIT_ART_IDS = Object.keys(SCENES)
