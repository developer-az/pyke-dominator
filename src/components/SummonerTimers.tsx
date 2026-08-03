import React, { useState } from 'react';
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

function isMidFocus(lanes: OverlayBotSummoner[]): boolean {
  return lanes.some((l) => l.role === 'Mid') && !lanes.some((l) => l.role === 'Bot' || l.role === 'Support');
}

function formatPrimaryClipboard(lanes: OverlayBotSummoner[]): string | null {
  const mid = lanes.find((l) => l.role === 'Mid');
  const adc = lanes.find((l) => l.role === 'Bot');
  const primary = mid || adc;
  if (!primary) return null;
  const bits = primary.spells.map((s) =>
    s.ready || s.remaining <= 0 ? `${s.short} UP` : `${s.short} ${formatCd(s.remaining)}`
  );
  const label = primary.role === 'Mid' ? 'MID' : 'ADC';
  return `${label} ${primary.championName}: ${bits.join(' · ')}`;
}

export const SummonerTimers: React.FC<Props> = ({ lanes, accentColor, compact }) => {
  const [copied, setCopied] = useState(false);
  if (!lanes.length) return null;

  const midFocus = isMidFocus(lanes);
  const copyLabel = midFocus ? 'Copy mid sums' : 'Copy ADC sums';
  const copiedLabel = midFocus ? 'Copied mid sums' : 'Copied ADC sums';
  const heading = midFocus ? 'Enemy Mid Sums' : 'Enemy Bot Sums';

  const handleCopy = async () => {
    const text = formatPrimaryClipboard(lanes);
    if (!text) return;
    try {
      if (window.electronAPI?.clipboardWrite) {
        await window.electronAPI.clipboardWrite(text);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const body = (
    <div className={compact ? 'space-y-1.5' : 'space-y-3'}>
      {lanes.map((lane) => (
        <div key={lane.role} className="flex flex-wrap items-center gap-2">
          <span
            className={`font-mono uppercase tracking-wider text-chrome-dim ${compact ? 'text-[9px]' : 'text-[10px]'} w-14 shrink-0`}
          >
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
                    ready ? 'hud-accent-green !text-chrome-bright' : '!text-chrome-dim opacity-80'
                  }`}
                >
                  {sp.short} {ready ? 'UP' : formatCd(sp.remaining)}
                </span>
              );
            })}
          </div>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void handleCopy()}
          className={`hud-chip !py-0.5 ${compact ? '!text-[9px]' : '!text-[10px]'} cursor-pointer hover:opacity-100`}
          title={midFocus ? 'Copy mid laner summoner timers' : 'Copy ADC summoner timers'}
        >
          {copied ? copiedLabel : copyLabel}
        </button>
        {!compact && (
          <p className="text-[9px] font-mono text-chrome-dim/70 tracking-wide">
            {midFocus
              ? 'Flash on death · Ignite on kill · Mid Flash/TP ups auto-copy'
              : 'Flash/Heal/Barrier on death · Ignite/Exhaust on kill/assist · ADC ups auto-copy'}
          </p>
        )}
      </div>
    </div>
  );

  if (compact) return <div className="border-t border-white/10 pt-1.5">{body}</div>;

  return (
    <HudFrame accent="cyan" label="Sums" className="p-5">
      <h2 className="hud-heading text-xl text-chrome-bright mb-4">
        <ChromeMark size={14} style={{ color: accentColor }} /> {heading}
      </h2>
      {body}
    </HudFrame>
  );
};
