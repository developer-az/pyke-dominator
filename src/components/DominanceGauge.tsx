import React from 'react';
import type { DominanceMetrics } from '../logic/pykeLogic';

interface DominanceGaugeProps {
    metrics: DominanceMetrics;
}

export const DominanceGauge: React.FC<DominanceGaugeProps> = ({ metrics }) => {
    const { score, grade, title, summary, earlyGameScore, midGameScore, lateGameScore } = metrics;

    // Color logic based on grade
    const getGradeColor = (g: string) => {
        switch (g) {
            case 'S+': return 'text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.6)]';
            case 'S': return 'text-pyke-green drop-shadow-[0_0_10px_rgba(0,255,157,0.6)]';
            case 'A': return 'text-emerald-400';
            case 'B': return 'text-blue-400';
            case 'C': return 'text-orange-400';
            case 'D': return 'text-red-500';
            default: return 'text-slate-400';
        }
    };

    const getBarColor = (val: number) => {
        if (val >= 80) return 'bg-pyke-green shadow-[0_0_10px_rgba(0,255,157,0.4)]';
        if (val >= 60) return 'bg-emerald-500';
        if (val >= 40) return 'bg-yellow-500';
        return 'bg-red-500';
    };

    return (
        <div className="bg-slate-900/80 p-6 rounded-xl border border-slate-800/80 backdrop-blur-md shadow-xl relative overflow-hidden group hover:border-pyke-green/30 transition-all duration-500">
            {/* Background Pulse Effect */}
            <div className={`absolute inset-0 opacity-5 group-hover:opacity-10 transition-opacity duration-700 pointer-events-none bg-gradient-to-br ${grade === 'S+' || grade === 'S' ? 'from-pyke-green to-transparent' : 'from-slate-700 to-transparent'}`}></div>

            <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Dominance Factor</h3>
                        <h2 className={`text-2xl font-display font-bold tracking-wider ${getGradeColor(grade)}`}>
                            {title}
                        </h2>
                    </div>
                    <div className="flex flex-col items-end">
                        <div className={`text-5xl font-display font-black ${getGradeColor(grade)}`}>
                            {grade}
                        </div>
                        <div className="text-xs text-slate-500 font-mono mt-1">SCORE: {score}/100</div>
                    </div>
                </div>

                <p className="text-slate-300 text-sm mb-6 leading-relaxed border-l-2 border-slate-700 pl-3 italic">
                    "{summary}"
                </p>

                {/* Phase Bars */}
                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-400 w-12">EARLY</span>
                        <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-1000 ease-out ${getBarColor(earlyGameScore)}`}
                                style={{ width: `${earlyGameScore}%` }}
                            ></div>
                        </div>
                        <span className="text-xs font-mono text-slate-500 w-8 text-right">{earlyGameScore}%</span>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-400 w-12">MID</span>
                        <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-1000 ease-out delay-100 ${getBarColor(midGameScore)}`}
                                style={{ width: `${midGameScore}%` }}
                            ></div>
                        </div>
                        <span className="text-xs font-mono text-slate-500 w-8 text-right">{midGameScore}%</span>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-400 w-12">LATE</span>
                        <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-1000 ease-out delay-200 ${getBarColor(lateGameScore)}`}
                                style={{ width: `${lateGameScore}%` }}
                            ></div>
                        </div>
                        <span className="text-xs font-mono text-slate-500 w-8 text-right">{lateGameScore}%</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
