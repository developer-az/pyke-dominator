import { exec } from 'child_process';
import axios from 'axios';
import https from 'https';

let credentials: { port: string; token: string; protocol: string } | null = null;

// Reused across every request — creating a new https.Agent per call (as this
// previously did) means a fresh TLS context/socket pool on every single LCU
// request. On a 1–1.5s poll cadence for the life of the app that's constant,
// avoidable socket churn competing with the game for CPU.
const lcuHttpsAgent = new https.Agent({ rejectUnauthorized: false, keepAlive: true });

export const connectToLCU = (): Promise<{ port: string; token: string; protocol: string }> => {
    return new Promise((resolve, reject) => {
        // Use PowerShell to find the process, it's more reliable on modern Windows than wmic
        const command = `powershell -Command "Get-CimInstance Win32_Process -Filter \\"name = 'LeagueClientUx.exe'\\" | Select-Object -ExpandProperty CommandLine"`;

        exec(command, (error, stdout) => {
            if (error || !stdout || !stdout.trim()) {
                console.log('LCU not found or error:', error);
                reject(new Error('League Client not found'));
                return;
            }

            const portMatch = stdout.match(/--app-port=([0-9]*)/);
            const tokenMatch = stdout.match(/--remoting-auth-token=([\w-]*)/);

            if (portMatch && tokenMatch) {
                credentials = {
                    port: portMatch[1],
                    token: tokenMatch[1],
                    protocol: 'https'
                };
                resolve(credentials);
            } else {
                reject(new Error('Could not parse LCU credentials from: ' + stdout));
            }
        });
    });
};

interface LCURunePage {
    name: string;
    id: number;
    primaryStyleId?: number;
    subStyleId?: number;
    selectedPerkIds?: number[];
    current?: boolean;
}

export interface ExportRunePagePayload {
    name: string;
    primaryStyleId: number;
    subStyleId: number;
    selectedPerkIds: number[];
    current?: boolean;
}

export const exportRunePage = async (runePage: ExportRunePagePayload): Promise<void> => {
    if (!credentials) throw new Error('LCU not connected');

    if (!Array.isArray(runePage.selectedPerkIds) || runePage.selectedPerkIds.length !== 9) {
        throw new Error(`Invalid rune page: expected 9 perk IDs, got ${runePage.selectedPerkIds?.length ?? 0}`);
    }

    const currentPages = await makeLCURequest('GET', '/lol-perks/v1/pages');
    const pages = Array.isArray(currentPages) ? (currentPages as LCURunePage[]) : [];

    const existingPage = pages.find((p) => p.name === runePage.name);
    if (existingPage?.id != null) {
        await makeLCURequest('DELETE', `/lol-perks/v1/pages/${existingPage.id}`);
    }

    await makeLCURequest('POST', '/lol-perks/v1/pages', {
        name: runePage.name,
        primaryStyleId: runePage.primaryStyleId,
        subStyleId: runePage.subStyleId,
        selectedPerkIds: runePage.selectedPerkIds,
        current: runePage.current !== false,
    });
};

interface ItemSetBlock {
    type: string;
    items: Array<{ id: string; count: number }>;
}

interface LCUItemSetPage {
    title?: string;
    uid?: string;
    type?: string;
    map?: string;
    mode?: string;
    priority?: boolean;
    sortrank?: number;
    startedFrom?: string;
    associatedChampions?: number[];
    associatedMaps?: number[];
    preferredItemSlots?: unknown[];
    blocks?: ItemSetBlock[];
    [key: string]: unknown;
}

interface LCUItemSetsCollection {
    accountId?: number;
    itemSets?: LCUItemSetPage[];
    timestamp?: number;
}

export interface ExportBuildPayload {
    starter: Array<{ id: string }>;
    core: Array<{ id: string }>;
    boots: { id: string };
    situational: Array<{ id: string }>;
    buildPath: Array<{ id: string }>;
    /** LCU champion key (Pyke 555, Yone 777). Defaults to Pyke. */
    championKey?: number;
    /** Item-set title shown in shop. */
    title?: string;
}

