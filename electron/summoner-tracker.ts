/**
 * Tracks enemy summoner spells from champ select / live client and estimates
 * CDs from kill/death events (Live Client has no spell-cast API).
 *
 * Focus:
 * - Support profiles → Bot + Support
 * - Yone Mid → Mid only
 *
 * Reliability model:
 * - Never restart a spell that is already on cooldown
 * - Heal/Barrier/Ghost/Cleanse on death (high confidence — usually burned)
 * - Flash on death only the first time while ready (later deaths are too noisy)
 * - Ignite/Exhaust on kill/assist only for Support lane (ADC kills ≠ Ignite)
 * - Manual mark overrides always win
 */

export interface TrackedSpell {
  spellId: number;
  name: string;
  short: string;
  baseCd: number;
  readyAt: number;
  source?: 'kill' | 'death' | 'inferred' | 'manual';
  /** Auto Flash-on-death already used once for this lane */
  flashAutoUsed?: boolean;
}

export type TrackedRole = 'Bot' | 'Support' | 'Mid';
export type SummonerFocus = 'bot' | 'mid';

export interface EnemyLaneSpells {
  role: TrackedRole;
  championName: string;
  championId?: number;
  spells: TrackedSpell[];
  /** First Flash auto-start already consumed for this lane */
  flashDeathArmed?: boolean;
}

/** @deprecated alias — prefer EnemyLaneSpells */
export type EnemyBotSpells = EnemyLaneSpells;

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
  11: { id: 11, name: 'Smite', short: 'Smite', baseCd: 90 },
  12: { id: 12, name: 'Teleport', short: 'TP', baseCd: 360 },
  14: { id: 14, name: 'Ignite', short: 'Ignite', baseCd: 180 },
  21: { id: 21, name: 'Barrier', short: 'Barrier', baseCd: 180 },
};

const ADC_HINTS = new Set(
  [
    'Ashe', 'Caitlyn', 'Jinx', 'KaiSa', 'Kaisa', 'Ezreal', 'Jhin', 'Lucian', 'MissFortune',
    'Sivir', 'Tristana', 'Twitch', 'Varus', 'Vayne', 'Xayah', 'Aphelios', 'Draven', 'Kalista',
    'KogMaw', 'Samira', 'Zeri', 'Nilah', 'Smolder', 'Yunara', 'Corki',
  ].map((n) => n.toLowerCase().replace(/[^a-z]/g, ''))
);

const SUPPORT_HINTS = new Set(
  [
    'Pyke', 'Thresh', 'Nautilus', 'Leona', 'Blitzcrank', 'Rakan', 'Alistar', 'Braum', 'Taric',
    'Rell', 'Nami', 'Lulu', 'Janna', 'Soraka', 'Yuumi', 'Sona', 'Milio', 'Renata', 'RenataGlasc',
    'Karma', 'Zyra', 'Brand', 'Xerath', 'Lux', 'Morgana', 'Swain', 'Neeko', 'Zilean', 'Bard',
    'Senna', 'Pantheon', 'Mel', 'Seraphine', 'Shaco',
  ].map((n) => n.toLowerCase().replace(/[^a-z]/g, ''))
);

/** Common mids — fallback when Live Client omits MIDDLE. */
const MID_HINTS = new Set(
  [
    'Ahri', 'Akali', 'Anivia', 'Annie', 'AurelionSol', 'Azir', 'Cassiopeia', 'Corki', 'Diana',
    'Ekko', 'Fizz', 'Galio', 'Hwei', 'Irelia', 'Kassadin', 'Katarina', 'Leblanc', 'Lissandra',
    'Lux', 'Malzahar', 'Neeko', 'Orianna', 'Qiyana', 'Ryze', 'Sylas', 'Syndra', 'Talon',
    'TwistedFate', 'Veigar', 'Vex', 'Viktor', 'Vladimir', 'Xerath', 'Yasuo', 'Yone', 'Zed',
    'Ziggs', 'Zoe', 'Aurora', 'Mel',
  ].map((n) => n.toLowerCase().replace(/[^a-z]/g, ''))
);

const NAME_TO_DEF: Record<string, SpellDef> = {};
for (const s of Object.values(SPELLS)) {
  NAME_TO_DEF[s.name.toLowerCase()] = s;
  NAME_TO_DEF[s.short.toLowerCase()] = s;
}

