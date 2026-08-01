/**
 * Pro-style ward placement + mental timers (trinket ~90–120s).
 * Clock-gated spots for Support (Pyke) and Mid (Yone), biased by enemy jg threat.
 */

import type { ProfileId } from './profiles';
import type { JungleThreat } from './jungleLogic';

export interface WardCue {
  id: string;
  label: string;
  detail: string;
  urgency: 'info' | 'warn' | 'spike';
  /** Suggested refresh interval for this ward (seconds) */
  refreshSec: number;
}

const TRINKET = 110; // average stealth ward lifetime mental model

export function buildWardCues(
  gameTime: number,
  profileId: ProfileId,
  jg: JungleThreat | null
): WardCue[] {
  if (gameTime <= 0) return [];
  const minutes = gameTime / 60;
  const cues: WardCue[] = [];
  const jgBot = jg?.sideBias === 'bot' || jg?.gankRisk === 'high';

  if (profileId === 'pyke-support') {
    // 1:05–1:25 pixel / opposite-side river (pro open)
    if (minutes >= 1.0 && minutes <= 1.6) {
      cues.push({
        id: 'ward-open',
        label: 'Open ward',
        detail: jgBot
          ? 'Pixel brush (dragon side) now — covers invade + first gank path.'
          : 'Pixel near dragon OR river entrance by 1:25 — first info win.',
        urgency: 'warn',
        refreshSec: TRINKET,
      });
    }
    // Pre-scuttle
    if (minutes >= 2.0 && minutes <= 2.6) {
      cues.push({
        id: 'ward-scuttle',
        label: 'Scuttle vision',
        detail: 'River brush / pixel before 2:15 crab — track enemy jg side.',
        urgency: jg?.gankRisk === 'high' ? 'spike' : 'warn',
        refreshSec: TRINKET,
      });
    }
    // Lane phase river + tri
    if (minutes > 2.6 && minutes < 8) {
      const due = Math.floor(gameTime / TRINKET);
      // Pulse a refresh reminder every ~trinket window
      if (gameTime % TRINKET < 18) {
        cues.push({
          id: `ward-refresh-${due}`,
          label: 'Refresh ward',
          detail: jgBot
            ? 'Tri-bush or river — jg threat bot. Control ward in river when pushing.'
            : 'River brush when shoving; lane bush only if they hide engage.',
          urgency: 'info',
          refreshSec: TRINKET,
        });
      }
    }
    // Deep track when crashing / roaming
    if (minutes >= 3.5 && minutes <= 6 && jgBot) {
      cues.push({
        id: 'ward-deep',
        label: 'Deep track',
        detail: `Enemy ${jg?.junglerName || 'jg'} pathing bot — ward their raptor entrance on crash leave.`,
        urgency: 'warn',
        refreshSec: TRINKET,
      });
    }
    // Dragon −60s
    if (minutes >= 4.0 && minutes <= 5.2) {
      cues.push({
        id: 'ward-drake1',
        label: 'Drake setup',
        detail: 'Vision 60s early: pit control ward + river clear (Oracle at 9).',
        urgency: 'warn',
        refreshSec: 90,
      });
    }
    if (minutes >= 13 && minutes <= 15.5) {
      cues.push({
        id: 'ward-drake-soul',
        label: 'Objective wards',
        detail: 'Control ward on pit; trinkets in jungle behind — deny before spawn.',
        urgency: 'spike',
        refreshSec: 90,
      });
    }
  } else {
    // Yone mid — track jg for side safety + river
    if (minutes >= 1.1 && minutes <= 1.7) {
      cues.push({
        id: 'yone-ward-open',
        label: 'Mid open ward',
        detail: jgBot
          ? 'Ward bot-side river (their path) — protects you + bot from early gank.'
          : 'Ward one river bush by 1:25 — know which side jg started.',
        urgency: 'warn',
        refreshSec: TRINKET,
      });
    }
    if (minutes >= 2.8 && minutes <= 4.2) {
      cues.push({
        id: 'yone-ward-gank',
        label: 'Gank ward',
        detail: jg
          ? `${jg.junglerName}: ward the river they path. Short E only with vision.`
          : 'River ward before trading E — no fog all-ins.',
        urgency: jg?.gankRisk === 'high' ? 'spike' : 'warn',
        refreshSec: TRINKET,
      });
    }
    if (minutes >= 5.5 && minutes <= 8) {
      cues.push({
        id: 'yone-ward-deep',
        label: 'Track camps',
        detail: 'Deep ward raptors / pixel when you shove — side-lane E only if jg shown.',
        urgency: 'info',
        refreshSec: TRINKET,
      });
    }
    if (minutes >= 12 && minutes <= 16) {
      cues.push({
        id: 'yone-ward-obj',
        label: 'Obj vision',
        detail: 'Ward enemy jungle entrance before dragon — your E-R flank needs fog they lack.',
        urgency: 'warn',
        refreshSec: 90,
      });
    }
  }

  return cues;
}
