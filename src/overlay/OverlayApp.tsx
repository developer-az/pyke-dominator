import React, { useEffect, useMemo, useState } from 'react';
import {
  type Champion,
  type Build,
  type RunePage,
  type MatchupAnalysis,
} from '../logic/pykeLogic';
import { getProfile, loadStoredProfileId, type ProfileId } from '../logic/profiles';
import {
  buildInGameCues,
  formatGameTime,
  resolveAllyAdcName,
  resolveAllyMidName,
  type OverlayState,
} from './overlayLogic';
import { SummonerTimers } from '../components/SummonerTimers';
import { ChromeMark } from './ChromeMark';
import { ChromeGameHud } from './ChromeGameHud';

function damageTypeFromTags(tags: string[]): Champion['damageType'] {
  return tags.includes('Mage') || tags.includes('Support') ? 'Magic' : 'Physical';
}

function emptyCalibration(): FrameCalibration {
  return { dx: 0, dy: 0, dw: 0, dh: 0 };
}

function NudgeGroup({
  label,
  onNudge,
}: {
  label: string;
  onNudge: (field: 'dx' | 'dy' | 'dw' | 'dh', delta: number) => void;
}) {
  return (
    <div className="hud-nudge-group" title={`Nudge ${label} alignment`}>
      <span className="text-[8px] uppercase tracking-wider opacity-70 mr-1">{label}</span>
      <button type="button" className="hud-nudge-btn" onClick={() => onNudge('dx', -2)}>←</button>
      <button type="button" className="hud-nudge-btn" onClick={() => onNudge('dx', 2)}>→</button>
      <button type="button" className="hud-nudge-btn" onClick={() => onNudge('dy', 2)}>↑</button>
      <button type="button" className="hud-nudge-btn" onClick={() => onNudge('dy', -2)}>↓</button>
      <button type="button" className="hud-nudge-btn" onClick={() => onNudge('dw', -4)}>W-</button>
      <button type="button" className="hud-nudge-btn" onClick={() => onNudge('dw', 4)}>W+</button>
      <button type="button" className="hud-nudge-btn" onClick={() => onNudge('dh', -4)}>H-</button>
      <button type="button" className="hud-nudge-btn" onClick={() => onNudge('dh', 4)}>H+</button>
    </div>
  );
}

