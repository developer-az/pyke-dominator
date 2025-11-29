import React, { useState, useEffect } from 'react';
import { BuildDisplay } from './components/BuildDisplay';
import { ChampionSelect } from './components/ChampionSelect';
import { DominanceGauge } from './components/DominanceGauge';
import { calculateBuild, calculateRunes, analyzeMatchup, calculateDominanceFactor } from './logic/pykeLogic';
import type { Champion, Build, RunePage, MatchupAnalysis, DominanceMetrics } from './logic/pykeLogic';



const App: React.FC = () => {
  const [champions, setChampions] = useState<Champion[]>([]);
  const [selections, setSelections] = useState<{ [key: string]: Champion | null }>({
    Top: null,
    Jungle: null,
    Mid: null,
    Bot: null,
    Support: null,
    YourADC: null, // Your ADC for 2v2 comparison
  });
  const [build, setBuild] = useState<Build | null>(null);
  const [runes, setRunes] = useState<RunePage | null>(null);
  const [analysis, setAnalysis] = useState<MatchupAnalysis | null>(null);
  const [dominance, setDominance] = useState<DominanceMetrics | null>(null);
  const [lcuConnected, setLcuConnected] = useState(false);
  const [exportStatus, setExportStatus] = useState<'idle' | 'success' | 'error'>('idle');

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

  // Initial LCU Connection via IPC
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.connectLCU().then(res => {
        if (res && res.success) {
          setLcuConnected(true);
        }
      });
    }
  }, []);

  // Auto-Detect Logic (Polling)
  useEffect(() => {
    if (!lcuConnected || !window.electronAPI || champions.length === 0) return;

    let intervalId: ReturnType<typeof setInterval>;

    const poll = async () => {
      // Performance Optimization: Skip polling if window is hidden
      if (document.hidden) return;

      if (!window.electronAPI) return;
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
            assignedPosition?: string;
            teamPosition?: string;
            position?: string;
          }

          interface LCUSession {
            theirTeam?: TeamMember[];
          }

          const sessionData = res.data as LCUSession;
          const theirTeam = sessionData.theirTeam;
          if (Array.isArray(theirTeam)) {
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
      }
    };

    // Poll every 1s when active
    intervalId = setInterval(poll, 1000);

    // Listener to handle visibility changes immediately
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        poll(); // Poll immediately when becoming visible
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [lcuConnected, champions]);

  // Recalculate Build & Analysis
  useEffect(() => {
    // Separate enemy team from your ADC
    const enemyRoles = ['Top', 'Jungle', 'Mid', 'Bot', 'Support'];
    const enemies = enemyRoles.map(role => selections[role]).filter(c => c !== null) as Champion[];
    const yourADC = selections.YourADC;

    if (enemies.length > 0) {
      const currentBuild = calculateBuild(enemies);
      setBuild(currentBuild);
      setRunes(calculateRunes(enemies, currentBuild));
      setAnalysis(analyzeMatchup(enemies, currentBuild, yourADC));
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

      // 1. Get current rune pages
      const res = await window.electronAPI.requestLCU('GET', '/lol-perks/v1/pages');
      if (!res.success) throw new Error(res.error);

      const currentPages = res.data;

      // 2. Check if "Pyke Dominator" exists and delete it
      interface RunePage {
        name: string;
        id: number;
      }
      const existingPage = (currentPages as RunePage[]).find((p: RunePage) => p.name === runes.name);
      if (existingPage) {
        const deleteRes = await window.electronAPI.requestLCU('DELETE', `/lol-perks/v1/pages/${existingPage.id}`);
        if (!deleteRes.success) console.warn('Failed to delete existing page:', deleteRes.error);
      }

      // 3. Export item set (appears in in-game shop)
      if (build && window.electronAPI.exportItemSet) {
        try {
          await window.electronAPI.exportItemSet({
            starter: build.starter,
            core: build.core,
            boots: build.boots,
            situational: build.situational,
            buildPath: build.buildPath
          });
        } catch (itemSetError) {
          // Item set export is optional, don't fail the whole export if it fails
          console.warn('Item set export failed (this is okay):', itemSetError);
        }
      }

      // 4. Create new rune page - Only send fields that LCU API accepts
      // Ensure selectedPerkIds array has exactly 9 elements: 4 primary + 2 secondary + 3 stat shards
      const selectedPerkIds = [...runes.selectedPerkIds];
      if (selectedPerkIds.length !== 9) {
        console.error('Invalid rune page: selectedPerkIds must have 9 elements, got', selectedPerkIds.length);
        throw new Error(`Invalid rune configuration: Expected 9 runes, got ${selectedPerkIds.length}`);
      }

      const runePagePayload = {
        name: runes.name,
        primaryStyleId: runes.primaryStyleId,
        subStyleId: runes.subStyleId,
        selectedPerkIds: selectedPerkIds,
        // LCU API requires current: true to make it the active page
        current: true
      };

      console.log('Exporting rune page:', JSON.stringify(runePagePayload, null, 2));
      console.log('Primary Style:', runePagePayload.primaryStyleId, 'Secondary Style:', runePagePayload.subStyleId);
      console.log('Rune IDs:', selectedPerkIds);
      console.log('Secondary runes (indices 4-5):', selectedPerkIds[4], selectedPerkIds[5]);

      const createRes = await window.electronAPI.requestLCU('POST', '/lol-perks/v1/pages', runePagePayload);
      if (!createRes.success) {
        console.error('LCU API Error:', createRes.error);
        throw new Error(createRes.error || 'Failed to create rune page');
      }

      console.log('Rune page exported successfully:', createRes.data);
      setExportStatus('success');
      setTimeout(() => setExportStatus('idle'), 3000);
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error('Export failed:', err.message || error);
      setExportStatus('error');
      setTimeout(() => setExportStatus('idle'), 3000);
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

  return (
    <div className="min-h-screen bg-pyke-dark text-slate-200 font-sans selection:bg-pyke-green selection:text-pyke-dark overflow-x-hidden">

      {/* Draggable Title Bar */}
      {window.electronAPI && (
        <div
          className="h-10 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-900/95 border-b border-slate-800/80 flex items-center justify-between px-4 fixed top-0 left-0 right-0 z-50 backdrop-blur-sm shadow-lg"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          <div className="flex items-center gap-2 text-xs text-slate-300 font-semibold">
            <span className="text-pyke-green text-base">⚔</span>
            <span className="tracking-wider">Pyke Dominator</span>
          </div>
          <div className="flex items-center gap-0.5" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <button
              onClick={handleMinimize}
              className="w-10 h-10 flex items-center justify-center hover:bg-slate-800/80 rounded transition-all duration-150 text-slate-400 hover:text-white active:bg-slate-700"
              title="Minimize"
            >
              <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="0" y1="6" x2="12" y2="6" />
              </svg>
            </button>
            <button
              onClick={handleMaximize}
              className="w-10 h-10 flex items-center justify-center hover:bg-slate-800/80 rounded transition-all duration-150 text-slate-400 hover:text-white active:bg-slate-700"
              title="Maximize / Restore"
            >
              <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="8" height="8" />
              </svg>
            </button>
            <button
              onClick={handleClose}
              className="w-10 h-10 flex items-center justify-center hover:bg-red-500/30 rounded transition-all duration-150 text-slate-400 hover:text-red-400 active:bg-red-500/40"
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
        {/* Header */}
        <header className="flex justify-between items-center mb-10 border-b border-slate-800 pb-6">
          <div className="flex items-center gap-4">
            <h1 className="text-4xl font-display font-bold text-white tracking-wider uppercase">
              Pyke Dominator
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700 tracking-widest">
              V1.2.0
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded border transition-all duration-300 ${lcuConnected
              ? 'border-green-900/50 bg-green-900/20 text-green-400'
              : 'border-slate-800 bg-slate-900/50 text-slate-500'
              }`}>
              <div className={`w-2 h-2 rounded-full ${lcuConnected ? 'bg-green-500' : 'bg-slate-500'}`}></div>
              <span className="text-xs font-bold uppercase tracking-wider">
                {lcuConnected ? 'Live' : 'Demo'}
              </span>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 relative">
          {/* Left Panel: Enemy Selection */}
          <div className="xl:col-span-3 space-y-6 animate-slide-in relative" style={{ zIndex: 100 }}>
            <div className="bg-pyke-dark-light/90 p-6 rounded-xl border border-pyke-accent backdrop-blur-xl shadow-2xl hover:border-pyke-green/50 transition-all duration-500 group relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-pyke-green/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <h2 className="text-xl font-display text-white mb-6 flex items-center gap-2 uppercase tracking-wider">
                <span className="text-pyke-green text-2xl drop-shadow-[0_0_5px_rgba(0,255,157,0.8)]">///</span> Enemy Squad
              </h2>
              <ChampionSelect
                champions={champions}
                selections={selections}
                onSelectionChange={handleSelectionChange}
                roles={['Top', 'Jungle', 'Mid', 'Bot', 'Support']}
              />
            </div>

            {/* Dominance Gauge */}
            {dominance && (
              <div className="animate-slide-in" style={{ animationDelay: '0.1s' }}>
                <DominanceGauge metrics={dominance} />
              </div>
            )}

            {/* Your ADC Selection */}
            <div className="bg-pyke-dark-light/90 p-6 rounded-xl border border-pyke-accent backdrop-blur-xl shadow-2xl hover:border-blue-500/50 transition-all duration-500 group relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <h2 className="text-xl font-display text-white mb-6 flex items-center gap-2 uppercase tracking-wider">
                <span className="text-blue-400 text-2xl drop-shadow-[0_0_5px_rgba(96,165,250,0.8)]">⚔</span> Ally Carry
              </h2>
              <ChampionSelect
                champions={champions}
                selections={selections}
                onSelectionChange={handleSelectionChange}
                roles={['YourADC']}
              />
            </div>
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
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 border border-dashed border-pyke-accent rounded-xl p-12 bg-pyke-dark-light/30 backdrop-blur-sm animate-fade-in relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-pyke-green/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                <div className="text-7xl mb-6 opacity-20 animate-pulse text-pyke-green">⚔️</div>
                <p className="text-2xl font-display tracking-[0.2em] text-slate-400 uppercase">Awaiting Data</p>
                <p className="text-sm mt-3 text-slate-600 font-mono border-t border-slate-800 pt-3">Select enemy champions to initialize tactical analysis.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
