import { connectToLCU, makeLCURequest } from './lcu-connector';
import { fetchLiveClientData, findLocalPlayer, type LiveClientAllGameData } from './live-client';
import {
    showOverlay,
    hideOverlay,
    sendOverlayUpdate,
    isOverlayUserHidden,
    createOverlayWindow,
    destroyOverlay,
    getOverlayWindow,
    syncScalesFromLeague,
    keepOverlayOnTop,
} from './overlay-window';
import {
    ingestChampSelectTeam,
    ingestLiveEvents,
    ingestLivePlayers,
    resetSummonerTracker,
    serializeSummoners,
    summonerFingerprint,
    consumeSummonerClipboard,
    setSummonerFocus,
} from './summoner-tracker';
import { clipboard } from 'electron';

/** Gameflow phases where an active match (including Practice Tool) is running. */
const IN_GAME_PHASES = new Set(['InProgress', 'GameStart']);

/** Phases that mean the match is over or we are out of a live game — live client may still respond briefly. */
const POST_GAME_PHASES = new Set([
    'WaitingForStats',
    'PreEndOfGame',
    'EndOfGame',
    'Lobby',
    'ChampSelect',
    'ReadyCheck',
    'Matchmaking',
    'None',
]);

/** Lobby / champ-select cadence — keep light so LCU stays responsive. */
const POLL_IDLE_MS = 2000;
/** In-game: overlay owns the hot path; slower ticks = less CPU vs League. */
const POLL_INGAME_MS = 4000;
/** In-game with the overlay hidden: nothing is rendered, so just track match state. */
const POLL_INGAME_HIDDEN_MS = 10000;
/** Clipboard is a synchronous OS call — never more than once per this window. */
const CLIPBOARD_MIN_INTERVAL_MS = 20000;

let lastClipboardWrite = 0;

export interface CachedEnemy {
    championId: number;
    championName?: string;
    position?: string;
}

let monitorInterval: ReturnType<typeof setInterval> | null = null;
let lastChampSelectEnemies: CachedEnemy[] = [];
let inGame = false;
/** Consecutive ticks where the match looked over — avoid destroying overlay on blips. */
let endGameStrikes = 0;
let destroyOverlayTimer: ReturnType<typeof setTimeout> | null = null;
let lastLcuConnectAttempt = 0;
let lastOverlayFingerprint = '';
let currentPollMs = POLL_IDLE_MS;
let onGameStateChange: ((active: boolean) => void) | null = null;

export function getLastChampSelectEnemies(): CachedEnemy[] {
    return lastChampSelectEnemies;
}

export function isCurrentlyInGame(): boolean {
    return inGame;
}

/** Optional hook so main window can minimize / pause work while League is running. */
export function setGameStateChangeHandler(handler: ((active: boolean) => void) | null): void {
    onGameStateChange = handler;
}

/** Attempt (re)connect, respecting a 5s backoff. Only called after a request already failed. */
async function ensureLcuConnected(): Promise<boolean> {
    const now = Date.now();
    if (now - lastLcuConnectAttempt < 5000) return false;
    lastLcuConnectAttempt = now;
    try {
        await connectToLCU();
        return true;
    } catch {
        return false;
    }
}

async function pollGameflowPhase(): Promise<string | null> {
    try {
        const phase = await makeLCURequest('GET', '/lol-gameflow/v1/gameflow-phase');
        return typeof phase === 'string' ? phase : null;
    } catch {
        return null;
    }
}

