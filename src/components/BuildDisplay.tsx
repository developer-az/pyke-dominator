import React from 'react';
import type { Build, RunePage, Item, MatchupAnalysis } from '../logic/pykeLogic';
import { getRuneIconUrl } from '../data/runeService';
import { HudFrame } from './HudFrame';
import { ChromeMark } from '../overlay/ChromeMark';

interface Props {
    build: Build;
    runes: RunePage;
    analysis: MatchupAnalysis;
    onExport: () => void;
    canExport: boolean;
    exportStatus: 'idle' | 'success' | 'error';
    accentColor?: string;
}

const ItemIcon: React.FC<{ item: Item; size?: string }> = ({ item, size = "w-12 h-12" }) => (
    <div className="group relative">
        <img
            src={`https://ddragon.leagueoflegends.com/cdn/15.1.1/img/item/${item.id}.png`}
            alt={item.name}
            className={`${size} border border-chrome-dim/40 group-hover:border-chrome-silver transition-all duration-200 cursor-help shadow-lg`}
            onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://ddragon.leagueoflegends.com/cdn/15.1.1/img/item/1001.png';
            }}
        />
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-chrome-ink/95 border border-chrome-silver/40 text-chrome-silver text-xs opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity shadow-lg">
            <div className="font-bold text-chrome-bright mb-1">{item.name}</div>
            <div>{item.reason || "Standard Pyke item."}</div>
        </div>
    </div>
);

const RuneIcon: React.FC<{ id: number; name: string; iconPath: string; reason?: string }> = ({ id, name, iconPath, reason }) => {
    const runeIconUrl = getRuneIconUrl(id);
    
    return (
        <div className="group relative">
            <img
                src={runeIconUrl}
                alt={name}
                className="w-8 h-8 border border-chrome-dim/40 group-hover:border-chrome-silver transition-colors cursor-help"
                onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (target.src !== iconPath) {
                        target.src = iconPath;
                    } else {
                        target.src = 'https://ddragon.leagueoflegends.com/cdn/15.1.1/img/perk/5001.png';
                    }
                }}
            />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-chrome-ink/95 border border-chrome-silver/40 text-chrome-silver text-xs opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity shadow-lg">
                <div className="font-bold text-chrome-bright mb-1">{name}</div>
                <div>{reason || "Standard Pyke rune."}</div>
            </div>
        </div>
    );
};

