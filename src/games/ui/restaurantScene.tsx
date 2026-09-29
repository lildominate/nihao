// OWNER: Games agent. Restaurangrusch kitchen scene art: original inline SVG/CSS in NiHao's palette (tokens only).
import type { ReactNode } from 'react'
import { Panda, type PandaMood } from '../../mascot/Panda'
import { lunchClock, type Species } from '../logic/restaurant'
import './restaurantScene.css'

export type CritterMood = 'happy' | 'ok' | 'angry' | 'sad' | 'glad'

const INK = 'var(--color-ink)'

// ─── Backdrop ────────────────────────────────────────────────

function Lantern() {
  return (
    <div className="rs-sway pointer-events-none absolute top-0 left-5 z-[2]" aria-hidden="true">
      <svg viewBox="0 0 44 78" width="44" height="78">
        <path d="M22 0 V14" stroke={INK} strokeWidth="2" />
        <rect x="14" y="12" width="16" height="6" rx="2" fill="var(--color-gold-dark)" />
        <ellipse cx="22" cy="34" rx="19" ry="17" fill="var(--color-lacquer)" />
        <path d="M22 17 Q9 34 22 51 M22 17 Q35 34 22 51 M22 17 V51" stroke="var(--color-lacquer-dark)" strokeWidth="1.6" fill="none" />
        <ellipse cx="15" cy="27" rx="4" ry="6" fill="#fff" opacity=".22" />
        <rect x="14" y="49" width="16" height="6" rx="2" fill="var(--color-gold-dark)" />
        <path d="M17 55 V70 M22 55 V74 M27 55 V70" stroke="var(--color-gold)" strokeWidth="2.4" strokeLinecap="round" />
        <text x="22" y="39" textAnchor="middle" fontSize="15" fontWeight="900" fill="var(--color-gold)" lang="zh-CN">福</text>
      </svg>
    </div>
  )
}

function Shelves() {
  return (
    <svg className="pointer-events-none absolute top-14 left-0 z-[1] w-full" viewBox="0 0 448 70" preserveAspectRatio="xMinYMin slice" aria-hidden="true">
      {/* plank */}
      <rect x="0" y="52" width="448" height="8" rx="2" fill="var(--color-warn-dark)" />
      <rect x="0" y="60" width="448" height="3" fill="#000" opacity=".1" />
      {/* jars and bowls */}
      <rect x="92" y="28" width="22" height="24" rx="6" fill="var(--color-brand-light)" />
      <rect x="95" y="22" width="16" height="7" rx="2" fill="var(--color-brand-dark)" />
      <rect x="122" y="34" width="20" height="18" rx="5" fill="var(--color-sky)" />
      <rect x="125" y="30" width="14" height="5" rx="2" fill="var(--color-sky-dark)" />
      <path d="M150 38 h34 q0 14 -17 14 t-17 -14z" fill="var(--color-plum)" />
      <ellipse cx="167" cy="38" rx="17" ry="3.4" fill="var(--color-plum-dark)" />
      <rect x="196" y="24" width="24" height="28" rx="7" fill="var(--color-flame)" />
      <rect x="200" y="18" width="16" height="7" rx="2" fill="var(--color-gold-dark)" />
      <path d="M232 52 v-14 h26 v14z" fill="var(--color-gold)" />
      <path d="M232 38 h26" stroke="var(--color-gold-dark)" strokeWidth="2" />
      <rect x="272" y="30" width="20" height="22" rx="5" fill="var(--color-lacquer-soft)" stroke="var(--color-lacquer)" strokeWidth="2" />
    </svg>
  )
}

