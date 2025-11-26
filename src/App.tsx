import React, { useState, useEffect } from 'react';
import { calculateBuild, calculateRunes, analyzeMatchup } from './logic/pykeLogic';
import type { Champion, Build, RunePage, MatchupAnalysis } from './logic/pykeLogic';
import { BuildDisplay } from './components/BuildDisplay';
import { ChampionSelect } from './components/ChampionSelect';



const App: React.FC = () => {
  const [champions, setChampions] = useState<Champion[]>([]);
  const [selections, setSelections] = useState<{ [key: string]: Champion | null }>({
    Top: null,
    Jungle: null,
    Mid: null,
    Bot: null,
    Support: null,
  });
  const [build, setBuild] = useState<Build | null>(null);
  const [runes, setRunes] = useState<RunePage | null>(null);
  const [analysis, setAnalysis] = useState<MatchupAnalysis | null>(null);
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
        const list: Champion[] = Object.values(data.data).map((c: any) => ({
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

    const interval = setInterval(async () => {
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
          const theirTeam = res.data.theirTeam;
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

              theirTeam.forEach((member: any) => {
                if (member.championId && member.championId !== 0) {
                  const found = champions.find(c => c.key === member.championId.toString());
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
    }, 1000);

    return () => clearInterval(interval);
  }, [lcuConnected, champions]);

  // Recalculate Build & Analysis
  useEffect(() => {
    const enemies = Object.values(selections).filter(c => c !== null) as Champion[];

    if (enemies.length > 0) {
      const currentBuild = calculateBuild(enemies);
      setBuild(currentBuild);
      setRunes(calculateRunes(enemies, currentBuild));
      setAnalysis(analyzeMatchup(enemies, currentBuild));
    } else {
      setBuild(null);
      setRunes(null);
      setAnalysis(null);
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
      const existingPage = currentPages.find((p: any) => p.name === runes.name);
      if (existingPage) {
        const deleteRes = await window.electronAPI.requestLCU('DELETE', `/lol-perks/v1/pages/${existingPage.id}`);
        if (!deleteRes.success) console.warn('Failed to delete existing page:', deleteRes.error);
      }

      // 3. Create new page - Only send fields that LCU API accepts
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
    } catch (error: any) {
      console.error('Export failed:', error);
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
    <div className="min-h-screen bg-pyke-dark text-slate-300 font-sans selection:bg-pyke-green selection:text-black">
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
        <header className="flex justify-between items-center mb-10 border-b border-slate-800 pb-6 animate-fade-in">
          <div className="flex items-center gap-4">
            <h1 className="text-4xl font-display text-pyke-green tracking-widest uppercase drop-shadow-[0_0_10px_rgba(0,255,157,0.4)] hover:drop-shadow-[0_0_15px_rgba(0,255,157,0.6)] transition-all duration-300">
              Pyke Dominator
            </h1>
            <span className="px-3 py-1 rounded-md text-xs font-bold bg-slate-800/80 text-slate-400 border border-slate-700/50 backdrop-blur-sm">
              V1.0.0
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border backdrop-blur-sm transition-all duration-300 ${
              lcuConnected 
                ? 'border-green-500/50 bg-green-500/10 shadow-lg shadow-green-500/10' 
                : (!window.electronAPI 
                  ? 'border-blue-500/50 bg-blue-500/10 shadow-lg shadow-blue-500/10' 
                  : 'border-red-500/50 bg-red-500/10 shadow-lg shadow-red-500/10')
            }`}>
              <div className={`w-2.5 h-2.5 rounded-full transition-all ${
                lcuConnected 
                  ? 'bg-green-500 animate-pulse shadow-lg shadow-green-500/50' 
                  : (!window.electronAPI 
                    ? 'bg-blue-500 shadow-lg shadow-blue-500/50' 
                    : 'bg-red-500 shadow-lg shadow-red-500/50')
              }`}></div>
              <span className={`text-xs font-bold uppercase tracking-wider ${
                lcuConnected 
                  ? 'text-green-400' 
                  : (!window.electronAPI 
                    ? 'text-blue-400' 
                    : 'text-red-400')
              }`}>
                {lcuConnected ? 'Live Link Active' : (!window.electronAPI ? 'Web Mode (Demo)' : 'Client Disconnected')}
              </span>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          {/* Left Panel: Enemy Selection */}
          <div className="xl:col-span-3 space-y-6 animate-slide-in">
            <div className="bg-slate-900/60 p-6 rounded-xl border border-slate-800/80 backdrop-blur-md shadow-xl hover:border-slate-700/80 transition-all duration-300">
              <h2 className="text-xl font-display text-white mb-6 flex items-center gap-2">
                <span className="text-pyke-green text-2xl">///</span> Enemy Composition
              </h2>
              <ChampionSelect
                champions={champions}
                selections={selections}
                onSelectionChange={handleSelectionChange}
              />
            </div>
          </div>

          {/* Right Panel: Build & Analysis */}
          <div className="xl:col-span-9 space-y-6">
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
              <div className="h-full flex flex-col items-center justify-center text-slate-600 border-2 border-dashed border-slate-800/50 rounded-xl p-12 bg-slate-900/20 backdrop-blur-sm animate-fade-in">
                <div className="text-6xl mb-4 opacity-30 animate-pulse">⚔️</div>
                <p className="text-xl font-display tracking-wider text-slate-500">Awaiting Enemy Intelligence...</p>
                <p className="text-sm mt-2 text-slate-600">Select enemy champions to generate your loadout.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
