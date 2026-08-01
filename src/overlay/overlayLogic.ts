import type { Build, MatchupAnalysis } from '../logic/pykeLogic';
import type { ProfileId } from '../logic/profiles';
import { formatCd } from '../logic/summonerSpells';
import { nextCannon, formatCannonEta } from '../logic/waveLogic';
import { assessJungleThreat } from '../logic/jungleLogic';
import { buildWardCues } from '../logic/visionLogic';
import { trackBuildProgress, inventoryHasName } from '../logic/buildProgress';

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
  summonerSpells?: {
    summonerSpellOne?: { displayName: string };
    summonerSpellTwo?: { displayName: string };
  };
}

export interface OverlayBotSummoner {
  role: 'Bot' | 'Support';
  championName: string;
  championId?: number;
  spells: Array<{
    name: string;
    short: string;
    baseCd: number;
    remaining: number;
    ready: boolean;
    source?: string;
  }>;
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
  isYone?: boolean;
  profileHint?: ProfileId | null;
  enemies?: OverlayEnemy[];
  allies?: Array<{ championName: string; level: number; position?: string; isDead?: boolean }>;
  cachedChampSelectEnemies?: Array<{ championId: number; championName?: string; position?: string }>;
  enemyBotSummoners?: OverlayBotSummoner[];
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
  profileId?: ProfileId;
}

/** Practical cues from Live Client + matchup analysis — levels, items, clock, mid/bot route. */
export function buildInGameCues(state: OverlayState, ctx: OverlayCueContext = {}): OverlayCue[] {
  const cues: OverlayCue[] = [];
  if (!state.inGame) return cues;

  const profileId = ctx.profileId || state.profileHint || (state.isYone ? 'yone-mid' : 'pyke-support');
  if (profileId === 'yone-mid') {
    return finalizeCues(buildYoneCues(state, ctx), state, profileId);
  }
  return finalizeCues(buildPykeCues(state, ctx), state, profileId);
}

/** Merge shared jg/ward/cannon and keep top urgency cues (slightly higher budget). */
function finalizeCues(base: OverlayCue[], state: OverlayState, profileId: ProfileId): OverlayCue[] {
  const gameTime = state.gameTime ?? 0;
  const jg = assessJungleThreat(gameTime, state.enemies || []);
  const shared: OverlayCue[] = [];

  if (jg && (jg.gankRisk === 'high' || jg.gankRisk === 'medium')) {
    shared.push({
      id: 'jg-threat',
      label: jg.label,
      detail: jg.detail,
      urgency: jg.gankRisk === 'high' ? 'spike' : 'warn',
    });
  }

  for (const w of buildWardCues(gameTime, profileId, jg).slice(0, 1)) {
    shared.push({
      id: w.id,
      label: w.label,
      detail: w.detail,
      urgency: w.urgency,
    });
  }

  // Cannon shove — only the relevant window (Pyke support priority)
  if (profileId === 'pyke-support') {
    const cannon = nextCannon(gameTime);
    if (cannon?.isActionWindow) {
      shared.push({
        id: 'cannon-shove',
        label: cannon.eta > 0 ? `Cannon ${formatCannonEta(cannon.eta)}` : 'Cannon wave',
        detail:
          cannon.eta > 5
            ? 'Set up shove on THIS cannon — crash then leave (mid/jg). Skip non-cannon roams.'
            : 'Crash THIS cannon → leave. Non-cannon waves are not the roam timer.',
        urgency: 'spike',
      });
    }
  }

  const priority = { spike: 0, warn: 1, info: 2 } as const;
  return [...base, ...shared]
    .sort((a, b) => priority[a.urgency] - priority[b.urgency])
    .slice(0, 3);
}