/** Stove with a wok. `steamRef` is the boost wrapper (replay 'rs-hot' on it for a burst of steam). */
export function Stove({ steamRef }: { steamRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div className="pointer-events-none absolute bottom-[72px] left-1 z-[3] h-[88px] w-[86px]" aria-hidden="true">
      <div ref={steamRef} className="rs-steam absolute top-0 left-5 h-14 w-12">
        <i /><i /><i />
      </div>
      <svg viewBox="0 0 90 90" className="absolute inset-0 h-full w-full">
        <rect x="6" y="56" width="78" height="34" rx="5" fill="var(--color-ink)" />
        <rect x="6" y="56" width="78" height="6" rx="3" fill="var(--color-ink-muted)" />
        <circle cx="22" cy="76" r="4" fill="var(--color-gold)" />
        <circle cx="38" cy="76" r="4" fill="var(--color-gold)" />
        {/* flames */}
        <path className="rs-flame" d="M30 58 q3 -9 6 0 q3 -12 6 0 q3 -8 6 0 q-6 6 -18 0z" fill="var(--color-flame)" />
        <path className="rs-flame" style={{ animationDelay: '.2s' }} d="M36 58 q2 -6 4 0 q2 -7 4 0z" fill="var(--color-gold)" />
        {/* wok */}
        <path d="M8 40 Q45 76 82 40 Z" fill="var(--color-ink-muted)" />
        <path d="M8 40 Q45 76 82 40" fill="none" stroke={INK} strokeWidth="2.5" />
        <ellipse cx="45" cy="40" rx="37" ry="4.5" fill={INK} />
        <path d="M13 41 Q24 52 34 55" stroke="#fff" strokeWidth="2" opacity=".3" fill="none" strokeLinecap="round" />
        <path d="M80 42 L90 34" stroke={INK} strokeWidth="5" strokeLinecap="round" />
        <circle cx="34" cy="38" r="3.4" fill="var(--color-brand)" />
        <circle cx="46" cy="37" r="3" fill="var(--color-flame)" />
        <circle cx="57" cy="38.5" r="3.4" fill="var(--color-gold)" />
      </svg>
    </div>
  )
}

/** Wall, shelves, lantern, counter and floor — the static set (no children re-render). */
export function KitchenBackdrop() {
  return (
    <>
      <div className="rs-wall absolute inset-0" aria-hidden="true" />
      <Shelves />
      <Lantern />
      <div className="rs-floor absolute inset-x-0 bottom-0 h-[26px]" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-x-0 bottom-[26px] z-10 h-[64px]" aria-hidden="true">
        <div className="rs-counter-top absolute inset-x-0 top-0 h-[12px] shadow-[0_3px_0_rgba(0,0,0,.12)]" />
        <div className="rs-counter-front absolute inset-x-0 top-[12px] bottom-0" />
      </div>
    </>
  )
}

// ─── Chef Pānpan ─────────────────────────────────────────────

function ChefHat() {
  return (
    <svg viewBox="0 0 200 200" className="pointer-events-none absolute inset-0 h-full w-full" style={{ overflow: 'visible' }} aria-hidden="true">
      <g>
        <circle cx="70" cy="22" r="19" fill="#fff" stroke="#e7e2ea" strokeWidth="2" />
        <circle cx="130" cy="22" r="19" fill="#fff" stroke="#e7e2ea" strokeWidth="2" />
        <circle cx="100" cy="10" r="23" fill="#fff" stroke="#e7e2ea" strokeWidth="2" />
        <rect x="62" y="24" width="76" height="24" rx="6" fill="#fff" />
        <rect x="60" y="40" width="80" height="14" rx="6" fill="#fff" stroke="#e7e2ea" strokeWidth="2" />
        <path d="M78 26 v14 M100 26 v14 M122 26 v14" stroke="#efeaf2" strokeWidth="2" strokeLinecap="round" />
      </g>
    </svg>
  )
}

/** Pānpan in his hat. Three stacked wrappers so serve / cook / float never fight over `transform`. */
export function Chef({ mood, serveRef, cookRef }: { mood: PandaMood; serveRef: React.RefObject<HTMLDivElement | null>; cookRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div ref={serveRef} className="pointer-events-none absolute bottom-[62px] left-[66px] z-[4] h-[140px] w-[140px]" data-testid="rr-chef">
      <div ref={cookRef} className="h-full w-full">
        <div className="animate-float relative h-full w-full">
          <Panda mood={mood} size={140} />
          <ChefHat />
        </div>
      </div>
    </div>
  )
}

// ─── Customers ───────────────────────────────────────────────

