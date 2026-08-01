import React, { useState, useEffect } from 'react';
import { BuildDisplay } from './components/BuildDisplay';
import { ChampionSelect } from './components/ChampionSelect';
import { DominanceGauge } from './components/DominanceGauge';
import { HudFrame } from './components/HudFrame';
import { calculateBuild, calculateRunes, analyzeMatchup, calculateDominanceFactor } from './logic/pykeLogic';
import type { Champion, Build, RunePage, MatchupAnalysis, DominanceMetrics } from './logic/pykeLogic';
import { ChromeMark } from './overlay/ChromeMark';
import { CHROME_COLOR_PRESETS, normalizeChromeColor } from './overlay/chromeTheme';



const App: React.FC = () => {
  const [champions, setChampions] = useState<Champion[]>([]);
  const emptySelections = (): { [key: string]: Champion | null } => ({
    Top: null,
    Jungle: null,
    Mid: null,
    Bot: null,
    Support: null,
    YourADC: null,
    YourMid: null,
  });
  const [selections, setSelections] = useState<{ [key: string]: Champion | null }>(emptySelections);
  const [build, setBuild] = useState<Build | null>(null);
  const [runes, setRunes] = useState<RunePage | null>(null);
  const [analysis, setAnalysis] = useState<MatchupAnalysis | null>(null);
  const [dominance, setDominance] = useState<DominanceMetrics | null>(null);
  const [lcuConnected, setLcuConnected] = useState(false);
  const [exportStatus, setExportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [overlayInGame, setOverlayInGame] = useState(false);
  const wasInGameRef = React.useRef(false);
  const [overlayClickThrough, setOverlayClickThrough] = useState(true);
  const [hudScale, setHudScale] = useState(20);
  const [mapScale, setMapScale] = useState(88);
  const [chromeColor, setChromeColor] = useState('#d4d8de');

  // Fetch Champions
  useEffect(() => {
    // Try to fetch latest version first
    fetch('https://ddragon.leagueoflegends.com/api/versions.json')
      .then(res => res.json())
      .then(versions => {
        const latestVersion = versions[0] || '15.1.1';
        return fetch(`https://ddragon.leagueoflegends.com/cdn/${latestVersion}/data/en_US/champion.json`);
      })
      .catch(() => {
        // Fallback to known version
        return fetch('https://ddragon.leagueoflegends.com/cdn/15.1.1/data/en_US/champion.json');
      })
      .then(res => res.json())
      .then(data => {
        interface ChampionData {
          id: string;
          key: string;
          name: string;
          tags: string[];
        }

        const championsData = Object.values(data.data) as ChampionData[];
        const list: Champion[] = championsData.map((c: ChampionData) => ({
          id: c.id,
          key: c.key,
          name: c.name,
          tags: c.tags,
          damageType: c.tags.includes('Mage') || c.tags.includes('Support') ? 'Magic' : 'Physical' // Simplified approximation
        }));
        setChampions(list);
      })
      .catch(error => {
        console.error('Failed to fetch champions:', error);
      });
  }, []);

  // LCU Connection via IPC — retry until Live (client may launch after the app)
  useEffect(() => {
    if (!window.electronAPI) return;

    let cancelled = false;
    let retryTimer: ReturnType<typeof setInterval> | null = null;

    const tryConnect = () => {
      if (!window.electronAPI || cancelled) return;
      window.electronAPI.connectLCU().then(res => {
        if (cancelled) return;
        if (res && res.success) {
          setLcuConnected(true);
          if (retryTimer) {
            clearInterval(retryTimer);
            retryTimer = null;
          }
        }
      }).catch(() => { /* keep retrying */ });
    };

    tryConnect();
    retryTimer = setInterval(tryConnect, 5000);

    window.electronAPI.getOverlayStatus?.().then((res) => {
      if (res?.success) {
        setOverlayVisible(res.visible);
        setOverlayInGame(res.inGame);
        setOverlayClickThrough(res.clickThrough);
        setHudScale(res.hudScale);
        if (typeof res.mapScale === 'number') setMapScale(res.mapScale);
        if (typeof res.chromeColor === 'string') setChromeColor(res.chromeColor);
      }
    });

    const unsubVis = window.electronAPI.onOverlayVisibilityChanged?.((payload) => {
      setOverlayVisible(payload.visible);
    });
    const unsubMeta = window.electronAPI.onOverlayMeta?.((payload) => {
      const meta = payload as { clickThrough?: boolean; hudScale?: number; mapScale?: number; chromeColor?: string };
      if (typeof meta.clickThrough === 'boolean') setOverlayClickThrough(meta.clickThrough);
      if (typeof meta.hudScale === 'number') setHudScale(meta.hudScale);
      if (typeof meta.mapScale === 'number') setMapScale(meta.mapScale);
      if (typeof meta.chromeColor === 'string') setChromeColor(meta.chromeColor);
    });

    return () => {
      cancelled = true;
      if (retryTimer) clearInterval(retryTimer);
      unsubVis?.();
      unsubMeta?.();
    };
  }, []);

  // Track overlay in-game state from pushes (shared channel also used by overlay window)
  useEffect(() => {
    if (!window.electronAPI?.onOverlayUpdate) return;
    const unsub = window.electronAPI.onOverlayUpdate((payload) => {
      const data = payload as { inGame?: boolean };
      if (typeof data.inGame === 'boolean') {
        setOverlayInGame(data.inGame);
        // Match ended → clear champ-select / live leftovers so UI is ready for next lobby
        if (wasInGameRef.current && !data.inGame) {
          setSelections(emptySelections());
          setBuild(null);
          setRunes(null);
          setAnalysis(null);
          setDominance(null);
          setExportStatus('idle');
        }
        wasInGameRef.current = data.inGame;
      }
    });
    return () => {
      unsub?.();
    };
  }, []);

  // Auto-Detect Logic (Polling)
  useEffect(() => {
    if (!lcuConnected || !window.electronAPI || champions.length === 0) return;

    let pollInFlight = false;

    const poll = async () => {
      // Performance: skip while hidden OR while a match is live (main is minimized /
      // champ select is irrelevant — avoid competing with League for LCU + CPU).
      if (document.hidden || overlayInGame) return;
      // Avoid stacking overlapping requests if one poll runs long
      if (pollInFlight) return;

      if (!window.electronAPI) return;
      pollInFlight = true;
      try {
        const res = await window.electronAPI.requestLCU('GET', '/lol-champ-select/v1/session');

        // Handle 404 gracefully (not in champ select) or other errors
        if (!res.success) {
          // If it's a 404, that's expected when not in champ select - silently ignore
          if (res.error && res.error.includes('404')) {
            return; // Not in champ select, this is normal
          }
          // Other errors might be connection issues, but don't spam console
          return;
        }

        if (res.success && res.data) {
          interface TeamMember {
            championId?: number;
            cellId?: number;
            assignedPosition?: string;
            teamPosition?: string;
            position?: string;
          }

          interface LCUSession {
            theirTeam?: TeamMember[];
            myTeam?: TeamMember[];
            localPlayerCellId?: number;
          }

          const sessionData = res.data as LCUSession;
          const theirTeam = sessionData.theirTeam;
          const myTeam = sessionData.myTeam;
          const localPlayerCellId = sessionData.localPlayerCellId;
          if (Array.isArray(theirTeam) || Array.isArray(myTeam)) {
            setSelections(prev => {
              const newSelections = { ...prev };
              let hasUpdates = false;

              // Map LCU role names to our role names
              const roleMap: { [key: string]: string } = {
                'TOP': 'Top',
                'JUNGLE': 'Jungle',
                'MIDDLE': 'Mid',
                'BOTTOM': 'Bot',
                'UTILITY': 'Support'
              };

              if (Array.isArray(theirTeam)) {
                theirTeam.forEach((member: TeamMember) => {
                  const championId = member.championId;
                  if (championId !== undefined && championId !== 0) {
                    const found = champions.find(c => c.key === championId.toString());
                    if (found) {
                      // Use assignedPosition or teamPosition from LCU API
                      const lcuRole = member.assignedPosition || member.teamPosition || member.position;
                      const role = lcuRole ? roleMap[lcuRole] || null : null;

                      if (role) {
                        if (newSelections[role]?.id !== found.id) {
                          newSelections[role] = found;
                          hasUpdates = true;
                        }
                      } else {
                        // Check if champion is already assigned to ANY role to prevent duplication
                        const isAlreadyAssigned = Object.values(newSelections).some(s => s?.id === found.id);

                        if (!isAlreadyAssigned) {
                          // Fallback: try to infer role from champion tags if LCU doesn't provide it
                          // This is less accurate but better than index-based assignment
                          const inferredRole = inferRoleFromChampion(found, newSelections);
                          if (inferredRole && newSelections[inferredRole]?.id !== found.id) {
                            newSelections[inferredRole] = found;
                            hasUpdates = true;
                          }
                        }
                      }
                    }
                  }
                });
              }

              // Ally ADC from myTeam BOTTOM (exclude local Pyke cell)
              if (Array.isArray(myTeam)) {
                const isAllyNotSelf = (m: TeamMember) =>
                  m.championId !== undefined &&
                  m.championId !== 0 &&
                  (localPlayerCellId === undefined || m.cellId !== localPlayerCellId);

                const bottomMember = myTeam.find((m) => {
                  const pos = (m.assignedPosition || m.teamPosition || m.position || '').toUpperCase();
                  return pos === 'BOTTOM' && isAllyNotSelf(m);
                });
                const marksmanFallback = !bottomMember
                  ? myTeam.find((m) => {
                      if (!isAllyNotSelf(m)) return false;
                      const champ = champions.find(c => c.key === String(m.championId));
                      const pos = (m.assignedPosition || m.teamPosition || m.position || '').toUpperCase();
                      return !!champ?.tags.includes('Marksman') && pos !== 'UTILITY';
                    })
                  : null;
                const adcMember = bottomMember || marksmanFallback;
                if (adcMember?.championId) {
                  const adcChamp = champions.find(c => c.key === String(adcMember.championId));
                  if (adcChamp && adcChamp.id !== 'Pyke' && newSelections.YourADC?.id !== adcChamp.id) {
                    newSelections.YourADC = adcChamp;
                    hasUpdates = true;
                  }
                }

                const midMember = myTeam.find((m) => {
                  const pos = (m.assignedPosition || m.teamPosition || m.position || '').toUpperCase();
                  return (pos === 'MIDDLE' || pos === 'MID') && isAllyNotSelf(m);
                });
                if (midMember?.championId) {
                  const midChamp = champions.find(c => c.key === String(midMember.championId));
                  if (midChamp && midChamp.id !== 'Pyke' && newSelections.YourMid?.id !== midChamp.id) {
                    newSelections.YourMid = midChamp;
                    hasUpdates = true;
                  }
                }
              }

              return hasUpdates ? newSelections : prev;
            });
          }
        }
      } catch (e) {
        // Session likely not active or other expected errors, ignore silently
        // Only log unexpected errors
        if (e && typeof e === 'object' && 'message' in e) {
          const errorMessage = String((e as { message?: unknown }).message || '');
          if (!errorMessage.includes('404')) {
            console.debug('LCU polling error:', e);
          }
        }
      } finally {
        pollInFlight = false;
      }
    };

    // Poll every 1.5s when active (slower = less LCU contention with the game client)
    const intervalId = setInterval(poll, 1500);

    // Listener to handle visibility changes immediately
    const handleVisibilityChange = () => {
      if (!document.hidden && !overlayInGame) {
        poll(); // Poll immediately when becoming visible
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [lcuConnected, champions, overlayInGame]);

  // Recalculate Build & Analysis
  useEffect(() => {
    // Separate enemy team from your ADC / mid
    const enemyRoles = ['Top', 'Jungle', 'Mid', 'Bot', 'Support'];
    const enemies = enemyRoles.map(role => selections[role]).filter(c => c !== null) as Champion[];
    const yourADC = selections.YourADC;
    const yourMid = selections.YourMid;

    if (enemies.length > 0) {
      const currentBuild = calculateBuild(enemies, yourADC, yourMid);
      setBuild(currentBuild);
      setRunes(calculateRunes(enemies, currentBuild, yourADC, yourMid));
      setAnalysis(analyzeMatchup(enemies, currentBuild, yourADC, yourMid));
      setDominance(calculateDominanceFactor(enemies, currentBuild));
    } else {
      setBuild(null);
      setRunes(null);
      setAnalysis(null);
      setDominance(null);
    }
  }, [selections]);

  // Helper function to infer role from champion tags when LCU doesn't provide role
  const inferRoleFromChampion = (champion: Champion, currentSelections: { [key: string]: Champion | null }): string | null => {
    // Check if role is already taken
    const isRoleTaken = (role: string) => currentSelections[role] !== null;

    // Marksman = Bot
    if (champion.tags.includes('Marksman') && !isRoleTaken('Bot')) {
      return 'Bot';
    }
    // Support tag = Support
    if (champion.tags.includes('Support') && !isRoleTaken('Support')) {
      return 'Support';
    }
    // Tank/Fighter often = Top
    if ((champion.tags.includes('Tank') || champion.tags.includes('Fighter')) && !isRoleTaken('Top')) {
      return 'Top';
    }
    // Assassin/Mage often = Mid
    if ((champion.tags.includes('Assassin') || champion.tags.includes('Mage')) && !isRoleTaken('Mid')) {
      return 'Mid';
    }

    // Fill remaining slots
    const roles = ['Top', 'Jungle', 'Mid', 'Bot', 'Support'];
    for (const role of roles) {
      if (!isRoleTaken(role)) return role;
    }

    return null;
  };

  const handleSelectionChange = (role: string, champion: Champion | null) => {
    setSelections(prev => ({ ...prev, [role]: champion }));
  };

  const handleExport = async () => {
    if (!runes || !window.electronAPI) return;
    try {
      setExportStatus('idle');

      const selectedPerkIds = [...runes.selectedPerkIds];
      if (selectedPerkIds.length !== 9) {
        throw new Error(`Invalid rune configuration: Expected 9 runes, got ${selectedPerkIds.length}`);
      }

      const runePagePayload = {
        name: runes.name,
        primaryStyleId: runes.primaryStyleId,
        subStyleId: runes.subStyleId,
        selectedPerkIds,
        current: true,
      };

      // Prefer dedicated main-process exporters (correct LCU paths + error bodies)
      let runeOk = false;
      if (window.electronAPI.exportRunePage) {
        const runeRes = await window.electronAPI.exportRunePage(runePagePayload);
        if (!runeRes.success) throw new Error(runeRes.error || 'Failed to export rune page');
        runeOk = true;
      } else {
        const res = await window.electronAPI.requestLCU('GET', '/lol-perks/v1/pages');
        if (!res.success) throw new Error(res.error);
        interface ExistingRunePage { name: string; id: number }
        const pages = Array.isArray(res.data) ? (res.data as ExistingRunePage[]) : [];
        const existingPage = pages.find((p) => p.name === runes.name);
        if (existingPage) {
          await window.electronAPI.requestLCU('DELETE', `/lol-perks/v1/pages/${existingPage.id}`);
        }
        const createRes = await window.electronAPI.requestLCU('POST', '/lol-perks/v1/pages', runePagePayload);
        if (!createRes.success) throw new Error(createRes.error || 'Failed to create rune page');
        runeOk = true;
      }

      let itemOk = true;
      if (build && window.electronAPI.exportItemSet) {
        const itemRes = await window.electronAPI.exportItemSet({
          starter: build.starter,
          core: build.core,
          boots: build.boots,
          situational: build.situational,
          buildPath: build.buildPath,
        });
        if (!itemRes?.success) {
          itemOk = false;
          console.error('Item set export failed:', itemRes?.error);
          // Runes landed — surface partial failure instead of silent success
          throw new Error(itemRes?.error || 'Rune page exported, but item set failed');
        }
      }

      if (runeOk && itemOk) {
        setExportStatus('success');
        setTimeout(() => setExportStatus('idle'), 3000);
      }
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error('Export failed:', err.message || error);
      setExportStatus('error');
      setTimeout(() => setExportStatus('idle'), 4000);
    }
  };

  const handleMinimize = () => {
    if (window.electronAPI) {
      window.electronAPI.windowMinimize();
    }
  };

  const handleMaximize = () => {
    if (window.electronAPI) {
      window.electronAPI.windowMaximize();
    }
  };

  const handleClose = () => {
    if (window.electronAPI) {
      window.electronAPI.windowClose();
    }
  };

  const handleToggleOverlay = async () => {
    if (!window.electronAPI?.toggleOverlay) return;
    try {
      const res = await window.electronAPI.toggleOverlay();
      if (res?.success) {
        setOverlayVisible(res.visible);
      }
    } catch (error) {
      console.error('Unable to toggle overlay:', error);
    }
  };

  const handleToggleClickThrough = async () => {
    if (!window.electronAPI?.toggleOverlayClickThrough) return;
    try {
      const res = await window.electronAPI.toggleOverlayClickThrough();
      if (res?.success) {
        setOverlayClickThrough(res.clickThrough);
      }
    } catch (error) {
      console.error('Unable to change overlay interaction mode:', error);
    }
  };

  const handleHudScaleChange = async (scale: number) => {
    setHudScale(scale);
    try {
      const res = await window.electronAPI?.setOverlayHudScale(scale);
      if (res?.success) setHudScale(res.hudScale);
    } catch (error) {
      console.error('Unable to save HUD scale:', error);
    }
  };

  const handleMapScaleChange = async (scale: number) => {
    setMapScale(scale);
    try {
      const res = await window.electronAPI?.setOverlayMapScale?.(scale);
      if (res?.success) setMapScale(res.mapScale);
    } catch (error) {
      console.error('Unable to save Map scale:', error);
    }
  };

  const handleSyncLeagueScales = async () => {
    try {
      const res = await window.electronAPI?.syncLeagueScales?.();
      if (res?.success) {
        setHudScale(res.hudScale);
        setMapScale(res.mapScale);
      }
    } catch (error) {
      console.error('Unable to sync League scales:', error);
    }
  };

  const handleChromeColorChange = async (color: string) => {
    setChromeColor(color);
    try {
      const res = await window.electronAPI?.setOverlayChromeColor?.(color);
      if (res?.success) setChromeColor(res.chromeColor);
    } catch (error) {
      console.error('Unable to save chrome color:', error);
    }
  };

  return (
    <div
      className="hud-app-shell text-chrome-silver font-sans selection:bg-chrome-silver/25 selection:text-chrome-ink overflow-x-hidden"
      style={{
        ['--chrome-user' as string]: normalizeChromeColor(chromeColor),
        ['--chrome-silver' as string]: normalizeChromeColor(chromeColor),
        ['--chrome-bright' as string]: normalizeChromeColor(chromeColor),
        ['--pyke-green' as string]: normalizeChromeColor(chromeColor),
      }}
    >

      {/* Draggable Title Bar */}
      {window.electronAPI && (
        <div
          className="hud-titlebar h-10 flex items-center justify-between px-4 fixed top-0 left-0 right-0 z-50"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          <div className="flex items-center gap-2 text-xs text-chrome-dim font-semibold">
            <ChromeMark size={12} style={{ color: chromeColor }} />
            <span className="font-display tracking-[0.22em] uppercase text-chrome-bright">Pyke Dominator</span>
            <span className="hud-chip hud-accent-blood !py-0.5 !text-[8px]">Hound</span>
          </div>
          <div className="flex items-center gap-0.5" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <button
              onClick={handleMinimize}
              className="w-10 h-10 flex items-center justify-center hover:bg-white/5 transition-all duration-150 text-chrome-dim hover:text-chrome-bright active:bg-white/10"
              title="Minimize"
            >
              <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="0" y1="6" x2="12" y2="6" />
              </svg>
            </button>
            <button
              onClick={handleMaximize}
              className="w-10 h-10 flex items-center justify-center hover:bg-white/5 transition-all duration-150 text-chrome-dim hover:text-chrome-bright active:bg-white/10"
              title="Maximize / Restore"
            >
              <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="8" height="8" />
              </svg>
            </button>
            <button
              onClick={handleClose}
              className="w-10 h-10 flex items-center justify-center hover:bg-chrome-blood/30 transition-all duration-150 text-chrome-dim hover:text-rose-300 active:bg-chrome-blood/40"
              title="Close"
            >
              <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="2" y1="2" x2="10" y2="10" />
                <line x1="10" y1="2" x2="2" y2="10" />
              </svg>
            </button>
          </div>
        </div>
      )}
      <div className={`container mx-auto p-6 max-w-7xl ${window.electronAPI ? 'pt-16' : ''}`}>
        <header className="hud-main-header mb-8 pb-5 relative">
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-chrome-silver/50 to-transparent" />
          <div className="absolute bottom-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-chrome-blood/40 to-transparent translate-y-px" />

          <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
            <div className="flex items-center gap-4 min-w-0">
              <ChromeMark className="shrink-0" size={28} style={{ color: chromeColor }} />
              <div className="min-w-0">
                <h1 className="hud-brand text-3xl md:text-5xl truncate">Pyke Dominator</h1>
                <p className="mt-1 font-mono text-[10px] tracking-[0.28em] uppercase text-chrome-dim">
                  Gothic chrome · tactical loadout
                </p>
              </div>
              <span className="hud-chip text-chrome-dim hidden sm:inline-flex" style={{ ['--accent' as string]: '#8a919c' }}>
                V1.3.0
              </span>
            </div>
            <div
              className={`hud-chip flex items-center gap-2 shrink-0 ${
                lcuConnected ? 'hud-accent-green !text-chrome-bright' : 'text-chrome-dim'
              }`}
            >
              <span className={`hud-status-dot ${lcuConnected ? 'text-chrome-bright' : 'text-chrome-dim'}`} />
              {lcuConnected ? 'Live' : 'Demo'}
            </div>
          </div>

          {window.electronAPI && (
            <div className="hud-toolbar">
              <button
                type="button"
                onClick={handleToggleOverlay}
                className={`hud-btn ${
                  overlayVisible
                    ? '!text-chrome-bright !border-chrome-silver/60 shadow-[0_0_12px_rgba(242,244,247,0.12)]'
                    : ''
                }`}
                title="Toggle in-game overlay (Ctrl+Shift+H)"
              >
                Overlay {overlayVisible ? 'On' : 'Off'}
                {overlayInGame ? ' · Live' : ''}
              </button>
              <button
                type="button"
                onClick={handleToggleClickThrough}
                className="hud-btn"
                title="Lock/unlock a compact movable overlay (Ctrl+Shift+U)"
              >
                {overlayClickThrough ? 'Locked · Pass-through' : 'Unlocked · Move'}
              </button>
              <label className="hud-scale-control" title="Match League Interface › HUD Scale (0–100)">
                <span>HUD {hudScale}</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={hudScale}
                  onChange={(event) => void handleHudScaleChange(Number(event.target.value))}
                />
              </label>
              <label className="hud-scale-control" title="Match League Interface › Minimap Scale (0–100)">
                <span>Map {mapScale}</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={mapScale}
                  onChange={(event) => void handleMapScaleChange(Number(event.target.value))}
                />
              </label>
              <button
                type="button"
                className="hud-btn"
                title="Read GlobalScale / MinimapScale from League game.cfg"
                onClick={() => void handleSyncLeagueScales()}
              >
                Sync LoL
              </button>
              <label className="chrome-color-control" title="Chrome frame + accent color">
                <span>Chrome</span>
                <input
                  type="color"
                  value={normalizeChromeColor(chromeColor)}
                  onChange={(event) => void handleChromeColorChange(event.target.value)}
                />
                <span className="chrome-color-presets">
                  {CHROME_COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className={`chrome-color-swatch${normalizeChromeColor(chromeColor) === preset.value.toLowerCase() ? ' is-active' : ''}`}
                      style={{ background: preset.value }}
                      title={preset.label}
                      onClick={() => void handleChromeColorChange(preset.value)}
                    />
                  ))}
                </span>
              </label>
            </div>
          )}
          {window.electronAPI && (
            <p className="mt-2 font-mono text-[9px] tracking-[0.08em] text-chrome-dim/70">
              Tip: set League's Video &gt; Display Mode to <strong className="text-chrome-dim">Borderless</strong> — overlays over exclusive Fullscreen force Windows to recompose every frame and can cost real FPS.
              Unlock the overlay (Ctrl+Shift+U) to drag it, and nudge the ability/minimap alignment marks to fit your exact HUD.
            </p>
          )}
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 relative">
          {/* Left Panel: Enemy Selection */}
          <div className="xl:col-span-3 space-y-6 animate-slide-in relative" style={{ zIndex: 100 }}>
            <HudFrame accent="green" label="Hostiles" className="p-5">
              <h2 className="hud-heading text-xl text-chrome-bright mb-5">
                <ChromeMark size={14} style={{ color: chromeColor }} /> Enemy Squad
              </h2>
              <ChampionSelect
                champions={champions}
                selections={selections}
                onSelectionChange={handleSelectionChange}
                roles={['Top', 'Jungle', 'Mid', 'Bot', 'Support']}
                layout="stack"
              />
            </HudFrame>

            {/* Dominance Gauge */}
            {dominance && (
              <div className="animate-slide-in" style={{ animationDelay: '0.1s' }}>
                <DominanceGauge metrics={dominance} />
              </div>
            )}

            {/* Ally ADC + Mid (mid mobility feeds roam scoring) */}
            <HudFrame accent="cyan" label="Bond" className="p-5">
              <h2 className="hud-heading text-xl text-chrome-bright mb-5">
                <ChromeMark size={14} className="text-chrome-dim" /> Ally Lanes
              </h2>
              <ChampionSelect
                champions={champions}
                selections={selections}
                onSelectionChange={handleSelectionChange}
                roles={['YourADC', 'YourMid']}
                layout="stack"
              />
            </HudFrame>
          </div>

          {/* Right Panel: Build & Analysis */}
          <div className="xl:col-span-9 space-y-6 relative" style={{ zIndex: 1 }}>
            {build && runes && analysis ? (
              <BuildDisplay
                build={build}
                runes={runes}
                analysis={analysis}
                onExport={handleExport}
                canExport={lcuConnected}
                exportStatus={exportStatus}
                accentColor={chromeColor}
              />
            ) : (
              <HudFrame accent="steel" label="Standby" className="hud-scanlines min-h-[420px] p-12 animate-fade-in">
                <div className="h-full flex flex-col items-center justify-center text-chrome-dim">
                  <ChromeMark size={48} className="mb-6 opacity-30" style={{ color: chromeColor }} />
                  <p className="hud-heading text-2xl text-chrome-dim">Awaiting Data</p>
                  <p className="text-sm mt-3 text-chrome-dim/70 font-mono border-t border-white/10 pt-3 tracking-wider">
                    Select enemy champions to initialize tactical analysis.
                  </p>
                </div>
              </HudFrame>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
