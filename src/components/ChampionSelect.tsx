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
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-6 bg-pyke-accent/30 rounded-xl border border-pyke-green/20 backdrop-blur-sm">
            {ROLES.map((role) => (
                <div key={role} className="flex flex-col gap-2">
                    <label className="text-pyke-green font-bold uppercase tracking-wider text-sm">{role}</label>
                    <input
                        list={`champions-${role}`}
                        className="bg-pyke-dark border border-slate-700 rounded p-2 text-white focus:border-pyke-green focus:outline-none transition-colors"
                        placeholder="Select Enemy..."
                        onChange={(e) => {
                            const val = e.target.value;
                            const champ = champions.find(c => c.name === val);
                            onSelectionChange(role, champ || null);
                        }}
                    />
                    <datalist id={`champions-${role}`}>
                        {champions.map(c => (
                            <option key={c.id} value={c.name} />
                        ))}
                    </datalist>
                    {selections[role] && (
                        <div className="text-xs text-slate-400 flex gap-2">
                            <span className="bg-slate-800 px-1 rounded">{selections[role]?.damageType}</span>
                            <span className="bg-slate-800 px-1 rounded">{selections[role]?.tags[0]}</span>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};
