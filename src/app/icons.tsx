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

// ── Tab bar icons (solid, two-tone via opacity) ──
export const PathTabIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor"><path d="M3.5 10.5L12 3.5l8.5 7V20a1 1 0 01-1 1H15v-6H9v6H4.5a1 1 0 01-1-1z" /></svg>
)
export const ReviewTabIcon = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12a8 8 0 01-14 5.3M4 12a8 8 0 0114-5.3" /><path d="M18.5 3v4h-4M5.5 21v-4h4" /></svg>
)
export const WordsTabIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor"><path d="M4 4.5A1.5 1.5 0 015.5 3H11v17H5.5A1.5 1.5 0 014 18.5zM13 3h5.5A1.5 1.5 0 0120 4.5v14a1.5 1.5 0 01-1.5 1.5H13z" /><path d="M6.5 7h2.5M6.5 10h2.5M15.5 7h2M15.5 10h2" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" /></svg>
)
export const ProfileTabIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor"><circle cx="12" cy="8" r="4.5" /><path d="M3.5 20.5c1-4.2 4.4-6.5 8.5-6.5s7.5 2.3 8.5 6.5z" /></svg>
)
