/**
 * Track recommended-build purchase progress by item ID (not fuzzy names).
 */

import {
  ALL_BOOT_IDS,
  finalizeBootId,
  nextBootStep,
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
  /** Finished Noxian / upgraded boot for the recommendation */
  hasFinishedBoots: boolean;
}

/** Support quest chain — owning any stage counts as "have Atlas". */
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
  const bootTarget = build?.boots ? finalizeBootId(build.boots.id) : '';
  const hasFinishedBoots = bootTarget ? ownsFinishedBoots(ownedIds, bootTarget) : false;

  if (!build) {
    return {
      ownedIds,
      path: [],
      remaining: [],
      next: null,
      completedCount: 0,
      hasBoots,
      hasFinishedBoots,
    };
  }

  const path: BuildItemRef[] = [];
  // Surface the next boot step (Boots → mid → upgrade) so supports see the upgrade
  const bootStep = nextBootStep(ownedIds, build.boots.id);
  if (bootStep && !hasFinishedBoots) {
    path.push({
      id: bootStep.id,
      name: bootStep.name,
      reason:
        bootStep.id === bootTarget
          ? build.boots.reason || 'Finish boot upgrade.'
          : `Boot path → ${build.boots.name}: buy ${bootStep.name} next.`,
    });
  } else if (build.boots && !hasFinishedBoots) {
    path.push({ ...build.boots, id: bootTarget || build.boots.id });
  }

  for (const c of build.core) {
    if (!path.some((p) => p.id === c.id)) path.push(c);
  }
  for (const s of build.situational) {
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
      (isBootStep && hasFinishedBoots) ||
      (item.id === '3865' && hasSupportQuest) ||
      (item.id === '3877' && ownedIds.has('3877'));
    if (owned) {
      completedCount++;
      continue;
    }
    remaining.push(item);
    if (!next) next = item;
  }

  return { ownedIds, path, remaining, next, completedCount, hasBoots, hasFinishedBoots };
}

/** Name fallback for items that finished but ID drifted (rare). */
export function inventoryHasName(
  inventory: Array<{ displayName?: string }> | undefined,
  fragments: string[]
): boolean {
  const names = (inventory || []).map((i) => (i.displayName || '').toLowerCase());
  return fragments.some((f) => names.some((n) => n.includes(f)));
}
