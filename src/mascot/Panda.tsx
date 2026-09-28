// OWNER: Design-look agent. Original panda mascot "Pānpan" — hand-built inline SVG, no external assets.
// A round, soft panda with a red-lacquer scarf and a jade bead. Every mood changes eyes, mouth, arms
// and adds a small prop, so moods read clearly from 40 px up to 200 px.
import { useId } from 'react'

export type PandaMood = 'happy' | 'cheer' | 'sad' | 'think' | 'sleep' | 'wave' | 'surprised' | 'proud'

const INK = '#2b2533'
const INK_2 = '#3d3547'
const FUR = '#ffffff'
const FUR_SHADE = '#ece6f0'
const BLUSH = '#ff9aa6'
const SCARF = '#d9412e'
const SCARF_DARK = '#a52a1b'
const JADE = '#2fbf8f'
const GOLD = '#fbbf24'
const SKY = '#6cc4ff'

type Arm = { d: string; front?: boolean }
/** Arm strokes per mood (thick round-capped paths in a 200×200 space). */
const ARMS: Record<PandaMood, Arm[]> = {
  happy: [{ d: 'M63 132 Q52 148 58 164' }, { d: 'M137 132 Q148 148 142 164' }],
  cheer: [{ d: 'M62 132 Q44 116 36 90' }, { d: 'M138 132 Q156 116 164 90' }],
  sad: [{ d: 'M64 134 Q58 152 66 168' }, { d: 'M136 134 Q142 152 134 168' }],
  think: [{ d: 'M63 132 Q52 148 58 164' }, { d: 'M138 134 Q128 146 122 132', front: true }],
  sleep: [{ d: 'M66 138 Q70 152 84 152', front: true }, { d: 'M134 138 Q130 152 116 152', front: true }],
  wave: [{ d: 'M63 132 Q52 148 58 164' }, { d: 'M138 130 Q160 118 166 86' }],
  surprised: [{ d: 'M62 132 Q46 128 40 110' }, { d: 'M138 132 Q154 128 160 110' }],
  proud: [{ d: 'M62 132 Q42 148 64 160', front: true }, { d: 'M138 132 Q158 148 136 160', front: true }],
}

