import React from 'react';
import type { WardStatus } from '../logic/visionLogic';

/**
 * Standalone vision indicator — purpose + pink count + sweep jobs.
 * Compact still shows purpose (why), not just a place name.
 */
export const WardIndicator: React.FC<{ status: WardStatus | null; compact?: boolean }> = ({
  status,
  compact,
}) => {
  if (!status) return null;

  const sweepLine =
    status.sweepTargets && status.sweepTargets.length > 0
      ? status.sweepTargets[0]
      : null;

  return (
    <div
      className={`hud-ward${status.due ? ' hud-ward--due' : ''}`}
      title={`${status.why}\n${status.controlPlan}${
        status.sweepTargets?.length ? `\n${status.sweepTargets.join('\n')}` : ''
      }`}
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
      <div className="hud-ward-copy min-w-0">
        <span className="hud-ward-where">{status.where}</span>
        <span className="hud-ward-why">{sweepLine || status.why}</span>
      </div>
      <span className="hud-ward-meta">{status.buyHint}</span>
    </div>
  );
};
