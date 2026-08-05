import type { Build, MatchupAnalysis } from '../logic/pykeLogic';
import type { ProfileId } from '../logic/profiles';
import { formatCd } from '../logic/summonerSpells';
import { nextCannon, formatCannonEta } from '../logic/waveLogic';
import { assessJungleThreat } from '../logic/jungleLogic';
import { buildWardStatus, type WardStatus } from '../logic/visionLogic';
import { trackBuildProgress, inventoryHasName, type BuildItemRef } from '../logic/buildProgress';
import { activeThreatsByName } from '../logic/counters';
import { inferSituation, type ProfileSituation } from '../logic/situation';

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
  role: 'Bot' | 'Support' | 'Mid';
  championName: string;
  championId?: number;
  spells: Array<{
    name: string;
    short: string;
    baseCd: number;
    remaining: number;
    ready: boolean;
    readyAt?: number;
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
  /**
   * Wall-clock seconds this cue may stay once first shown.
   * Roam / tempo lines should be short (≤25s); fight spikes can linger longer.
   */
  maxAgeSec?: number;
}

export interface OverlayCueContext {
  analysis?: MatchupAnalysis | null;
  build?: Build | null;
  profileId?: ProfileId;
  situation?: ProfileSituation | null;
}

/** Resolve the active profile for a live state (live champion wins over stored). */
export function resolveProfileId(state: OverlayState, fallback?: ProfileId): ProfileId {
  const live = (state.localPlayer?.championName || '').toLowerCase().replace(/[^a-z]/g, '');
  if (live === 'yone') return 'yone-mid';
  if (live === 'pantheon') return 'pantheon-support';
  if (live === 'pyke') return 'pyke-support';
  return state.profileHint || fallback || (state.isYone ? 'yone-mid' : 'pyke-support');
}

/** Behind / even / ahead read straight off the live payload. */
export function situationFromState(state: OverlayState): ProfileSituation {
  return inferSituation({
    level: state.localPlayer?.level ?? state.activePlayerLevel,
    enemyLevels: (state.enemies || []).map((e) => e.level || 0),
    scores: state.localPlayer?.scores,
    enemyScores: (state.enemies || []).map((e) => e.scores || {}),
    gameTime: state.gameTime,
  });
}

/** Vision read for the standalone ward indicator (never in the cue stack). */
export function getWardStatus(state: OverlayState, profileId: ProfileId): WardStatus | null {
  const gameTime = state.gameTime ?? 0;
  const focusLane = profileId === 'yone-mid' ? 'mid' : 'bot';
  const jg = assessJungleThreat(gameTime, state.enemies || [], focusLane);
  const items = state.localPlayer?.items || [];
  const owned = new Set(items.map((i) => i.itemID));
  const controlWardCount = items
    .filter((i) => i.itemID === 2055)
    .reduce((n, i) => n + (i.count || 1), 0);
  return buildWardStatus(gameTime, profileId, jg, state.localPlayer?.scores?.wardScore, {
    hasUmbral: owned.has(3179),
    hasOracle: owned.has(3364),
    controlWardCount,
  });
}

/** Gank probability square — yellow = fog risk, red = brief high window. */
export function getGankStatus(
  state: OverlayState,
  profileId: ProfileId
): import('../logic/jungleLogic').JungleThreat | null {
  const gameTime = state.gameTime ?? 0;
  if (gameTime <= 0) return null;
  const focusLane = profileId === 'yone-mid' ? 'mid' : 'bot';
  return assessJungleThreat(gameTime, state.enemies || [], focusLane);
}

/** Remaining recommended items — anything already owned by item ID is dropped. */
export function remainingBuildItems(state: OverlayState, build: Build | null | undefined): BuildItemRef[] {
  return trackBuildProgress(state.localPlayer?.items, build).remaining;
}

/** Practical cues from Live Client + matchup analysis — levels, items, clock, mid/bot route. */
export function buildInGameCues(state: OverlayState, ctx: OverlayCueContext = {}): OverlayCue[] {
  const cues: OverlayCue[] = [];
  if (!state.inGame) return cues;

  const profileId = ctx.profileId || resolveProfileId(state);
  if (profileId === 'yone-mid') {
    return finalizeCues(buildYoneCues(state, ctx), state, profileId, ctx.analysis);
  }
  if (profileId === 'pantheon-support') {
    return finalizeCues(buildPantheonCues(state, ctx), state, profileId, ctx.analysis);
  }
  return finalizeCues(buildPykeCues(state, ctx), state, profileId, ctx.analysis);
}

