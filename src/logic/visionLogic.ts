/**
 * Support vision plan: where to ward, when to buy Control Wards / Oracle Lens.
 * Timing uses clean ceil countdown (not float % quirks) and real buy schedules —
 * not a fake "trinket CD" that drifts from the client's personal cooldown.
 */

import type { ProfileId } from './profiles';
import type { JungleThreat } from './jungleLogic';

export interface WardCue {
  id: string;
  label: string;
  detail: string;
  urgency: 'info' | 'warn' | 'spike';
  refreshSec: number;
}

/** Stealth-ward mental cycle for "re-ward this spot" reminders (not Live Client CD). */
const REWARD_CYCLE = 90;

export interface WardStatus {
  /** Where to place the next ward — one short line. */
  where: string;
  /** Why / how — kept short for the chip. */
  why: string;
  urgency: WardCue['urgency'];
  /**
   * Seconds until the next re-ward reminder in the current cycle.
   * Always an integer (ceil) — never a float flash.
   */
  refreshInSec: number;
  wardScore?: number;
  due: boolean;
  /** Buy / swap chip: "pink ×1" | "SWEEP swap" | "hold pink" */
  buyHint: string;
  /** Longer control-ward plan for tooltips. */
  controlPlan: string;
}

export interface VisionBuyPlan {
  /** Control wards to purchase on this back (0–2). */
  controlWardsToBuy: number;
  /** How many pinks you should have used / bought by this minute (guide total). */
  controlWardsExpectedByNow: number;
  /** Keep this many in inventory after the buy. */
  holdInInventory: number;
  /** Recommended trinket right now. */
  trinket: 'stealth' | 'oracle' | 'farsight';
  /** Short shop line for item-set / overlay. */
  shopLine: string;
}

/**
 * Optimal Control Ward cadence for engage supports (Pyke / Pantheon).
 * Goal: never walk without a pink after first back; spike buys before objectives.
 */
export function visionBuyPlan(
  gameTime: number,
  profileId: ProfileId,
  opts?: { hasUmbral?: boolean; hasOracle?: boolean; controlWardCount?: number }
): VisionBuyPlan {
  const minutes = gameTime / 60;
  const held = opts?.controlWardCount ?? 0;
  const hasOracle = !!opts?.hasOracle;
  const hasUmbral = !!opts?.hasUmbral;
  const support = profileId !== 'yone-mid';

  // Expected cumulative pink purchases by this point (guide, not hard rule)
  let expected = 0;
  if (minutes >= 2.5) expected = 1;
  if (minutes >= 5) expected = 2;
  if (minutes >= 8) expected = 3;
  if (minutes >= 12) expected = 4;
  if (minutes >= 16) expected = 5;
  if (minutes >= 22) expected = 6;

  let hold = support ? 1 : 0;
  if (minutes >= 12) hold = support ? 2 : 1;
  if (minutes >= 20) hold = 1;

  // Buy enough on this back to refill inventory to `hold`
  let toBuy = Math.max(0, hold - held);
  // Objective spikes: force a pink buy even if somehow holding
  if (support && minutes >= 4.5 && minutes <= 5.5 && held < 1) toBuy = Math.max(toBuy, 1);
  if (support && minutes >= 13 && minutes <= 15.5 && held < 2) toBuy = Math.max(toBuy, 2 - held);

  let trinket: VisionBuyPlan['trinket'] = 'stealth';
  if (profileId === 'yone-mid') {
    trinket = minutes >= 14 || hasUmbral ? 'farsight' : 'stealth';
  } else if (hasOracle) {
    trinket = 'oracle';
  } else if (hasUmbral || minutes >= 8.5) {
    // Classic support: Oracle once first legendary / ~9 min — clear before fights
    trinket = 'oracle';
  }

  const shopBits: string[] = [];
  if (toBuy > 0) shopBits.push(`Control Ward ×${toBuy}`);
  if (trinket === 'oracle' && !hasOracle) shopBits.push('swap Oracle Lens');
  if (trinket === 'farsight') shopBits.push('Farsight OK');
  if (shopBits.length === 0) shopBits.push(held >= hold ? `hold ${held} pink` : 'vision OK');

  return {
    controlWardsToBuy: toBuy,
    controlWardsExpectedByNow: expected,
    holdInInventory: hold,
    trinket,
    shopLine: shopBits.join(' · '),
  };
}

