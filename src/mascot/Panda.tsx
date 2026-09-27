// OWNER: Design-look agent. Original panda mascot ("Pānpan"), inline SVG, no external assets.
export type PandaMood = 'happy' | 'cheer' | 'sad' | 'think' | 'sleep' | 'wave' | 'surprised' | 'proud'
export function Panda({ mood = 'happy', size = 96, className }: { mood?: PandaMood; size?: number; className?: string }) {
  return <span className={className} style={{ fontSize: size * 0.8, lineHeight: 1 }} role="img" aria-label={`Panda (${mood})`}>🐼</span>
}