const SKIN: Record<Species, { fur: string; shirt: string; belly: string }> = {
  fox: { fur: 'var(--color-flame)', shirt: 'var(--color-sky)', belly: '#fff' },
  rabbit: { fur: 'var(--color-plum-soft)', shirt: 'var(--color-brand)', belly: '#fff' },
  cat: { fur: 'var(--color-ink-faint)', shirt: 'var(--color-gold)', belly: '#fff' },
  duck: { fur: 'var(--color-gold)', shirt: 'var(--color-lacquer)', belly: 'var(--color-gold-soft)' },
}

/** Original cute animal customer. The face follows the mood: happy -> impatient -> angry (or glad / sad after the result). */
export function Critter({ sp, mood }: { sp: Species; mood: CritterMood }) {
  const c = SKIN[sp]
  const eyeY = 46
  const glad = mood === 'glad'
  const arcEyes = glad || mood === 'sad'
  const mouth =
    glad ? <path d="M40 64 Q50 78 60 64 Z" fill="#7f1d1d" stroke="#7f1d1d" strokeWidth="2" strokeLinejoin="round" />
      : mood === 'happy' ? <path d="M42 65 Q50 72 58 65" fill="none" stroke="#7f1d1d" strokeWidth="2.6" strokeLinecap="round" />
        : mood === 'ok' ? <path d="M42 68 Q46 65 50 68 T58 68" fill="none" stroke="#7f1d1d" strokeWidth="2.6" strokeLinecap="round" />
          : <path d="M42 71 Q50 63 58 71" fill="none" stroke="#7f1d1d" strokeWidth="2.6" strokeLinecap="round" />
  return (
    <svg viewBox="0 0 100 120" className="h-full w-full" style={{ overflow: 'visible' }} aria-hidden="true" data-species={sp}>
      <ellipse cx="50" cy="118" rx="30" ry="4" fill="#000" opacity=".12" />
      {/* body */}
      <path d="M16 118 Q14 84 50 84 Q86 84 84 118 Z" fill={c.shirt} />
      <path d="M40 84 L50 96 L60 84" fill={c.belly} opacity=".9" />
      <ellipse cx="22" cy="108" rx="7" ry="8" fill={c.fur} />
      <ellipse cx="78" cy="108" rx="7" ry="8" fill={c.fur} />
      {sp === 'duck' && <path d="M8 96 Q0 88 6 80 Q10 90 20 92 Z" fill={c.fur} />}
      {sp === 'fox' && <path d="M80 104 Q104 100 100 76 Q92 92 78 92 Z" fill={c.fur} stroke="#fff" strokeWidth="0" />}
      {sp === 'cat' && <path d="M80 108 Q102 104 96 84" fill="none" stroke={c.fur} strokeWidth="7" strokeLinecap="round" />}
      {/* ears / tuft (behind head) */}
      {sp === 'fox' && <><path d="M22 40 L18 10 L44 28 Z" fill={c.fur} /><path d="M78 40 L82 10 L56 28 Z" fill={c.fur} /><path d="M24 34 L23 18 L36 28Z" fill="var(--color-ink)" opacity=".75" /><path d="M76 34 L77 18 L64 28Z" fill="var(--color-ink)" opacity=".75" /></>}
      {sp === 'cat' && <><path d="M22 40 L20 10 L44 26 Z" fill={c.fur} /><path d="M78 40 L80 10 L56 26 Z" fill={c.fur} /><path d="M25 34 L24 19 L36 28Z" fill="var(--color-lacquer-soft)" /><path d="M75 34 L76 19 L64 28Z" fill="var(--color-lacquer-soft)" /></>}
      {sp === 'rabbit' && <>
        <g className="origin-bottom" style={{ transform: mood === 'angry' ? 'none' : mood === 'sad' ? 'rotate(-18deg)' : undefined, transformOrigin: '38px 34px' }}>
          <ellipse cx="36" cy="12" rx="9" ry="22" fill={c.fur} stroke="var(--color-line-dark)" strokeWidth="1.5" /><ellipse cx="36" cy="14" rx="4.5" ry="15" fill="var(--color-lacquer-soft)" />
        </g>
        <g style={{ transform: mood === 'sad' ? 'rotate(18deg)' : undefined, transformOrigin: '64px 34px' }}>
          <ellipse cx="64" cy="12" rx="9" ry="22" fill={c.fur} stroke="var(--color-line-dark)" strokeWidth="1.5" /><ellipse cx="64" cy="14" rx="4.5" ry="15" fill="var(--color-lacquer-soft)" />
        </g>
      </>}
      {sp === 'duck' && <path d="M46 20 Q44 6 52 8 Q50 14 54 20 Z" fill={c.fur} />}
      {/* head */}
      <ellipse cx="50" cy="52" rx="32" ry="30" fill={c.fur} stroke={sp === 'rabbit' ? 'var(--color-line-dark)' : 'none'} strokeWidth="1.5" />
      {sp === 'fox' && <path d="M20 56 Q36 78 50 70 Q64 78 80 56 Q64 62 50 60 Q36 62 20 56Z" fill="#fff" />}
      {sp === 'cat' && <path d="M46 24 v8 M50 23 v9 M54 24 v8" stroke="var(--color-ink-muted)" strokeWidth="2.6" strokeLinecap="round" />}
      <ellipse cx="30" cy="60" rx="6" ry="4" fill="var(--color-lacquer)" opacity={mood === 'angry' ? 0.5 : 0.22} />
      <ellipse cx="70" cy="60" rx="6" ry="4" fill="var(--color-lacquer)" opacity={mood === 'angry' ? 0.5 : 0.22} />
      {/* eyes */}
      {arcEyes ? (
        <g stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none">
          <path d={glad ? `M32 ${eyeY + 3} Q38 ${eyeY - 6} 44 ${eyeY + 3}` : `M32 ${eyeY - 2} Q38 ${eyeY + 6} 44 ${eyeY - 2}`} />
          <path d={glad ? `M56 ${eyeY + 3} Q62 ${eyeY - 6} 68 ${eyeY + 3}` : `M56 ${eyeY - 2} Q62 ${eyeY + 6} 68 ${eyeY - 2}`} />
        </g>
      ) : (
        <g className="rs-blink">
          <circle cx="38" cy={eyeY} r="5" fill={INK} /><circle cx="62" cy={eyeY} r="5" fill={INK} />
          <circle cx="39.6" cy={eyeY - 1.8} r="1.7" fill="#fff" /><circle cx="63.6" cy={eyeY - 1.8} r="1.7" fill="#fff" />
        </g>
      )}
      {(mood === 'angry' || mood === 'ok' || mood === 'sad') && (
        <g stroke={INK} strokeWidth="3" strokeLinecap="round">
          <path d={mood === 'angry' ? 'M30 34 L45 40' : mood === 'ok' ? 'M31 37 L44 35' : 'M31 39 L44 34'} />
          <path d={mood === 'angry' ? 'M70 34 L55 40' : mood === 'ok' ? 'M69 37 L56 35' : 'M69 39 L56 34'} />
        </g>
      )}
      {/* muzzle / nose / bill */}
      {sp === 'fox' && <ellipse cx="50" cy="56" rx="4.6" ry="3.4" fill={INK} />}
      {sp === 'cat' && <path d="M46 55 h8 l-4 5z" fill="var(--color-lacquer)" />}
      {sp === 'rabbit' && <><ellipse cx="50" cy="56" rx="4" ry="3" fill="var(--color-lacquer)" /><path d="M46 68 v5 h4 v-5 M50 68 v5 h4 v-5" fill="#fff" stroke="var(--color-line-dark)" strokeWidth="1" opacity={glad || mood === 'happy' ? 1 : 0} /></>}
      {sp === 'duck' && <path d="M34 55 Q50 48 66 55 Q64 66 50 66 Q36 66 34 55Z" fill="var(--color-flame)" />}
      {sp === 'cat' && <path d="M20 60 h12 M20 66 h12 M68 60 h12 M68 66 h12" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity=".9" />}
      {sp !== 'duck' && mouth}
      {sp === 'duck' && <g transform="translate(0 -1)">{glad ? <path d="M40 60 Q50 74 60 60 Z" fill="#7f1d1d" /> : <path d={mood === 'happy' ? 'M42 62 Q50 68 58 62' : mood === 'ok' ? 'M43 63 H57' : 'M42 66 Q50 58 58 66'} fill="none" stroke="#7f1d1d" strokeWidth="2.6" strokeLinecap="round" />}</g>}
      {mood === 'ok' && <path d="M76 36 Q80 42 76 46 Q72 42 76 36 Z" fill="var(--color-sky)" />}
      {mood === 'sad' && <path d="M68 52 Q72 58 68 62 Q64 58 68 52 Z" fill="var(--color-sky)" />}
      {mood === 'angry' && (
        <g fill="#fff" opacity=".85">
          <circle className="rs-huff" cx="20" cy="30" r="5" /><circle className="rs-huff" style={{ animationDelay: '.45s' }} cx="80" cy="30" r="5" />
        </g>
      )}
    </svg>
  )
}

