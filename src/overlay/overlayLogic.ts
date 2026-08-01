import type { Build, MatchupAnalysis } from '../logic/pykeLogic';

export interface OverlayEnemy {
  championName: string;
  level?: number;
  position?: string;
  isDead?: boolean;
  items?: string[];
  scores?: {
    assists: number;
    creepScore: number;
    deaths: number;
    kills: number;
    wardScore: number;
  };
}

export interface OverlayLocalPlayer {
  championName: string;
  level: number;
  isDead: boolean;
  items: Array<{ itemID: number; displayName: string; count: number; slot: number }>;
  scores?: OverlayEnemy['scores'];
  position?: string;
  currentGold: number;
  summonerSpells?: {
    summonerSpellOne?: { displayName: string };
    summonerSpellTwo?: { displayName: string };
  };
}

export interface OverlayState {
  inGame: boolean;
  gameflowPhase?: string | null;
  gameMode?: string | null;
  gameTime?: number;
  mapName?: string | null;
  localPlayer?: OverlayLocalPlayer | null;
  isPyke?: boolean;
  enemies?: OverlayEnemy[];
  allies?: Array<{ championName: string; level: number; position?: string; isDead?: boolean }>;
  cachedChampSelectEnemies?: Array<{ championId: number; championName?: string; position?: string }>;
  activePlayerLevel?: number;
  timestamp?: number;
}

export interface OverlayCue {
  id: string;
  label: string;
  detail: string;
  urgency: 'info' | 'warn' | 'spike';
}

export interface OverlayCueContext {
  analysis?: MatchupAnalysis | null;
  build?: Build | null;
}

