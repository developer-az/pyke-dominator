import { useEffect, useState } from 'react'
import { ChromeMark } from './components/ChromeMark'
import { HudPreview } from './components/HudPreview'
import { Reveal } from './components/Reveal'
import {
  fetchLatestRelease,
  RELEASES_URL,
  REPO_URL,
  type ReleaseInfo,
} from './lib/release'

const features = [
  {
    kicker: '01 — Matchup',
    title: 'Know the lane before the load screen.',
    body: 'Enemy roles lock in and Dominator answers with items, runes, and a dominance read shaped for how you actually play the pick — not a generic op.gg dump.',
  },
  {
    kicker: '02 — Export',
    title: 'One click into the League Client.',
    body: 'Runes and item sets land in LCU without copy-paste theater. Stay in champ select. Stay in the fight for tempo.',
  },
  {
    kicker: '03 — Overlay',
    title: 'Chrome that respects the map.',
    body: 'Ability and minimap frames, summoner timing, vision cues. Sync HUD scale from League, calibrate by the pixel, then lock it click-through so it never steals focus.',
  },
]

const profiles = [
  {
    name: 'Pyke Support',
    line: 'Primary — bot lane tempo, all-in windows, roam-aware scoring.',
  },
  {
    name: 'Pantheon Support',
    line: 'Off-pick when Pyke is banned — still a Dominator lane plan.',
  },
  {
    name: 'Yone Mid',
    line: 'Mid profile with jungle-aware context when the game asks for it.',
  },
]

const steps = [
  { n: '01', title: 'Install', body: 'Grab the Windows setup from Releases and launch with League open.' },
  { n: '02', title: 'Lock in', body: 'Champ select fills enemies as picks land. Review the loadout.' },
  { n: '03', title: 'Export & play', body: 'Push runes and items into the client. Overlay appears when the match starts.' },
]

function DownloadButtons({ release }: { release: ReleaseInfo | null }) {
  const href = release?.downloadUrl || RELEASES_URL
  const label = release ? `Download ${release.tag}` : 'Download for Windows'

  return (
    <div className="flex flex-wrap items-center gap-3">
      <a className="btn-chrome" href={href}>
        <ChromeMark size={14} />
        {label}
      </a>
      <a className="btn-ghost" href={RELEASES_URL} target="_blank" rel="noreferrer">
        All releases
      </a>
    </div>
  )
}

