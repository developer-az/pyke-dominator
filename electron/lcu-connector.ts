import { exec } from 'child_process';
import axios from 'axios';
import https from 'https';

let credentials: { port: string; token: string; protocol: string } | null = null;

export const connectToLCU = (): Promise<{ port: string; token: string; protocol: string }> => {
    return new Promise((resolve, reject) => {
        // Use PowerShell to find the process, it's more reliable on modern Windows than wmic
        const command = `powershell -Command "Get-CimInstance Win32_Process -Filter \\"name = 'LeagueClientUx.exe'\\" | Select-Object -ExpandProperty CommandLine"`;

        exec(command, (error, stdout) => {
            if (error || !stdout || !stdout.trim()) {
                console.log('LCU not found or error:', error);
                // MOCK FOR DEV if explicitly requested, otherwise fail
                // resolve({ port: '1234', token: 'mock-token', protocol: 'https' });
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

interface RunePage {
    name: string;
    id?: number;
}

interface LCURunePage {
    name: string;
    id: number;
}

export const exportRunePage = async (runePage: RunePage): Promise<void> => {
    if (!credentials) throw new Error('LCU not connected');

    // 1. Get current rune pages
    const currentPages = await makeLCURequest('GET', '/lol-perks/v1/pages') as LCURunePage[];

    // 2. Check if "Pyke Dominator" exists and delete it
    const existingPage = currentPages.find((p: LCURunePage) => p.name === runePage.name);
    if (existingPage) {
        await makeLCURequest('DELETE', `/lol-perks/v1/pages/${existingPage.id}`);
    }

    // 3. Create new page
    await makeLCURequest('POST', '/lol-perks/v1/pages', runePage);
};

interface ItemSet {
    title: string;
    associatedChampions: number[];
    associatedMaps: number[];
    blocks: Array<{
        type: string;
        items: Array<{
            id: string;
            count: number;
        }>;
    }>;
}

interface LCUItemSet {
    id: number;
    title: string;
}

// Export item set to League Client (appears in in-game shop)
export const exportItemSet = async (build: { starter: Array<{ id: string }>; core: Array<{ id: string }>; boots: { id: string }; situational: Array<{ id: string }>; buildPath: Array<{ id: string }> }): Promise<void> => {
    if (!credentials) throw new Error('LCU not connected');

    try {
        // Get current summoner ID (needed for item sets)
        const currentSummoner = await makeLCURequest('GET', '/lol-summoner/v1/current-summoner') as { summonerId: number };
        if (!currentSummoner || !currentSummoner.summonerId) {
            throw new Error('Could not get summoner ID');
        }

        const summonerId = currentSummoner.summonerId;

        // Get Pyke's champion ID (555)
        const pykeChampionId = 555;

        // Get existing item sets
        const existingSets = await makeLCURequest('GET', `/lol-item-sets/v1/item-sets/${summonerId}`) as LCUItemSet[] | null;
        
        // Delete existing "Pyke Dominator" item set if it exists
        if (existingSets && Array.isArray(existingSets)) {
            const existingSet = existingSets.find((s: LCUItemSet) => s.title === 'Pyke Dominator');
            if (existingSet) {
                await makeLCURequest('DELETE', `/lol-item-sets/v1/item-sets/${summonerId}/${existingSet.id}`);
            }
        }

        // Create item set blocks
        const blocks: ItemSet['blocks'] = [];

        // Starter items block
        if (build.starter.length > 0) {
            blocks.push({
                type: 'Starting Items',
                items: build.starter.map(item => ({ id: item.id, count: 1 }))
            });
        }

        // Core items block
        if (build.core.length > 0) {
            blocks.push({
                type: 'Core Items',
                items: build.core.map(item => ({ id: item.id, count: 1 }))
            });
        }

        // Boots block
        if (build.boots) {
            blocks.push({
                type: 'Boots',
                items: [{ id: build.boots.id, count: 1 }]
            });
        }

        // Build path block (ordered purchase sequence)
        if (build.buildPath.length > 0) {
            blocks.push({
                type: 'Build Path',
                items: build.buildPath.map(item => ({ id: item.id, count: 1 }))
            });
        }

        // Situational items block
        if (build.situational.length > 0) {
            blocks.push({
                type: 'Situational',
                items: build.situational.map(item => ({ id: item.id, count: 1 }))
            });
        }

        // Create the item set
        const itemSet: ItemSet = {
            title: 'Pyke Dominator',
            associatedChampions: [pykeChampionId],
            associatedMaps: [11, 12], // Summoner's Rift (11 = Classic, 12 = ARAM - adjust as needed)
            blocks: blocks
        };

        // Create the item set
        await makeLCURequest('POST', `/lol-item-sets/v1/item-sets/${summonerId}`, itemSet);
    } catch (error: unknown) {
        const err = error as { message?: string };
        console.error('Failed to export item set:', err.message || 'Unknown error');
        throw error;
    }
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
            httpsAgent: new https.Agent({ rejectUnauthorized: false }),
            validateStatus: (status) => {
                // Don't throw on 404 - it's expected when not in champ select
                return status < 500;
            }
        });
        
        // Check if response is an error
        if (response.status === 404) {
            // 404 is expected when not in champ select, return null instead of throwing
            return null;
        }
        
        if (response.status >= 400) {
            throw new Error(`LCU API returned status ${response.status}`);
        }
        
        return response.data;
    } catch (error: unknown) {
        // Only log non-404 errors
        const axiosError = error as { response?: { status?: number }; message?: string };
        if (axiosError.response?.status !== 404) {
            console.error('LCU Request Error:', axiosError.message || 'Unknown error');
        }
        throw error;
    }
};
