import React, { useState, useRef, useEffect } from 'react';
import type { Champion } from '../logic/pykeLogic';

interface Props {
    champions: Champion[];
    onSelectionChange: (role: string, champion: Champion | null) => void;
    selections: Record<string, Champion | null>;
    roles?: string[]; // Optional: specify which roles to show
}

export const ChampionSelect: React.FC<Props> = ({ champions, onSelectionChange, selections, roles }) => {
    const displayRoles = roles || ['Top', 'Jungle', 'Mid', 'Bot', 'Support'];
    const [openDropdowns, setOpenDropdowns] = useState<{ [key: string]: boolean }>({});
    const [searchTerms, setSearchTerms] = useState<{ [key: string]: string }>({});
    const dropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

    const handleSearch = (role: string, value: string) => {
        setSearchTerms(prev => ({ ...prev, [role]: value }));
        setOpenDropdowns(prev => ({ ...prev, [role]: true }));
    };

    const selectChampion = (role: string, champion: Champion) => {
        onSelectionChange(role, champion);
        setOpenDropdowns(prev => ({ ...prev, [role]: false }));
        setSearchTerms(prev => ({ ...prev, [role]: '' }));
    };

    const clearSelection = (role: string) => {
        onSelectionChange(role, null);
        setSearchTerms(prev => ({ ...prev, [role]: '' }));
    };

    // Filter champions based on search term
    const getFilteredChampions = (role: string): Champion[] => {
        const searchTerm = searchTerms[role]?.toLowerCase() || '';
        if (!searchTerm) return champions;
        return champions.filter(c => 
            c.name.toLowerCase().includes(searchTerm) ||
            c.id.toLowerCase().includes(searchTerm)
        );
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            Object.keys(dropdownRefs.current).forEach(role => {
                const ref = dropdownRefs.current[role];
                if (ref && !ref.contains(event.target as Node)) {
                    setOpenDropdowns(prev => ({ ...prev, [role]: false }));
                }
            });
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className={`grid grid-cols-1 ${displayRoles.length === 1 ? 'md:grid-cols-1' : 'md:grid-cols-5'} gap-4`}>
            {displayRoles.map((role) => {
                const isOpen = openDropdowns[role] || false;
                const searchTerm = searchTerms[role] || '';
                const selectedChampion = selections[role];
                const filteredChampions = getFilteredChampions(role);

                return (
                    <div key={role} className="flex flex-col gap-2">
                        <label className={`font-bold uppercase tracking-wider text-sm mb-1 ${
                            role === 'YourADC' ? 'text-blue-400' : 'text-pyke-green'
                        }`}>
                            {role === 'YourADC' ? 'Your ADC' : role}
                        </label>
                        <div 
                            className="relative" 
                            ref={(el) => { dropdownRefs.current[role] = el; }}
                        >
                            {/* Input Field */}
                            <div className="relative">
                                <input
                                    type="text"
                                    className="w-full bg-slate-800/80 border border-slate-700/50 rounded-lg p-2.5 text-white placeholder-slate-500 focus:border-pyke-green focus:outline-none focus:ring-2 focus:ring-pyke-green/20 transition-all duration-200 hover:border-slate-600 pr-8"
                                    placeholder="Type to search..."
                                    value={selectedChampion ? selectedChampion.name : searchTerm}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (selectedChampion && val !== selectedChampion.name) {
                                            clearSelection(role);
                                        }
                                        handleSearch(role, val);
                                    }}
                                    onFocus={() => setOpenDropdowns(prev => ({ ...prev, [role]: true }))}
                                />
                                {selectedChampion && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            clearSelection(role);
                                        }}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-red-400 transition-colors text-xs font-bold"
                                        title="Clear selection"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>

                            {/* Dropdown List */}
                            {isOpen && (
                                <div className="absolute z-50 w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                    {filteredChampions.length === 0 ? (
                                        <div className="p-3 text-sm text-slate-400 text-center">
                                            No champions found
                                        </div>
                                    ) : (
                                        <div className="py-1">
                                            {filteredChampions.map((champion) => (
                                                <button
                                                    key={champion.id}
                                                    type="button"
                                                    className="w-full text-left px-3 py-2 hover:bg-slate-800 transition-colors flex items-center gap-2"
                                                    onClick={() => selectChampion(role, champion)}
                                                >
                                                    <span className="text-white text-sm">{champion.name}</span>
                                                    <span className="text-xs text-slate-500 ml-auto">
                                                        {champion.tags[0]}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Selected Champion Info */}
                        {selectedChampion && (
                            <div className="flex gap-2 mt-1">
                                <span className="text-xs bg-slate-800/60 text-slate-300 px-2 py-0.5 rounded border border-slate-700/50">
                                    {selectedChampion.damageType}
                                </span>
                                <span className="text-xs bg-slate-800/60 text-slate-300 px-2 py-0.5 rounded border border-slate-700/50">
                                    {selectedChampion.tags[0]}
                                </span>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
