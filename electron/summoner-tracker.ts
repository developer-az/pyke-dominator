/**
 * Tracks enemy Bot + Support summoner spells from champ select / live client
 * and estimates CDs from kill/death events (Live Client has no spell-cast API).
 */

export interface TrackedSpell {
  spellId: number;
  name: string;
  short: string;
  baseCd: number;
  readyAt: number;
  source?: 'kill' | 'death' | 'inferred';
}

export interface EnemyBotSpells {
  role: 'Bot' | 'Support';
  championName: string;
  championId?: number;
  spells: TrackedSpell[];
}

interface SpellDef {
  id: number;
  name: string;
  short: string;
  baseCd: number;
}

const SPELLS: Record<number, SpellDef> = {
  1: { id: 1, name: 'Cleanse', short: 'Cleanse', baseCd: 210 },
  3: { id: 3, name: 'Exhaust', short: 'Exhaust', baseCd: 210 },
  4: { id: 4, name: 'Flash', short: 'Flash', baseCd: 300 },
  6: { id: 6, name: 'Ghost', short: 'Ghost', baseCd: 210 },
  7: { id: 7, name: 'Heal', short: 'Heal', baseCd: 240 },
  12: { id: 12, name: 'Teleport', short: 'TP', baseCd: 360 },
  14: { id: 14, name: 'Ignite', short: 'Ignite', baseCd: 180 },
  21: { id: 21, name: 'Barrier', short: 'Barrier', baseCd: 180 },
};

const NAME_TO_DEF: Record<string, SpellDef> = {};
for (const s of Object.values(SPELLS)) {
  NAME_TO_DEF[s.name.toLowerCase()] = s;
  NAME_TO_DEF[s.short.toLowerCase()] = s;
}

function defFromId(id: number | undefined): SpellDef | null {
  if (!id) return null;
  return SPELLS[id] || null;
}

function defFromName(name: string | undefined): SpellDef | null {
  if (!name) return null;
  const cleaned = name.replace(/[^a-zA-Z]/g, '').toLowerCase();
  return (
    NAME_TO_DEF[cleaned] ||
    NAME_TO_DEF[name.toLowerCase()] ||
    Object.values(SPELLS).find((s) => cleaned.includes(s.name.toLowerCase())) ||
    null
  );
}

function toTracked(def: SpellDef, readyAt = 0): TrackedSpell {
  return { spellId: def.id, name: def.name, short: def.short, baseCd: def.baseCd, readyAt };
}

let botLane: EnemyBotSpells[] = [];
let processedEventIds = new Set<number>();
let lastFingerprint = '';

export function getEnemyBotSummoners(): EnemyBotSpells[] {
  return botLane;
}

export function resetSummonerTracker(): void {
  botLane = [];
  processedEventIds = new Set();
  lastFingerprint = '';
}

function upsertLane(role: 'Bot' | 'Support', championName: string, championId: number | undefined, defs: SpellDef[]): void {
  if (!championName && !defs.length) return;
  const existing = botLane.find((b) => b.role === role);
  const spells = defs.map((d) => {
    const prev = existing?.spells.find((s) => s.name === d.name);
    return prev ? { ...toTracked(d), readyAt: prev.readyAt, source: prev.source } : toTracked(d);
  });
  const entry: EnemyBotSpells = { role, championName, championId, spells };
  if (existing) {
    Object.assign(existing, entry);
  } else {
    botLane.push(entry);
  }
}

/** Champ select: cache enemy BOTTOM + UTILITY spell ids. */
export function ingestChampSelectTeam(
  theirTeam: Array<{
    championId?: number;
    championName?: string;
    assignedPosition?: string;
    teamPosition?: string;
    position?: string;
    spell1Id?: number;
    spell2Id?: number;
  }>
): void {
  for (const m of theirTeam) {
    const pos = (m.assignedPosition || m.teamPosition || m.position || '').toUpperCase();
    let role: 'Bot' | 'Support' | null = null;
    if (pos === 'BOTTOM') role = 'Bot';
    else if (pos === 'UTILITY') role = 'Support';
    if (!role) continue;

    const defs = [defFromId(m.spell1Id), defFromId(m.spell2Id)].filter(Boolean) as SpellDef[];
    const name = m.championName || (m.championId ? `#${m.championId}` : role);
    upsertLane(role, name, m.championId, defs);
  }
}