function normChamp(name: string | undefined): string {
  return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
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

let trackedLanes: EnemyLaneSpells[] = [];
let processedEventIds = new Set<number>();
let lastFingerprint = '';
/** Focus lane Flash/sums coming back — clipboard auto-copy. */
let pendingClipboardText: string | null = null;
const prevReady = new Map<string, boolean>();
/** Active focus for serialize / clipboard (set from game-monitor). */
let activeFocus: SummonerFocus = 'bot';

export function setSummonerFocus(focus: SummonerFocus): void {
  activeFocus = focus === 'mid' ? 'mid' : 'bot';
}

export function getSummonerFocus(): SummonerFocus {
  return activeFocus;
}

export function getEnemyBotSummoners(): EnemyLaneSpells[] {
  return filterByFocus(trackedLanes, activeFocus);
}

export function resetSummonerTracker(): void {
  trackedLanes = [];
  processedEventIds = new Set();
  lastFingerprint = '';
  pendingClipboardText = null;
  prevReady.clear();
  activeFocus = 'bot';
}

export function consumeSummonerClipboard(): string | null {
  const t = pendingClipboardText;
  pendingClipboardText = null;
  return t;
}

function filterByFocus(lanes: EnemyLaneSpells[], focus: SummonerFocus): EnemyLaneSpells[] {
  if (focus === 'mid') return lanes.filter((l) => l.role === 'Mid');
  return lanes.filter((l) => l.role === 'Bot' || l.role === 'Support');
}

function upsertLane(
  role: TrackedRole,
  championName: string,
  championId: number | undefined,
  defs: SpellDef[]
): void {
  if (!championName && !defs.length) return;
  const existing = trackedLanes.find((b) => b.role === role);
  const byChamp = trackedLanes.find(
    (b) => normChamp(b.championName) === normChamp(championName) && b.role !== role
  );
  if (byChamp && !existing) {
    trackedLanes = trackedLanes.filter((b) => b !== byChamp);
  }
  const spells = defs.map((d) => {
    const prev = existing?.spells.find((s) => s.name === d.name || s.spellId === d.id);
    return prev
      ? { ...toTracked(d), readyAt: prev.readyAt, source: prev.source }
      : toTracked(d);
  });
  const entry: EnemyLaneSpells = {
    role,
    championName,
    championId,
    spells,
    flashDeathArmed: existing?.flashDeathArmed ?? true,
  };
  if (existing) {
    Object.assign(existing, entry);
  } else {
    trackedLanes.push(entry);
  }
}

function inferRoleFromSpells(defs: SpellDef[]): TrackedRole | null {
  const names = new Set(defs.map((d) => d.name));
  if (names.has('Heal') || names.has('Barrier')) return 'Bot';
  if (names.has('Exhaust')) return 'Support';
  if (names.has('Teleport') && !names.has('Heal')) return 'Mid';
  return null;
}

function inferRoleFromChamp(championName: string): TrackedRole | null {
  const n = normChamp(championName);
  if (ADC_HINTS.has(n)) return 'Bot';
  if (SUPPORT_HINTS.has(n)) return 'Support';
  if (MID_HINTS.has(n)) return 'Mid';
  return null;
}

function resolveRole(pos: string, championName: string, defs: SpellDef[]): TrackedRole | null {
  const p = pos.toUpperCase();
  if (p === 'BOTTOM') return 'Bot';
  if (p === 'UTILITY' || p === 'SUPPORT') return 'Support';
  if (p === 'MIDDLE' || p === 'MID') return 'Mid';
  if (p === 'TOP' || p === 'JUNGLE') return null;
  return inferRoleFromSpells(defs) || inferRoleFromChamp(championName);
}

/** Champ select: cache enemy BOTTOM + UTILITY + MIDDLE spell ids. */
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
    const defs = [defFromId(m.spell1Id), defFromId(m.spell2Id)].filter(Boolean) as SpellDef[];
    const name = m.championName || (m.championId ? `#${m.championId}` : '');
    const pos = m.assignedPosition || m.teamPosition || m.position || '';
    const role = resolveRole(pos, name, defs);
    if (!role) continue;
    upsertLane(role, name || role, m.championId, defs);
  }
}

