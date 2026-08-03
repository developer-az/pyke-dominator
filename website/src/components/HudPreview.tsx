/** Abstract product visual — chrome HUD silhouette for the hero plane. */
export function HudPreview() {
  return (
    <div className="relative mx-auto w-full max-w-xl animate-drift" aria-hidden>
      <div className="hud-frame clip-panel relative aspect-[16/11] overflow-hidden p-5 sm:p-7">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_20%,rgba(155,28,46,0.18),transparent_55%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-chrome-silver/50 to-transparent animate-pulse-line" />

        <div className="relative flex h-full flex-col justify-between">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-chrome-dim">
                Live matchup
              </p>
              <p className="mt-1 font-display text-xl tracking-wide text-chrome-bright sm:text-2xl">
                Pyke Dominator
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-chrome-dim">
                Dominance
              </p>
              <p className="mt-1 font-display text-2xl text-chrome-blood sm:text-3xl">72</p>
            </div>
          </div>

          <div className="mt-6 grid flex-1 grid-cols-5 gap-2 sm:gap-3">
            {['TOP', 'JG', 'MID', 'BOT', 'SUP'].map((role, i) => (
              <div
                key={role}
                className="flex flex-col items-center justify-end gap-2"
                style={{ opacity: 0.55 + i * 0.08 }}
              >
                <div
                  className="w-full rounded-sm border border-chrome-silver/20 bg-chrome-ink/70"
                  style={{ height: `${38 + ((i * 17) % 40)}%` }}
                />
                <span className="font-mono text-[9px] tracking-[0.16em] text-chrome-dim">
                  {role}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-chrome-silver/15 pt-4">
            <div className="flex gap-2">
              {['CORE', 'BOOTS', 'SIT'].map((label) => (
                <span
                  key={label}
                  className="border border-chrome-silver/25 px-2 py-1 font-mono text-[9px] tracking-[0.14em] text-chrome-silver/80"
                >
                  {label}
                </span>
              ))}
            </div>
            <span className="font-mono text-[10px] tracking-[0.18em] text-chrome-dim">
              EXPORT READY
            </span>
          </div>
        </div>
      </div>

      {/* Overlay chrome accents */}
      <div className="pointer-events-none absolute -bottom-3 left-[8%] right-[18%] h-8 border border-chrome-silver/30 bg-chrome-ink/40 backdrop-blur-sm" />
      <div className="pointer-events-none absolute -right-2 bottom-[18%] h-24 w-24 border border-chrome-silver/25 bg-chrome-ink/30 sm:h-28 sm:w-28" />
    </div>
  )
}