export function Panda({ mood = 'happy', size = 96, className }: { mood?: PandaMood; size?: number; className?: string }) {
  const uid = useId().replace(/:/g, '')
  const g = (n: string) => `${n}-${uid}`
  const arms = ARMS[mood] ?? ARMS.happy
  const headTilt = mood === 'sleep' ? 'rotate(-7 100 96)' : mood === 'sad' ? 'rotate(4 100 96)' : mood === 'think' ? 'rotate(-4 100 96)' : undefined
  const earDroop = mood === 'sad' || mood === 'sleep'

  const arm = (a: Arm, i: number) => (
    <path key={i} d={a.d} fill="none" stroke={INK} strokeWidth={21} strokeLinecap="round" />
  )

  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={`Pānpan (${MOOD_LABEL[mood] ?? mood})`}
      data-mood={mood}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <radialGradient id={g('fur')} cx="42%" cy="34%" r="75%">
          <stop offset="0" stopColor={FUR} />
          <stop offset="0.72" stopColor={FUR} />
          <stop offset="1" stopColor={FUR_SHADE} />
        </radialGradient>
        <radialGradient id={g('ink')} cx="40%" cy="30%" r="80%">
          <stop offset="0" stopColor={INK_2} />
          <stop offset="1" stopColor={INK} />
        </radialGradient>
      </defs>

      {/* ground shadow */}
      <ellipse cx="100" cy="193" rx="54" ry="6" fill="#000" opacity="0.09" />

      {/* back props */}
      {mood === 'cheer' && <Stars />}
      {mood === 'proud' && <Sparkles />}
      {mood === 'wave' && (
        <g stroke={INK} strokeWidth="4" strokeLinecap="round" opacity="0.5" fill="none">
          <path d="M178 74 q6 8 2 18" /><path d="M186 66 q9 12 3 28" />
        </g>
      )}

      {/* legs */}
      <ellipse cx="72" cy="180" rx="19" ry="13" fill={`url(#${g('ink')})`} />
      <ellipse cx="128" cy="180" rx="19" ry="13" fill={`url(#${g('ink')})`} />
      <ellipse cx="72" cy="182" rx="8" ry="5" fill="#57506a" opacity="0.5" />
      <ellipse cx="128" cy="182" rx="8" ry="5" fill="#57506a" opacity="0.5" />

      {/* back arms */}
      {arms.filter((a) => !a.front).map(arm)}

      {/* body */}
      <ellipse cx="100" cy="150" rx="47" ry="40" fill={`url(#${g('fur')})`} />
      <ellipse cx="100" cy="158" rx="26" ry="22" fill={FUR_SHADE} opacity="0.55" />

      {/* scarf */}
      <path d="M58 124 Q100 146 142 124 L144 134 Q100 158 56 134 Z" fill={SCARF} />
      <path d="M58 124 Q100 146 142 124" fill="none" stroke={SCARF_DARK} strokeWidth="2" opacity="0.5" />
      <path d="M120 138 l8 22 l-13 -4 z" fill={SCARF_DARK} />
      <path d="M124 136 l14 18 l-13 1 z" fill={SCARF} />
      {mood === 'proud' ? (
        <g>
          <circle cx="100" cy="146" r="10" fill={GOLD} stroke="#c98a0a" strokeWidth="2.5" />
          <path d="M100 140 l1.9 3.9 4.2 .6-3 3 .7 4.2-3.8-2-3.8 2 .7-4.2-3-3 4.2-.6z" fill="#fff6d8" />
        </g>
      ) : (
        <g>
          <circle cx="100" cy="144" r="6.5" fill={JADE} />
          <circle cx="98" cy="142" r="2" fill="#fff" opacity="0.7" />
        </g>
      )}

      {/* front arms */}
      {arms.filter((a) => a.front).map(arm)}

      {/* head group */}
      <g transform={headTilt}>
        {/* ears */}
        <g transform={earDroop ? 'rotate(-14 56 52)' : undefined}>
          <circle cx="56" cy="52" r="20" fill={`url(#${g('ink')})`} />
          <circle cx="57" cy="54" r="9" fill="#57506a" />
        </g>
        <g transform={earDroop ? 'rotate(14 144 52)' : undefined}>
          <circle cx="144" cy="52" r="20" fill={`url(#${g('ink')})`} />
          <circle cx="143" cy="54" r="9" fill="#57506a" />
        </g>
        {/* head */}
        <ellipse cx="100" cy="92" rx="60" ry="51" fill={`url(#${g('fur')})`} />
        {/* eye patches: tilted teardrops */}
        <ellipse cx="74" cy="94" rx="15" ry="19" transform="rotate(38 74 94)" fill={`url(#${g('ink')})`} />
        <ellipse cx="126" cy="94" rx="15" ry="19" transform="rotate(-38 126 94)" fill={`url(#${g('ink')})`} />
        {/* cheeks */}
        <ellipse cx="58" cy="116" rx="10" ry="6" fill={BLUSH} opacity={mood === 'sad' ? 0.35 : 0.7} />
        <ellipse cx="142" cy="116" rx="10" ry="6" fill={BLUSH} opacity={mood === 'sad' ? 0.35 : 0.7} />
        <Eyes mood={mood} />
        {/* nose */}
        <path d="M93 110 Q100 106 107 110 Q104 116 100 117 Q96 116 93 110 Z" fill={INK} />
        <ellipse cx="98" cy="110" rx="2.2" ry="1.3" fill="#fff" opacity="0.6" />
        <Mouth mood={mood} />
        {mood === 'sad' && (
          <g stroke={INK} strokeWidth="3.5" strokeLinecap="round" fill="none">
            <path d="M64 70 L80 64" /><path d="M136 70 L120 64" />
          </g>
        )}
        {mood === 'surprised' && (
          <g stroke={INK} strokeWidth="3.5" strokeLinecap="round" fill="none">
            <path d="M64 64 Q74 56 84 62" /><path d="M136 64 Q126 56 116 62" />
          </g>
        )}
        {mood === 'think' && (
          <path d="M112 64 Q124 58 136 64" stroke={INK} strokeWidth="3.5" strokeLinecap="round" fill="none" />
        )}
      </g>

      {/* front props */}
      {mood === 'sad' && <Drop x={154} y={70} />}
      {mood === 'surprised' && (
        <g>
          <Drop x={158} y={62} />
          <g fill={SCARF}>
            <rect x="26" y="30" width="7" height="22" rx="3.5" transform="rotate(-14 30 40)" />
            <circle cx="33" cy="61" r="4" />
          </g>
        </g>
      )}
      {mood === 'sleep' && (
        <g fill={SKY} fontFamily="Fredoka, Nunito, sans-serif" fontWeight="700">
          <text x="150" y="50" fontSize="26">z</text>
          <text x="166" y="30" fontSize="20" opacity="0.8">z</text>
          <text x="178" y="14" fontSize="15" opacity="0.6">z</text>
        </g>
      )}
      {mood === 'think' && (
        <g>
          <circle cx="152" cy="46" r="4" fill={FUR} stroke={INK} strokeWidth="2.5" />
          <circle cx="163" cy="32" r="6" fill={FUR} stroke={INK} strokeWidth="2.5" />
          <g transform="translate(176 12)">
            <circle r="15" fill={FUR} stroke={INK} strokeWidth="2.5" />
            <text y="7" textAnchor="middle" fontSize="20" fontWeight="800" fill={SCARF} fontFamily="Fredoka, Nunito, sans-serif">?</text>
          </g>
        </g>
      )}
    </svg>
  )
}

