import React from 'react';
import type { Build, RunePage, Item, MatchupAnalysis } from '../logic/pykeLogic';

interface Props {
    build: Build;
    runes: RunePage;
    analysis: MatchupAnalysis;
    onExport: () => void;
    canExport: boolean;
    exportStatus: 'idle' | 'success' | 'error';
}

const ItemIcon: React.FC<{ item: Item; size?: string }> = ({ item, size = "w-12 h-12" }) => (
    <div className="group relative">
        <img
            src={`https://ddragon.leagueoflegends.com/cdn/14.23.1/img/item/${item.id}.png`}
            alt={item.name}
            className={`${size} rounded border border-slate-600 group-hover:border-pyke-green transition-colors cursor-help`}
        />
        {/* Tooltip */}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-black/95 border border-pyke-green text-slate-200 text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity shadow-lg shadow-pyke-green/20">
            <div className="font-bold text-pyke-green mb-1">{item.name}</div>
            <div>{item.reason || "Standard Pyke item."}</div>
        </div>
    </div>
);

const RuneIcon: React.FC<{ id: number; name: string; iconPath: string; reason?: string }> = ({ name, iconPath, reason }) => (
    <div className="group relative">
        <img
            src={iconPath}
            alt={name}
            className="w-8 h-8 rounded-full border border-slate-600 group-hover:border-pyke-green transition-colors cursor-help"
        />
        {/* Tooltip */}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-black/95 border border-pyke-green text-slate-200 text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity shadow-lg shadow-pyke-green/20">
            <div className="font-bold text-pyke-green mb-1">{name}</div>
            <div>{reason || "Standard Pyke rune."}</div>
        </div>
    </div>
);

