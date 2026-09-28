// Inline SVG icons for the shell (original artwork, stroke/solid, currentColor).
import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }
const base = ({ size = 24, ...rest }: P) => ({ width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true, ...rest })

export const StarIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor"><path d="M12 2.8l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.7l-5.4 2.9 1.1-6.1-4.5-4.3 6.1-.8z" strokeLinejoin="round" stroke="currentColor" strokeWidth="1.5" /></svg>
)
export const CheckIcon = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
)
export const LockIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor"><path d="M7 10V8a5 5 0 0110 0v2h.5A1.5 1.5 0 0119 11.5v8a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 015 19.5v-8A1.5 1.5 0 016.5 10zm2.5 0h5V8a2.5 2.5 0 00-5 0z" /></svg>
)
/** Four little tone contours: the icon for tone lessons. */
export const TonesIcon = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.5 8h4M9 14l2.5-6M13.5 8l1.8 5 1.8-5M19.5 8l2.2 6" />
  </svg>
)
export const TrophyIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor"><path d="M7 3h10v2h3.5v2.5a4.5 4.5 0 01-4.1 4.5A5 5 0 0113 15.9V18h3v3H8v-3h3v-2.1A5 5 0 017.6 12 4.5 4.5 0 013.5 7.5V5H7zm0 4H5.5v.5A2.5 2.5 0 007 9.8zm10 0v2.8a2.5 2.5 0 001.5-2.3V7z" /></svg>
)
export const FlameIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor"><path d="M12 2.5c.6 3.2 5.5 5.6 5.5 11a5.5 5.5 0 01-11 0c0-2.4 1.1-4 2.3-5.1.2 1.5.9 2.6 1.9 3.1C10.3 8.7 11 5.6 12 2.5z" /><path d="M12 13c.3 1.4 2.3 2.2 2.3 4.2a2.3 2.3 0 01-4.6 0c0-1.6 1.6-2.4 2.3-4.2z" fill="#fde68a" /></svg>
)
export const BoltIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor"><path d="M13.5 2L5 13.5h6L10 22l9-12h-6.2z" /></svg>
)
export const SpeakerIcon = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" /><path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11" /></svg>
)
export const CloseIcon = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
)
export const SearchIcon = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l5 5" /></svg>
)
export const BackIcon = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
)
export const ShareIcon = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V3.5M8 7l4-4 4 4" /><path d="M8 10.5H6.5A1.5 1.5 0 005 12v7.5A1.5 1.5 0 006.5 21h11a1.5 1.5 0 001.5-1.5V12a1.5 1.5 0 00-1.5-1.5H16" /></svg>
)

// ── Tab bar icons (duotone: a soft fill + a solid layer, both currentColor) ──
export const PathTabIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor"><path d="M3.5 10.6L12 3.4l8.5 7.2V20a1.2 1.2 0 01-1.2 1.2H15v-5.7a3 3 0 00-6 0v5.7H4.7A1.2 1.2 0 013.5 20z" /><path d="M1.8 11.2L12 2.6l10.2 8.6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity=".45" /></svg>
)
export const PracticeTabIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor"><circle cx="12" cy="12" r="9.5" opacity=".3" /><circle cx="12" cy="12" r="6" opacity=".55" /><circle cx="12" cy="12" r="2.6" /><path d="M13.2 10.8l6.4-6.4M17 3.5h3.5V7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
)
export const ReviewTabIcon = PracticeTabIcon
export const GamesTabIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor"><path d="M7 6.5h10a5 5 0 014.9 6l-1 4.6a2.6 2.6 0 01-4.5 1.1L14.2 16H9.8l-2.2 2.2a2.6 2.6 0 01-4.5-1.1l-1-4.6A5 5 0 017 6.5z" opacity=".35" /><path d="M7.5 9.5v4M5.5 11.5h4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /><circle cx="16" cy="10.3" r="1.5" /><circle cx="18" cy="13" r="1.5" /></svg>
)
export const WordsTabIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor"><path d="M12 5.5C9.8 4 6.8 3.6 3.5 4v14.5c3.3-.4 6.3 0 8.5 1.5z" opacity=".4" /><path d="M12 5.5c2.2-1.5 5.2-1.9 8.5-1.5v14.5c-3.3-.4-6.3 0-8.5 1.5z" /></svg>
)
export const ProfileTabIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor"><circle cx="12" cy="8" r="4.5" /><path d="M3.5 20.5c1-4.2 4.4-6.5 8.5-6.5s7.5 2.3 8.5 6.5z" opacity=".45" /></svg>
)