async function cacheChampSelectEnemies(): Promise<void> {
    try {
        const session = await makeLCURequest('GET', '/lol-champ-select/v1/session');
        if (!session || typeof session !== 'object') return;

        const theirTeam = (session as {
            theirTeam?: Array<{
                championId?: number;
                championName?: string;
                assignedPosition?: string;
                teamPosition?: string;
                position?: string;
                spell1Id?: number;
                spell2Id?: number;
            }>;
        }).theirTeam;
        if (!Array.isArray(theirTeam)) return;

        const enemies: CachedEnemy[] = [];
        for (const member of theirTeam) {
            if (member.championId && member.championId !== 0) {
                enemies.push({
                    championId: member.championId,
                    championName: member.championName,
                    position: member.assignedPosition,
                });
            }
        }
        if (enemies.length > 0) {
            lastChampSelectEnemies = enemies;
        }
        // Auto-fill enemy bot summoner intel while sitting in client
        ingestChampSelectTeam(theirTeam);
    } catch {
        // Not in champ select
    }
}

/** Live champion → profile id. Keep in sync with src/logic/profiles.ts. */
const PROFILE_BY_CHAMPION: Record<string, string> = {
    pyke: 'pyke-support',
    pantheon: 'pantheon-support',
    yone: 'yone-mid',
};

function buildOverlayPayload(live: LiveClientAllGameData | null, gameflowPhase: string | null) {
    const localPlayer = live ? findLocalPlayer(live) : null;
    const localName = (localPlayer?.championName || '').toLowerCase().replace(/[^a-z]/g, '');
    const isPyke = localPlayer ? localName === 'pyke' : true;
    const isYone = localPlayer ? localName === 'yone' : false;
    const profileHint = localPlayer
        ? PROFILE_BY_CHAMPION[localName] ?? null
        : 'pyke-support';

    // Yone Mid tracks enemy mid sums; support profiles track bot + support
    setSummonerFocus(profileHint === 'yone-mid' || isYone ? 'mid' : 'bot');

    const enemyPlayers =
        live?.allPlayers?.filter((p) => localPlayer && p.team !== localPlayer.team) || [];

    const enemies = enemyPlayers.map((p) => ({
        championName: p.championName,
        level: p.level,
        position: p.position,
        isDead: p.isDead,
        items: p.items?.map((i) => i.displayName) || [],
        scores: p.scores,
        summonerSpells: p.summonerSpells,
    }));

    // Keep lane summoner timers current from live positions + kill events
    ingestLivePlayers(enemies);
    const nameToChampion = new Map<string, string>();
    for (const p of live?.allPlayers || []) {
        if (p.summonerName) nameToChampion.set(p.summonerName, p.championName);
        if (p.riotIdGameName) nameToChampion.set(p.riotIdGameName, p.championName);
        if (p.riotId) {
            nameToChampion.set(p.riotId, p.championName);
            const base = p.riotId.split('#')[0];
            if (base) nameToChampion.set(base, p.championName);
        }
        // Events sometimes use champion display names directly
        if (p.championName) nameToChampion.set(p.championName, p.championName);
    }
    ingestLiveEvents(live?.events?.Events, nameToChampion);

    // Auto-copy ADC Flash/Heal/Barrier when they come back up. Clipboard writes
    // are a synchronous OS call — throttle so a flapping timer can never turn
    // into a write on every tick while a match is running.
    const clip = consumeSummonerClipboard();
    if (clip && Date.now() - lastClipboardWrite > CLIPBOARD_MIN_INTERVAL_MS) {
        lastClipboardWrite = Date.now();
        try {
            clipboard.writeText(clip);
        } catch {
            // ignore clipboard failures
        }
    }

    const allies = live?.allPlayers
        ?.filter((p) => localPlayer && p.team === localPlayer.team && p.summonerName !== localPlayer.summonerName)
        .map((p) => ({
            championName: p.championName,
            level: p.level,
            position: p.position,
            isDead: p.isDead,
        })) || [];

    return {
        inGame: true,
        gameflowPhase,
        gameMode: live?.gameData?.gameMode || null,
        gameTime: live?.gameData?.gameTime ?? 0,
        mapName: live?.gameData?.mapName || null,
        localPlayer: localPlayer
            ? {
                  championName: localPlayer.championName,
                  level: localPlayer.level,
                  isDead: localPlayer.isDead,
                  items: localPlayer.items || [],
                  scores: localPlayer.scores,
                  position: localPlayer.position,
                  currentGold: live?.activePlayer?.currentGold ?? 0,
                  summonerSpells: localPlayer.summonerSpells,
              }
            : null,
        isPyke,
        isYone,
        profileHint,
        enemies,
        allies,
        cachedChampSelectEnemies: lastChampSelectEnemies,
        enemyBotSummoners: serializeSummoners(),
        activePlayerLevel: live?.activePlayer?.level ?? localPlayer?.level ?? 0,
        timestamp: Date.now(),
    };
}