/** Live client: refresh spell names for tracked laners by position / hints. */
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
  const candidates: Array<{
    champ: string;
    pos: string;
    defs: SpellDef[];
    role: TrackedRole | null;
  }> = [];
  for (const e of enemies) {
    const defs = [
      defFromName(e.summonerSpells?.summonerSpellOne?.displayName),
      defFromName(e.summonerSpells?.summonerSpellTwo?.displayName),
    ].filter(Boolean) as SpellDef[];
    if (defs.some((d) => d.name === 'Smite')) continue;
    const role = resolveRole(e.position || '', e.championName, defs);
    candidates.push({ champ: e.championName, pos: e.position || '', defs, role });
  }

  for (const c of candidates) {
    if (!c.role) continue;
    if (c.defs.length === 0) {
      const existing = trackedLanes.find((b) => b.role === c.role);
      if (existing) {
        if (existing.championName.startsWith('#') || !existing.championName) {
          existing.championName = c.champ;
        } else if (normChamp(existing.championName) !== normChamp(c.champ)) {
          existing.championName = c.champ;
        }
      }
      continue;
    }
    upsertLane(c.role, c.champ, undefined, c.defs);
  }

  for (const role of ['Bot', 'Support', 'Mid'] as const) {
    if (trackedLanes.some((b) => b.role === role)) continue;
    const hit = candidates.find(
      (c) =>
        !c.role &&
        (inferRoleFromSpells(c.defs) === role || inferRoleFromChamp(c.champ) === role)
    );
    if (hit && hit.defs.length) upsertLane(role, hit.champ, undefined, hit.defs);
  }
}

/**
 * Start a spell CD. Never restarts an active cooldown (fixes false mid-CD refreshes).
 * Manual marks always apply.
 */
function startSpellCd(
  lane: EnemyLaneSpells,
  spellName: string,
  source: TrackedSpell['source'],
  opts?: { force?: boolean }
): boolean {
  const spell = lane.spells.find((s) => s.name === spellName);
  if (!spell) return false;
  const now = Date.now();
  if (!opts?.force && spell.readyAt > now) return false;
  spell.readyAt = now + spell.baseCd * 1000;
  spell.source = source;
  return true;
}

