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

function Snake() {
  return (
    <svg viewBox="0 0 100 100" className={S} aria-hidden="true">
      <rect x="8" y="10" width="84" height="80" rx="14" fill="#fff" fillOpacity=".9" />
      <g fill="#d9f5ea"><rect x="8" y="10" width="21" height="20" /><rect x="50" y="10" width="21" height="20" /><rect x="29" y="30" width="21" height="20" /><rect x="71" y="30" width="21" height="20" /></g>
      <rect x="16" y="20" width="34" height="14" rx="7" fill="#fff" stroke="#d9412e" strokeWidth="2.5" /><text x="33" y="30.5" fontSize="9" fontWeight="900" textAnchor="middle" fill="#9333ea">māo</text>
      <path d="M78 72H44a10 10 0 0 1 0-20h20" fill="none" stroke="#0a7a5a" strokeWidth="13" strokeLinecap="round" />
      <path d="M78 72H44a10 10 0 0 1 0-20h20" fill="none" stroke="#12a179" strokeWidth="7" strokeLinecap="round" />
      <path d="M70 72v0M58 72v0M46 72v0" stroke="#0a7a5a" strokeWidth="3" strokeLinecap="round" />
      <circle cx="68" cy="52" r="11" fill="#fff" stroke="#c9c1d0" strokeWidth="1.5" />
      <circle cx="59" cy="43" r="4.6" fill="#2b2533" /><circle cx="77" cy="43" r="4.6" fill="#2b2533" />
      <ellipse cx="63.4" cy="52" rx="3" ry="3.8" fill="#2b2533" /><ellipse cx="72.6" cy="52" rx="3" ry="3.8" fill="#2b2533" />
      <circle cx="64" cy="51" r="1.1" fill="#fff" /><circle cx="73.2" cy="51" r="1.1" fill="#fff" />
      <ellipse cx="68" cy="57.5" rx="2.4" ry="1.7" fill="#2b2533" />
    </svg>
  )
}

function Bridge() {
  return (
    <svg viewBox="0 0 100 100" className={S} aria-hidden="true">
      <path d="M0 58h26v42H0Z" fill="#efe5d6" /><path d="M74 58h26v42H74Z" fill="#efe5d6" />
      <rect x="-2" y="53" width="30" height="8" rx="4" fill="#12a179" /><rect x="72" y="53" width="30" height="8" rx="4" fill="#12a179" />
      <path d="M28 88q22 8 44 0" stroke="#bae6fd" strokeWidth="4" strokeLinecap="round" fill="none" />
      <rect x="28" y="54" width="14" height="8" rx="2.5" fill="#fbbf24" stroke="#a52a1b" strokeWidth="1.6" />
      <rect x="43" y="54" width="14" height="8" rx="2.5" fill="#fbbf24" stroke="#a52a1b" strokeWidth="1.6" />
      <g className="g-drift"><rect x="58" y="46" width="14" height="8" rx="2.5" fill="#fff" stroke="#a52a1b" strokeWidth="1.6" transform="rotate(-10 65 50)" /></g>
      <rect x="18" y="26" width="4" height="30" rx="1.5" fill="#d9412e" /><circle cx="20" cy="30" r="5" fill="#d9412e" stroke="#fbbf24" strokeWidth="2" />
      <ellipse cx="33" cy="52" rx="13" ry="3.2" fill="#000" opacity=".12" />
      <circle cx="33" cy="38" r="11" fill="#fff" /><circle cx="24.5" cy="29" r="4.6" fill="#2b2533" /><circle cx="41.5" cy="29" r="4.6" fill="#2b2533" />
      <ellipse cx="28.6" cy="38" rx="3" ry="3.8" fill="#2b2533" /><ellipse cx="37.4" cy="38" rx="3" ry="3.8" fill="#2b2533" />
      <circle cx="29.2" cy="37" r="1.1" fill="#fff" /><circle cx="38" cy="37" r="1.1" fill="#fff" />
      <path d="M28 45q5 4 10 0" stroke="#d9412e" strokeWidth="3" strokeLinecap="round" fill="none" />
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

export const GAME_ART: Record<GameId, () => React.JSX.Element> = { ordregn: Rain, runner: Runner, memory: Cards, blixt: Bolt, tonjakt: Tones, bygg: Blocks, snake: Snake, bridge: Bridge }