/** Merge shared jg/threat/cannon cues and keep the highest-urgency few. */
function finalizeCues(
  base: OverlayCue[],
  state: OverlayState,
  profileId: ProfileId,
  analysis?: MatchupAnalysis | null
): OverlayCue[] {
  const gameTime = state.gameTime ?? 0;
  const minutes = gameTime / 60;
  const focusLane = profileId === 'yone-mid' ? 'mid' : 'bot';
  const jg = assessJungleThreat(gameTime, state.enemies || [], focusLane);
  const shared: OverlayCue[] = [];

  // Loading / first ~90s — exact matchup doctrine (pro lines, no basics)
  if (minutes < 1.6 && analysis?.loadingDoctrine?.length) {
    shared.push({
      id: 'matchup-doctrine',
      label: analysis.loadingDoctrine[0] || analysis.title,
      detail: analysis.loadingDoctrine.slice(1, 3).join(' · ').slice(0, 160),
      urgency: 'warn',
      maxAgeSec: 70,
    });
  } else if (minutes >= 1.6 && analysis?.tips?.length) {
    // Rotate one pro tip every game-minute — id changes so TTL cannot bury the rail
    const tipIdx = Math.floor(minutes) % analysis.tips.length;
    const tip = analysis.tips[tipIdx];
    if (tip && tip.length > 24) {
      shared.push({
        id: `pro-tip-${Math.floor(minutes)}-${tipIdx}`,
        label: 'Pro read',
        detail: tip.slice(0, 140),
        urgency: 'info',
        maxAgeSec: 55,
      });
    }
  }

  if (jg && (jg.gankRisk === 'high' || jg.gankRisk === 'medium')) {
    // Id includes minute + risk so a sticky yellow/red line can refresh after TTL
    shared.push({
      id: `jg-threat-${jg.gankRisk}-${Math.floor(minutes)}`,
      label: jg.label,
      detail: jg.detail,
      urgency: jg.gankRisk === 'high' ? 'spike' : 'warn',
      maxAgeSec: jg.gankRisk === 'high' ? 22 : 35,
    });
  }

  // Named enemy threats (Naafiri) — these outrank generic clock advice once they
  // actually have their ultimate online.
  const threats = activeThreatsByName((state.enemies || []).map((e) => e.championName));
  for (const threat of threats) {
    const enemy = (state.enemies || []).find(
      (e) => e.championName.toLowerCase().replace(/[^a-z]/g, '') === threat.id.toLowerCase()
    );
    if (enemy?.isDead) continue;
    const online = (enemy?.level ?? 1) >= 6;
    shared.push({
      id: `threat-${threat.id}`,
      label: threat.cue.label,
      detail: threat.cue.detail,
      urgency: online ? 'spike' : 'warn',
    });
  }

  // Cannon shove — short-lived roam timer only
  if (profileId === 'pyke-support' || profileId === 'pantheon-support') {
    const cannon = nextCannon(gameTime);
    if (cannon?.isActionWindow && (cannon.eta == null || cannon.eta <= 20)) {
      shared.push({
        id: 'cannon-shove',
        label: cannon.eta > 0 ? `Cannon ${formatCannonEta(cannon.eta)}` : 'Cannon wave',
        detail: 'Crash → leave. Skip non-cannon roams.',
        urgency: 'spike',
        maxAgeSec: 18,
      });
    }
  }

  const priority = { spike: 0, warn: 1, info: 2 } as const;
  const seen = new Set<string>();
  return [...base, ...shared]
    .filter((cue) => {
      if (seen.has(cue.id)) return false;
      seen.add(cue.id);
      return true;
    })
    .sort((a, b) => priority[a.urgency] - priority[b.urgency])
    // Extra candidates so OverlayApp TTL can refill after sticky lines expire
    .slice(0, 6)
    .map((cue) => ({
      ...cue,
      // Default TTL: roam/tempo info dies fast; spikes get a bit longer
      maxAgeSec:
        cue.maxAgeSec ??
        (cue.id.includes('roam') || cue.id.includes('cannon')
          ? 22
          : cue.urgency === 'info'
            ? 18
            : 35),
    }));
}