/** Practical cues from Live Client + matchup analysis — levels, items, clock, mid/bot route. */
export function buildInGameCues(state: OverlayState, ctx: OverlayCueContext = {}): OverlayCue[] {
  const cues: OverlayCue[] = [];
  if (!state.inGame) return cues;

  const { analysis, build } = ctx;
  const level = state.localPlayer?.level ?? state.activePlayerLevel ?? 1;
  const gameTime = state.gameTime ?? 0;
  const minutes = Math.floor(gameTime / 60);
  const seconds = Math.floor(gameTime % 60);
  const itemNames = (state.localPlayer?.items || []).map((i) => i.displayName.toLowerCase());
  const hasBoots = itemNames.some((n) => n.includes('boots') || n.includes('greaves') || n.includes('treads') || n.includes('steelcaps') || n.includes('lucidity') || n.includes('mobility'));
  const hasUmbral = itemNames.some((n) => n.includes('umbral'));
  const hasVoltaic = itemNames.some((n) => n.includes('voltaic'));
  const hasYoumuu = itemNames.some((n) => n.includes('youmuu'));
  const hasAxiom = itemNames.some((n) => n.includes('axiom'));
  const hasHubris = itemNames.some((n) => n.includes('hubris'));
  const hasSecondCore = hasVoltaic || hasYoumuu || hasAxiom || hasHubris;
  const completedLegendaries = itemNames.filter((n) =>
    n.includes('umbral') || n.includes('voltaic') || n.includes('youmuu') ||
    n.includes('hubris') || n.includes('axiom') || n.includes('edge of night') ||
    n.includes('serpent') || n.includes('serylda') || n.includes('guardian angel') ||
    n.includes('maw') || n.includes('chempunk') || n.includes("death's dance") ||
    n.includes('mercurial')
  ).length;

  const laneDiff = analysis?.botLaneMatchup?.matchupDifficulty;
  const hardLane = laneDiff === 'HARD' || laneDiff === 'VERY_HARD';
  const unfavorable2v2 = analysis?.botLaneMatchup?.damageComparison?.advantage === 'UNFAVORABLE';
  const lowAggro = analysis?.aggressionLevel === 'LOW';
  const secondCoreName =
    build?.core[1]?.name ||
    (hasYoumuu ? "Youmuu's" : hasVoltaic ? 'Voltaic' : 'second core');

  // Level power spikes — gate speculative all-ins on hard/burst lanes
  if (level === 1) {
    cues.push({
      id: 'lvl2',
      label: 'Level 2 spike',
      detail: hardLane
        ? 'Contest XP — all-in only if their key spell is down.'
        : 'Contest XP — Q+E window opens at 2.',
      urgency: 'spike',
    });
  } else if (level === 2 || level === 3) {
    if (hardLane || unfavorable2v2) {
      cues.push({
        id: 'early-window',
        label: `L${level} windows`,
        detail: 'Thin trades on spent CDs. Crash → leave for mid/jg — skip extended 2v2.',
        urgency: 'warn',
      });
    } else {
      cues.push({
        id: 'early-allin',
        label: `Level ${level} all-in`,
        detail: 'Bush Q → E. Trade with grey health up.',
        urgency: 'spike',
      });
    }
  } else if (level >= 5 && level < 6) {
    cues.push({
      id: 'ult-soon',
      label: 'Ult next level',
      detail: 'Play for XP — R execute + reset angle at 6.',
      urgency: 'warn',
    });
  } else if (level >= 6 && level < 8) {
    cues.push({
      id: 'ult-online',
      label: 'R online',
      detail: analysis?.roamAdvice
        ? analysis.roamAdvice.slice(0, 120)
        : 'Crash bot → convert mid/jungle. R resets decide skirmishes.',
      urgency: 'spike',
    });
  } else if (level >= 11 && level < 13) {
    cues.push({
      id: 'mid-levels',
      label: 'Mid-game spike',
      detail: 'Lower R CD — chain flanks with ADC for resets.',
      urgency: 'spike',
    });
  } else if (level >= 16) {
    cues.push({
      id: 'late-levels',
      label: 'Late-game R',
      detail: 'Hold for multi-kill angles. R finishes fights — it does not open them.',
      urgency: 'warn',
    });
  }

  // Clock-based roam / objective windows
  if (gameTime > 0) {
    if (minutes >= 2 && minutes < 3 && !hasBoots) {
      cues.push({
        id: 'first-back',
        label: 'First back window',
        detail: `~${minutes}:${seconds.toString().padStart(2, '0')} — bank gold for upgrade / boots.`,
        urgency: 'info',
      });
    }
    if (minutes >= 3 && minutes <= 4) {
      const roamDetail = analysis?.roamAdvice
        ? analysis.roamAdvice.slice(0, 140)
        : hardLane || lowAggro
          ? 'Crash → leave. Prefer mid only on spent dashes / ally setup; else jg/river.'
          : 'Shove bot → W mid river. Track enemy jungler path.';
      cues.push({
        id: 'first-roam',
        label: 'Roam timing',
        detail: roamDetail,
        urgency: 'warn',
      });
    }
    if (minutes >= 7 && minutes <= 9) {
      cues.push({
        id: 'herald-setup',
        label: 'Herald / river',
        detail: 'Deep vision + pick before objective spawn.',
        urgency: 'info',
      });
    }
    if (minutes >= 13 && minutes <= 15) {
      cues.push({
        id: 'dragon-setup',
        label: 'Dragon setup',
        detail: 'Clear vision early. Hold R for cross-map execute.',
        urgency: 'warn',
      });
    }
    if (minutes >= 16 && minutes <= 20) {
      cues.push({
        id: 'soul-baron-setup',
        label: 'Soul / Baron window',
        detail: 'Umbral clear → side fog picks. Save R for collapsing fights.',
        urgency: 'warn',
      });
    }
    if (minutes > 20 && minutes <= 30) {
      cues.push({
        id: 'mid-late-flank',
        label: 'Mid-late flanks',
        detail: 'Play fog edges. Peel ADC first, then look for R resets.',
        urgency: 'spike',
      });
    }
    if (minutes > 30) {
      cues.push({
        id: 'super-late',
        label: 'Super late',
        detail: 'One mistake ends it — ward, wait, punish overextends only.',
        urgency: 'warn',
      });
    }
  }

  // Item power spikes
  if (!hasUmbral && level >= 4) {
    cues.push({
      id: 'rush-umbral',
      label: 'Rush Umbral',
      detail: 'Vision denial unlocks the fights you choose.',
      urgency: 'info',
    });
  }
  if (hasUmbral && !hasSecondCore) {
    cues.push({
      id: 'post-umbral',
      label: `Next: ${secondCoreName}`,
      detail: build?.core[1]?.reason
        ? build.core[1].reason.slice(0, 120)
        : 'Finish second core — fight spike.',
      urgency: 'spike',
    });
  }
  if (hasUmbral && hasSecondCore && !hasAxiom && completedLegendaries < 3 && minutes >= 12) {
    cues.push({
      id: 'third-item',
      label: 'Third item window',
      detail: build?.situational[0]
        ? `${build.situational[0].name} — ${((build.situational[0].reason || '').slice(0, 80))}`
        : 'Axiom for R resets, or Edge/Serpent into their tools.',
      urgency: 'info',
    });
  }
  if (hasBoots && minutes >= 5 && minutes <= 12) {
    cues.push({
      id: 'mobility',
      label: 'Boots active',
      detail: hardLane || lowAggro
        ? 'Boots = leave timers. Convert every crash cross-map.'
        : 'Maximize side presence between waves.',
      urgency: 'info',
    });
  }
  if (completedLegendaries >= 3 && minutes >= 18) {
    cues.push({
      id: 'full-build-pressure',
      label: 'Item spike',
      detail: 'Fog picks before objectives — your burst window is now.',
      urgency: 'spike',
    });
  }

  const priority = { spike: 0, warn: 1, info: 2 } as const;
  return cues
    .sort((a, b) => priority[a.urgency] - priority[b.urgency])
    .slice(0, 2);
}

export function formatGameTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Resolve allied ADC from live client allies (BOTTOM, else Marksman via catalog). */
export function resolveAllyAdcName(
  allies: OverlayState['allies'],
  champions: Array<{ name: string; id: string; tags: string[] }>
): string | null {
  if (!allies?.length) return null;
  const bottom = allies.find((a) => (a.position || '').toUpperCase() === 'BOTTOM');
  if (bottom) return bottom.championName;
  for (const ally of allies) {
    const champ = champions.find(
      (c) => c.name.toLowerCase() === ally.championName.toLowerCase() || c.id.toLowerCase() === ally.championName.toLowerCase()
    );
    if (champ?.tags.includes('Marksman')) return ally.championName;
  }
  return null;
}

/** Resolve allied mid from live client allies. */
export function resolveAllyMidName(
  allies: OverlayState['allies'],
  champions: Array<{ name: string; id: string; tags: string[] }>
): string | null {
  if (!allies?.length) return null;
  const mid = allies.find((a) => {
    const p = (a.position || '').toUpperCase();
    return p === 'MIDDLE' || p === 'MID';
  });
  if (mid) return mid.championName;
  for (const ally of allies) {
    const champ = champions.find(
      (c) => c.name.toLowerCase() === ally.championName.toLowerCase() || c.id.toLowerCase() === ally.championName.toLowerCase()
    );
    if (champ && (champ.tags.includes('Mage') || champ.tags.includes('Assassin')) && !champ.tags.includes('Marksman')) {
      return ally.championName;
    }
  }
  return null;
}
