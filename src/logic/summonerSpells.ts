/** Summoner spell IDs (LCU / Data Dragon) + base cooldowns used for bot-lane timers. */

export interface SummonerSpellInfo {
  id: number;
  name: string;
  /** Base CD in seconds at typical support/ADC haste (no Ionian). */
  baseCd: number;
  /** Shorter key for HUD chips. */
  short: string;
}

export const SUMMONER_SPELLS: Record<number, SummonerSpellInfo> = {
  1: { id: 1, name: 'Cleanse', baseCd: 210, short: 'Cleanse' },
  3: { id: 3, name: 'Exhaust', baseCd: 210, short: 'Exhaust' },
  4: { id: 4, name: 'Flash', baseCd: 300, short: 'Flash' },
  6: { id: 6, name: 'Ghost', baseCd: 210, short: 'Ghost' },
  7: { id: 7, name: 'Heal', baseCd: 240, short: 'Heal' },
  11: { id: 11, name: 'Smite', baseCd: 90, short: 'Smite' },
  12: { id: 12, name: 'Teleport', baseCd: 360, short: 'TP' },
  13: { id: 13, name: 'Clarity', baseCd: 240, short: 'Clarity' },
  14: { id: 14, name: 'Ignite', baseCd: 180, short: 'Ignite' },
  21: { id: 21, name: 'Barrier', baseCd: 180, short: 'Barrier' },
  32: { id: 32, name: 'Mark', baseCd: 80, short: 'Mark' },
  39: { id: 39, name: 'Mark', baseCd: 80, short: 'Mark' },
  54: { id: 54, name: 'Flash', baseCd: 300, short: 'Flash' }, // placeholder / skin variants map to Flash
  55: { id: 55, name: 'Placeholder & Attack-Smite', baseCd: 90, short: 'Smite' },
};

const NAME_ALIASES: Record<string, string> = {
  summonerflash: 'Flash',
  summonerdot: 'Ignite',
  summonerheal: 'Heal',
  summonerexhaust: 'Exhaust',
  summonerbarrier: 'Barrier',
  summonerteleport: 'Teleport',
  summonerhaste: 'Ghost',
  summonerboost: 'Cleanse',
  summonersmite: 'Smite',
  flash: 'Flash',
  ignite: 'Ignite',
  heal: 'Heal',
  exhaust: 'Exhaust',
  barrier: 'Barrier',
  teleport: 'Teleport',
  ghost: 'Ghost',
  cleanse: 'Cleanse',
  smite: 'Smite',
};

export function spellFromId(id: number | undefined | null): SummonerSpellInfo | null {
  if (id == null || id === 0) return null;
  return SUMMONER_SPELLS[id] || null;
}

export function spellFromDisplayName(name: string | undefined | null): SummonerSpellInfo | null {
  if (!name) return null;
  const key = name.replace(/[^a-zA-Z]/g, '').toLowerCase();
  const canonical = NAME_ALIASES[key] || NAME_ALIASES[`summoner${key}`];
  if (!canonical) {
    // Fuzzy: display names like "Flash", "Ignite"
    const entry = Object.values(SUMMONER_SPELLS).find(
      (s) => s.name.toLowerCase() === name.toLowerCase() || s.short.toLowerCase() === name.toLowerCase()
    );
    return entry || null;
  }
  return Object.values(SUMMONER_SPELLS).find((s) => s.name === canonical) || null;
}

export type BotLaneRole = 'Bot' | 'Support';

export interface TrackedSummonerSpell {
  spellId: number;
  name: string;
  short: string;
  baseCd: number;
  /** Epoch ms when the spell becomes available again; 0 = ready / unknown. */
  readyAt: number;
  /** How we started the CD (for UI honesty). */
  source?: 'manual' | 'kill' | 'death' | 'inferred';
}

export interface EnemyBotSummonerState {
  role: BotLaneRole;
  championName: string;
  championId?: number;
  spells: TrackedSummonerSpell[];
}

export function makeTrackedSpell(info: SummonerSpellInfo, readyAt = 0): TrackedSummonerSpell {
  return {
    spellId: info.id,
    name: info.name,
    short: info.short,
    baseCd: info.baseCd,
    readyAt,
  };
}

/** Remaining CD in whole seconds; 0 = ready. */
export function remainingCdSeconds(spell: TrackedSummonerSpell, now = Date.now()): number {
  if (!spell.readyAt || spell.readyAt <= now) return 0;
  return Math.ceil((spell.readyAt - now) / 1000);
}

export function formatCd(seconds: number): string {
  if (seconds <= 0) return 'UP';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `${s}s`;
}

/** Spells we care about on enemy bot lane for lane pressure. */
export const PRIORITY_SUMMONERS = new Set(['Flash', 'Ignite', 'Heal', 'Exhaust', 'Barrier', 'Cleanse', 'Ghost']);

export function isPrioritySpell(name: string): boolean {
  return PRIORITY_SUMMONERS.has(name);
}