function rewardCountdown(gameTime: number): { refreshInSec: number; due: boolean; cycleIndex: number } {
  if (gameTime <= 0) return { refreshInSec: REWARD_CYCLE, due: false, cycleIndex: 0 };
  const cycleIndex = Math.floor(gameTime / REWARD_CYCLE);
  const elapsed = gameTime - cycleIndex * REWARD_CYCLE;
  // ceil avoids 0↔1 float flicker from Live Client fractional seconds
  const refreshInSec = Math.max(0, Math.ceil(REWARD_CYCLE - elapsed - 1e-6));
  const due = refreshInSec <= 12;
  return { refreshInSec, due, cycleIndex };
}

export function buildWardCues(
  gameTime: number,
  profileId: ProfileId,
  jg: JungleThreat | null
): WardCue[] {
  if (gameTime <= 0) return [];
  const minutes = gameTime / 60;
  const cues: WardCue[] = [];
  const jgBot = jg?.sideBias === 'bot' || jg?.gankRisk === 'high';
  const { due, cycleIndex } = rewardCountdown(gameTime);

  if (profileId !== 'yone-mid') {
    if (minutes >= 1.0 && minutes <= 1.5) {
      cues.push({
        id: 'ward-open',
        label: 'Open ward',
        detail: jgBot
          ? 'Pixel brush (dragon side) — covers invade + first gank path.'
          : 'Pixel near dragon OR river entrance by 1:25 — first info win.',
        urgency: 'warn',
        refreshSec: REWARD_CYCLE,
      });
    }
    if (minutes >= 2.0 && minutes <= 2.5) {
      cues.push({
        id: 'ward-scuttle',
        label: 'Scuttle vision',
        detail: 'River brush / pixel before 2:15 crab — track enemy jg side.',
        urgency: jg?.gankRisk === 'high' ? 'spike' : 'warn',
        refreshSec: REWARD_CYCLE,
      });
    }
    if (minutes > 2.5 && minutes < 8 && due) {
      cues.push({
        id: `ward-refresh-${cycleIndex}`,
        label: 'Re-ward',
        detail: jgBot
          ? 'Tri or river — jg bot. Drop a Control Ward when you crash.'
          : 'River brush on shove; lane bush only vs hide-engage.',
        urgency: 'info',
        refreshSec: REWARD_CYCLE,
      });
    }
    if (minutes >= 3.5 && minutes <= 6 && jgBot) {
      cues.push({
        id: 'ward-deep',
        label: 'Deep track',
        detail: `Enemy ${jg?.junglerName || 'jg'} bot — ward raptor entrance on crash leave.`,
        urgency: 'warn',
        refreshSec: REWARD_CYCLE,
      });
    }
    if (minutes >= 4.0 && minutes <= 5.2) {
      cues.push({
        id: 'ward-drake1',
        label: 'Drake setup',
        detail: 'Pit Control Ward + river clear. Oracle soon if not swapped.',
        urgency: 'warn',
        refreshSec: 90,
      });
    }
    if (minutes >= 8.5 && minutes <= 10) {
      cues.push({
        id: 'ward-oracle',
        label: 'Oracle Lens',
        detail: 'Swap Sweeper now — clear before fights / next objective.',
        urgency: 'spike',
        refreshSec: 60,
      });
    }
    if (minutes >= 13 && minutes <= 15.5) {
      cues.push({
        id: 'ward-drake-soul',
        label: 'Objective wards',
        detail: '2 Control Wards: pit + entrance. Sweep jungle before spawn.',
        urgency: 'spike',
        refreshSec: 90,
      });
    }
  } else {
    if (minutes >= 1.1 && minutes <= 1.6) {
      cues.push({
        id: 'yone-ward-open',
        label: 'Mid open ward',
        detail: jgBot
          ? 'Ward bot-side river — protects you + bot from early gank.'
          : 'One river bush by 1:25 — know which side jg started.',
        urgency: 'warn',
        refreshSec: REWARD_CYCLE,
      });
    }
    if (minutes >= 2.8 && minutes <= 4.0 && (due || jg?.gankRisk === 'high')) {
      cues.push({
        id: 'yone-ward-gank',
        label: 'Gank ward',
        detail: jg
          ? `${jg.junglerName}: ward the river they path. Short E only with vision.`
          : 'River ward before trading E — no fog all-ins.',
        urgency: jg?.gankRisk === 'high' ? 'spike' : 'warn',
        refreshSec: REWARD_CYCLE,
      });
    }
    if (minutes >= 12 && minutes <= 16) {
      cues.push({
        id: 'yone-ward-obj',
        label: 'Obj vision',
        detail: 'Ward enemy jungle entrance before dragon — E-R flank needs fog.',
        urgency: 'warn',
        refreshSec: 90,
      });
    }
  }

  return cues;
}