function buildYoneCues(state: OverlayState, ctx: OverlayCueContext): OverlayCue[] {
  const cues: OverlayCue[] = [];
  const { analysis, build } = ctx;
  const level = state.localPlayer?.level ?? state.activePlayerLevel ?? 1;
  const gameTime = state.gameTime ?? 0;
  const minutes = Math.floor(gameTime / 60);
  const progress = trackBuildProgress(state.localPlayer?.items, build);
  const hasBerserkers =
    progress.ownedIds.has('3006') ||
    inventoryHasName(state.localPlayer?.items, ['berserker', 'greaves']);
  const lowAggro = analysis?.aggressionLevel === 'LOW';

  // Ally jungler sync (Yone is mid — partner lane is jg, not another mid)
  const jgTip = analysis?.roamAdvice || analysis?.tips?.find((t) => /jungl|gank|path|dive|clear/i.test(t));
  if (jgTip && minutes >= 2 && minutes <= 6 && level < 9) {
    cues.push({
      id: 'yone-jg-sync',
      label: 'Jg sync',
      detail: jgTip.slice(0, 140),
      urgency: lowAggro ? 'spike' : 'warn',
    });
  }

  if (level <= 2) {
    cues.push({
      id: 'yone-early',
      label: 'Farm range Q',
      detail: lowAggro
        ? 'Let them push. Preserve HP — E trades start at 3.'
        : 'Thin with Q. Level 3 E is the first real window.',
      urgency: 'warn',
    });
  } else if (level >= 3 && level < 6) {
    cues.push({
      id: 'yone-e-trades',
      label: `L${level} E trades`,
      detail: 'Q3 ready → short E>Q>W → snap back. Do not open E into their full combo.',
      urgency: 'spike',
    });
  } else if (level >= 6 && level < 9) {
    cues.push({
      id: 'yone-ult',
      label: 'R online',
      detail: 'E → Q3 → R → W → autos → snap. Miss R = leave.',
      urgency: 'spike',
    });
  } else if (level >= 11) {
    cues.push({
      id: 'yone-side',
      label: 'Side lane',
      detail: analysis?.roamAdvice?.slice(0, 120) || 'Push side, deny camps, TP to fights — long-lane duelist.',
      urgency: 'warn',
    });
  }

  if (progress.next) {
    cues.push({
      id: `buy-${progress.next.id}`,
      label: `Next: ${progress.next.name}`,
      detail: (progress.next.reason || 'Stay on build path.').slice(0, 110),
      urgency: progress.completedCount === 0 ? 'spike' : 'warn',
    });
  } else if (minutes >= 2 && minutes <= 5 && !hasBerserkers) {
    cues.push({
      id: 'yone-boots',
      label: "Rush Berserker's",
      detail: 'AS boots cut Q CD — real first spike before legendaries.',
      urgency: 'spike',
    });
  }

  // Free R only when ult is available
  const flashDown = (state.enemyBotSummoners || []).flatMap((l) =>
    l.spells.filter((s) => s.short === 'Flash' && !s.ready && s.remaining > 0)
  );
  if (level >= 6 && flashDown.length > 0) {
    cues.push({
      id: 'sum-flash',
      label: 'Flash down',
      detail: `Enemy bot Flash ~${formatCd(flashDown[0].remaining)} — look for R picks.`,
      urgency: 'spike',
    });
  }

  return cues;
}

