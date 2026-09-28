# src/motion: motion and feedback kit

Import everything from `src/motion` (for example `import { celebrate, haptic } from '../motion'`). There are no dependencies. Only `transform` and `opacity` are animated, so it runs at 60 fps on iPhone. Everything respects reduced motion, both the OS setting and `settings.reduceMotion`.

Demo: run `npx vite --port 5199` and open `/src/motion/_demo/index.html`.

## Setup (lead or agent 1, once)

```tsx
<ProgressProvider>
  <MotionSettingsSync />   {/* mirrors settings.reduceMotion onto <html data-reduce-motion> */}
  <App />
</ProgressProvider>
// optional, e.g. in App: tap sound for <Pressable>
setTapSound(() => { if (settings.soundEffects) playSfx('tap') })
```

When `data-reduce-motion="true"` is set, **every CSS animation and transition in the app** is switched off, in the same way as the OS setting (`index.css`).

## Imperative

| API | What it does |
|---|---|
| `celebrate(kind, opts?)` | Canvas particles on a fixed overlay that ignores pointer events and removes itself. `kind` is one of `'confetti'` (two side cannons plus a rain), `'burst'` (radial pop and ring), `'fireworks'` (rockets that explode) or `'stars'` (gold twinkling stars). `opts`: `{ origin?: {x,y}, from?: Element, colors?: string[], intensity?: 0.25–2 }`. Particles are capped at 420. Reduced motion gives about 15% of the particles, drifting gently. |
| `haptic(kind?)` | `'light'`, `'select'`, `'medium'`, `'heavy'`, `'success'`, `'warning'` or `'error'`. Uses `navigator.vibrate` where it exists (Android). On iOS 18+ it uses the hidden-switch tick trick. Otherwise it does nothing, silently. It is skipped while a text input has focus. |
| `flyTo(fromEl, toEl, content, opts?)` | Coins or orbs fly along a curve (for example `'+10'` to the XP counter). The target bumps each time an orb arrives. `opts`: `{ count, durationMs, staggerMs, className, onArrive(i) }`. Returns a Promise. |
| `bump(el)` | Springy scale on an element, for example when a counter changes. |
| `replay(el, cls)` | Restarts a one-shot class, for example `replay(card, 'shake')`. |
| `prefersReducedMotion()` | Non-hook check. |

## Components

| Component | Notes |
|---|---|
| `<CountUp value from? durationMs? pulse? format? />` | Rolls to the new value with tabular numbers, pops on change and reads the final value to screen readers. |
| `<Transition swapKey kind="slide/fade/pop/up" direction={1/-1} />` | Enter-only (the old tree unmounts at once, so audio never plays twice). Fill mode is `backwards`, so the wrapper has no transform once the animation ends. For the first ~300 ms, `position: fixed` children are positioned against the wrapper; use `kind="fade"` around screens that contain fixed footers. |
| `<Splash message? onDone minMs=1200 ready? />` | Launch or loading screen: the Panda waves, the "Nǐ hǎo" letters rise, the tone-3 marks drop in and dip, and a shimmer bar runs. It types out `message` and fades out, then calls `onDone`. |
| `<CelebrationOverlay open title subtitle? mood onClose confetti? closeLabel? tapToClose?>children</CelebrationOverlay>` | Portal with rays, glow, the Panda popping in, a title and subtitle, and children staggered in. It fires confetti and a success haptic on open. It moves focus to the button and traps it, closes on Escape or on a tap anywhere (after 700 ms), and restores focus afterwards. |
| `<Skeleton width height rounded lines? />` | Shimmer placeholder. |
| `<Pressable haptics="light" sound>` | A `<button>` with `.press`, a haptic and the registered tap sound. Accepts all button props. |
| `useReducedMotion()` | Hook. Works without a ProgressProvider. |

## CSS utilities (`src/styles/motion.css`)

| Class | Use for |
|---|---|
| `.press` | Any tappable: buttons, answer tiles, path nodes, cards. It works together with Tailwind `translate-*` (a separate property). |
| `.pop-in` | Correct feedback, new badge, "Rätt!" |
| `.slide-up` / `.fade-in` | Cards, results, sheet content |
| `.shake` | Wrong answer (use `replay(el,'shake')` to trigger it again) |
| `.bounce-soft` | "START" bubble above the current node, main call to action |
| `.float` | Idle mascot |
| `.pulse-ring` | Current lesson node (round element; colour via `--ring`) |
| `.shimmer` | Skeletons |
| `.glow` | Streak flame, gold rewards (colour via `--glow`) |
| `.wiggle` | Unclaimed chest or reward |
| `.stagger-children` | Lists or rows entering in sequence (`--stagger`; `--i` is set automatically for 16 children) |
| `.delay-1` … `.delay-5` | Delay one-shot animations in 80 ms steps |

## Recipes

- **Correct answer**: add `pop-in` on the verdict icon, then `celebrate('burst', { from: checkButton })` and `haptic('success')`. Optionally `flyTo(checkButton, xpEl, '+10', { count: 3 })`.
- **Wrong answer**: `replay(answerEl, 'shake')` and `haptic('error')`. No particles.
- **Combo of 5 or more**: `celebrate('stars', { from: comboEl })`.
- **Lesson finished**: `<CelebrationOverlay>` with `<CountUp from={0} value={xp}/>` inside it. For a perfect lesson use `confetti="fireworks"`.
- **Level up or streak milestone**: `<CelebrationOverlay mood="proud" confetti="fireworks">`.
- **Screen or exercise change**: `<Transition swapKey={id} kind="slide">` (use `fade` if the screen contains a fixed footer).
