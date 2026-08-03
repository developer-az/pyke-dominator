import React from 'react';
import type { WardStatus } from '../logic/visionLogic';

/**
 * Standalone vision indicator — where + buy/swap hint. Not part of the cue stack.
 */
export const WardIndicator: React.FC<{ status: WardStatus | null; compact?: boolean }> = ({
  status,
  compact,
}) => {
  if (!status) return null;

  return (
    <div
      className={`hud-ward${status.due ? ' hud-ward--due' : ''}`}
      title={`${status.why}\n${status.controlPlan}`}
    >
      <svg
        className="hud-ward-icon"
        width={compact ? 10 : 12}
        height={compact ? 10 : 12}
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M8 1.5 12.5 6v5.5L8 14.5 3.5 11.5V6z" />
        <circle cx="8" cy="8" r="1.8" fill="currentColor" stroke="none" />
      </svg>
      <span className="hud-ward-where">{status.where}</span>
      <span className="hud-ward-meta">{status.buyHint}</span>
    </div>
  );
};
