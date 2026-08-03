/**
 * Champion profile abstraction — Pyke Support (primary), Pantheon Support
 * (off-champ when Pyke is banned) and Yone Mid.
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
import {
  analyzePantheonMatchup,
  calculatePantheonBuild,
  calculatePantheonDominance,
  calculatePantheonRunes,
} from './pantheonLogic';
import type { ProfileSituation } from './situation';

export type ProfileId = 'pyke-support' | 'pantheon-support' | 'yone-mid';

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
   * Ally slots that matter for this profile's scoring, most important first.
   * Pyke / Pantheon (support): ADC then Mid. Yone (mid): Jungle — never Mid.
   */
  focusAllies: Array<'YourADC' | 'YourMid' | 'YourJungle'>;
  /** Enemy role that is the primary matchup focus */
  primaryEnemyRole: 'Support' | 'Mid' | 'Bot' | 'Top';
  /** True when live behind/even/ahead state changes the recommendations. */
  situationAware: boolean;
  /** Second ally arg: Pyke/Pantheon = mid laner; Yone = jungler */
  calculateBuild: (
    enemies: Champion[],
    yourADC?: Champion | null,
    allyPartner?: Champion | null,
    situation?: ProfileSituation | null
  ) => Build;
  calculateRunes: (
    enemies: Champion[],
    build?: Build,
    yourADC?: Champion | null,
    allyPartner?: Champion | null,
    situation?: ProfileSituation | null
  ) => RunePage;
  analyzeMatchup: (
    enemies: Champion[],
    build?: Build,
    yourADC?: Champion | null,
    allyPartner?: Champion | null,
    situation?: ProfileSituation | null
  ) => MatchupAnalysis;
  calculateDominance: (
    enemies: Champion[],
    build: Build,
    yourADC?: Champion | null,
    allyPartner?: Champion | null,
    situation?: ProfileSituation | null
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
  situationAware: false,
  calculateBuild,
  calculateRunes,
  analyzeMatchup,
  calculateDominance: (enemies, build) => calculateDominanceFactor(enemies, build),
};

const pantheonSupport: ChampionProfile = {
  id: 'pantheon-support',
  championId: 'Pantheon',
  championKey: 80,
  role: 'Support',
  label: 'Pantheon Support',
  shortLabel: 'Pantheon',
  runePageName: 'Pantheon Support Dominator',
  itemSetTitle: 'Pantheon Support Dominator',
  brandTitle: 'Pantheon Dominator',
  // Engage support: the ADC is who you play through, mid is the roam target.
  focusAllies: ['YourADC', 'YourMid'],
  primaryEnemyRole: 'Support',
  situationAware: true,
  calculateBuild: (enemies, adc, allyMid, situation) =>
    calculatePantheonBuild(enemies, adc, allyMid, situation),
  calculateRunes: (enemies, _build, adc, allyMid, situation) =>
    calculatePantheonRunes(enemies, adc, allyMid, situation),
  analyzeMatchup: (enemies, build, adc, allyMid, situation) =>
    analyzePantheonMatchup(enemies, build, adc, allyMid, situation),
  calculateDominance: (enemies, build, adc, allyMid, situation) =>
    calculatePantheonDominance(enemies, build, adc, allyMid, situation),
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
  situationAware: false,
  calculateBuild: (enemies, _adc, allyJungle) => calculateYoneBuild(enemies, allyJungle),
  calculateRunes: (enemies, _build, _adc, allyJungle) => {
    const page = calculateYoneRunes(enemies, allyJungle);
    return { ...page, name: 'Yone Mid Dominator' };
  },
  analyzeMatchup: (enemies, build, _adc, allyJungle) => analyzeYoneMatchup(enemies, build, allyJungle),
  calculateDominance: (enemies, build, _adc, allyJungle) =>
    calculateYoneDominance(enemies, build, allyJungle),
};

export const PROFILES: ChampionProfile[] = [pykeSupport, pantheonSupport, yoneMid];

export const PROFILE_IDS: ProfileId[] = PROFILES.map((p) => p.id);

export function isProfileId(value: unknown): value is ProfileId {
  return typeof value === 'string' && (PROFILE_IDS as string[]).includes(value);
}

export function getProfile(id: ProfileId | string | null | undefined): ChampionProfile {
  return PROFILES.find((p) => p.id === id) || pykeSupport;
}

export function profileFromChampionName(name: string | null | undefined): ChampionProfile | null {
  if (!name) return null;
  const lower = name.toLowerCase().replace(/[^a-z]/g, '');
  return PROFILES.find((p) => p.championId.toLowerCase() === lower) || null;
}

const STORAGE_KEY = 'dominator.activeProfile';

export function loadStoredProfileId(): ProfileId {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (isProfileId(v)) return v;
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
