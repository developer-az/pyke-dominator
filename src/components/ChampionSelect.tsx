import React from 'react';
import type { Champion } from '../logic/pykeLogic';

interface Props {
    champions: Champion[];
    onSelectionChange: (role: string, champion: Champion | null) => void;
    selections: Record<string, Champion | null>;
}

const ROLES = ['Top', 'Jungle', 'Mid', 'Bot', 'Support'];

export const ChampionSelect: React.FC<Props> = ({ champions, onSelectionChange, selections }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {ROLES.map((role) => (
                <div key={role} className="flex flex-col gap-2">
                    <label className="text-pyke-green font-bold uppercase tracking-wider text-sm mb-1">{role}</label>
                    <div className="relative">
                        <input
                            list={`champions-${role}`}
                            className="w-full bg-slate-800/80 border border-slate-700/50 rounded-lg p-2.5 text-white placeholder-slate-500 focus:border-pyke-green focus:outline-none focus:ring-2 focus:ring-pyke-green/20 transition-all duration-200 hover:border-slate-600"
                            placeholder="Select Enemy..."
                            value={selections[role]?.name || ''}
                            onChange={(e) => {
                                const val = e.target.value;
                                const champ = champions.find(c => c.name === val);
                                onSelectionChange(role, champ || null);
                            }}
                        />
                        {selections[role] && (
                            <button
                                onClick={() => onSelectionChange(role, null)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-red-400 transition-colors text-xs font-bold"
                                title="Clear selection"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                    <datalist id={`champions-${role}`}>
                        {champions.map(c => (
                            <option key={c.id} value={c.name} />
                        ))}
                    </datalist>
                    {selections[role] && (
                        <div className="flex gap-2 mt-1">
                            <span className="text-xs bg-slate-800/60 text-slate-300 px-2 py-0.5 rounded border border-slate-700/50">
                                {selections[role]?.damageType}
                            </span>
                            <span className="text-xs bg-slate-800/60 text-slate-300 px-2 py-0.5 rounded border border-slate-700/50">
                                {selections[role]?.tags[0]}
                            </span>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};
