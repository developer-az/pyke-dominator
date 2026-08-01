import React, { useEffect, useMemo, useState } from 'react';
import { normalizeChromeColor } from './chromeTheme';

/**
 * League anchors its bottom HUD cluster (spellbook/shop/portrait) to bottom-center
 * and the minimap to bottom-right, both flush against the screen edge — they don't
 * float with margins. Size responds to Interface > HUD Scale / Minimap Scale and to
 * vertical resolution (League's UI is height-driven, not width-driven).
 *
 * GlobalScale in game.cfg ranges roughly 0.2 (smallest, common on pro/high-level
 * configs) to 1.0 (largest). MinimapScale ranges roughly 0.5–2.0.
 * These are sane anchor-formula defaults — the in-game nudge controls (unlock the
 * overlay, Ctrl+Shift+U) let you fine-tune per-pixel to your exact client.
 */
function useLeagueGeometry(hudScale: number, mapScale: number) {
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
    const safeMap = Number.isFinite(mapScale) ? Math.max(0, Math.min(100, mapScale)) : 73;
    const s = vh / 1080;
    const g = safeHud / 100; // ~GlobalScale
    const m = 0.5 + (safeMap / 100) * 1.5; // ~MinimapScale, matches league-settings mapping

    // Bottom HUD cluster: width/height lerp across the practical GlobalScale range.
    const abilityW = Math.round((640 + 360 * g) * s);
    const abilityH = Math.round((88 + 44 * g) * s);
    // Minimap: lerp across MinimapScale 0.5–2.0.
    const mapNorm = (m - 0.5) / 1.5;
    const mapSize = Math.round((150 + 190 * mapNorm) * s);

    return { abilityW, abilityH, mapSize, safeHud, safeMap, g, m, vh, vw };
  }, [vh, vw, hudScale, mapScale]);
}

/** Small gothic thorn accent at a bracket tip — a rotated diamond, cheap to paint. */
function ThornTip({ style }: { style?: React.CSSProperties }) {
  return <span className="chrome-thorn-tip" style={style} aria-hidden />;
}

/**
 * Minimal alignment bracket: 4 corner marks only (no filled rect, no blur, no filter,
 * no animation) so the frame barely covers the playable area while still reading as
 * a deliberate chrome-and-thorns accent.
 */
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
}> = ({ hudScale = 20, mapScale = 88, enabled = true, chromeColor = '#d4d8de', calibration }) => {
  const geo = useLeagueGeometry(hudScale, mapScale);
  const color = normalizeChromeColor(chromeColor);
  const abilityCal = calibration?.ability ?? { dx: 0, dy: 0, dw: 0, dh: 0 };
  const mapCal = calibration?.minimap ?? { dx: 0, dy: 0, dw: 0, dh: 0 };

  if (!enabled) return null;

  const abilityWidth = Math.max(40, geo.abilityW + abilityCal.dw);
  const abilityHeight = Math.max(24, geo.abilityH + abilityCal.dh);
  const mapSize = Math.max(60, geo.mapSize + mapCal.dw);

  return (
    <div className="chrome-game-hud" aria-hidden style={{ ['--chrome-frame-color' as string]: color }}>
      <div
        className="chrome-frame-box"
        style={{
          left: '50%',
          bottom: 2 + abilityCal.dy,
          width: abilityWidth,
          height: abilityHeight,
          transform: `translateX(calc(-50% + ${abilityCal.dx}px))`,
        }}
      >
        <CornerBrackets color={color} armLength={14} />
      </div>
      <div
        className="chrome-frame-box"
        style={{
          right: 2 - mapCal.dx,
          bottom: 2 + mapCal.dy,
          width: mapSize,
          height: Math.max(60, geo.mapSize + mapCal.dh),
        }}
      >
        <CornerBrackets color={color} armLength={18} />
      </div>
    </div>
  );
};
