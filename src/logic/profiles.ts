/**
 * Champion profile abstraction — Pyke Support (primary) + Yone Mid (second profile).
 * UI / overlay / export all resolve logic through getProfile().
 */
import {
  analyzeMatchup,
  calculateBuild,
  calculateDominanceFactor,
  calculateRunes,
  type Build,
  type Champion,
  type DominanceMetrics,
  type MatchupAnalysis,
  type RunePage,
} from './pykeLogic';
import {
  analyzeYoneMatchup,
  calculateYoneBuild,
  calculateYoneDominance,
  calculateYoneRunes,
} from './yoneLogic';

export type ProfileId = 'pyke-support' | 'yone-mid';

export type ProfileRole = 'Support' | 'Mid' | 'Top' | 'Jungle' | 'Bot';

export interface ChampionProfile {
  id: ProfileId;
  /** Data Dragon champion id */
  championId: string;
  /** Numeric champion key for LCU item-set association */
  championKey: number;
  role: ProfileRole;
  label: string;
  shortLabel: string;
  runePageName: string;
  itemSetTitle: string;
  brandTitle: string;
  /** Ally lanes that matter for this profile's scoring */
  focusAllies: Array<'YourADC' | 'YourMid'>;
  /** Enemy role that is the primary matchup focus */
  primaryEnemyRole: 'Support' | 'Mid' | 'Bot' | 'Top';
  calculateBuild: (enemies: Champion[], yourADC?: Champion | null, yourMid?: Champion | null) => Build;
  calculateRunes: (
    enemies: Champion[],
    build?: Build,
    yourADC?: Champion | null,
    yourMid?: Champion | null
  ) => RunePage;
  analyzeMatchup: (
    enemies: Champion[],
    build?: Build,
    yourADC?: Champion | null,
    yourMid?: Champion | null
  ) => MatchupAnalysis;
  calculateDominance: (enemies: Champion[], build: Build) => DominanceMetrics;
}

const pykeSupport: ChampionProfile = {
  id: 'pyke-support',
  championId: 'Pyke',
  championKey: 555,
  role: 'Support',
  label: 'Pyke Support',
  shortLabel: 'Pyke',
  runePageName: 'Pyke Dominator',
  itemSetTitle: 'Pyke Dominator',
  brandTitle: 'Pyke Dominator',
  focusAllies: ['YourADC', 'YourMid'],
  primaryEnemyRole: 'Support',
  calculateBuild,
  calculateRunes,
  analyzeMatchup,
  calculateDominance: calculateDominanceFactor,
};

const yoneMid: ChampionProfile = {
  id: 'yone-mid',
  championId: 'Yone',
  championKey: 777,
  role: 'Mid',
  label: 'Yone Mid',
  shortLabel: 'Yone',
  runePageName: 'Yone Mid Dominator',
  itemSetTitle: 'Yone Mid Dominator',
  brandTitle: 'Yone Dominator',
  focusAllies: ['YourMid'],
  primaryEnemyRole: 'Mid',
  calculateBuild: (enemies) => calculateYoneBuild(enemies),
  calculateRunes: (enemies, build) => {
    const page = calculateYoneRunes(enemies, build);
    return { ...page, name: 'Yone Mid Dominator' };
  },
  analyzeMatchup: (enemies, build) => analyzeYoneMatchup(enemies, build),
  calculateDominance: calculateYoneDominance,
};

export const PROFILES: ChampionProfile[] = [pykeSupport, yoneMid];

export function getProfile(id: ProfileId | string | null | undefined): ChampionProfile {
  return PROFILES.find((p) => p.id === id) || pykeSupport;
}

export function profileFromChampionName(name: string | null | undefined): ChampionProfile | null {
  if (!name) return null;
  const lower = name.toLowerCase();
  return PROFILES.find((p) => p.championId.toLowerCase() === lower) || null;
}

const STORAGE_KEY = 'dominator.activeProfile';

export function loadStoredProfileId(): ProfileId {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'yone-mid' || v === 'pyke-support') return v;
  } catch {
    /* ignore */
  }
  return 'pyke-support';
}

export function storeProfileId(id: ProfileId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}
