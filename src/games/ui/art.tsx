// OWNER: Games agent. Hand-made SVG illustrations for the game cards.
import type { GameId } from '../logic/records'

const S = 'h-full w-full'

function Rain() {
  return (
    <svg viewBox="0 0 100 100" className={S} aria-hidden="true">
      <path d="M22 40h52a15 15 0 0 0 0-30 20 20 0 0 0-37-4 14 14 0 0 0-15 34Z" fill="#fff" />
      <path d="M22 40h52a15 15 0 0 0 3-.3" fill="none" stroke="#bae6fd" strokeWidth="3" />
      <g className="g-drift">
        <rect x="14" y="50" width="30" height="16" rx="6" fill="#fde047" /><text x="29" y="62" fontSize="10" fontWeight="900" textAnchor="middle" fill="#1f2937">mā</text>
        <rect x="56" y="62" width="30" height="16" rx="6" fill="#fff" /><text x="71" y="74" fontSize="10" fontWeight="900" textAnchor="middle" fill="#2563eb">hǎo</text>
      </g>
      <path d="M34 78l-3 8M52 50l-3 8M84 46l-3 8" stroke="#e0f2fe" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
function Cards() {
  return (
    <svg viewBox="0 0 100 100" className={S} aria-hidden="true">
      <g transform="rotate(-12 38 55)"><rect x="16" y="24" width="42" height="56" rx="8" fill="#fff" /><text x="37" y="58" fontSize="15" fontWeight="900" textAnchor="middle" fill="#e11d48">chá</text></g>
      <g transform="rotate(10 64 52)"><rect x="44" y="22" width="42" height="56" rx="8" fill="#fde68a" /><text x="65" y="55" fontSize="13" fontWeight="900" textAnchor="middle" fill="#1f2937">te</text></g>
      <circle cx="80" cy="22" r="9" fill="#facc15" /><path d="M76 22l3 3 5-6" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  )
}
function Bolt() {
  return (
    <svg viewBox="0 0 100 100" className={S} aria-hidden="true">
      <circle cx="50" cy="54" r="32" fill="#fff" fillOpacity=".95" /><circle cx="50" cy="54" r="32" fill="none" stroke="#fed7aa" strokeWidth="5" />
      <rect x="44" y="12" width="12" height="8" rx="3" fill="#fff" />
      <path d="M55 30 38 58h12l-5 22 18-30H51l4-20Z" fill="#f97316" />
    </svg>
  )
}
function Tones() {
  return (
    <svg viewBox="0 0 100 100" className={S} aria-hidden="true">
      <rect x="12" y="14" width="76" height="72" rx="16" fill="#fff" fillOpacity=".95" />
      <path d="M22 30h22" stroke="#e11d48" strokeWidth="6" strokeLinecap="round" />
      <path d="M56 42 76 24" stroke="#16a34a" strokeWidth="6" strokeLinecap="round" />
      <path d="M22 56q10 22 16 12t8-12" stroke="#2563eb" strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M58 54l18 20" stroke="#9333ea" strokeWidth="6" strokeLinecap="round" />
    </svg>
  )
}
function Blocks() {
  return (
    <svg viewBox="0 0 100 100" className={S} aria-hidden="true">
      <rect x="14" y="62" width="30" height="20" rx="5" fill="#fff" /><text x="29" y="76" fontSize="10" fontWeight="900" textAnchor="middle" fill="#2563eb">wǒ</text>
      <rect x="48" y="62" width="30" height="20" rx="5" fill="#fef08a" /><text x="63" y="76" fontSize="10" fontWeight="900" textAnchor="middle" fill="#9333ea">shì</text>
      <g className="g-drift"><rect x="30" y="30" width="44" height="20" rx="5" fill="#fff" /><text x="52" y="44" fontSize="9" fontWeight="900" textAnchor="middle" fill="#9333ea">Ruì diǎn</text></g>
      <path d="M84 24a10 10 0 1 1-1 0" stroke="#fff" strokeWidth="3" fill="none" /><path d="M84 18v7l4 2" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  )
}

function Runner() {
  return (
    <svg viewBox="0 0 100 100" className={S} aria-hidden="true">
      <path d="M50 18 8 92h84L50 18Z" fill="#fff" fillOpacity=".92" />
      <path d="M50 18 34 92M50 18l16 74" stroke="#a7f3d0" strokeWidth="3" strokeLinecap="round" />
      <path d="M50 18 8 92M50 18l42 74" stroke="#d9412e" strokeWidth="4" strokeLinecap="round" />
      <g className="g-drift">
        <rect x="18" y="34" width="24" height="26" rx="4" fill="none" stroke="#d9412e" strokeWidth="4" />
        <rect x="21" y="37" width="18" height="10" rx="3" fill="#fff" /><text x="30" y="45" fontSize="7.5" fontWeight="900" textAnchor="middle" fill="#2563eb">nǐ</text>
        <rect x="58" y="34" width="24" height="26" rx="4" fill="none" stroke="#d9412e" strokeWidth="4" />
        <rect x="61" y="37" width="18" height="10" rx="3" fill="#fff" /><text x="70" y="45" fontSize="7.5" fontWeight="900" textAnchor="middle" fill="#9333ea">hào</text>
      </g>
      <ellipse cx="50" cy="86" rx="13" ry="3.5" fill="#000" opacity=".18" />
      <circle cx="50" cy="72" r="12" fill="#fff" /><circle cx="41" cy="62" r="5" fill="#2b2533" /><circle cx="59" cy="62" r="5" fill="#2b2533" />
      <ellipse cx="45" cy="72" rx="3.4" ry="4" fill="#2b2533" /><ellipse cx="55" cy="72" rx="3.4" ry="4" fill="#2b2533" />
      <circle cx="46" cy="71" r="1.2" fill="#fff" /><circle cx="54" cy="71" r="1.2" fill="#fff" />
      <path d="M40 80q10 6 20 0" stroke="#d9412e" strokeWidth="4" strokeLinecap="round" fill="none" />
    </svg>
  )
}

export const GAME_ART: Record<GameId, () => React.JSX.Element> = { ordregn: Rain, runner: Runner, memory: Cards, blixt: Bolt, tonjakt: Tones, bygg: Blocks }
