import axios from 'axios';
import https from 'https';

const LIVE_CLIENT_BASE = 'https://127.0.0.1:2999/liveclientdata';

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

export interface LiveClientItem {
    itemID: number;
    displayName: string;
    count: number;
    slot: number;
}

export interface LiveClientPlayer {
    championName: string;
    isBot: boolean;
    isDead: boolean;
    items: LiveClientItem[];
    level: number;
    position: string;
    rawChampionName?: string;
    respawnTimer: number;
    scores?: {
        assists: number;
        creepScore: number;
        deaths: number;
        kills: number;
        wardScore: number;
    };
    summonerName: string;
    riotId?: string;
    riotIdGameName?: string;
    riotIdTagLine?: string;
    team: 'ORDER' | 'CHAOS' | string;
    summonerSpells?: {
        summonerSpellOne?: { displayName: string };
        summonerSpellTwo?: { displayName: string };
    };
}

export interface LiveClientActivePlayer {
    level: number;
    currentGold: number;
    championStats?: Record<string, number>;
    summonerName: string;
    riotId?: string;
    riotIdGameName?: string;
    abilities?: Record<string, { abilityLevel?: number; displayName?: string }>;
}

export interface LiveClientGameData {
    gameMode: string;
    gameTime: number;
    mapName: string;
    mapNumber: number;
    mapTerrain?: string;
}

export interface LiveClientAllGameData {
    activePlayer: LiveClientActivePlayer;
    allPlayers: LiveClientPlayer[];
    events?: { Events?: Array<{ EventName: string; EventID: number; EventTime: number }> };
    gameData: LiveClientGameData;
}

export async function fetchLiveClientData(): Promise<LiveClientAllGameData | null> {
    try {
        const response = await axios.get(`${LIVE_CLIENT_BASE}/allgamedata`, {
            httpsAgent,
            timeout: 1500,
            validateStatus: (status) => status < 500,
        });

        if (response.status === 404 || !response.data) {
            return null;
        }

        return response.data as LiveClientAllGameData;
    } catch {
        // Game client not running or not in an active match
        return null;
    }
}

export async function isLiveClientAvailable(): Promise<boolean> {
    try {
        const response = await axios.get(`${LIVE_CLIENT_BASE}/gamestats`, {
            httpsAgent,
            timeout: 1000,
            validateStatus: (status) => status < 500,
        });
        return response.status === 200 && !!response.data;
    } catch {
        return false;
    }
}

export function findLocalPlayer(data: LiveClientAllGameData): LiveClientPlayer | null {
    const { activePlayer, allPlayers } = data;
    if (!allPlayers?.length) return null;

    const activeName = activePlayer?.summonerName;
    const activeRiotId = activePlayer?.riotId;
    const activeGameName = activePlayer?.riotIdGameName;

    const match = allPlayers.find((p) => {
        if (activeRiotId && p.riotId === activeRiotId) return true;
        if (activeGameName && p.riotIdGameName === activeGameName) return true;
        if (activeName && p.summonerName === activeName) return true;
        return false;
    });

    return match || allPlayers[0] || null;
}