export default function App() {
  const [release, setRelease] = useState<ReleaseInfo | null>(null)

  useEffect(() => {
    let alive = true
    fetchLatestRelease().then((info) => {
      if (alive) setRelease(info)
    })
    return () => {
      alive = false
    }
  }, [])

  return (
    <>
      <div className="site-atmosphere" aria-hidden />
      <div className="site-content">
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
          <a href="#top" className="flex items-center gap-2.5 text-chrome-bright no-underline">
            <ChromeMark size={22} />
            <span className="font-display text-lg tracking-[0.08em]">Dominator</span>
          </a>
          <nav className="hidden items-center gap-7 font-mono text-[11px] uppercase tracking-[0.18em] text-chrome-dim sm:flex">
            <a href="#features" className="hover:text-chrome-bright">
              Features
            </a>
            <a href="#profiles" className="hover:text-chrome-bright">
              Profiles
            </a>
            <a href="#download" className="hover:text-chrome-bright">
              Download
            </a>
            <a href={REPO_URL} target="_blank" rel="noreferrer" className="hover:text-chrome-bright">
              GitHub
            </a>
          </nav>
        </header>

        <main id="top">
          {/* Hero — brand first, one composition */}
          <section className="relative mx-auto grid min-h-[min(92vh,920px)] w-full max-w-6xl items-center gap-12 px-5 pb-20 pt-6 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:pb-28">
            <div>
              <p className="animate-fade-up font-mono text-[11px] uppercase tracking-[0.28em] text-chrome-dim">
                Windows · League of Legends
              </p>
              <h1 className="animate-fade-up mt-4 font-display text-[clamp(3.2rem,9vw,5.8rem)] leading-[0.92] tracking-[0.02em] text-chrome-bright">
                Dominator
              </h1>
              <p
                className="animate-fade-up mt-5 max-w-md text-lg leading-relaxed text-chrome-silver/85 sm:text-xl"
                style={{ animationDelay: '120ms' }}
              >
                Your lane plan, already loaded — matchups, runes, and chrome that stays with you into the game.
              </p>
              <div className="animate-fade-up mt-8" style={{ animationDelay: '220ms' }}>
                <DownloadButtons release={release} />
                {release && (
                  <p className="mt-3 font-mono text-[11px] tracking-[0.08em] text-chrome-dim">
                    Latest: {release.assetName}
                  </p>
                )}
              </div>
            </div>

            <div className="animate-fade-up" style={{ animationDelay: '180ms' }}>
              <HudPreview />
            </div>
          </section>

          <div className="chrome-rule mx-auto w-full max-w-6xl" />

          {/* Pitch */}
          <section className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
            <Reveal>
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-chrome-blood">
                Why it exists
              </p>
              <h2 className="mt-4 max-w-3xl font-display text-3xl leading-tight tracking-wide text-chrome-bright sm:text-4xl">
                Built for the minutes where a README can’t sit next to you.
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-chrome-dim sm:text-lg">
                Dominator is a personal League companion — not a wall of markdown. It watches champ select,
                shapes a loadout for the matchup, pushes it into the client, and keeps a quiet chrome HUD
                alive while you play. Pyke Support first; Pantheon and Yone when the draft asks.
              </p>
            </Reveal>
          </section>

          {/* Features */}
          <section id="features" className="mx-auto w-full max-w-6xl px-5 pb-10 sm:px-8">
            <div className="space-y-16 sm:space-y-24">
              {features.map((f, i) => (
                <Reveal key={f.kicker} delayMs={i * 60}>
                  <article className="grid gap-4 border-t border-chrome-silver/15 pt-10 lg:grid-cols-[0.4fr_1fr] lg:gap-12">
                    <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-chrome-dim">
                      {f.kicker}
                    </p>
                    <div>
                      <h3 className="font-display text-2xl tracking-wide text-chrome-bright sm:text-3xl">
                        {f.title}
                      </h3>
                      <p className="mt-4 max-w-xl text-base leading-relaxed text-chrome-dim">
                        {f.body}
                      </p>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          </section>

          {/* Profiles */}
          <section id="profiles" className="mx-auto w-full max-w-6xl px-5 py-24 sm:px-8">
            <Reveal>
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-chrome-dim">
                Profiles
              </p>
              <h2 className="mt-3 font-display text-3xl tracking-wide text-chrome-bright sm:text-4xl">
                One client. Three lanes of intent.
              </h2>
            </Reveal>
            <div className="mt-12 grid gap-px bg-chrome-silver/15 sm:grid-cols-3">
              {profiles.map((p, i) => (
                <Reveal key={p.name} delayMs={i * 80} className="bg-chrome-ink">
                  <div className="h-full px-6 py-8 sm:px-7 sm:py-10">
                    <ChromeMark size={18} className="text-chrome-silver" />
                    <h3 className="mt-5 font-display text-xl text-chrome-bright">{p.name}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-chrome-dim">{p.line}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          {/* How it works */}
          <section className="mx-auto w-full max-w-6xl px-5 pb-24 sm:px-8">
            <Reveal>
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-chrome-dim">
                Flow
              </p>
              <h2 className="mt-3 font-display text-3xl tracking-wide text-chrome-bright">
                In. Out. Onto the Rift.
              </h2>
            </Reveal>
            <div className="mt-12 grid gap-10 sm:grid-cols-3">
              {steps.map((s, i) => (
                <Reveal key={s.n} delayMs={i * 70}>
                  <div>
                    <p className="font-mono text-sm tracking-[0.2em] text-chrome-blood">{s.n}</p>
                    <h3 className="mt-3 font-display text-xl text-chrome-bright">{s.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-chrome-dim">{s.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          {/* Download CTA */}
          <section id="download" className="relative mx-auto w-full max-w-6xl px-5 pb-28 sm:px-8">
            <Reveal>
              <div className="hud-frame clip-panel relative overflow-hidden px-6 py-14 sm:px-12 sm:py-16">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(242,244,247,0.08),transparent_50%),radial-gradient(ellipse_at_90%_100%,rgba(155,28,46,0.16),transparent_45%)]" />
                <div className="relative max-w-xl">
                  <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-chrome-dim">
                    Get Dominator
                  </p>
                  <h2 className="mt-3 font-display text-3xl tracking-wide text-chrome-bright sm:text-4xl">
                    Download the latest Windows build.
                  </h2>
                  <p className="mt-4 text-base leading-relaxed text-chrome-dim">
                    Pulled live from GitHub Releases — Setup installer preferred. Portable builds land on
                    the releases page when available.
                  </p>
                  <div className="mt-8">
                    <DownloadButtons release={release} />
                  </div>
                </div>
              </div>
            </Reveal>
          </section>
        </main>

        <footer className="border-t border-chrome-silver/10">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <div className="flex items-center gap-2 text-chrome-dim">
              <ChromeMark size={16} />
              <span className="font-display tracking-wide text-chrome-silver">Dominator</span>
            </div>
            <p className="font-mono text-[11px] tracking-[0.12em] text-chrome-dim">
              Unofficial fan tool · Not affiliated with Riot Games
            </p>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[11px] uppercase tracking-[0.16em] text-chrome-dim hover:text-chrome-bright"
            >
              Source on GitHub
            </a>
          </div>
        </footer>
      </div>
    </>
  )
}
