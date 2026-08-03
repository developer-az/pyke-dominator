# Pyke Dominator

<div align="center">

**Desktop companion for Pyke support — matchup analysis, loadout export, and a live in-game overlay**

[![Version](https://img.shields.io/badge/version-1.3.0-blue.svg)](https://github.com/developer-az/pyke-dominator/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.2-blue)](https://react.dev/)
[![Electron](https://img.shields.io/badge/Electron-39-blue)](https://www.electronjs.org/)

</div>

---

## Overview

**Pyke Dominator** is a Windows desktop app for League of Legends Pyke support players. It connects to the League Client, fills enemy picks in champion select, recommends items and runes for the matchup, exports loadouts into the client, and shows a lightweight chrome overlay while you play.

Designed for ranked climbing and practice — clear recommendations, one-click export, and an overlay that stays out of the way when locked.

---

## Features

### Matchup & loadout

- **Enemy composition analysis** — Top, Jungle, Mid, Bot, Support
- **Item builds** — Core path, boots, and situational picks (Edge of Night, Maw, Serpent’s Fang, and more) based on tanks, burst, CC, and magic threats
- **Rune pages** — Primary and secondary trees adapted to poke, CC, and lane shape, with short explanations
- **Dominance gauge** — Quick read on how favorable the bot-lane / team setup is for Pyke
- **Ally context** — Optional ADC and Mid picks for 2v2 and roam-aware scoring
- **Lane insights** — Difficulty, lane tips, all-in windows, and damage estimates at key levels

### League Client integration

- Auto-connects when the League Client is running
- Detects champion select and fills enemy roles as picks lock in
- **Export runes** and **item sets** into the client with one action
- Clears back to a ready state after the match so the next lobby starts clean

### In-game overlay

- Transparent chrome frames around the ability bar and minimap
- Live-client aware: appears when a match is active, tears down after the game
- **HUD Scale** and **Minimap Scale** sliders (0–100) to match League’s Interface settings
- **Sync LoL** — reads `GlobalScale` / `MinimapScale` from League’s `game.cfg`
- Per-pixel **calibration** (nudge ability / map frames) when unlocked
- Custom **chrome color** with presets
- Performance-minded: overlay is created only in-game; hidden overlay is throttled so it does not fight League for GPU/CPU

---

## Install (Windows)

### From a release (recommended)

1. Open [Releases](https://github.com/developer-az/pyke-dominator/releases) and download **v1.3.0**
2. Choose either:
   - **Portable** — `Pyke Dominator 1.3.0.exe` (run directly, no install)
   - **Setup** — `Pyke Dominator Setup 1.3.0.exe` (NSIS installer)
3. Launch the app with the League Client open (or start League afterward — it reconnects automatically)

### From source

```bash
git clone https://github.com/developer-az/pyke-dominator.git
cd pyke-dominator
npm install
npm run dist
```

Installer and portable builds land in the `release/` folder.

---

## Quick start

1. Start **League of Legends**, then open **Pyke Dominator**
2. Enter champion select as Pyke (or any role — enemy fills still apply)
3. Review the recommended **items**, **runes**, and **matchup** panel
4. Click **Export** to push the rune page and item set into the client
5. When the game starts, the overlay appears automatically (if not hidden)

You can also pick enemies manually with the searchable champion dropdowns for practice or when LCU is unavailable (Demo mode).

---

## Overlay controls

| Action | Shortcut / control |
|--------|--------------------|
| Show / hide overlay | **Ctrl+Shift+H** (or **Overlay On/Off** in the app) |
| Lock (click-through) / unlock (move & calibrate) | **Ctrl+Shift+U** |
| Match League HUD / minimap scale | Sliders **HUD** / **Map**, or **Sync LoL** |
| Chrome accent color | Color picker + presets in the toolbar |
| Fine-tune frame alignment | Unlock overlay → nudge Ability / Map marks → optional Reset |

When unlocked, drag the compact overlay window and use the Ability / Map nudge buttons (← → ↑ ↓, W±, H±) so the chrome lines up with your exact client. Calibration is saved between sessions.

### Display mode tip (important for FPS)

Set League’s **Video → Display Mode** to **Borderless**.

Overlays on top of **exclusive Fullscreen** force Windows to recompose every frame and can cost real FPS. Borderless keeps the overlay cheap and the game responsive.

---

## Usage notes

- **LCU** — Requires the League Client running. Champion auto-fill works in champion select; export needs a live client session.
- **Post-game reset** — After a match ends, champ-select caches and overlay state clear so the next game starts fresh.
- **Hotkey conflicts** — If Ctrl+Shift+H or Ctrl+Shift+U do nothing, another app may own those shortcuts; use the in-app Overlay / Lock buttons instead.
- **Data** — Champions, items, and runes load from Riot’s Data Dragon CDN (latest patch when available).

---

## Development

### Prerequisites

- Node.js 18+
- npm
- Windows (Electron desktop features and LCU/overlay)

### Commands

```bash
# Web UI only
npm run dev

# Desktop app with Vite + Electron (Windows helper)
npm run dev:electron:win
# or
npm run dev:electron

# Production web build
npm run build

# Full Windows installers (NSIS + portable) → release/
npm run dist

# Unpackaged app dir (faster local check)
npm run pack

# Product landing site (website/)
npm run website:dev
npm run website:build
```

| Script | Purpose |
|--------|---------|
| `npm run dev` | Vite dev server |
| `npm run dev:electron` / `dev:electron:win` | Electron + hot reload |
| `npm run build` | Web production build |
| `npm run electron:build` | Compile Electron main process |
| `npm run dist` | Build + electron-builder (NSIS + portable) |
| `npm run pack` | Build + electron-builder `--dir` |
| `npm run website:dev` | Dominator marketing site (see `website/`) |
| `npm run website:build` | Build marketing site for Vercel / GitHub Pages |
| `npm run lint` | ESLint |
| `npm run preview` | Preview production web build |

### Project layout

```
pyke-dominator/
├── electron/           # Main process, LCU, live client, overlay window
├── src/
│   ├── components/     # UI (champion select, build display, gauge, HUD frame)
│   ├── data/           # Data Dragon services
│   ├── logic/          # Build / rune / matchup logic
│   ├── overlay/        # In-game overlay React app
│   └── App.tsx         # Main window
├── overlay.html        # Overlay entry
├── scripts/            # Perf / geometry helpers
└── release/            # electron-builder output
```

### Stack

- React 19 · TypeScript 5.9 · Vite 7 · Electron 39 · Tailwind CSS 3.4
- **Data Dragon** — champions, runes, icons
- **LCU** — champ select session, rune pages, item sets
- **Live Client API** — in-game player/state for the overlay

---

## Contributing

Pull requests are welcome.

1. Fork the repo and create a feature branch
2. Keep TypeScript / ESLint clean
3. Test LCU export and overlay hotkeys on Windows when you touch those paths
4. Open a PR with a short description of the change

---

## License

MIT — see [LICENSE](LICENSE).

---

## Support

- **Issues**: [GitHub Issues](https://github.com/developer-az/pyke-dominator/issues)
- **Releases**: [GitHub Releases](https://github.com/developer-az/pyke-dominator/releases)
- **Repository**: [developer-az/pyke-dominator](https://github.com/developer-az/pyke-dominator)

---

<div align="center">

**Built for Pyke players**

*Pyke Dominator is not endorsed by Riot Games and does not reflect the views or opinions of Riot Games or anyone officially involved in producing or managing League of Legends. League of Legends and Riot Games are trademarks or registered trademarks of Riot Games, Inc.*

</div>
