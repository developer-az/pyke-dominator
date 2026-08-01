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
  /**
   * Ally slots that matter for this profile's scoring.
   * Pyke (support): ADC + Mid. Yone (mid): Jungle — never Mid (you are mid).
   */
  focusAllies: Array<'YourADC' | 'YourMid' | 'YourJungle'>;
  /** Enemy role that is the primary matchup focus */
  primaryEnemyRole: 'Support' | 'Mid' | 'Bot' | 'Top';
  /** Second ally arg: Pyke = mid laner; Yone = jungler */
  calculateBuild: (enemies: Champion[], yourADC?: Champion | null, allyPartner?: Champion | null) => Build;
  calculateRunes: (
    enemies: Champion[],
    build?: Build,
    yourADC?: Champion | null,
    allyPartner?: Champion | null
  ) => RunePage;
  analyzeMatchup: (
    enemies: Champion[],
    build?: Build,
    yourADC?: Champion | null,
    allyPartner?: Champion | null
  ) => MatchupAnalysis;
  calculateDominance: (
    enemies: Champion[],
    build: Build,
    yourADC?: Champion | null,
    allyPartner?: Champion | null
  ) => DominanceMetrics;
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
  calculateDominance: (enemies, build) => calculateDominanceFactor(enemies, build),
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
  // You ARE mid — ally context is jungle pathing / dive sync, not another mid
  focusAllies: ['YourJungle'],
  primaryEnemyRole: 'Mid',
  calculateBuild: (enemies, _adc, allyJungle) => calculateYoneBuild(enemies, allyJungle),
  calculateRunes: (enemies, _build, _adc, allyJungle) => {
    const page = calculateYoneRunes(enemies, allyJungle);
    return { ...page, name: 'Yone Mid Dominator' };
  },
  analyzeMatchup: (enemies, build, _adc, allyJungle) => analyzeYoneMatchup(enemies, build, allyJungle),
  calculateDominance: (enemies, build, _adc, allyJungle) =>
    calculateYoneDominance(enemies, build, allyJungle),
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
