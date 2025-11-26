// Rune service using official Data Dragon API
// API: https://ddragon.leagueoflegends.com/cdn/{version}/data/en_US/runesReforged.json

interface RuneData {
    id: number;
    key: string;
    icon: string;
    name: string;
    shortDesc: string;
    longDesc: string;
}

interface RuneTree {
    id: number;
    key: string;
    icon: string;
    name: string;
    slots: Array<{
        runes: RuneData[];
    }>;
}

let runeCache: Map<number, RuneData> | null = null;
let ddragonVersion: string = '15.1.1';

// Fetch latest Data Dragon version
export const fetchLatestVersion = async (): Promise<string> => {
    try {
        const response = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
        const versions = await response.json();
        return versions[0]; // Latest version is first in array
    } catch (error) {
        console.warn('Failed to fetch latest version, using fallback:', error);
        return ddragonVersion;
    }
};

// Fetch all rune data from Data Dragon
export const fetchRunes = async (): Promise<Map<number, RuneData>> => {
    if (runeCache) {
        return runeCache;
    }

    try {
        const version = await fetchLatestVersion();
        ddragonVersion = version;
        const response = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/runesReforged.json`);
        const runeTrees: RuneTree[] = await response.json();
        
        const runeMap = new Map<number, RuneData>();
        
        // Flatten all runes from all trees into a map
        runeTrees.forEach(tree => {
            tree.slots.forEach(slot => {
                slot.runes.forEach(rune => {
                    runeMap.set(rune.id, rune);
                });
            });
        });
        
        runeCache = runeMap;
        return runeMap;
    } catch (error) {
        console.error('Failed to fetch runes:', error);
        return new Map();
    }
};

// Get rune icon URL using official Data Dragon format
export const getRuneIconUrl = (runeId: number, version?: string): string => {
    const v = version || ddragonVersion;
    // Official format: https://ddragon.leagueoflegends.com/cdn/{version}/img/perk/{runeId}.png
    return `https://ddragon.leagueoflegends.com/cdn/${v}/img/perk/${runeId}.png`;
};

// Get rune data by ID
export const getRuneData = async (runeId: number): Promise<RuneData | null> => {
    const runes = await fetchRunes();
    return runes.get(runeId) || null;
};

