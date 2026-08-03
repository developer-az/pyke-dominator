/** Real in-app screenshot plane — preserves intrinsic aspect ratio. */

type Props = {
  src?: string
  alt?: string
  caption?: string
  /** Wider hero treatment vs nested column shot */
  size?: 'hero' | 'inline'
}

const SIZE = {
  hero: 'max-w-5xl',
  inline: 'max-w-none',
} as const

export function HudPreview({
  src = `${import.meta.env.BASE_URL}screenshots/hero-app.png`,
  alt = 'One Trick — Pyke Support loadout screen',
  caption = 'Live client · Pyke Support',
  size = 'hero',
}: Props) {
  return (
    <figure className={`relative mx-auto w-full ${SIZE[size]} animate-drift`}>
      <div className="hud-shot clip-panel relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 z-[1] h-px bg-gradient-to-r from-transparent via-chrome-silver/55 to-transparent animate-pulse-line" />
        <img
          src={src}
          alt={alt}
          width={838}
          height={577}
          decoding="async"
          {...(size === 'hero' ? { fetchPriority: 'high' as const } : {})}
        />
      </div>
      <figcaption className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-chrome-dim">
        {caption}
      </figcaption>
    </figure>
  )
}