/** Live client: refresh spell names for enemy bot laners by position. */
export function ingestLivePlayers(
  enemies: Array<{
    championName: string;
    position?: string;
    summonerSpells?: {
      summonerSpellOne?: { displayName: string };
      summonerSpellTwo?: { displayName: string };
    };
  }>
): void {
  for (const e of enemies) {
    const pos = (e.position || '').toUpperCase();
    let role: 'Bot' | 'Support' | null = null;
    if (pos === 'BOTTOM') role = 'Bot';
    else if (pos === 'UTILITY' || pos === 'SUPPORT') role = 'Support';
    if (!role) continue;

    const defs = [
      defFromName(e.summonerSpells?.summonerSpellOne?.displayName),
      defFromName(e.summonerSpells?.summonerSpellTwo?.displayName),
    ].filter(Boolean) as SpellDef[];

    if (defs.length === 0) {
      // Keep prior champ-select spells; just refresh name
      const existing = botLane.find((b) => b.role === role);
      if (existing) existing.championName = e.championName;
      continue;
    }
    upsertLane(role, e.championName, undefined, defs);
  }
}

function startSpellCd(lane: EnemyBotSpells, spellName: string, source: TrackedSpell['source']): void {
  const spell = lane.spells.find((s) => s.name === spellName);
  if (!spell) return;
  const now = Date.now();
  // Don't refresh if already ticking with >30s left (avoid double-fire)
  if (spell.readyAt > now + 30_000) return;
  spell.readyAt = now + spell.baseCd * 1000;
  spell.source = source;
}

interface LiveEvent {
  EventID?: number;
  EventName?: string;
  EventTime?: number;
  KillerName?: string;
  VictimName?: string;
  Assisters?: string[];
}

/**
 * Heuristics (no spell-cast events in Live Client):
 * - Killer among tracked bot laners → start Ignite if they have it
 * - Victim among tracked → start Flash (often burned before/on death; marked inferred)
 */
export function ingestLiveEvents(
  events: LiveEvent[] | undefined,
  nameToChampion: Map<string, string>
): void {
  if (!events?.length) return;

  for (const ev of events) {
    if (ev.EventName !== 'ChampionKill' || ev.EventID == null) continue;
    if (processedEventIds.has(ev.EventID)) continue;
    processedEventIds.add(ev.EventID);

    const killerChamp = ev.KillerName ? nameToChampion.get(ev.KillerName) : undefined;
    const victimChamp = ev.VictimName ? nameToChampion.get(ev.VictimName) : undefined;

    for (const lane of botLane) {
      if (killerChamp && lane.championName === killerChamp) {
        startSpellCd(lane, 'Ignite', 'kill');
      }
      if (victimChamp && lane.championName === victimChamp) {
        startSpellCd(lane, 'Flash', 'death');
        // Heal/Barrier often burned in the same all-in
        startSpellCd(lane, 'Heal', 'death');
        startSpellCd(lane, 'Barrier', 'death');
      }
    }
  }
}

/** Compact fingerprint for overlay IPC dedupe (bucket remaining CD to 2s). */
export function summonerFingerprint(now = Date.now()): string {
  const parts = botLane.map((lane) => {
    const spells = lane.spells
      .map((s) => {
        const rem = s.readyAt > now ? Math.ceil((s.readyAt - now) / 2000) : 0;
        return `${s.short}:${rem}`;
      })
      .join(',');
    return `${lane.role}:${lane.championName}:{${spells}}`;
  });
  return parts.join('|');
}

export function summonerPayloadChanged(): boolean {
  const fp = summonerFingerprint();
  if (fp === lastFingerprint) return false;
  lastFingerprint = fp;
  return true;
}

/** Snapshot for IPC — remaining seconds computed at read time. */
export function serializeSummoners(now = Date.now()): Array<{
  role: 'Bot' | 'Support';
  championName: string;
  championId?: number;
  spells: Array<{
    name: string;
    short: string;
    baseCd: number;
    remaining: number;
    ready: boolean;
    source?: string;
  }>;
}> {
  return botLane.map((lane) => ({
    role: lane.role,
    championName: lane.championName,
    championId: lane.championId,
    spells: lane.spells.map((s) => {
      const remaining = s.readyAt > now ? Math.ceil((s.readyAt - now) / 1000) : 0;
      return {
        name: s.name,
        short: s.short,
        baseCd: s.baseCd,
        remaining,
        ready: remaining <= 0,
        source: s.source,
      };
    }),
  }));
}