/**
 * Export item set via the real LCU collection API:
 * GET/PUT `/lol-item-sets/v1/item-sets/{summonerId}/sets`
 *
 * The previous implementation POSTed a bare set to a non-collection path and
 * treated the GET response as an array — both are wrong for current clients.
 */
export const exportItemSet = async (build: ExportBuildPayload): Promise<void> => {
    if (!credentials) throw new Error('LCU not connected');

    const currentSummoner = await makeLCURequest('GET', '/lol-summoner/v1/current-summoner') as {
        summonerId?: number;
        accountId?: number;
    } | null;
    if (!currentSummoner?.summonerId) {
        throw new Error('Could not get summoner ID from LCU');
    }

    const summonerId = currentSummoner.summonerId;
    const championKey = build.championKey ?? 555;
    const setTitle = build.title || 'Pyke Dominator';

    const existing = await makeLCURequest(
        'GET',
        `/lol-item-sets/v1/item-sets/${summonerId}/sets`
    ) as LCUItemSetsCollection | null;

    const existingSets = Array.isArray(existing?.itemSets) ? existing!.itemSets! : [];
    const kept = existingSets.filter((s) => s.title !== setTitle && s.title !== 'Pyke Dominator' && s.title !== 'Yone Mid Dominator');

    const blocks: ItemSetBlock[] = [];
    if (build.starter.length > 0) {
        blocks.push({
            type: 'Starting Items',
            items: build.starter.map((item) => ({ id: String(item.id), count: 1 })),
        });
    }
    if (build.core.length > 0) {
        blocks.push({
            type: 'Core Items',
            items: build.core.map((item) => ({ id: String(item.id), count: 1 })),
        });
    }
    if (build.boots) {
        blocks.push({
            type: 'Boots',
            items: [{ id: String(build.boots.id), count: 1 }],
        });
    }
    if (build.buildPath.length > 0) {
        blocks.push({
            type: 'Build Path',
            items: build.buildPath.map((item) => ({ id: String(item.id), count: 1 })),
        });
    }
    if (build.situational.length > 0) {
        blocks.push({
            type: 'Situational',
            items: build.situational.map((item) => ({ id: String(item.id), count: 1 })),
        });
    }

    const newSet: LCUItemSetPage = {
        title: setTitle,
        type: 'custom',
        map: 'any',
        mode: 'any',
        priority: false,
        sortrank: 0,
        startedFrom: 'BLANK',
        associatedChampions: [championKey],
        associatedMaps: [11, 12],
        preferredItemSlots: [],
        blocks,
    };

    const payload: LCUItemSetsCollection = {
        accountId: existing?.accountId ?? currentSummoner.accountId ?? 0,
        itemSets: [...kept, newSet],
        timestamp: Date.now(),
    };

    await makeLCURequest('PUT', `/lol-item-sets/v1/item-sets/${summonerId}/sets`, payload);
};

export const makeLCURequest = async (method: string, endpoint: string, body?: unknown) => {
    if (!credentials) {
        throw new Error('Not connected to LCU');
    }

    const url = `${credentials.protocol}://127.0.0.1:${credentials.port}${endpoint}`;
    const auth = Buffer.from(`riot:${credentials.token}`).toString('base64');

    try {
        const response = await axios({
            method,
            url,
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            },
            data: body,
            httpsAgent: lcuHttpsAgent,
            timeout: 4000,
            validateStatus: (status) => {
                // Don't throw on 404 - it's expected when not in champ select
                return status < 500;
            }
        });

        if (response.status === 404) {
            return null;
        }

        if (response.status >= 400) {
            const detail = typeof response.data === 'object'
                ? JSON.stringify(response.data)
                : String(response.data ?? '');
            throw new Error(`LCU API ${method} ${endpoint} → ${response.status}${detail ? `: ${detail}` : ''}`);
        }

        return response.data;
    } catch (error: unknown) {
        const axiosError = error as { response?: { status?: number; data?: unknown }; message?: string };
        if (axiosError.response?.status !== 404) {
            console.error('LCU Request Error:', axiosError.message || 'Unknown error');
        }
        throw error;
    }
};
