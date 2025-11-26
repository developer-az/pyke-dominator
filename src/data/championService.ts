import type { Champion } from '../logic/pykeLogic';

// Try to fetch latest version, fallback to a recent version
const DDRAGON_VERSION = '15.1.1'; // Updated to Season 15
const DDRAGON_URL = `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/data/en_US/champion.json`;

// Function to fetch latest version (can be called on app start)
export const fetchLatestVersion = async (): Promise<string> => {
    try {
        const response = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
        const versions = await response.json();
        return versions[0]; // Latest version is first in array
    } catch (error) {
        console.warn('Failed to fetch latest version, using fallback:', error);
        return DDRAGON_VERSION;
    }
};

export const fetchChampions = async (): Promise<Champion[]> => {
    try {
        const response = await fetch(DDRAGON_URL);
        const data = await response.json();
        interface ChampionData {
            id: string;
            key: string;
            name: string;
            tags: string[];
            info?: { magic?: number; attack?: number };
        }
        
        const championsData = Object.values(data.data) as ChampionData[];
        const champions: Champion[] = championsData.map((c: ChampionData) => ({
            id: c.id,
            key: c.key,
            name: c.name,
            tags: c.tags,
            damageType: determineDamageType(c.tags, c.info),
        }));
        return champions;
    } catch (error) {
        console.error('Failed to fetch champions:', error);
        return [];
    }
};

const determineDamageType = (tags: string[], info?: { magic?: number; attack?: number }): 'Physical' | 'Magic' | 'Mixed' => {
    // Simple heuristic
    if (tags.includes('Mage') || tags.includes('Support')) return 'Magic';
    if (tags.includes('Marksman') || tags.includes('Assassin')) return 'Physical';
    if (info && info.magic !== undefined && info.attack !== undefined) {
        if (info.magic > 5 && info.attack > 5) return 'Mixed';
        if (info.magic > info.attack) return 'Magic';
    }
    return 'Physical';
};