const MOOD_LABEL: Record<PandaMood, string> = {
  happy: 'glad', cheer: 'jublar', sad: 'ledsen', think: 'funderar', sleep: 'sover', wave: 'vinkar', surprised: 'förvånad', proud: 'stolt',
}

function Eyes({ mood }: { mood: PandaMood }) {
  const arc = (d: string, k: string) => <path key={k} d={d} fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" />
  switch (mood) {
    case 'cheer':
      return <>{arc('M68 98 Q76 88 84 98', 'l')}{arc('M116 98 Q124 88 132 98', 'r')}</>
    case 'proud':
      return <>{arc('M68 96 Q76 102 84 96', 'l')}{arc('M116 96 Q124 102 132 96', 'r')}</>
    case 'sleep':
      return <>{arc('M68 96 Q76 103 84 96', 'l')}{arc('M116 96 Q124 103 132 96', 'r')}</>
    case 'surprised':
      return (
        <>
          <circle cx="76" cy="94" r="10" fill="#fff" /><circle cx="124" cy="94" r="10" fill="#fff" />
          <circle cx="76" cy="95" r="4.5" fill={INK} /><circle cx="124" cy="95" r="4.5" fill={INK} />
        </>
      )
    case 'think':
      return (
        <>
          <Eye cx={76} cy={94} dx={-2} dy={-3} />
          {arc('M116 95 Q124 91 132 95', 'r')}
        </>
      )
    case 'sad':
      return (
        <>
          <Eye cx={76} cy={96} dx={0} dy={2} />
          <Eye cx={124} cy={96} dx={0} dy={2} />
          <ellipse cx="80" cy="106" rx="2.2" ry="3.2" fill={SKY} />
        </>
      )
    default:
      return <><Eye cx={76} cy={94} /><Eye cx={124} cy={94} /></>
  }
}

function Eye({ cx, cy, dx = 0, dy = 0 }: { cx: number; cy: number; dx?: number; dy?: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r="8.5" fill="#fff" />
      <circle cx={cx + dx} cy={cy + dy + 0.5} r="6" fill={INK} />
      <circle cx={cx + dx + 2.2} cy={cy + dy - 2} r="2.3" fill="#fff" />
    </g>
  )
}

