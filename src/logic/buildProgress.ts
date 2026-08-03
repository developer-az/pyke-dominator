/**
 * Track recommended-build purchase progress by item ID (not fuzzy names).
 */

import {
  ALL_BOOT_IDS,
  nextBootStep,
  ownsAnyCompleteBoots,
  ownsFinishedBoots,
} from './bootChains';

export interface BuildItemRef {
  id: string;
  name: string;
  reason?: string;
}

export interface BuildProgress {
  ownedIds: Set<string>;
  /** Ordered path: boots chain step + core + situational */
  path: BuildItemRef[];
  remaining: BuildItemRef[];
  next: BuildItemRef | null;
  completedCount: number;
  /** Any boots piece in inventory */
  hasBoots: boolean;
  /** Recommended boot target owned (mid-tier for supports) */
  hasFinishedBoots: boolean;
}

/** Support quest chain — owning any stage counts as "have Atlas". Never sell. */
export const SUPPORT_QUEST_IDS = new Set([
  '3865', // World Atlas
  '3866', // Runic Compass
  '3867', // Bounty of Worlds
  '3869', // Celestial Opposition
  '3870', // Dream Maker
  '3871', // Zaz'Zak's
  '3876', // Solstice Sleigh
  '3877', // Bloodsong
]);

export function trackBuildProgress(
  inventory: Array<{ itemID: number; displayName?: string; count?: number }> | undefined,
  build: {
    core: BuildItemRef[];
    boots: BuildItemRef;
    situational: BuildItemRef[];
  } | null | undefined
): BuildProgress {
  const ownedIds = new Set(
    (inventory || [])
      .filter((i) => i.itemID && i.itemID !== 0)
      .map((i) => String(i.itemID))
  );

  const hasBoots = [...ownedIds].some((id) => ALL_BOOT_IDS.has(id));
  const bootDone =
    (build?.boots ? ownsFinishedBoots(ownedIds, build.boots.id) : false) ||
    ownsAnyCompleteBoots(ownedIds);

  if (!build) {
    return {
      ownedIds,
      path: [],
      remaining: [],
      next: null,
      completedCount: 0,
      hasBoots,
      hasFinishedBoots: bootDone,
    };
  }

  const path: BuildItemRef[] = [];
  const bootStep = nextBootStep(ownedIds, build.boots.id);
  if (bootStep && !bootDone) {
    const chainEnd = bootStep.id === build.boots.id;
    path.push({
      id: bootStep.id,
      name: bootStep.name,
      reason: chainEnd
        ? build.boots.reason || 'Finish boots (mid-tier is enough for support).'
        : `Boot path → ${build.boots.name}: buy ${bootStep.name} next.`,
    });
  } else if (build.boots && !bootDone) {
    path.push({ ...build.boots });
  }

  for (const c of build.core) {
    if (!path.some((p) => p.id === c.id)) path.push(c);
  }
  // Keep checklist short — top 2 situational only
  for (const s of build.situational.slice(0, 2)) {
    if (!path.some((p) => p.id === s.id)) path.push(s);
  }

  const hasSupportQuest = [...ownedIds].some((id) => SUPPORT_QUEST_IDS.has(id));

  let completedCount = 0;
  let next: BuildItemRef | null = null;
  const remaining: BuildItemRef[] = [];
  for (const item of path) {
    const isBootStep = ALL_BOOT_IDS.has(item.id) || item.id === build.boots?.id;
    const owned =
      ownedIds.has(String(item.id)) ||
      (isBootStep && bootDone) ||
      (item.id === '3865' && hasSupportQuest) ||
      (item.id === '3877' && hasSupportQuest);
    if (owned) {
      completedCount++;
      continue;
    }
    remaining.push(item);
    if (!next) next = item;
  }

  return {
    ownedIds,
    path,
    remaining,
    next,
    completedCount,
    hasBoots,
    hasFinishedBoots: bootDone,
  };
}

/** Name fallback for items that finished but ID drifted (rare). */
export function inventoryHasName(
  inventory: Array<{ displayName?: string }> | undefined,
  fragments: string[]
): boolean {
  const names = (inventory || []).map((i) => (i.displayName || '').toLowerCase());
  return fragments.some((f) => names.some((n) => n.includes(f)));
}
