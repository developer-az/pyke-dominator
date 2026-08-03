/**
 * Named enemy threats that need a specific answer instead of the generic
 * comp-scan heuristics. Shared by every profile so a threat is answered the
 * same way whether you are on Pyke, Pantheon or Yone.
 */

import type { Champion } from './pykeLogic';

export interface ThreatAnswer {
  id: string;
  name: string;
  /** Item IDs whose score must be pushed hard up while this threat is alive. */
  favorItemIds: string[];
  /** Item IDs that must never be recommended as "the answer" to this threat. */
  banItemIds: string[];
  /**
   * Defense-row shard override (patch 26.x+).
   * Valid: 5011 flat Health, 5013 Tenacity, 5001 Health Scaling.
   * Armor/MR shards (5002/5003) were removed from the client.
   */
  preferDefenseShard?: number;
  tips: string[];
  /** Short line for the overlay cue stack. */
  cue: { label: string; detail: string };
}

const NAAFIRI: ThreatAnswer = {
  id: 'Naafiri',
  name: 'Naafiri',
  // Steelcaps, Death's Dance, Guardian Angel, Randuin's, Sterak's
  favorItemIds: ['3047', '6333', '3026', '3143', '3053'],
  // Edge of Night is NOT the answer: her W is a point-click unstoppable dash and
  // the packs keep applying damage after the shield pops on the first dagger.
  banItemIds: ['3814'],
  preferDefenseShard: 5011, // flat HP — Armor/MR shards removed; her kit is physical burst
  tips: [
    'Naafiri: Edge of Night does NOT save you. Her W is point-click/unstoppable and the pack autos keep hitting after the shield pops.',
    'Answer Naafiri with armor items + HP shard: Plated Steelcaps early, then Death\'s Dance / Guardian Angel. Flat Health defense shard (Armor shard is gone).',
    'She kills isolated targets — never take a fog fight or a solo side-lane ward while her R is up. Move with a body next to you.',
    'Her packs give her vision of you when they chase — break line of sight or kill the dogs before you try to disengage.',
  ],
  cue: {
    label: 'Naafiri hunting',
    detail: 'Do not walk fog alone. EoN does not stop her — armor/Steelcaps + stay in body range of an ally.',
  },
};

const THREATS: ThreatAnswer[] = [NAAFIRI];

function normalize(value: string | undefined | null): string {
  return (value || '').toLowerCase().replace(/[^a-z]/g, '');
}

/** Threat answers active for this enemy team (by champion id or display name). */
export function activeThreats(enemyTeam: Array<Champion | { id?: string; name?: string }>): ThreatAnswer[] {
  const names = new Set(enemyTeam.flatMap((c) => [normalize(c.id), normalize(c.name)]));
  return THREATS.filter((t) => names.has(normalize(t.id)));
}

/** Threat answers active from live-client enemy champion names. */
export function activeThreatsByName(championNames: Array<string | undefined>): ThreatAnswer[] {
  const names = new Set(championNames.map(normalize));
  return THREATS.filter((t) => names.has(normalize(t.id)));
}

export function hasNaafiri(enemyTeam: Array<Champion | { id?: string; name?: string }>): boolean {
  return activeThreats(enemyTeam).some((t) => t.id === 'Naafiri');
}

/**
 * Apply threat answers to a scored item pool in place-ish fashion:
 * banned items are pushed below any threshold, favored items get a large boost.
 */
export function applyThreatScoring<T extends { item: { id: string }; score: number; reason: string }>(
  pool: T[],
  threats: ThreatAnswer[]
): T[] {
  if (threats.length === 0) return pool;
  const banned = new Set(threats.flatMap((t) => t.banItemIds));
  const favored = new Map<string, string>();
  for (const t of threats) {
    for (const id of t.favorItemIds) favored.set(id, t.name);
  }

  return pool.map((entry) => {
    if (banned.has(entry.item.id)) {
      return { ...entry, score: -1000 };
    }
    const threatName = favored.get(entry.item.id);
    if (threatName) {
      return {
        ...entry,
        score: entry.score + 45,
        reason: `${entry.reason} Hard-picked vs ${threatName}.`,
      };
    }
    return entry;
  });
}

export function threatTips(threats: ThreatAnswer[]): string[] {
  return threats.flatMap((t) => t.tips);
}
