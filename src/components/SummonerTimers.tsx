import React from 'react';
import type { OverlayBotSummoner } from '../overlay/overlayLogic';
import { formatCd } from '../logic/summonerSpells';
import { HudFrame } from './HudFrame';
import { ChromeMark } from '../overlay/ChromeMark';

interface Props {
  lanes: OverlayBotSummoner[];
  accentColor?: string;
  /** Compact strip for overlay / idle panel */
  compact?: boolean;
}

export const SummonerTimers: React.FC<Props> = ({ lanes, accentColor, compact }) => {
  if (!lanes.length) return null;

  const body = (
    <div className={compact ? 'space-y-1.5' : 'space-y-3'}>
      {lanes.map((lane) => (
        <div key={lane.role} className="flex flex-wrap items-center gap-2">
          <span className={`font-mono uppercase tracking-wider text-chrome-dim ${compact ? 'text-[9px]' : 'text-[10px]'} w-14 shrink-0`}>
            {lane.role}
          </span>
          <span className={`text-chrome-bright truncate ${compact ? 'text-[11px]' : 'text-sm'} min-w-[4rem]`}>
            {lane.championName}
          </span>
          <div className="flex flex-wrap gap-1">
            {lane.spells.map((sp) => {
              const ready = sp.ready || sp.remaining <= 0;
              return (
                <span
                  key={`${lane.role}-${sp.short}`}
                  title={
                    ready
                      ? `${sp.name} ready`
                      : `${sp.name} ${formatCd(sp.remaining)}${sp.source ? ` (${sp.source})` : ''}`
                  }
                  className={`hud-chip !py-0.5 ${compact ? '!text-[9px]' : '!text-[10px]'} ${
                    ready
                      ? 'hud-accent-green !text-chrome-bright'
                      : '!text-chrome-dim opacity-80'
                  }`}
                >
                  {sp.short} {ready ? 'UP' : formatCd(sp.remaining)}
                </span>
              );
            })}
          </div>
        </div>
      ))}
      {!compact && (
        <p className="text-[9px] font-mono text-chrome-dim/70 tracking-wide">
          Flash/Heal/Barrier start on death · Ignite on their kill (Live Client heuristic).
        </p>
      )}
    </div>
  );

  if (compact) return <div className="border-t border-white/10 pt-1.5">{body}</div>;

  return (
    <HudFrame accent="cyan" label="Sums" className="p-5">
      <h2 className="hud-heading text-xl text-chrome-bright mb-4">
        <ChromeMark size={14} style={{ color: accentColor }} /> Enemy Bot Sums
      </h2>
      {body}
    </HudFrame>
  );
};