/**
 * Compact, single-line ward read for its own indicator — not part of the cue stack.
 */
export function buildWardStatus(
  gameTime: number,
  profileId: ProfileId,
  jg: JungleThreat | null,
  wardScore?: number,
  inv?: { hasUmbral?: boolean; hasOracle?: boolean; controlWardCount?: number }
): WardStatus | null {
  if (gameTime <= 0) return null;

  const { refreshInSec, due } = rewardCountdown(gameTime);
  const plan = visionBuyPlan(gameTime, profileId, inv);
  const cues = buildWardCues(gameTime, profileId, jg);
  const jgBot = jg?.sideBias === 'bot' || jg?.gankRisk === 'high';
  const minutes = gameTime / 60;

  let where: string;
  let why: string;
  let urgency: WardStatus['urgency'] = due ? 'warn' : 'info';

  if (cues.length > 0) {
    const top = cues[0];
    const [place, ...rest] = top.detail.split(/ — |\. /);
    where = place.trim().replace(/\.$/, '');
    why = (rest.join(' ') || top.label).trim();
    urgency = top.urgency;
  } else if (profileId === 'yone-mid') {
    where = jgBot ? 'Bot-side river bush' : 'River bush on shove side';
    why = due ? 'Re-ward window' : 'Keep the entrance covered';
  } else if (minutes >= 12) {
    where = 'Objective pit + jungle entrance';
    why = due ? 'Re-ward before spawn' : 'Deny before the fight walks up';
  } else {
    where = jgBot ? 'Tri-bush / river (jg bot)' : 'River brush when you crash';
    why = due ? 'Re-ward window' : 'Cover the entrance you play through';
  }

  let buyHint = plan.shopLine;
  if (plan.trinket === 'oracle' && !inv?.hasOracle) {
    buyHint = plan.controlWardsToBuy > 0
      ? `SWEEP + pink ×${plan.controlWardsToBuy}`
      : 'Swap Oracle Lens'
  } else if (plan.controlWardsToBuy > 0) {
    buyHint = `Buy pink ×${plan.controlWardsToBuy}`;
  } else if (due) {
    buyHint = 'WARD NOW';
  } else {
    buyHint = `${refreshInSec}s`;
  }

  const controlPlan = supportControlPlanText(minutes, plan);

  return {
    where,
    why,
    urgency: due || plan.controlWardsToBuy > 0 || (plan.trinket === 'oracle' && !inv?.hasOracle)
      ? urgency === 'info'
        ? 'warn'
        : urgency
      : urgency,
    refreshInSec,
    wardScore,
    due: due || plan.controlWardsToBuy >= 2 || (plan.trinket === 'oracle' && !inv?.hasOracle && minutes >= 8.5 && minutes <= 10),
    buyHint,
    controlPlan,
  };
}

function supportControlPlanText(minutes: number, plan: VisionBuyPlan): string {
  if (minutes < 2.5) {
    return 'First back: buy 1 Control Ward. Keep 1 in inv after that.';
  }
  if (minutes < 8) {
    return `Lane phase: buy pink every back until you hold ${plan.holdInInventory}. ~${plan.controlWardsExpectedByNow} bought by now is on pace.`;
  }
  if (minutes < 14) {
    return `Oracle on + hold ${plan.holdInInventory} pinks. Expect ~${plan.controlWardsExpectedByNow} Control Wards used by mid game.`;
  }
  return `Objectives: place pit pink, refill to ${plan.holdInInventory} on each back. Pace ~${plan.controlWardsExpectedByNow}+ total.`;
}
