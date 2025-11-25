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
    fetch('https://ddragon.leagueoflegends.com/cdn/14.23.1/data/en_US/champion.json')
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
        if (res.success && res.data) {
          const theirTeam = res.data.theirTeam;
          if (Array.isArray(theirTeam)) {
            setSelections(prev => {
              const newSelections = { ...prev };
              const roles = ['Top', 'Jungle', 'Mid', 'Bot', 'Support'];
              let hasUpdates = false;

              theirTeam.forEach((member: any, index: number) => {
                if (member.championId && member.championId !== 0) {
                  const found = champions.find(c => c.key === member.championId.toString());
                  if (found) {
                    // Assign to role based on index (0-4)
                    const role = roles[index];
                    if (newSelections[role]?.id !== found.id) {
                      newSelections[role] = found;
                      hasUpdates = true;
                    }
                  }
                }
              });

              return hasUpdates ? newSelections : prev;
            });
          }
        }
      } catch (e) {
        // Session likely not active, ignore
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
      setAnalysis(analyzeMatchup(enemies));
    } else {
      setBuild(null);
      setRunes(null);
      setAnalysis(null);
    }
  }, [selections]);

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
        await window.electronAPI.requestLCU('DELETE', `/lol-perks/v1/pages/${existingPage.id}`);
      }

      // 3. Create new page
      const createRes = await window.electronAPI.requestLCU('POST', '/lol-perks/v1/pages', runes);
      if (!createRes.success) throw new Error(createRes.error);

      setExportStatus('success');
      setTimeout(() => setExportStatus('idle'), 3000);
    } catch (error) {
      console.error('Export failed:', error);
      setExportStatus('error');
      setTimeout(() => setExportStatus('idle'), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-pyke-dark text-slate-300 font-sans selection:bg-pyke-green selection:text-black">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <header className="flex justify-between items-center mb-10 border-b border-slate-800 pb-6">
          <div className="flex items-center gap-4">
            <h1 className="text-4xl font-display text-pyke-green tracking-widest uppercase drop-shadow-[0_0_10px_rgba(72,191,145,0.3)]">
              Pyke Dominator
            </h1>
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-800 text-slate-500 border border-slate-700">
              V1.0.0
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${lcuConnected ? 'border-green-500/50 bg-green-500/10' : (!window.electronAPI ? 'border-blue-500/50 bg-blue-500/10' : 'border-red-500/50 bg-red-500/10')}`}>
              <div className={`w-2 h-2 rounded-full ${lcuConnected ? 'bg-green-500 animate-pulse' : (!window.electronAPI ? 'bg-blue-500' : 'bg-red-500')}`}></div>
              <span className={`text-xs font-bold uppercase tracking-wider ${lcuConnected ? 'text-green-400' : (!window.electronAPI ? 'text-blue-400' : 'text-red-400')}`}>
                {lcuConnected ? 'Live Link Active' : (!window.electronAPI ? 'Web Mode (Demo)' : 'Client Disconnected')}
              </span>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          {/* Left Panel: Enemy Selection */}
          <div className="xl:col-span-3 space-y-6">
            <div className="bg-slate-900/50 p-6 rounded-lg border border-slate-800 backdrop-blur-sm">
              <h2 className="text-xl font-display text-white mb-6 flex items-center gap-2">
                <span className="text-pyke-green">///</span> Enemy Composition
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
              <div className="h-full flex flex-col items-center justify-center text-slate-600 border-2 border-dashed border-slate-800 rounded-lg p-12 bg-slate-900/30">
                <div className="text-6xl mb-4 opacity-20">⚔️</div>
                <p className="text-xl font-display tracking-wider">Awaiting Enemy Intelligence...</p>
                <p className="text-sm mt-2">Select enemy champions to generate your loadout.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
