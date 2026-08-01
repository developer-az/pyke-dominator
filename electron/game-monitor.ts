import { connectToLCU, makeLCURequest } from './lcu-connector';
import { fetchLiveClientData, findLocalPlayer, type LiveClientAllGameData } from './live-client';
import {
    showOverlay,
    hideOverlay,
    sendOverlayUpdate,
    isOverlayUserHidden,
    createOverlayWindow,
    destroyOverlay,
    syncScalesFromLeague,
    keepOverlayOnTop,
} from './overlay-window';

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

const POLL_IDLE_MS = 2000;
const POLL_INGAME_MS = 3000;

export interface CachedEnemy {
    championId: number;
    championName?: string;
    position?: string;
}

let monitorInterval: ReturnType<typeof setInterval> | null = null;
let lastChampSelectEnemies: CachedEnemy[] = [];
let inGame = false;
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

        const theirTeam = (session as { theirTeam?: Array<{ championId?: number; championName?: string; assignedPosition?: string }> }).theirTeam;
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
    } catch {
        // Not in champ select
    }
}

function buildOverlayPayload(live: LiveClientAllGameData | null, gameflowPhase: string | null) {
    const localPlayer = live ? findLocalPlayer(live) : null;
    // Unknown until live client reports a champion — treat as Pyke-friendly for this app
    const isPyke = localPlayer
        ? localPlayer.championName.toLowerCase() === 'pyke'
        : true;

    const enemies = live?.allPlayers
        ?.filter((p) => localPlayer && p.team !== localPlayer.team)
        .map((p) => ({
            championName: p.championName,
            level: p.level,
            position: p.position,
            isDead: p.isDead,
            items: p.items?.map((i) => i.displayName) || [],
            scores: p.scores,
        })) || [];

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
        enemies,
        allies,
        cachedChampSelectEnemies: lastChampSelectEnemies,
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
    // Bucket game time to ~3s so we don't redraw every tick on the clock alone
    const timeBucket = Math.floor((payload.gameTime || 0) / 3);
    return [
        payload.gameflowPhase || '',
        payload.gameMode || '',
        timeBucket,
        lp?.level ?? 0,
        lp?.isDead ? 1 : 0,
        itemKey,
        enemyKey,
        payload.isPyke ? 1 : 0,
        (payload.cachedChampSelectEnemies || []).map((e) => e.championId).join(','),
    ].join('~');
}

function resetMatchCaches(): void {
    lastChampSelectEnemies = [];
    lastOverlayFingerprint = '';
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
    resetMatchCaches();
    hideOverlay();
    // Tear down the fullscreen transparent window so it cannot keep compositing
    // over the desktop / next lobby after the match.
    destroyOverlay();
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

        // Cache champ select only while not in a live match
        if (!inGame) {
            await cacheChampSelectEnemies();
        }

        const live = await fetchLiveClientData();
        const liveAvailable = live !== null;
        const phaseInGame = phase ? IN_GAME_PHASES.has(phase) : false;
        const phaseIsPostGame = phase ? POST_GAME_PHASES.has(phase) : false;

        // Prefer gameflow when known: EndOfGame / Lobby / ChampSelect must exit even if
        // live client still serves stale /allgamedata for a while.
        // If LCU phase is unknown (null) but live client is up (Practice Tool), trust live.
        const shouldShow = phaseInGame || (liveAvailable && !phaseIsPostGame && phase === null);

        if (shouldShow) {
            const wasInGame = inGame;
            inGame = true;
            setPollCadence(POLL_INGAME_MS);

            if (!wasInGame) {
                syncScalesFromLeague();
                if (!isOverlayUserHidden()) {
                    createOverlayWindow();
                    showOverlay();
                }
                onGameStateChange?.(true);
            } else {
                keepOverlayOnTop();
            }

            const payload = buildOverlayPayload(live, phase);
            const fp = overlayFingerprint(payload);
            if (fp !== lastOverlayFingerprint) {
                lastOverlayFingerprint = fp;
                sendOverlayUpdate(payload);
            }
        } else if (inGame) {
            endGameSession();
        }
    } finally {
        tickInFlight = false;
    }
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
