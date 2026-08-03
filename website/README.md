# Dominator website

Cinematic product landing for Dominator — download CTA, features, and profiles.

## Develop

```bash
cd website
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

### Base path

| Host | Command / env |
|------|----------------|
| Vercel (root = `website/`) | default `base: /` |
| GitHub Pages project site | `VITE_BASE=/pyke-dominator/ npm run build` |

## Deploy

- **Vercel** — import the repo, set Root Directory to `website`, framework Vite.
- **GitHub Pages** — enable Pages (GitHub Actions). Workflow: [`.github/workflows/pages.yml`](../.github/workflows/pages.yml).

Download buttons resolve the latest Windows `.exe` from the GitHub Releases API at runtime (Setup preferred), with a fallback to the releases page.