function buildPykeCues(state: OverlayState, ctx: OverlayCueContext): OverlayCue[] {
  const cues: OverlayCue[] = [];
  const { analysis, build } = ctx;
  const level = state.localPlayer?.level ?? state.activePlayerLevel ?? 1;
  const gameTime = state.gameTime ?? 0;
  const minutes = Math.floor(gameTime / 60);
  const seconds = Math.floor(gameTime % 60);
  const progress = trackBuildProgress(state.localPlayer?.items, build);
  const hasUmbral =
    progress.ownedIds.has('3179') || inventoryHasName(state.localPlayer?.items, ['umbral']);
  const hasBoots = progress.hasBoots;

  const laneDiff = analysis?.botLaneMatchup?.matchupDifficulty;
  const hardLane = laneDiff === 'HARD' || laneDiff === 'VERY_HARD';
  const unfavorable2v2 = analysis?.botLaneMatchup?.damageComparison?.advantage === 'UNFAVORABLE';
  const lowAggro = analysis?.aggressionLevel === 'LOW';

  // --- XP / level-6 timing vs roam tradeoffs ---
  const enemyBotLevels = (state.enemies || [])
    .filter((e) => {
      const p = (e.position || '').toUpperCase();
      return p === 'BOTTOM' || p === 'UTILITY' || p === 'SUPPORT';
    })
    .map((e) => e.level || 1);
  const enemyBotAvg =
    enemyBotLevels.length > 0
      ? enemyBotLevels.reduce((a, b) => a + b, 0) / enemyBotLevels.length
      : level;
  const xpBehind = level < 6 && level + 0.4 < enemyBotAvg;
  const xpAhead = level < 6 && level > enemyBotAvg + 0.4;
  const cannon = nextCannon(gameTime);

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
  } else if (level >= 4 && level < 6) {
    if (xpBehind) {
      cues.push({
        id: 'xp-hold',
        label: 'Hold for XP',
        detail:
          'Behind on XP before 6 — soak cannon/XP, skip long mid roams. Jg sync only on crash + shown path.',
        urgency: 'spike',
      });
    } else if (xpAhead && cannon?.isActionWindow) {
      cues.push({
        id: 'xp-convert',
        label: 'XP lead — convert',
        detail: 'Ahead pre-6: crash THIS cannon → mid/jg sync, then return for your 6.',
        urgency: 'warn',
      });
    } else {
      cues.push({
        id: 'ult-soon',
        label: 'Ult next level',
        detail: 'Perfect XP for 6 — R execute snowball. Roam only after cannon crash.',
        urgency: 'warn',
      });
    }
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

  if (gameTime > 0) {
    if (minutes >= 2 && minutes < 3 && !hasBoots) {
      cues.push({
        id: 'first-back',
        label: 'First back window',
        detail: `~${minutes}:${seconds.toString().padStart(2, '0')} — bank gold for upgrade / boots.`,
        urgency: 'info',
      });
    }
    // Roam timing only on cannon windows (or post-6 when R is the convert tool)
    if (minutes >= 3 && minutes <= 6 && level >= 6 && cannon?.isActionWindow) {
      const roamDetail = analysis?.roamAdvice
        ? analysis.roamAdvice.slice(0, 140)
        : hardLane || lowAggro
          ? 'Cannon crash → leave. Prefer mid only on spent dashes / ally setup; else jg/river.'
          : 'Cannon crash → W mid river. Track enemy jungler path.';
      cues.push({
        id: 'first-roam',
        label: 'Roam on cannon',
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

  // Item path by ID — advances past first purchase correctly
  if (progress.next) {
    cues.push({
      id: `buy-${progress.next.id}`,
      label: `Next: ${progress.next.name}`,
      detail: (progress.next.reason || (hasUmbral ? 'Stay on spike path.' : 'Vision denial unlocks the fights you choose.')).slice(
        0,
        120
      ),
      urgency: 'spike',
    });
  } else if (!hasUmbral && level >= 4) {
    cues.push({
      id: 'rush-umbral',
      label: 'Rush Umbral',
      detail: 'Vision denial unlocks the fights you choose.',
      urgency: 'info',
    });
  }

  if (hasBoots && minutes >= 5 && minutes <= 12) {
    cues.push({
      id: 'mobility',
      label: 'Boots active',
      detail: hardLane || lowAggro
        ? 'Boots = leave timers. Convert cannon crashes cross-map.'
        : 'Maximize side presence between cannon waves.',
      urgency: 'info',
    });
  }
  if (progress.completedCount >= 3 && minutes >= 18) {
    cues.push({
      id: 'full-build-pressure',
      label: 'Item spike',
      detail: 'Fog picks before objectives — your burst window is now.',
      urgency: 'spike',
    });
  }

  // Free R angles ONLY with ult (level 6+)
  const flashDown = (state.enemyBotSummoners || []).flatMap((l) =>
    l.spells.filter((s) => s.short === 'Flash' && !s.ready && s.remaining > 0)
  );
  if (level >= 6 && flashDown.length > 0) {
    cues.push({
      id: 'sum-flash',
      label: 'Flash down',
      detail: `Enemy ${flashDown.length > 1 ? 'bot' : 'Flash'} ~${formatCd(flashDown[0].remaining)} — free R angles.`,
      urgency: 'spike',
    });
  } else if (level < 6 && flashDown.length > 0) {
    cues.push({
      id: 'sum-flash-pre6',
      label: 'Flash down',
      detail: `Flash ~${formatCd(flashDown[0].remaining)} — trade/zone only. No R until 6.`,
      urgency: 'info',
    });
  }

  return cues;
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

/** Resolve allied mid from live client allies (Pyke support partner). */
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

/** Resolve allied jungler (Yone mid partner — Yone is already mid). */
export function resolveAllyJungleName(
  allies: OverlayState['allies'],
  champions: Array<{ name: string; id: string; tags: string[] }>
): string | null {
  if (!allies?.length) return null;
  const jg = allies.find((a) => {
    const p = (a.position || '').toUpperCase();
    return p === 'JUNGLE' || p === 'JNG';
  });
  if (jg) return jg.championName;

  // Smite isn't on ally payload here — fall back to common jg tags if unique
  const jgTagged = allies.filter((ally) => {
    const champ = champions.find(
      (c) =>
        c.name.toLowerCase() === ally.championName.toLowerCase() ||
        c.id.toLowerCase() === ally.championName.toLowerCase()
    );
    if (!champ) return false;
    // Classic jg: Fighter/Tank without Marksman/Support primary
    return (
      (champ.tags.includes('Fighter') || champ.tags.includes('Tank')) &&
      !champ.tags.includes('Marksman') &&
      !champ.tags.includes('Support')
    );
  });
  if (jgTagged.length === 1) return jgTagged[0].championName;
  return null;
}