export const BuildDisplay: React.FC<Props> = ({ build, runes, analysis, onExport, canExport, exportStatus }) => {
    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div className="flex justify-between items-center border-b border-slate-700 pb-4">
                <h2 className="text-2xl font-display text-pyke-green tracking-widest uppercase">Dominator Loadout</h2>
                {canExport && (
                    <button
                        onClick={onExport}
                        disabled={exportStatus !== 'idle'}
                        className={`px-4 py-2 rounded border transition-all uppercase font-bold text-sm tracking-wider ${exportStatus === 'success' ? 'bg-green-500 text-black border-green-500' :
                            exportStatus === 'error' ? 'bg-red-500 text-white border-red-500' :
                                'bg-pyke-accent hover:bg-pyke-green hover:text-black text-pyke-green border-pyke-green'
                            }`}
                    >
                        {exportStatus === 'success' ? 'Exported!' :
                            exportStatus === 'error' ? 'Failed' :
                                'Export to Client'}
                    </button>
                )}
            </div>

            {/* STRATEGIC ANALYSIS SECTION */}
            <div className="bg-slate-900/80 border border-pyke-green/30 p-6 rounded-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <h1 className="text-9xl font-black text-pyke-green">?</h1>
                </div>

                <div className="relative z-10">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Mission Objective</h3>
                            <h2 className="text-3xl font-display text-white uppercase tracking-wide">{analysis.title}</h2>
                        </div>
                        <div className={`px-3 py-1 rounded border text-xs font-bold uppercase tracking-wider ${analysis.aggressionLevel === 'EXTREME' ? 'bg-red-500/20 text-red-400 border-red-500/50' :
                            analysis.aggressionLevel === 'HIGH' ? 'bg-orange-500/20 text-orange-400 border-orange-500/50' :
                                analysis.aggressionLevel === 'MODERATE' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50' :
                                    'bg-blue-500/20 text-blue-400 border-blue-500/50'
                            }`}>
                            Aggression: {analysis.aggressionLevel}
                        </div>
                    </div>

                    <p className="text-slate-300 text-lg mb-6 italic border-l-4 border-pyke-green pl-4">
                        "{analysis.description}"
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h4 className="text-xs font-bold text-pyke-green uppercase tracking-wider mb-2">Win Condition</h4>
                            <p className="text-sm text-slate-400">{analysis.winCondition}</p>
                        </div>
                        <div>
                            <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2">Primary Targets</h4>
                            <div className="flex flex-wrap gap-2">
                                {analysis.primaryTargets.map(t => (
                                    <span key={t} className="px-2 py-0.5 bg-red-500/10 border border-red-500/30 text-red-300 text-xs rounded">
                                        {t}
                                    </span>
                                ))}
                                {analysis.primaryTargets.length === 0 && <span className="text-slate-500 text-xs">None visible</span>}
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-800">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tactical Tips</h4>
                        <ul className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {analysis.tips.map((tip, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-slate-400">
                                    <span className="text-pyke-green mt-1">›</span>
                                    {tip}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Items Section */}
                <div className="space-y-6">
                    <h3 className="text-xl text-slate-300 font-bold">Item Build</h3>

                    {/* Full Build Path */}
                    <div className="space-y-2">
                        <label className="text-xs text-slate-500 uppercase tracking-wider">Full Build Path (Pacing)</label>
                        <div className="flex flex-wrap gap-2 items-center bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                            {build.buildPath.map((item, i) => (
                                <React.Fragment key={i}>
                                    <ItemIcon item={item} />
                                    {i < build.buildPath.length - 1 && (
                                        <span className="text-slate-600">→</span>
                                    )}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs text-slate-500 uppercase tracking-wider">Starting Items</label>
                        <div className="flex gap-2">
                            {build.starter.map((item, i) => <ItemIcon key={i} item={item} />)}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs text-slate-500 uppercase tracking-wider">Core Build</label>
                        <div className="flex gap-2 items-center">
                            <ItemIcon item={build.boots} />
                            <div className="w-4 h-px bg-slate-700"></div>
                            {build.core.map((item, i) => <ItemIcon key={i} item={item} size="w-14 h-14" />)}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs text-slate-500 uppercase tracking-wider">Situational / Counter</label>
                        <div className="flex gap-2">
                            {build.situational.map((item, i) => <ItemIcon key={i} item={item} />)}
                        </div>
                    </div>
                </div>

                {/* Runes Section */}
                <div className="space-y-6">
                    <h3 className="text-xl text-slate-300 font-bold">Runes Reforged</h3>

                    <div className="bg-pyke-accent/20 p-4 rounded border border-slate-700">
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-2">
                                <img
                                    src="https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/7200_Domination.png"
                                    alt="Domination"
                                    className="w-8 h-8"
                                />
                                <span className="text-pyke-green font-bold text-lg">Hail of Blades</span>
                            </div>
                            <span className="text-xs text-slate-400">Domination</span>
                        </div>

                        <div className="space-y-3">
                            {/* Keystone */}
                            <div className="flex items-center gap-3">
                                <RuneIcon
                                    id={9923}
                                    name="Hail of Blades"
                                    iconPath="https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/HailOfBlades/HailOfBlades.png"
                                    reason={runes.reasons[9923]}
                                />
                                <span className="text-white font-bold">Hail of Blades</span>
                            </div>

                            {/* Primary Runes */}
                            <div className="flex gap-4 pl-2">
                                <RuneIcon id={8143} name="Sudden Impact" iconPath="https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/SuddenImpact/SuddenImpact.png" reason={runes.reasons[8143]} />

                                {/* Dynamic Vision Rune (Slot 2) */}
                                {runes.selectedPerkIds.includes(8136) ? (
                                    <RuneIcon id={8136} name="Zombie Ward" iconPath="https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/ZombieWard/ZombieWard.png" reason={runes.reasons[8136]} />
                                ) : (
                                    <RuneIcon id={8120} name="Ghost Poro" iconPath="https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/GhostPoro/GhostPoro.png" reason={runes.reasons[8120]} />
                                )}

                                <RuneIcon id={8106} name="Ultimate Hunter" iconPath="https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/UltimateHunter/UltimateHunter.png" reason={runes.reasons[8106]} />
                            </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-700">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs text-slate-400">Secondary Tree</span>
                                {runes.subStyleId === 8400 ? (
                                    <img src="https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/7204_Resolve.png" className="w-5 h-5" />
                                ) : (
                                    <img src="https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/7201_Precision.png" className="w-5 h-5" />
                                )}
                            </div>

                            <div className="flex gap-4 pl-2">
                                {runes.subStyleId === 8400 ? (
                                    <>
                                        <RuneIcon id={8444} name="Second Wind" iconPath="https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/SecondWind/SecondWind.png" reason={runes.reasons[8444]} />
                                        <RuneIcon id={8424} name="Unflinching" iconPath="https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/Unflinching/Unflinching.png" reason={runes.reasons[8424]} />
                                    </>
                                ) : (
                                    <>
                                        {runes.selectedPerkIds.includes(8009) ? (
                                            <RuneIcon id={8009} name="Presence of Mind" iconPath="https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/PresenceOfMind/PresenceOfMind.png" reason={runes.reasons[8009]} />
                                        ) : (
                                            <RuneIcon id={9111} name="Triumph" iconPath="https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/Triumph.png" reason={runes.reasons[9111]} />
                                        )}
                                        <RuneIcon id={8014} name="Coup de Grace" iconPath="https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/CoupDeGrace/CoupDeGrace.png" reason={runes.reasons[8014]} />
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