export const OverlayApp: React.FC = () => {
  const [state, setState] = useState<OverlayState>({ inGame: false });
  const [champions, setChampions] = useState<Champion[]>([]);
  const [clickThrough, setClickThrough] = useState(true);
  const [hudScale, setHudScale] = useState(20);
  const [mapScale, setMapScale] = useState(88);
  const [chromeColor, setChromeColor] = useState('#d4d8de');
  const [collapsed, setCollapsed] = useState(false);
  const [calibration, setCalibration] = useState<OverlayCalibration>({ ability: emptyCalibration(), minimap: emptyCalibration() });
  const [profileId, setProfileId] = useState<ProfileId>(() =>
    typeof window !== 'undefined' ? loadStoredProfileId() : 'pyke-support'
  );
  const profile = useMemo(() => getProfile(profileId), [profileId]);

  // Load champion catalog for profile logic
  useEffect(() => {
    fetch('https://ddragon.leagueoflegends.com/api/versions.json')
      .then((res) => res.json())
      .then((versions) => {
        const latest = versions[0] || '15.1.1';
        return fetch(`https://ddragon.leagueoflegends.com/cdn/${latest}/data/en_US/champion.json`);
      })
      .catch(() => fetch('https://ddragon.leagueoflegends.com/cdn/15.1.1/data/en_US/champion.json'))
      .then((res) => res.json())
      .then((data) => {
        interface ChampionData {
          id: string;
          key: string;
          name: string;
          tags: string[];
        }
        const list = (Object.values(data.data) as ChampionData[]).map((c) => ({
          id: c.id,
          key: c.key,
          name: c.name,
          tags: c.tags,
          damageType: damageTypeFromTags(c.tags),
        }));
        setChampions(list);
      })
      .catch((err) => console.error('Overlay champion load failed:', err));
  }, []);

  // Subscribe to main-process overlay pushes
  useEffect(() => {
    if (!window.electronAPI?.onOverlayUpdate) return;

    const unsubUpdate = window.electronAPI.onOverlayUpdate((payload) => {
      const next = payload as OverlayState;
      setState(next);
      if (next.profileHint === 'yone-mid' || next.profileHint === 'pyke-support') {
        setProfileId(next.profileHint);
      } else if (next.isYone) {
        setProfileId('yone-mid');
      } else if (next.isPyke) {
        setProfileId('pyke-support');
      }
    });

    const unsubMeta = window.electronAPI.onOverlayMeta?.((payload) => {
      const meta = payload as {
        clickThrough?: boolean;
        hudScale?: number;
        mapScale?: number;
        chromeColor?: string;
        calibration?: OverlayCalibration;
      };
      if (typeof meta.clickThrough === 'boolean') {
        setClickThrough(meta.clickThrough);
      }
      if (typeof meta.hudScale === 'number') {
        setHudScale(meta.hudScale);
      }
      if (typeof meta.mapScale === 'number') {
        setMapScale(meta.mapScale);
      }
      if (typeof meta.chromeColor === 'string') {
        setChromeColor(meta.chromeColor);
      }
      if (meta.calibration) {
        setCalibration(meta.calibration);
      }
    });

    window.electronAPI.getOverlayStatus?.().then((res) => {
      if (res?.success && typeof res.clickThrough === 'boolean') {
        setClickThrough(res.clickThrough);
      }
      if (res?.success && typeof res.hudScale === 'number') {
        setHudScale(res.hudScale);
      }
      if (res?.success && typeof res.mapScale === 'number') {
        setMapScale(res.mapScale);
      }
      if (res?.success && typeof res.chromeColor === 'string') {
        setChromeColor(res.chromeColor);
      }
      if (res?.success && res.calibration) {
        setCalibration(res.calibration);
      }
    });

    return () => {
      unsubUpdate?.();
      unsubMeta?.();
    };
  }, []);

  const enemyChampions: Champion[] = useMemo(() => {
    if (!champions.length) return [];

    if (state.enemies && state.enemies.length > 0) {
      return state.enemies
        .map((e) => {
          const found = champions.find(
            (c) => c.name.toLowerCase() === e.championName.toLowerCase() || c.id.toLowerCase() === e.championName.toLowerCase()
          );
          return found || null;
        })
        .filter((c): c is Champion => c !== null);
    }

    // Fallback: last champ select
    if (state.cachedChampSelectEnemies?.length) {
      return state.cachedChampSelectEnemies
        .map((e) => {
          if (e.championId) {
            const byKey = champions.find((c) => c.key === String(e.championId));
            if (byKey) return byKey;
          }
          if (e.championName) {
            return champions.find((c) => c.name.toLowerCase() === e.championName!.toLowerCase()) || null;
          }
          return null;
        })
        .filter((c): c is Champion => c !== null);
    }

    return [];
  }, [state.enemies, state.cachedChampSelectEnemies, champions]);

  const yourAdcChampion: Champion | null = useMemo(() => {
    if (!champions.length) return null;
    const name = resolveAllyAdcName(state.allies, champions);
    if (!name) return null;
    return (
      champions.find(
        (c) => c.name.toLowerCase() === name.toLowerCase() || c.id.toLowerCase() === name.toLowerCase()
      ) || null
    );
  }, [state.allies, champions]);

  const yourMidChampion: Champion | null = useMemo(() => {
    if (!champions.length) return null;
    const name = resolveAllyMidName(state.allies, champions);
    if (!name) return null;
    return (
      champions.find(
        (c) => c.name.toLowerCase() === name.toLowerCase() || c.id.toLowerCase() === name.toLowerCase()
      ) || null
    );
  }, [state.allies, champions]);

  const build: Build | null = useMemo(
    () =>
      enemyChampions.length > 0
        ? profile.calculateBuild(enemyChampions, yourAdcChampion, yourMidChampion)
        : null,
    [enemyChampions, yourAdcChampion, yourMidChampion, profile]
  );

  const runes: RunePage | null = useMemo(
    () =>
      enemyChampions.length > 0 && build
        ? profile.calculateRunes(enemyChampions, build, yourAdcChampion, yourMidChampion)
        : null,
    [enemyChampions, build, yourAdcChampion, yourMidChampion, profile]
  );

  const analysis: MatchupAnalysis | null = useMemo(
    () =>
      enemyChampions.length > 0 && build
        ? profile.analyzeMatchup(enemyChampions, build, yourAdcChampion, yourMidChampion)
        : null,
    [enemyChampions, build, yourAdcChampion, yourMidChampion, profile]
  );

  const cues = useMemo(
    () => buildInGameCues(state, { analysis, build, profileId }),
    [state, analysis, build, profileId]
  );

  const handleHide = () => {
    void window.electronAPI?.toggleOverlay?.().catch((error) => {
      console.error('Unable to hide overlay:', error);
    });
  };

  const handleToggleClicks = () => {
    void window.electronAPI?.toggleOverlayClickThrough?.()
      .then((res) => {
        if (res?.success && typeof res.clickThrough === 'boolean') {
          setClickThrough(res.clickThrough);
        }
      })
      .catch((error) => console.error('Unable to change overlay mode:', error));
  };

  const nudge = (target: 'ability' | 'minimap', field: 'dx' | 'dy' | 'dw' | 'dh', delta: number) => {
    void window.electronAPI?.adjustOverlayCalibration?.(target, field, delta)
      .then((res) => {
        if (res?.success && res.calibration) setCalibration(res.calibration);
      })
      .catch(() => {});
  };

  const handleResetCalibration = () => {
    void window.electronAPI?.resetOverlayCalibration?.()
      .then((res) => {
        if (res?.success && res.calibration) setCalibration(res.calibration);
      })
      .catch(() => {});
  };

  if (!state.inGame) {
    return (
      <div className="w-screen h-screen pointer-events-none bg-transparent">
        <div className="hud-overlay-controls absolute top-4 right-4 text-[10px] pointer-events-auto">
          <ChromeMark className="hud-chrome-mark" size={12} />
          <span className="tracking-[0.2em] uppercase">Waiting for match</span>
        </div>
      </div>
    );
  }

  const profileMatchesLocal =
    !state.localPlayer?.championName ||
    state.localPlayer.championName.toLowerCase() === profile.championId.toLowerCase();

  const gameModeLabel = state.gameMode === 'PRACTICETOOL'
    ? 'Practice Tool'
    : state.gameMode || 'In Game';

  const runeSummary =
    profileId === 'yone-mid'
      ? `${runes?.selectedPerkIds[0] === 8021 ? 'Fleet' : 'Lethal Tempo'} · Resolve`
      : `Hail of Blades · ${runes?.subStyleId === 8400 ? 'Resolve' : 'Precision'}`;

  return (
    <div
      className="w-screen h-screen bg-transparent overflow-hidden select-none"
      style={{ ['--overlay-scale' as string]: `${0.75 + hudScale / 200}` }}
    >
      {/* Alignment corner-marks stay on while in-game — lightweight, static, no blur/animation */}
      <ChromeGameHud
        hudScale={Number.isFinite(hudScale) ? hudScale : 20}
        mapScale={Number.isFinite(mapScale) ? mapScale : 88}
        enabled
        chromeColor={chromeColor}
        calibration={calibration}
      />

      {!clickThrough && (
      <div className="hud-overlay-controls absolute top-3 left-1/2 -translate-x-1/2 pointer-events-auto">
        <ChromeMark className="hud-chrome-mark" size={11} />
        <button
          type="button"
          onClick={handleHide}
          className="hud-btn"
          title="Hide overlay (Ctrl+Shift+H)"
        >
          Hide
        </button>
        <button
          type="button"
          onClick={handleToggleClicks}
          className="hud-btn"
          title="Lock overlay and pass clicks to League (Ctrl+Shift+U)"
        >
          Lock overlay
        </button>
        <NudgeGroup label="Ability" onNudge={(field, delta) => nudge('ability', field, delta)} />
        <NudgeGroup label="Map" onNudge={(field, delta) => nudge('minimap', field, delta)} />
        <button type="button" onClick={handleResetCalibration} className="hud-nudge-btn" title="Reset alignment marks to default">
          Reset fit
        </button>
        <span className="px-1 text-[8px] tracking-wider opacity-50">
          ⌃⇧H / U
        </span>
      </div>
      )}

      <div
        className={`hud-overlay-scale absolute top-16 right-4 w-[280px] ${collapsed ? 'opacity-70' : 'opacity-100'}`}
      >
        <div className="hud-overlay-panel">
          <span className="hud-corner hud-corner-tl" aria-hidden />
          <span className="hud-corner hud-corner-br" aria-hidden />
          <span className="hud-rail hud-rail-top" aria-hidden />

          <div
            className="hud-chrome-header"
            style={!clickThrough ? { WebkitAppRegion: 'drag' } as React.CSSProperties : undefined}
          >
            <div className="flex items-center gap-2 min-w-0">
              <ChromeMark className="hud-chrome-mark" size={13} />
              <div className="min-w-0">
                <div className="hud-chrome-title truncate">
                  {profile.brandTitle}
                </div>
                <div className="hud-chrome-meta">
                  {profile.shortLabel} · {gameModeLabel}
                  {typeof state.gameTime === 'number' && state.gameTime > 0
                    ? ` · ${formatGameTime(state.gameTime)}`
                    : ''}
                  {state.localPlayer ? ` · Lv ${state.localPlayer.level}` : ''}
                </div>
              </div>
            </div>
            {!clickThrough && (
              <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
                <button
                  type="button"
                  onClick={() => setCollapsed((c) => !c)}
                  className="hud-btn"
                >
                  {collapsed ? 'Expand' : 'Min'}
                </button>
              </div>
            )}
          </div>

          {!collapsed && (
            <div className="relative z-10 p-2.5 space-y-2 max-h-[60vh] overflow-y-auto">
              {!profileMatchesLocal ? (
                <div className="hud-chrome-cue hud-chrome-cue--warn text-[11px]">
                  Playing <strong>{state.localPlayer?.championName || 'unknown'}</strong> —
                  switch profile in the main client for full cues ({profile.label} loaded).
                </div>
              ) : null}

              {cues.map((cue) => (
                <div
                  key={cue.id}
                  className={`hud-chrome-cue hud-chrome-cue--${cue.urgency}`}
                >
                  <div className="font-semibold uppercase tracking-[0.12em] text-[9px] opacity-90">
                    {cue.label}
                  </div>
                  <div className="mt-0.5 opacity-85 text-[11px] leading-snug">{cue.detail}</div>
                </div>
              ))}

              {state.enemyBotSummoners && state.enemyBotSummoners.length > 0 && (
                <SummonerTimers lanes={state.enemyBotSummoners} compact />
              )}

              {build && (
                <div className="flex flex-wrap gap-1 items-center">
                  {build.core.map((item) => (
                    <span key={`core-${item.id}`} className="hud-chip !text-[10px]" title={item.reason}>
                      {item.name}
                    </span>
                  ))}
                  <span className="hud-chip !text-[10px] !text-[#aeb4be]" title={build.boots.reason}>
                    {build.boots.name}
                  </span>
                </div>
              )}

              {runes && (
                <p className="text-[10px] text-[#8a919c] font-mono tracking-wide">
                  {runeSummary}
                </p>
              )}

              {analysis && (
                <div className="border-t border-white/10 pt-1.5">
                  <div className="text-[11px] font-semibold text-[#e4e6ea]">
                    {analysis.aggressionLevel} · {analysis.title}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {analysis.primaryTargets.slice(0, 2).map((t) => (
                      <span key={t} className="hud-chip hud-accent-blood !text-[10px]">
                        Prey {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {!build && (
                <p className="text-[11px] text-[#6b7280] font-mono tracking-wide">
                  Waiting for enemy data…
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
