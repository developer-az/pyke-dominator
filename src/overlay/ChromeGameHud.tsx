import React, { useEffect, useMemo, useState } from 'react';
import { normalizeChromeColor } from './chromeTheme';

/**
 * League anchors its bottom HUD cluster (spellbook/shop/portrait) to bottom-center
 * and the minimap to bottom-right. Size responds to Interface > HUD Scale / Minimap Scale.
 *
 * Scale factor prefers League's configured Height from game.cfg when provided so
 * windowed / DPI mismatch vs overlay bounds doesn't skew both frames unequally.
 *
 * GlobalScale ~0.2–1.0 → hudScale 0–100.
 * MinimapScale ~0.5–2.0 → mapScale 0–100 via 0.5 + (slider/100)*1.5.
 */
function useLeagueGeometry(
  hudScale: number,
  mapScale: number,
  gameWidth?: number,
  gameHeight?: number
) {
  const [vh, setVh] = useState(() => (typeof window !== 'undefined' ? window.innerHeight : 1080));
  const [vw, setVw] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1920));

  useEffect(() => {
    const onResize = () => {
      setVh(window.innerHeight);
      setVw(window.innerWidth);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return useMemo(() => {
    const safeHud = Number.isFinite(hudScale) ? Math.max(0, Math.min(100, hudScale)) : 20;
    const safeMap = Number.isFinite(mapScale) ? Math.max(0, Math.min(100, mapScale)) : 33;
    // League UI is height-driven vs a 1080 design baseline. Prefer overlay
    // viewport height (borderless ≈ game). game.cfg W/H is for labels / future
    // letterbox offsets — do not divide by cfg height or 1440p collapses to s=1.
    const refH = gameHeight && gameHeight > 0 ? gameHeight : 1080;
    const refW = gameWidth && gameWidth > 0 ? gameWidth : 1920;
    const s = (vh > 0 ? vh : 1080) / 1080;

    const g = safeHud / 100; // ~GlobalScale
    const m = 0.5 + (safeMap / 100) * 1.5; // ~MinimapScale

    // Empirical SR HUD cluster sizes at 1080p across GlobalScale.
    const abilityW = Math.round((620 + 380 * g) * s);
    const abilityH = Math.round((82 + 50 * g) * s);
    // Minimap: MinimapScale 0.5–2.0 → ~150–340px at 1080p
    const mapNorm = (m - 0.5) / 1.5;
    const mapSize = Math.round((150 + 190 * mapNorm) * s);

    return { abilityW, abilityH, mapSize, safeHud, safeMap, g, m, vh, vw, s, refH, refW };
  }, [vh, vw, hudScale, mapScale, gameWidth, gameHeight]);
}

/** Small gothic thorn accent at a bracket tip — a rotated diamond, cheap to paint. */
function ThornTip({ style }: { style?: React.CSSProperties }) {
  return <span className="chrome-thorn-tip" style={style} aria-hidden />;
}

function CornerBrackets({ color, armLength = 16 }: { color: string; armLength?: number }) {
  const corners: Array<{ key: string; style: React.CSSProperties; tip: React.CSSProperties }> = [
    {
      key: 'tl',
      style: { top: 0, left: 0, borderTop: '2px solid', borderLeft: '2px solid' },
      tip: { top: -3, left: -3 },
    },
    {
      key: 'tr',
      style: { top: 0, right: 0, borderTop: '2px solid', borderRight: '2px solid' },
      tip: { top: -3, right: -3 },
    },
    {
      key: 'bl',
      style: { bottom: 0, left: 0, borderBottom: '2px solid', borderLeft: '2px solid' },
      tip: { bottom: -3, left: -3 },
    },
    {
      key: 'br',
      style: { bottom: 0, right: 0, borderBottom: '2px solid', borderRight: '2px solid' },
      tip: { bottom: -3, right: -3 },
    },
  ];

  return (
    <>
      {corners.map((c) => (
        <span
          key={c.key}
          className="chrome-corner-bracket"
          style={{ width: armLength, height: armLength, borderColor: color, ...c.style }}
        >
          <ThornTip style={{ ...c.tip, background: color }} />
        </span>
      ))}
    </>
  );
}

export const ChromeGameHud: React.FC<{
  hudScale?: number;
  mapScale?: number;
  enabled?: boolean;
  chromeColor?: string;
  calibration?: OverlayCalibration;
  /** Show filled guides + size labels so you can match League's HUD/minimap. */
  showGuides?: boolean;
  gameWidth?: number;
  gameHeight?: number;
}> = ({
  hudScale = 20,
  mapScale = 33,
  enabled = true,
  chromeColor = '#d4d8de',
  calibration,
  showGuides = false,
  gameWidth,
  gameHeight,
}) => {
  const geo = useLeagueGeometry(hudScale, mapScale, gameWidth, gameHeight);
  const color = normalizeChromeColor(chromeColor);
  const abilityCal = calibration?.ability ?? { dx: 0, dy: 0, dw: 0, dh: 0 };
  const mapCal = calibration?.minimap ?? { dx: 0, dy: 0, dw: 0, dh: 0 };

  if (!enabled) return null;

  const abilityWidth = Math.max(40, geo.abilityW + abilityCal.dw);
  const abilityHeight = Math.max(24, geo.abilityH + abilityCal.dh);
  const mapW = Math.max(60, geo.mapSize + mapCal.dw);
  const mapH = Math.max(60, geo.mapSize + mapCal.dh);

  return (
    <div className="chrome-game-hud" aria-hidden style={{ ['--chrome-frame-color' as string]: color }}>
      <div
        className={`chrome-frame-box ${showGuides ? 'chrome-frame-guide' : ''}`}
        style={{
          left: '50%',
          bottom: 2 + abilityCal.dy,
          width: abilityWidth,
          height: abilityHeight,
          transform: `translateX(calc(-50% + ${abilityCal.dx}px))`,
        }}
      >
        <CornerBrackets color={color} armLength={14} />
        {showGuides && (
          <span className="chrome-frame-label">
            ABILITY HUD
            <br />
            {abilityWidth}×{abilityHeight} · HUD {geo.safeHud}
          </span>
        )}
      </div>
      <div
        className={`chrome-frame-box ${showGuides ? 'chrome-frame-guide chrome-frame-guide-map' : ''}`}
        style={{
          right: 2 - mapCal.dx,
          bottom: 2 + mapCal.dy,
          width: mapW,
          height: mapH,
        }}
      >
        <CornerBrackets color={color} armLength={18} />
        {showGuides && (
          <span className="chrome-frame-label">
            MINIMAP
            <br />
            {mapW}×{mapH} · Map {geo.safeMap}
          </span>
        )}
      </div>
      {showGuides && (
        <div className="chrome-align-banner">
          Align frames to your League HUD + minimap · Sync LoL scales first · Nudge until edges match
          {geo.refH ? ` · cfg ${geo.refW}×${geo.refH}` : ''}
        </div>
      )}
    </div>
  );
};