function buildPantheonCues(state: OverlayState, ctx: OverlayCueContext): OverlayCue[] {
  const cues: OverlayCue[] = [];
  const { analysis, build } = ctx;
  const level = state.localPlayer?.level ?? state.activePlayerLevel ?? 1;
  const gameTime = state.gameTime ?? 0;
  const minutes = gameTime / 60;
  const progress = trackBuildProgress(state.localPlayer?.items, build);
  const situation = ctx.situation || situationFromState(state);
  const behind = situation.state === 'behind';
  const ahead = situation.state === 'ahead';
  const hasOracle = progress.ownedIds.has('3364');
  const cannon = nextCannon(gameTime);

  if (analysis?.preyFocus && level >= 2) {
    cues.push({
      id: 'prey-focus',
      label: `Prey ${analysis.primaryTargets[0] || ''}`.trim(),
      detail: analysis.preyFocus,
      urgency: 'spike',
      maxAgeSec: 40,
    });
  }

  if (behind) {
    cues.push({
      id: 'pan-behind',
      label: 'Behind — utility',
      detail: 'E-block ADC, W diver, R only into winning fights.',
      urgency: 'spike',
      maxAgeSec: 35,
    });
  } else if (ahead && minutes >= 3 && minutes <= 10) {
    cues.push({
      id: 'pan-ahead',
      label: 'Ahead — spend map',
      detail: 'Crash → mid/jg. Your curve only goes down.',
      urgency: 'spike',
      maxAgeSec: 25,
    });
  }

  if (level === 1) {
    cues.push({
      id: 'pan-lvl2',
      label: 'Race to 2',
      detail: 'Q poke → Q+W at 2 is your biggest spike.',
      urgency: 'spike',
      maxAgeSec: 40,
    });
  } else if (level === 6) {
    cues.push({
      id: 'pan-ult',
      label: 'R online',
      detail: behind
        ? 'R only into fights you already lead.'
        : 'R the lane that is already fighting.',
      urgency: 'spike',
      maxAgeSec: 28,
    });
  }

  if (
    !behind &&
    minutes >= 3 &&
    minutes <= 8 &&
    level >= 6 &&
    cannon?.isActionWindow &&
    cannon.eta <= 20
  ) {
    cues.push({
      id: 'roam-cannon',
      label: 'Roam now',
      detail: (analysis?.roamAdvice || 'Crash → leave mid/jg.').slice(0, 90),
      urgency: 'warn',
      maxAgeSec: 20,
    });
  }

  if (!hasOracle && minutes >= 8.5 && minutes <= 11) {
    cues.push({
      id: 'swap-oracle',
      label: 'Swap sweeper',
      detail: 'Oracle Lens — clear before you W in.',
      urgency: 'spike',
      maxAgeSec: 30,
    });
  }

  if (progress.next) {
    cues.push({
      id: `buy-${progress.next.id}`,
      label: `Next: ${progress.next.name}`,
      detail: (progress.next.reason || 'Stay on the path.').slice(0, 120),
      urgency: behind ? 'spike' : 'warn',
    });
  }

  const flashDown = (state.enemyBotSummoners || []).flatMap((l) =>
    l.spells.filter((s) => s.short === 'Flash' && !s.ready && s.remaining > 0)
  );
  if (flashDown.length > 0 && !behind) {
    cues.push({
      id: 'sum-flash',
      label: 'Flash down',
      detail: `Enemy bot Flash ~${formatCd(flashDown[0].remaining)} — W is unavoidable in that window.`,
      urgency: 'spike',
    });
  }

  return cues;
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
    progress.ownedIds.has('3172') ||
    inventoryHasName(state.localPlayer?.items, ['berserker', 'greaves', 'gunmetal']);
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
  const minutes = gameTime / 60;
  const progress = trackBuildProgress(state.localPlayer?.items, build);
  const hasUmbral =
    progress.ownedIds.has('3179') || inventoryHasName(state.localPlayer?.items, ['umbral']);
  const hasOracle = progress.ownedIds.has('3364');

  const laneDiff = analysis?.botLaneMatchup?.matchupDifficulty;
  const hardLane = laneDiff === 'HARD' || laneDiff === 'VERY_HARD';
  const unfavorable2v2 = analysis?.botLaneMatchup?.damageComparison?.advantage === 'UNFAVORABLE';
  const lowAggro = analysis?.aggressionLevel === 'LOW';

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
  const cannon = nextCannon(gameTime);

  // Prey focus — always high value once we know who dies first
  if (analysis?.preyFocus && level >= 2) {
    cues.push({
      id: 'prey-focus',
      label: `Prey ${analysis.primaryTargets[0] || ''}`.trim(),
      detail: analysis.preyFocus,
      urgency: 'spike',
      maxAgeSec: 40,
    });
  }

  if (level === 1) {
    cues.push({
      id: 'lvl2',
      label: 'Level 2 spike',
      detail: hardLane
        ? 'Contest XP — all-in only if their key spell is down.'
        : 'Contest XP — Q+E window opens at 2.',
      urgency: 'spike',
      maxAgeSec: 45,
    });
  } else if ((level === 2 || level === 3) && (hardLane || unfavorable2v2 || !analysis?.preyFocus)) {
    cues.push({
      id: 'early-window',
      label: `L${level}`,
      detail: hardLane || unfavorable2v2
        ? 'Thin trades on spent CDs. Crash → leave — skip extended 2v2.'
        : 'Bush Q → E. Trade with grey health up.',
      urgency: hardLane ? 'warn' : 'spike',
      maxAgeSec: 30,
    });
  } else if (level >= 4 && level < 6 && xpBehind) {
    cues.push({
      id: 'xp-hold',
      label: 'Hold for XP',
      detail: 'Soak cannon/XP — skip long mid roams until 6.',
      urgency: 'spike',
      maxAgeSec: 25,
    });
  } else if (level === 6) {
    // Only the moment you hit 6 — not a sticky banner for two levels
    cues.push({
      id: 'ult-online',
      label: 'R online',
      detail: 'Crash → convert. R finishes fights.',
      urgency: 'spike',
      maxAgeSec: 28,
    });
  }

  // Roam: only during the live cannon action window, short TTL
  if (
    minutes >= 3 &&
    minutes <= 8 &&
    level >= 6 &&
    cannon?.isActionWindow &&
    (cannon.eta == null || cannon.eta <= 25)
  ) {
    const roamDetail = analysis?.roamAdvice
      ? analysis.roamAdvice.slice(0, 100)
      : hardLane || lowAggro
        ? 'Crash → leave. Mid only on spent dashes.'
        : 'Crash → W river / mid.';
    cues.push({
      id: 'roam-cannon',
      label: 'Roam now',
      detail: roamDetail,
      urgency: 'warn',
      maxAgeSec: 20,
    });
  }

  // Vision shop beats filler clock advice
  if (!hasOracle && minutes >= 8.5 && minutes <= 11) {
    cues.push({
      id: 'swap-oracle',
      label: 'Swap sweeper',
      detail: 'Oracle Lens now — clear before the next fight.',
      urgency: 'spike',
      maxAgeSec: 30,
    });
  }

  // Buy cue follows progress.next (core first, then boots) — never spike boots
  // before first core because trackBuildProgress keeps core ahead of boots.
  if (progress.next) {
    const nextIsBoot =
      !progress.hasFinishedBoots &&
      /boot|swift|lucid|merc|steel|greave|ionian|treads/i.test(progress.next.name);
    if (nextIsBoot) {
      cues.push({
        id: `buy-${progress.next.id}`,
        label: `Buy ${progress.next.name}`,
        detail: (progress.next.reason || 'Finish mid-tier boots — upgrade optional.').slice(0, 100),
        urgency: 'spike',
        maxAgeSec: 40,
      });
    } else if (!hasUmbral || progress.next.id !== '3179') {
      cues.push({
        id: `buy-${progress.next.id}`,
        label: `Next: ${progress.next.name}`,
        detail: (progress.next.reason || 'Stay on spike path.').slice(0, 100),
        urgency: 'warn',
        maxAgeSec: 35,
      });
    }
  }

  const flashDown = (state.enemyBotSummoners || []).flatMap((l) =>
    l.spells.filter((s) => s.short === 'Flash' && !s.ready && s.remaining > 0)
  );
  if (level >= 6 && flashDown.length > 0 && flashDown[0].remaining < 90) {
    cues.push({
      id: 'sum-flash',
      label: 'Flash down',
      detail: `~${formatCd(flashDown[0].remaining)} — free R angles.`,
      urgency: 'spike',
      maxAgeSec: 25,
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