/** ✓ / ✗ stamp slammed over the customer. */
export function Stamp({ ok }: { ok: boolean }) {
  const col = ok ? 'var(--color-brand)' : 'var(--color-danger)'
  return (
    <div className="rs-stamp" data-testid="rr-stamp" data-ok={ok} aria-hidden="true">
      <svg viewBox="0 0 80 80" width="74" height="74">
        <circle cx="40" cy="40" r="35" fill="#fff" fillOpacity=".78" stroke={col} strokeWidth="6" />
        <circle cx="40" cy="40" r="28" fill="none" stroke={col} strokeWidth="1.6" strokeDasharray="3 4" />
        {ok
          ? <path d="M22 42 L35 55 L59 26" fill="none" stroke={col} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
          : <path d="M25 25 L55 55 M55 25 L25 55" fill="none" stroke={col} strokeWidth="9" strokeLinecap="round" />}
      </svg>
    </div>
  )
}

/** Grumpy storm-cloud puff over a customer who leaves unhappy. */
export function StormCloud() {
  return (
    <svg className="rs-cloud" viewBox="0 0 52 40" aria-hidden="true">
      <path d="M12 26 Q2 26 4 17 Q6 9 15 11 Q19 2 29 5 Q38 3 40 12 Q50 12 48 21 Q47 27 38 26 Z" fill="var(--color-ink-muted)" />
      <path d="M12 26 Q2 26 4 17 Q6 9 15 11 Q19 2 29 5 Q38 3 40 12 Q50 12 48 21 Q47 27 38 26 Z" fill="var(--color-ink)" opacity=".28" />
      <path d="M27 24 L21 34 L27 33 L23 40 L33 29 L27 30 L31 24Z" fill="var(--color-gold)" />
    </svg>
  )
}