/** Coarse fingerprint — skip IPC/React work when nothing the HUD cares about changed. */
function overlayFingerprint(payload: ReturnType<typeof buildOverlayPayload>): string {
    const lp = payload.localPlayer;
    const itemKey = (lp?.items || []).map((i) => `${i.itemID}:${i.count}`).join(',');
    const enemyKey = (payload.enemies || [])
        .map((e) => `${e.championName}:${e.level}:${e.isDead ? 1 : 0}`)
        .join('|');
    // 1s buckets — ward countdown / cannon windows need second-level updates.
    // Poll is already ~4s, so this just avoids skipping a tick inside a 6s bin.
    const timeBucket = Math.floor((payload.gameTime || 0) / 1);
    return [
        payload.gameflowPhase || '',
        payload.gameMode || '',
        timeBucket,
        lp?.level ?? 0,
        lp?.isDead ? 1 : 0,
        itemKey,
        enemyKey,
        payload.isPyke ? 1 : 0,
        payload.profileHint || '',
        summonerFingerprint(),
        (payload.cachedChampSelectEnemies || []).map((e) => e.championId).join(','),
    ].join('~');
}

function resetMatchCaches(): void {
    lastChampSelectEnemies = [];
    lastOverlayFingerprint = '';
    resetSummonerTracker();
}

function setPollCadence(ms: number): void {
    if (ms === currentPollMs && monitorInterval) return;
    currentPollMs = ms;
    if (monitorInterval) {
        clearInterval(monitorInterval);
        monitorInterval = setInterval(() => {
            void tick();
        }, currentPollMs);
    }
}

function endGameSession(): void {
    inGame = false;
    endGameStrikes = 0;
    resetMatchCaches();
    hideOverlay();
    // Delay destroy so a brief phase blip mid-game cannot permanently kill the window.
    if (destroyOverlayTimer) clearTimeout(destroyOverlayTimer);
    destroyOverlayTimer = setTimeout(() => {
        destroyOverlayTimer = null;
        if (!inGame) destroyOverlay();
    }, 12000);
    sendOverlayUpdate({
        inGame: false,
        enemies: [],
        allies: [],
        cachedChampSelectEnemies: [],
        localPlayer: null,
        timestamp: Date.now(),
    });
    setPollCadence(POLL_IDLE_MS);
    onGameStateChange?.(false);
}

let tickInFlight = false;