// ── Misc UI icons ──
export const ChatIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor"><path d="M4 4.5h11a2.5 2.5 0 012.5 2.5v5.5A2.5 2.5 0 0115 15H9l-4 3.5V15H4a2.5 2.5 0 01-2.5-2.5V7A2.5 2.5 0 014 4.5z" /><path d="M19 8.5h.5A2.5 2.5 0 0122 11v5a2.5 2.5 0 01-2.5 2.5H19V21l-3.5-2.5H12a2.5 2.5 0 01-2-1" opacity=".45" /></svg>
)
export const BookIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor"><path d="M5 3.5h11.5A2.5 2.5 0 0119 6v14.5H6.5A2.5 2.5 0 014 18V4.5a1 1 0 011-1z" /><path d="M4 18a2.5 2.5 0 012.5-2.5H19" fill="none" stroke="#fff" strokeOpacity=".6" strokeWidth="1.6" /><path d="M8 7.5h7M8 10.5h5" stroke="#fff" strokeOpacity=".7" strokeWidth="1.8" strokeLinecap="round" /></svg>
)
export const PlayIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor"><path d="M8 5.2v13.6a1 1 0 001.5.9l10.6-6.8a1 1 0 000-1.8L9.5 4.3A1 1 0 008 5.2z" /></svg>
)
export const PauseIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor"><rect x="6" y="4.5" width="4.2" height="15" rx="1.4" /><rect x="13.8" y="4.5" width="4.2" height="15" rx="1.4" /></svg>
)
export const ReplayIcon = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12a8 8 0 108-8H8" /><path d="M10.5 1.5L7.5 4l3 2.5" /></svg>
)
export const TranslateIcon = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5.5h9M7.5 3.5v2M10 5.5c-.8 3.8-3.4 6.6-6.5 8M5.5 8.5c1.2 2.2 3 3.8 5 4.8" /><path d="M12.5 20.5l4-9.5 4 9.5M14 17h5" /></svg>
)
export const SunIcon = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="4.2" fill="currentColor" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></svg>
)
export const MoonIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor"><path d="M20 14.6A8.5 8.5 0 019.4 4a8.5 8.5 0 1010.6 10.6z" /></svg>
)
export const SystemIcon = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="6" y="2.5" width="12" height="19" rx="3" /><path d="M12 5.5v13a2 2 0 002-2" fill="currentColor" stroke="none" /><path d="M12 5.5h3a1 1 0 011 1v11a1 1 0 01-1 1h-3z" fill="currentColor" stroke="none" /></svg>
)
export const SparkleIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor"><path d="M12 2.5c.6 4.6 2.9 6.9 7.5 7.5-4.6.6-6.9 2.9-7.5 7.5-.6-4.6-2.9-6.9-7.5-7.5 4.6-.6 6.9-2.9 7.5-7.5z" /><path d="M19 15.5c.3 2 1.2 2.9 3 3.2-1.8.3-2.7 1.2-3 3.2-.3-2-1.2-2.9-3-3.2 1.8-.3 2.7-1.2 3-3.2z" opacity=".6" /></svg>
)
export const MicIcon = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="8.5" y="2.5" width="7" height="12" rx="3.5" fill="currentColor" /><path d="M5 11a7 7 0 0014 0M12 18v3.5" /></svg>
)
export const WaveIcon = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M3 12h1.5M7 8.5v7M10.5 5v14M14 8v8M17.5 10v4M21 12h0" /></svg>
)
export const ChevronRightIcon = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
)
export const ChevronDownIcon = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 9l7 7 7-7" /></svg>
)
export const TargetIcon = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth="2.4"><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /></svg>
)
export const ClockIcon = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
)
export const MotionIcon = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><circle cx="15" cy="12" r="5" fill="currentColor" /><path d="M2.5 9h5M3.5 12h4M2.5 15h5" /></svg>
)
export const SnailIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor"><path d="M3 18.5h14.5a4 4 0 004-4V9.5a1.5 1.5 0 00-3 0v3" opacity=".45" /><circle cx="11" cy="12" r="6" /><path d="M11 12a2.3 2.3 0 11-2.3-2.3" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="1.6" strokeLinecap="round" /></svg>
)