function laneMatchesChampion(lane: EnemyLaneSpells, championName: string | undefined): boolean {
  if (!championName) return false;
  return normChamp(lane.championName) === normChamp(championName);
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
 * - Support killer/assister → Ignite / Exhaust
 * - Victim → Heal/Barrier/Ghost/Cleanse (high confidence)
 * - Victim Flash → only first auto death while Flash is ready (then manual)
 */
export function ingestLiveEvents(
  events: LiveEvent[] | undefined,
  nameToChampion: Map<string, string>
): void {
  if (!events?.length) return;

  const lookup = (raw: string | undefined): string | undefined => {
    if (!raw) return undefined;
    return nameToChampion.get(raw) || nameToChampion.get(raw.split('#')[0]) || raw;
  };

  for (const ev of events) {
    if (ev.EventName !== 'ChampionKill' || ev.EventID == null) continue;
    if (processedEventIds.has(ev.EventID)) continue;
    processedEventIds.add(ev.EventID);

    const killerChamp = lookup(ev.KillerName);
    const victimChamp = lookup(ev.VictimName);

    for (const lane of trackedLanes) {
      // Combat sums: Support Ignite/Exhaust are reliable; ADC kills are usually autos
      if (lane.role === 'Support' || lane.role === 'Mid') {
        if (laneMatchesChampion(lane, killerChamp)) {
          startSpellCd(lane, 'Ignite', 'kill');
        }
        for (const a of ev.Assisters || []) {
          const assistChamp = lookup(a);
          if (laneMatchesChampion(lane, assistChamp)) {
            startSpellCd(lane, 'Exhaust', 'kill');
            startSpellCd(lane, 'Ignite', 'kill');
          }
        }
      }

      if (laneMatchesChampion(lane, victimChamp)) {
        // High-confidence defensive sums — usually burned before death
        startSpellCd(lane, 'Heal', 'death');
        startSpellCd(lane, 'Barrier', 'death');
        startSpellCd(lane, 'Ghost', 'death');
        startSpellCd(lane, 'Cleanse', 'death');

        // Flash: first death while ready only — later deaths are ~50/50
        if (lane.flashDeathArmed !== false) {
          const started = startSpellCd(lane, 'Flash', 'death');
          if (started) lane.flashDeathArmed = false;
        }
      }
    }
  }

  detectFocusSumsComingUp();
}

/**
 * Manual override — click when you saw them burn a sum.
 * force=true restarts even mid-CD (correct a false timer).
 */
export function markSpellUsed(
  role: TrackedRole,
  spellName: string,
  opts?: { clear?: boolean }
): boolean {
  const lane = trackedLanes.find((l) => l.role === role);
  if (!lane) return false;
  const spell = lane.spells.find(
    (s) => s.name.toLowerCase() === spellName.toLowerCase() || s.short.toLowerCase() === spellName.toLowerCase()
  );
  if (!spell) return false;
  if (opts?.clear) {
    spell.readyAt = 0;
    spell.source = 'manual';
    if (spell.name === 'Flash') lane.flashDeathArmed = true;
    lastFingerprint = '';
    return true;
  }
  startSpellCd(lane, spell.name, 'manual', { force: true });
  if (spell.name === 'Flash') lane.flashDeathArmed = false;
  lastFingerprint = '';
  return true;
}

/**
 * Toggle a spell timer: start CD if ready, clear if already counting down.
 * Used by Page Up (ADC Flash) / Page Down (Support Flash) so a mis-press is undoable.
 */
export function toggleSpellUsed(
  role: TrackedRole,
  spellName: string
): { success: boolean; active: boolean } {
  const lane = trackedLanes.find((l) => l.role === role);
  if (!lane) return { success: false, active: false };
  const spell = lane.spells.find(
    (s) =>
      s.name.toLowerCase() === spellName.toLowerCase() ||
      s.short.toLowerCase() === spellName.toLowerCase()
  );
  if (!spell) return { success: false, active: false };
  const now = Date.now();
  if (spell.readyAt > now) {
    spell.readyAt = 0;
    spell.source = 'manual';
    if (spell.name === 'Flash') lane.flashDeathArmed = true;
    lastFingerprint = '';
    return { success: true, active: false };
  }
  startSpellCd(lane, spell.name, 'manual', { force: true });
  if (spell.name === 'Flash') lane.flashDeathArmed = false;
  lastFingerprint = '';
  return { success: true, active: true };
}

function focusPrimaryLane(): EnemyLaneSpells | undefined {
  if (activeFocus === 'mid') return trackedLanes.find((b) => b.role === 'Mid');
  return trackedLanes.find((b) => b.role === 'Bot');
}

function detectFocusSumsComingUp(now = Date.now()): void {
  const primary = focusPrimaryLane();
  if (!primary) return;
  const watch =
    activeFocus === 'mid'
      ? ['Flash', 'Teleport', 'Ignite', 'Cleanse', 'Ghost']
      : ['Flash', 'Heal', 'Barrier'];
  const parts: string[] = [];
  for (const s of primary.spells) {
    if (!watch.includes(s.name)) continue;
    const key = `${primary.role}:${s.name}`;
    const ready = s.readyAt <= now;
    const wasReady = prevReady.get(key);
    prevReady.set(key, ready);
    if (wasReady === false && ready) {
      parts.push(`${s.short} UP`);
    }
  }
  if (parts.length) {
    const label = activeFocus === 'mid' ? 'MID' : 'ADC';
    pendingClipboardText = `${label} ${primary.championName}: ${parts.join(' · ')} (${new Date().toLocaleTimeString()})`;
  }
}

export function summonerFingerprint(now = Date.now()): string {
  detectFocusSumsComingUp(now);
  const lanes = filterByFocus(trackedLanes, activeFocus);
  const parts = lanes.map((lane) => {
    const spells = lane.spells
      .map((s) => {
        const rem = s.readyAt > now ? Math.ceil((s.readyAt - now) / 2000) : 0;
        return `${s.short}:${rem}`;
      })
      .join(',');
    return `${lane.role}:${lane.championName}:{${spells}}`;
  });
  return `${activeFocus}|${parts.join('|')}`;
}

export function summonerPayloadChanged(): boolean {
  const fp = summonerFingerprint();
  if (fp === lastFingerprint) return false;
  lastFingerprint = fp;
  return true;
}

/** Snapshot for IPC — remaining seconds + absolute readyAt for local UI ticks. */
export function serializeSummoners(
  now = Date.now(),
  focus: SummonerFocus = activeFocus
): Array<{
  role: TrackedRole;
  championName: string;
  championId?: number;
  spells: Array<{
    name: string;
    short: string;
    baseCd: number;
    remaining: number;
    ready: boolean;
    readyAt: number;
    source?: string;
  }>;
}> {
  detectFocusSumsComingUp(now);
  return filterByFocus(trackedLanes, focus).map((lane) => ({
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
        readyAt: s.readyAt,
        source: s.source,
      };
    }),
  }));
}

/** Format primary-lane timers for manual clipboard copy. */
export function formatAdcClipboard(now = Date.now()): string | null {
  const primary = focusPrimaryLane();
  if (!primary) return null;
  const bits = primary.spells.map((s) => {
    const rem = s.readyAt > now ? Math.ceil((s.readyAt - now) / 1000) : 0;
    return rem > 0 ? `${s.short} ${Math.floor(rem / 60)}:${String(rem % 60).padStart(2, '0')}` : `${s.short} UP`;
  });
  const label = activeFocus === 'mid' ? 'MID' : 'ADC';
  return `${label} ${primary.championName}: ${bits.join(' · ')}`;
}