async function tick(): Promise<void> {
    // Guard against overlapping ticks: if LCU/Live Client latency ever exceeds
    // the poll cadence, setInterval would otherwise stack concurrent ticks.
    if (tickInFlight) return;
    tickInFlight = true;
    try {
        let phase = await pollGameflowPhase();
        if (phase === null) {
            const reconnected = await ensureLcuConnected();
            if (reconnected) {
                phase = await pollGameflowPhase();
            }
        }

        const phaseInGame = phase ? IN_GAME_PHASES.has(phase) : false;
        const phaseIsPostGame = phase ? POST_GAME_PHASES.has(phase) : false;

        // Champ-select enemy + summoner cache only in lobby — never while match is live
        if (!inGame && !phaseInGame) {
            await cacheChampSelectEnemies();
        }

        // Live client is the in-game hot path. Skip the HTTPS hit entirely when we
        // already know we are in a post-game / lobby phase (saves sockets + CPU),
        // and when the overlay is hidden there is nothing to feed — only the
        // gameflow phase matters for knowing the match ended.
        const overlayHidden = isOverlayUserHidden();
        let live: LiveClientAllGameData | null = null;
        if ((phaseInGame || phase === null || inGame) && !(overlayHidden && phaseInGame)) {
            if (!phaseIsPostGame || inGame) {
                live = await fetchLiveClientData();
            }
        }
        const liveAvailable = live !== null;

        // Prefer gameflow when known: EndOfGame / Lobby / ChampSelect must exit even if
        // live client still serves stale /allgamedata for a while.
        // If LCU phase is unknown (null) but live client is up (Practice Tool), trust live.
        const shouldShow = phaseInGame || (liveAvailable && !phaseIsPostGame && phase === null);

        if (shouldShow) {
            const wasInGame = inGame;
            inGame = true;
            endGameStrikes = 0;
            if (destroyOverlayTimer) {
                clearTimeout(destroyOverlayTimer);
                destroyOverlayTimer = null;
            }
            setPollCadence(overlayHidden ? POLL_INGAME_HIDDEN_MS : POLL_INGAME_MS);

            if (!wasInGame) {
                syncScalesFromLeague();
                if (!overlayHidden) {
                    createOverlayWindow();
                    showOverlay();
                }
                onGameStateChange?.(true);
            } else if (!overlayHidden) {
                // Self-heal: window was destroyed mid-match — bring it back
                if (!getOverlayWindow()) {
                    createOverlayWindow();
                    showOverlay();
                }
                keepOverlayOnTop();
            }

            if (overlayHidden) {
                // Nothing is drawing — send match state once so the main window
                // stays parked, then skip all payload/fingerprint work.
                if (!wasInGame) {
                    sendOverlayUpdate({ inGame: true, timestamp: Date.now() });
                }
            } else {
                const payload = buildOverlayPayload(live, phase);
                const fp = overlayFingerprint(payload);
                if (fp !== lastOverlayFingerprint) {
                    lastOverlayFingerprint = fp;
                    sendOverlayUpdate(payload);
                }
            }
        } else if (inGame) {
            // Confirmed post-game ends immediately; otherwise require 3 missed ticks
            // (~12s) so a null phase / live-client hiccup cannot delete the overlay.
            if (phaseIsPostGame) {
                endGameSession();
            } else {
                endGameStrikes += 1;
                if (endGameStrikes >= 3) endGameSession();
            }
        } else if (!inGame) {
            // Pregame: push bot summoner intel to main UI occasionally (no overlay window)
            const summons = serializeSummoners();
            if (summons.length > 0) {
                const fp = `pre:${summonerFingerprint()}`;
                if (fp !== lastOverlayFingerprint) {
                    lastOverlayFingerprint = fp;
                    sendOverlayUpdate({
                        inGame: false,
                        enemyBotSummoners: summons,
                        cachedChampSelectEnemies: lastChampSelectEnemies,
                        timestamp: Date.now(),
                    });
                }
            }
        }
    } finally {
        tickInFlight = false;
    }
}

/** Immediate overlay/UI refresh after a manual summoner mark. */
export function pushSummonerUpdate(): void {
    lastOverlayFingerprint = '';
    if (inGame) {
        void tick();
        return;
    }
    sendOverlayUpdate({
        inGame: false,
        enemyBotSummoners: serializeSummoners(),
        timestamp: Date.now(),
    });
}

export function startGameMonitor(): void {
    if (monitorInterval) return;

    // Do NOT create the overlay window until a match actually starts —
    // a fullscreen transparent always-on-top surface costs DWM composition.

    void tick();
    monitorInterval = setInterval(() => {
        void tick();
    }, currentPollMs);
}

export function stopGameMonitor(): void {
    if (monitorInterval) {
        clearInterval(monitorInterval);
        monitorInterval = null;
    }
}