// ─── Dish card ───────────────────────────────────────────────

/** Big dish on a plate; the name and (once revealed) pinyin go in `children`. */
export function DishPlate({ emoji, children }: { emoji: string; children?: ReactNode }) {
  return (
    <>
      <span className="relative flex h-[54px] w-[54px] items-center justify-center rounded-full border-[3px] border-line-dark bg-white shadow-[inset_0_-3px_0_rgba(0,0,0,.08),0_2px_0_var(--color-line-dark)]" data-emoji>
        <span className="absolute inset-1 rounded-full border border-line" aria-hidden="true" />
        <span className="relative text-[30px] leading-none">{emoji}</span>
      </span>
      {children}
    </>
  )
}

// ─── Lunch-rush clock ────────────────────────────────────────

export function LunchClock({ done, reduced }: { done: number; reduced: boolean }) {
  const t = lunchClock(done)
  const tr = reduced ? 'none' : 'transform .7s cubic-bezier(.3,.7,.3,1)'
  return (
    <div className="flex items-center gap-1" aria-label={`Lunchrusning, klockan ${t.label}`} data-testid="rr-clock">
      <span className="relative block h-7 w-7 shrink-0 rounded-full border-[3px] border-lacquer bg-white" aria-hidden="true">
        <span className="absolute top-1/2 left-1/2 h-2 w-[3px] origin-top rounded-full bg-ink" style={{ transform: `translate(-50%, 0) rotate(${t.hourDeg + 180}deg)`, transition: tr }} />
        <span className="absolute top-1/2 left-1/2 h-[10px] w-[2px] origin-top rounded-full bg-lacquer" style={{ transform: `translate(-50%, 0) rotate(${t.minuteDeg + 180}deg)`, transition: tr }} />
      </span>
      <span className="text-xs font-black text-ink-muted tabular-nums">{t.label}</span>
    </div>
  )
}
