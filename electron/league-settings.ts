import fs from 'fs';
import path from 'path';

export interface LeagueHudScales {
  hudScale: number; // 0–100 (Interface › HUD Scale)
  mapScale: number; // 0–100 (mapped from MinimapScale)
  width: number;
  height: number;
  globalScale: number;
  minimapScale: number;
  source: string;
}

const CANDIDATE_CFG = [
  path.join('C:', 'Riot Games', 'League of Legends', 'Config', 'game.cfg'),
  path.join('D:', 'Riot Games', 'League of Legends', 'Config', 'game.cfg'),
  path.join(process.env.USERPROFILE || '', 'Riot Games', 'League of Legends', 'Config', 'game.cfg'),
];

function parseCfg(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.+)\s*$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

/** Map League MinimapScale (often 0.5–2.0+) onto our 0–100 slider. */
export function minimapScaleToSlider(minimapScale: number): number {
  // Inverse of: 0.5 + (slider/100)*1.5  → covers up to MinimapScale 2.0
  const slider = ((minimapScale - 0.5) / 1.5) * 100;
  return Math.max(0, Math.min(100, Math.round(slider)));
}

/** Slider 0–100 → League MinimapScale (0.5–2.0). */
export function sliderToMinimapScale(slider: number): number {
  const s = Number.isFinite(slider) ? Math.max(0, Math.min(100, slider)) : 73;
  return 0.5 + (s / 100) * 1.5;
}

export function readLeagueHudScales(): LeagueHudScales | null {
  for (const cfgPath of CANDIDATE_CFG) {
    try {
      if (!fs.existsSync(cfgPath)) continue;
      const vals = parseCfg(fs.readFileSync(cfgPath, 'utf8'));
      const globalScale = Number.parseFloat(vals.GlobalScale ?? '0.2');
      const minimapScale = Number.parseFloat(vals.MinimapScale ?? '1');
      const width = Number.parseInt(vals.Width || '1920', 10);
      const height = Number.parseInt(vals.Height || '1080', 10);
      if (!Number.isFinite(globalScale) || !Number.isFinite(minimapScale)) continue;
      return {
        hudScale: Math.max(0, Math.min(100, Math.round(globalScale * 100))),
        mapScale: minimapScaleToSlider(minimapScale),
        width: Number.isFinite(width) ? width : 1920,
        height: Number.isFinite(height) ? height : 1080,
        globalScale,
        minimapScale,
        source: cfgPath,
      };
    } catch {
      // try next
    }
  }
  return null;
}
