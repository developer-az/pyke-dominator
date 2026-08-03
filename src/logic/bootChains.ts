/**
 * Season 3+ boot lines: finished "upgraded" boots build through a mid-tier.
 * Exporting only the final ID (e.g. Swiftmarch) without Boots → Swiftness
 * makes the shop path unclear and blocks the upgrade for supports.
 */

/** Final recommended boot → full purchase chain (base → mid → upgrade). */
const CHAINS: Record<string, string[]> = {
  '3170': ['1001', '3009', '3170'], // Boots → Swiftness → Swiftmarch
  '3009': ['1001', '3009', '3170'],
  '3171': ['1001', '3158', '3171'], // → Ionian → Crimson Lucidity
  '3158': ['1001', '3158', '3171'],
  '3173': ['1001', '3111', '3173'], // → Mercs → Chainlaced Crushers
  '3111': ['1001', '3111', '3173'],
  '3174': ['1001', '3047', '3174'], // → Steelcaps → Armored Advance
  '3047': ['1001', '3047', '3174'],
  '3172': ['1001', '3006', '3172'], // → Berserker's → Gunmetal Greaves
  '3006': ['1001', '3006', '3172'],
  '1001': ['1001'],
};

const NAMES: Record<string, string> = {
  '1001': 'Boots',
  '3006': "Berserker's Greaves",
  '3009': 'Boots of Swiftness',
  '3047': 'Plated Steelcaps',
  '3111': "Mercury's Treads",
  '3158': 'Ionian Boots of Lucidity',
  '3170': 'Swiftmarch',
  '3171': 'Crimson Lucidity',
  '3172': 'Gunmetal Greaves',
  '3173': 'Chainlaced Crushers',
  '3174': 'Armored Advance',
};

/** Normalize a recommended boot to its finished upgrade when one exists. */
export function finalizeBootId(id: string): string {
  const chain = CHAINS[id];
  if (!chain || chain.length === 0) return id;
  return chain[chain.length - 1];
}

/** Full shop chain for LCU Boots block / build path. */
export function bootChainIds(recommendedId: string): string[] {
  const finalId = finalizeBootId(recommendedId);
  return CHAINS[finalId] || CHAINS[recommendedId] || ['1001', recommendedId];
}

export function bootChainItems(recommendedId: string): Array<{ id: string; name: string }> {
  return bootChainIds(recommendedId).map((id) => ({
    id,
    name: NAMES[id] || `Item ${id}`,
  }));
}

/** Owns the finished upgrade for this recommendation. */
export function ownsFinishedBoots(ownedIds: Set<string>, recommendedId: string): boolean {
  return ownedIds.has(finalizeBootId(recommendedId));
}

/** Next unowned step in the boot chain (component or upgrade). */
export function nextBootStep(
  ownedIds: Set<string>,
  recommendedId: string
): { id: string; name: string } | null {
  const chain = bootChainIds(recommendedId);
  if (ownedIds.has(chain[chain.length - 1])) return null;
  for (const id of chain) {
    if (!ownedIds.has(id)) return { id, name: NAMES[id] || `Item ${id}` };
  }
  return null;
}

export const ALL_BOOT_IDS = new Set([
  ...Object.keys(NAMES),
  '3008', // Gluttonous Greaves
  '3020', // Sorc
  '3168', // Immortal Path
  '3175', // Spellslinger's
]);
