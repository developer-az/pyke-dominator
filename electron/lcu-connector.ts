import { exec } from 'child_process';
import axios from 'axios';
import https from 'https';

let credentials: { port: string; token: string; protocol: string } | null = null;

export const connectToLCU = (): Promise<any> => {
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

export const exportRunePage = async (runePage: any): Promise<void> => {
    if (!credentials) throw new Error('LCU not connected');

    // 1. Get current rune pages
    const currentPages = await makeLCURequest('GET', '/lol-perks/v1/pages');

    // 2. Check if "Pyke Dominator" exists and delete it
    const existingPage = currentPages.find((p: any) => p.name === runePage.name);
    if (existingPage) {
        await makeLCURequest('DELETE', `/lol-perks/v1/pages/${existingPage.id}`);
    }

    // 3. Create new page
    await makeLCURequest('POST', '/lol-perks/v1/pages', runePage);
};



export const makeLCURequest = async (method: string, endpoint: string, body?: any) => {
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
            httpsAgent: new https.Agent({ rejectUnauthorized: false })
        });
        return response.data;
    } catch (error: any) {
        console.error('LCU Request Error:', error.message);
        throw error;
    }
};
