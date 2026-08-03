/**
 * Live game-state read (behind / even / ahead).
 *
 * Some profiles — Pantheon support above all — need genuinely different builds,
 * runes and fight selection when the game is going badly. This turns whatever
 * the Live Client gives us into one coarse, honest state.
 */

export type GameState = 'behind' | 'even' | 'ahead';

export interface ProfileSituation {
  state: GameState;
  /** Your level minus the average enemy level. */
  levelDelta: number;
  kills: number;
  deaths: number;
  assists: number;
  minutes: number;
  /** -3 .. +3 — how strong the read is. */
  swing: number;
  reasons: string[];
}

export const EVEN_SITUATION: ProfileSituation = {
  state: 'even',
  levelDelta: 0,
  kills: 0,
  deaths: 0,
  assists: 0,
  minutes: 0,
  swing: 0,
  reasons: [],
};

export interface SituationInput {
  level?: number;
  enemyLevels?: number[];
  scores?: { kills?: number; deaths?: number; assists?: number };
  /** Enemy deaths/kills if we can see them — used as a team-state proxy. */
  enemyScores?: Array<{ kills?: number; deaths?: number; assists?: number }>;
  gameTime?: number;
}

export function inferSituation(input: SituationInput): ProfileSituation {
  const minutes = Math.max(0, (input.gameTime ?? 0) / 60);
  const level = input.level ?? 1;
  const enemyLevels = (input.enemyLevels || []).filter((l) => l > 0);
  const enemyAvg = enemyLevels.length
    ? enemyLevels.reduce((a, b) => a + b, 0) / enemyLevels.length
    : level;
  const levelDelta = Number((level - enemyAvg).toFixed(2));

  const kills = input.scores?.kills ?? 0;
  const deaths = input.scores?.deaths ?? 0;
  const assists = input.scores?.assists ?? 0;

  const reasons: string[] = [];
  let swing = 0;

  if (levelDelta <= -1.5) {
    swing -= 2;
    reasons.push(`${Math.abs(levelDelta).toFixed(1)} levels down on the enemy average.`);
  } else if (levelDelta <= -0.7) {
    swing -= 1;
    reasons.push('Slightly behind on XP.');
  } else if (levelDelta >= 1.5) {
    swing += 2;
    reasons.push(`${levelDelta.toFixed(1)} levels up.`);
  } else if (levelDelta >= 0.7) {
    swing += 1;
  }

  const participation = kills + assists * 0.5;
  if (deaths >= 3 && deaths - participation >= 2) {
    swing -= 2;
    reasons.push(`${deaths} deaths with little participation — you are the bounty.`);
  } else if (deaths - participation >= 1.5) {
    swing -= 1;
    reasons.push('Negative trade record so far.');
  } else if (participation - deaths >= 3) {
    swing += 2;
    reasons.push('Well ahead on takedowns.');
  } else if (participation - deaths >= 1.5) {
    swing += 1;
  }

  // Enemy team snowball proxy: a fed enemy makes "even" a lie.
  const fedEnemies = (input.enemyScores || []).filter(
    (s) => (s.kills ?? 0) - (s.deaths ?? 0) >= 4
  ).length;
  if (fedEnemies >= 1) {
    swing -= 1;
    reasons.push(`${fedEnemies} enemy snowballing — respect their solo threat range.`);
  }

  swing = Math.max(-3, Math.min(3, swing));
  const state: GameState = swing <= -2 ? 'behind' : swing >= 2 ? 'ahead' : 'even';

  return { state, levelDelta, kills, deaths, assists, minutes, swing, reasons };
}
