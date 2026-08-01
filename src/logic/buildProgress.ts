/**
 * Track recommended-build purchase progress by item ID (not fuzzy names).
 */

export interface BuildItemRef {
  id: string;
  name: string;
  reason?: string;
}

export interface BuildProgress {
  ownedIds: Set<string>;
  /** Ordered path: starter skipped; boots + core + first situational */
  path: BuildItemRef[];
  next: BuildItemRef | null;
  completedCount: number;
  /** Component / finished boots detected */
  hasBoots: boolean;
}

const BOOT_IDS = new Set([
  '1001', // Boots
  '3006', // Berserker's
  '3009', // Swiftness
  '3020', // Sorc
  '3047', // Steelcaps
  '3111', // Mercs
  '3117', // Mobility
  '3158', // Lucidity
]);

/** Finished items that imply boots already purchased. */
const BOOT_FINISHED = BOOT_IDS;

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

  const hasBoots = [...ownedIds].some((id) => BOOT_FINISHED.has(id));

  if (!build) {
    return { ownedIds, path: [], next: null, completedCount: 0, hasBoots };
  }

  const path: BuildItemRef[] = [];
  // Boots first after open, then core in order, then situational
  if (build.boots) path.push(build.boots);
  for (const c of build.core) path.push(c);
  for (const s of build.situational.slice(0, 3)) {
    if (!path.some((p) => p.id === s.id)) path.push(s);
  }

  let completedCount = 0;
  let next: BuildItemRef | null = null;
  for (const item of path) {
    if (ownedIds.has(String(item.id))) {
      completedCount++;
      continue;
    }
    // Boots: any finished boots satisfies the boots step
    if (item.id === build.boots?.id && hasBoots) {
      completedCount++;
      continue;
    }
    if (!next) next = item;
  }

  return { ownedIds, path, next, completedCount, hasBoots };
}

/** Name fallback for items that finished but ID drifted (rare). */
export function inventoryHasName(
  inventory: Array<{ displayName?: string }> | undefined,
  fragments: string[]
): boolean {
  const names = (inventory || []).map((i) => (i.displayName || '').toLowerCase());
  return fragments.some((f) => names.some((n) => n.includes(f)));
}