export const BuildDisplay: React.FC<Props> = ({ build, runes, analysis, onExport, canExport, exportStatus, accentColor }) => {
    return (
        <div className="space-y-8 animate-fade-in relative" style={{ zIndex: 1, position: 'relative', ['--build-accent' as string]: accentColor || 'var(--chrome-silver)' }}>
            {/* Header */}
            <div className="flex flex-wrap justify-between items-center gap-3 border-b border-chrome-silver/20 pb-4 relative">
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-chrome-silver/60 via-transparent to-chrome-blood/40" />
                <h2 className="hud-heading text-2xl text-chrome-bright drop-shadow-[0_0_8px_rgba(242,244,247,0.2)]">
                    <ChromeMark size={16} style={{ color: accentColor }} /> Dominator Loadout
                </h2>
                {canExport && (
                    <button
                        onClick={onExport}
                        disabled={exportStatus !== 'idle'}
                        className={`px-5 py-2.5 border-2 transition-all duration-200 uppercase font-bold text-sm tracking-wider shadow-lg clip-path-none ${
                            exportStatus === 'success' 
                                ? 'bg-emerald-600 text-white border-emerald-500' 
                                : exportStatus === 'error' 
                                    ? 'bg-chrome-blood text-white border-chrome-blood' 
                                    : 'bg-chrome-ink/80 hover:bg-chrome-silver hover:text-chrome-ink text-chrome-silver border-chrome-silver hover:scale-105 active:scale-95'
                        }`}
                        style={{ clipPath: 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)' }}
                    >
                        {exportStatus === 'success' ? '✓ Exported!' :
                            exportStatus === 'error' ? '✕ Failed' :
                                '→ Export Build'}
                    </button>
                )}
            </div>
            {canExport && (
                <p className="text-xs text-chrome-dim -mt-6">
                    Exports runes and item set. Item set appears in-game shop.
                </p>
            )}

            {/* STRATEGIC ANALYSIS SECTION */}
            <HudFrame accent="green" label="Doctrine" className="p-6 hud-scanlines">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                    <h1 className="text-9xl font-black text-pyke-green font-display">?</h1>
                </div>

                <div className="relative z-10">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="text-[10px] font-mono text-slate-500 uppercase tracking-[0.22em] mb-1">Mission Objective</h3>
                            <h2 className="text-3xl font-display text-white uppercase tracking-wide">{analysis.title}</h2>
                        </div>
                        <div className={`hud-chip ${analysis.aggressionLevel === 'EXTREME' ? 'hud-accent-blood !text-red-400' :
                            analysis.aggressionLevel === 'HIGH' ? 'hud-accent-blood !text-orange-400' :
                                analysis.aggressionLevel === 'MODERATE' ? '!text-yellow-400' :
                                    'hud-accent-cyan !text-cyan-300'
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
                            {analysis.roamAdvice && (
                                <p className="text-sm text-cyan-300/90 mt-3 border-l-2 border-cyan-500/40 pl-3">
                                    {analysis.roamAdvice}
                                </p>
                            )}
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

                    {/* Bot Lane Matchup Analysis */}
                    {analysis.botLaneMatchup && (
                        <div className="mt-6 pt-4 border-t border-slate-800">
                            <h4 className="text-xs font-bold text-pyke-green uppercase tracking-wider mb-3">Bot Lane Matchup</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-slate-400 text-sm">Difficulty:</span>
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                                            analysis.botLaneMatchup.matchupDifficulty === 'EASY' ? 'bg-green-500/20 text-green-400 border border-green-500/50' :
                                            analysis.botLaneMatchup.matchupDifficulty === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50' :
                                            analysis.botLaneMatchup.matchupDifficulty === 'HARD' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50' :
                                            'bg-red-500/20 text-red-400 border border-red-500/50'
                                        }`}>
                                            {analysis.botLaneMatchup.matchupDifficulty}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-400 mb-2">{analysis.botLaneMatchup.lanePhase}</p>
                                    <p className="text-sm text-slate-400"><strong className="text-slate-300">All-in Potential:</strong> {analysis.botLaneMatchup.allInPotential}</p>
                                </div>
                                <div>
                                    {analysis.botLaneMatchup.keyCooldowns.length > 0 && (
                                        <>
                                            <h5 className="text-xs font-bold text-slate-500 uppercase mb-2">Key Cooldowns</h5>
                                            <ul className="space-y-1">
                                                {analysis.botLaneMatchup.keyCooldowns.map((cd, i) => (
                                                    <li key={i} className="text-xs text-slate-400">• {cd}</li>
                                                ))}
                                            </ul>
                                        </>
                                    )}
                                </div>
                            </div>

                        </div>
                    )}

                    {/* Bot Lane Damage Comparison - At Bottom */}
                    {analysis.botLaneMatchup?.damageComparison && (
                        <div className="mt-6 pt-4 border-t border-slate-800">
                            <h4 className="text-xs font-bold text-pyke-green uppercase tracking-wider mb-3">2v2 Damage Comparison</h4>
                            <p className="text-xs text-slate-500 mb-4">Enemy Bot + Support vs Your Bot + Pyke</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                        {/* Enemy Damage */}
                                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                                            <div className="text-xs text-red-400 uppercase font-bold mb-2">Enemy Combo</div>
                                            <div className="text-xs text-slate-400 mb-2">{analysis.botLaneMatchup.damageComparison.enemyCombo.description}</div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <div className="text-xs text-slate-500">Level 3</div>
                                                    <div className="text-lg font-bold text-red-400">{analysis.botLaneMatchup.damageComparison.enemyCombo.level3}</div>
                                                </div>
                                                <div>
                                                    <div className="text-xs text-slate-500">Level 6</div>
                                                    <div className="text-lg font-bold text-red-400">{analysis.botLaneMatchup.damageComparison.enemyCombo.level6}</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Your Damage */}
                                        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                                            <div className="text-xs text-green-400 uppercase font-bold mb-2">Your Combo</div>
                                            <div className="text-xs text-slate-400 mb-2">{analysis.botLaneMatchup.damageComparison.yourCombo.description}</div>
                                            <div className="grid grid-cols-3 gap-2">
                                                <div>
                                                    <div className="text-xs text-slate-500">Level 3</div>
                                                    <div className="text-lg font-bold text-green-400">{analysis.botLaneMatchup.damageComparison.yourCombo.level3}</div>
                                                </div>
                                                <div>
                                                    <div className="text-xs text-slate-500">Level 6</div>
                                                    <div className="text-lg font-bold text-green-400">{analysis.botLaneMatchup.damageComparison.yourCombo.level6}</div>
                                                </div>
                                                <div>
                                                    <div className="text-xs text-slate-500">L6 + Ult</div>
                                                    <div className="text-lg font-bold text-pyke-green">{analysis.botLaneMatchup.damageComparison.yourCombo.level6WithUlt}</div>
                                                </div>
                                            </div>
                            </div>
                            </div>

                            {/* Advantage Indicator */}
                            <div className={`p-3 rounded-lg border ${
                                analysis.botLaneMatchup.damageComparison.advantage === 'FAVORABLE' 
                                    ? 'bg-green-500/10 border-green-500/30' 
                                    : analysis.botLaneMatchup.damageComparison.advantage === 'EVEN'
                                    ? 'bg-yellow-500/10 border-yellow-500/30'
                                    : 'bg-red-500/10 border-red-500/30'
                            }`}>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xs font-bold uppercase">Advantage:</span>
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                                        analysis.botLaneMatchup.damageComparison.advantage === 'FAVORABLE' 
                                            ? 'bg-green-500/20 text-green-400' 
                                            : analysis.botLaneMatchup.damageComparison.advantage === 'EVEN'
                                            ? 'bg-yellow-500/20 text-yellow-400'
                                            : 'bg-red-500/20 text-red-400'
                                    }`}>
                                        {analysis.botLaneMatchup.damageComparison.advantage}
                                    </span>
                                </div>
                                <ul className="space-y-1">
                                    {analysis.botLaneMatchup.damageComparison.notes.map((note, i) => (
                                        <li key={i} className="text-xs text-slate-400">• {note}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* Damage Analysis */}
                    {analysis.damageAnalysis && (
                        <div className="mt-6 pt-4 border-t border-slate-800">
                            <h4 className="text-xs font-bold text-pyke-green uppercase tracking-wider mb-3">Damage Analysis</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                                <div className="bg-slate-800/50 p-3 rounded border border-slate-700/50">
                                    <div className="text-xs text-slate-500 mb-1">Level 3 Combo</div>
                                    <div className="text-lg font-bold text-red-400">{analysis.damageAnalysis.level3Combo} damage</div>
                                </div>
                                <div className="bg-slate-800/50 p-3 rounded border border-slate-700/50">
                                    <div className="text-xs text-slate-500 mb-1">Level 6 Combo</div>
                                    <div className="text-lg font-bold text-orange-400">{analysis.damageAnalysis.level6Combo} damage</div>
                                </div>
                                <div className="bg-slate-800/50 p-3 rounded border border-slate-700/50">
                                    <div className="text-xs text-slate-500 mb-1">Level 6 + Ult</div>
                                    <div className="text-lg font-bold text-pyke-green">{analysis.damageAnalysis.level6WithUlt} damage</div>
                                </div>
                            </div>
                            <div className="text-sm text-slate-400 mb-2">
                                <strong className="text-slate-300">Execute Threshold:</strong> {analysis.damageAnalysis.killThreshold}
                            </div>
                            <ul className="space-y-1">
                                {analysis.damageAnalysis.notes.map((note, i) => (
                                    <li key={i} className="text-xs text-slate-500">• {note}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </HudFrame>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Items Section */}
                <HudFrame accent="steel" label="Arsenal" className="space-y-6 p-6">
                    <h3 className="hud-heading text-xl text-slate-300">
                        <ChromeMark size={14} className="text-chrome-bright" /> Item Build
                    </h3>

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
                </HudFrame>

                {/* Runes Section */}
                <HudFrame accent="blood" label="Perks" className="space-y-6 p-6">
                    <h3 className="hud-heading text-xl text-slate-300">
                        <ChromeMark size={14} className="text-chrome-blood" /> Runes Reforged
                    </h3>

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

                                {/* Dynamic Vision Rune (Slot 3) - Updated for Season 15 */}
                                {runes.selectedPerkIds.includes(8137) ? (
                                    <RuneIcon id={8137} name="Sixth Sense" iconPath="https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/SixthSense/SixthSense.png" reason={runes.reasons[8137]} />
                                ) : runes.selectedPerkIds.includes(8141) ? (
                                    <RuneIcon id={8141} name="Deep Ward" iconPath="https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/DeepWard/DeepWard.png" reason={runes.reasons[8141]} />
                                ) : runes.selectedPerkIds.includes(8140) ? (
                                    <RuneIcon id={8140} name="Grisly Mementos" iconPath="https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/GrislyMementos/GrislyMementos.png" reason={runes.reasons[8140]} />
                                ) : (
                                    <RuneIcon id={8137} name="Sixth Sense" iconPath="https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/SixthSense/SixthSense.png" reason={runes.reasons[8137]} />
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
                                        <RuneIcon id={8242} name="Unflinching" iconPath="https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/Unflinching/Unflinching.png" reason={runes.reasons[8242]} />
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
                </HudFrame>
            </div>
        </div>
    );
};
