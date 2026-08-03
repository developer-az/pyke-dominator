/** Real in-app screenshot plane for the hero. */

type Props = {
  src?: string
  alt?: string
  caption?: string
}

export function HudPreview({
  src = `${import.meta.env.BASE_URL}screenshots/hero-app.png`,
  alt = 'One Trick — Pyke Support loadout screen',
  caption = 'Live client · Pyke Support',
}: Props) {
  return (
    <figure className="relative mx-auto w-full max-w-2xl animate-drift">
      <div className="hud-frame clip-panel relative overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
        <div className="absolute inset-x-0 top-0 z-[1] h-px bg-gradient-to-r from-transparent via-chrome-silver/55 to-transparent animate-pulse-line" />
        <img
          src={src}
          alt={alt}
          width={1280}
          height={682}
          className="block h-auto w-full object-cover object-top"
          decoding="async"
          fetchPriority="high"
        />
      </div>
      <figcaption className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-chrome-dim">
        {caption}
      </figcaption>
    </figure>
  )
}