function Mouth({ mood }: { mood: PandaMood }) {
  const s = { fill: 'none', stroke: INK, strokeWidth: 3.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (mood) {
    case 'cheer':
    case 'wave':
      return (
        <g>
          <path d="M88 119 Q100 138 112 119 Z" fill={INK} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          <path d="M93 126 Q100 133 107 126 Q100 122 93 126 Z" fill="#ff7b8a" />
        </g>
      )
    case 'sad':
      return <path d="M91 127 Q100 120 109 127" {...s} />
    case 'think':
      return <path d="M93 124 Q99 121 104 124 T112 122" {...s} />
    case 'sleep':
      return <ellipse cx="100" cy="124" rx="3.5" ry="4" fill={INK} />
    case 'surprised':
      return <ellipse cx="100" cy="126" rx="6" ry="7.5" fill={INK} />
    case 'proud':
      return <path d="M90 120 Q102 130 112 118" {...s} />
    default:
      return <path d="M89 119 Q94.5 126 100 119 Q105.5 126 111 119" {...s} />
  }
}

function Drop({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M0 -12 C6 -3 9 2 9 6 A9 9 0 0 1 -9 6 C-9 2 -6 -3 0 -12 Z" fill={SKY} stroke="#2b8fd6" strokeWidth="1.5" />
      <ellipse cx="-3" cy="4" rx="2" ry="3" fill="#fff" opacity="0.7" />
    </g>
  )
}

function Star({ x, y, r, fill }: { x: number; y: number; r: number; fill: string }) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2
    const rr = i % 2 ? r * 0.45 : r
    return `${(x + Math.cos(a) * rr).toFixed(1)},${(y + Math.sin(a) * rr).toFixed(1)}`
  }).join(' ')
  return <polygon points={pts} fill={fill} stroke="#c98a0a" strokeWidth="1.5" strokeLinejoin="round" />
}

function Stars() {
  return (
    <g>
      <Star x={22} y={60} r={11} fill={GOLD} />
      <Star x={178} y={58} r={11} fill={GOLD} />
      <Star x={40} y={22} r={7} fill="#ffd966" />
      <Star x={160} y={18} r={8} fill="#ffd966" />
      <circle cx="100" cy="14" r="4" fill={SCARF} />
      <circle cx="16" cy="104" r="3.5" fill={JADE} />
      <circle cx="186" cy="104" r="3.5" fill={SKY} />
    </g>
  )
}

function Sparkle({ x, y, r, fill }: { x: number; y: number; r: number; fill: string }) {
  return <path d={`M${x} ${y - r} Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y} Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r} Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y} Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r} Z`} fill={fill} />
}

function Sparkles() {
  return (
    <g>
      <Sparkle x={26} y={50} r={13} fill={GOLD} />
      <Sparkle x={176} y={44} r={11} fill={GOLD} />
      <Sparkle x={170} y={112} r={7} fill={JADE} />
      <Sparkle x={30} y={112} r={7} fill={SKY} />
      <Sparkle x={150} y={14} r={6} fill="#ffd966" />
    </g>
  )
}

/** Just the head — for small avatars (tab bar, dialogue bubbles). */
export function PandaFace({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="30 28 140 118" width={size} height={size} className={className} aria-hidden="true">
      <circle cx="56" cy="52" r="20" fill={INK} /><circle cx="57" cy="54" r="9" fill="#57506a" />
      <circle cx="144" cy="52" r="20" fill={INK} /><circle cx="143" cy="54" r="9" fill="#57506a" />
      <ellipse cx="100" cy="92" rx="60" ry="51" fill={FUR} stroke={FUR_SHADE} strokeWidth="2" />
      <ellipse cx="74" cy="94" rx="15" ry="19" transform="rotate(38 74 94)" fill={INK} />
      <ellipse cx="126" cy="94" rx="15" ry="19" transform="rotate(-38 126 94)" fill={INK} />
      <ellipse cx="58" cy="116" rx="10" ry="6" fill={BLUSH} opacity="0.7" />
      <ellipse cx="142" cy="116" rx="10" ry="6" fill={BLUSH} opacity="0.7" />
      <Eye cx={76} cy={94} /><Eye cx={124} cy={94} />
      <path d="M93 110 Q100 106 107 110 Q104 116 100 117 Q96 116 93 110 Z" fill={INK} />
      <path d="M89 119 Q94.5 126 100 119 Q105.5 126 111 119" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  )
}
