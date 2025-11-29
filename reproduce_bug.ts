
// Mock types
interface Champion {
    id: string;
    key: string;
    name: string;
    tags: string[];
}

interface TeamMember {
    championId?: number;
    assignedPosition?: string;
    teamPosition?: string;
    position?: string;
}

// Mock Data
const champions: Champion[] = [
    { id: 'Darius', key: '122', name: 'Darius', tags: ['Fighter', 'Tank'] },
    { id: 'Ahri', key: '103', name: 'Ahri', tags: ['Mage', 'Assassin'] }
];

// Current State
let selections: { [key: string]: Champion | null } = {
    Top: null,
    Jungle: null,
    Mid: null,
    Bot: null,
    Support: null,
};

// The Logic from App.tsx (Simplified for reproduction)
function updateSelections(theirTeam: TeamMember[]) {
    const newSelections = { ...selections };
    let hasUpdates = false;

    const roleMap: { [key: string]: string } = {
        'TOP': 'Top',
        'JUNGLE': 'Jungle',
        'MIDDLE': 'Mid',
        'BOTTOM': 'Bot',
        'UTILITY': 'Support'
    };

    // Helper from App.tsx
    const inferRoleFromChampion = (champion: Champion, currentSelections: { [key: string]: Champion | null }): string | null => {
        const isRoleTaken = (role: string) => currentSelections[role] !== null;

        if (champion.tags.includes('Marksman') && !isRoleTaken('Bot')) return 'Bot';
        if (champion.tags.includes('Support') && !isRoleTaken('Support')) return 'Support';
        if ((champion.tags.includes('Tank') || champion.tags.includes('Fighter')) && !isRoleTaken('Top')) return 'Top';
        if ((champion.tags.includes('Assassin') || champion.tags.includes('Mage')) && !isRoleTaken('Mid')) return 'Mid';

        const roles = ['Top', 'Jungle', 'Mid', 'Bot', 'Support'];
        for (const role of roles) {
            if (!isRoleTaken(role)) return role;
        }
        return null;
    };

    theirTeam.forEach((member) => {
        const championId = member.championId;
        if (championId !== undefined && championId !== 0) {
            const found = champions.find(c => c.key === championId.toString());
            if (found) {
                const lcuRole = member.assignedPosition || member.teamPosition || member.position;
                const role = lcuRole ? roleMap[lcuRole] || null : null;

                if (role) {
                    if (newSelections[role]?.id !== found.id) {
                        newSelections[role] = found;
                        hasUpdates = true;
                    }
                } else {
                    // FIX APPLIED: Check if 'found' is already in newSelections!
                    const isAlreadyAssigned = Object.values(newSelections).some(s => s?.id === found.id);

                    if (!isAlreadyAssigned) {
                        const inferredRole = inferRoleFromChampion(found, newSelections);
                        if (inferredRole && newSelections[inferredRole]?.id !== found.id) {
                            newSelections[inferredRole] = found;
                            hasUpdates = true;
                        }
                    }
                }
            }
        }
    });

    if (hasUpdates) {
        selections = newSelections;
        console.log('Selections Updated:', JSON.stringify(selections, null, 2));
    } else {
        console.log('No Updates');
    }
}

// Simulation
console.log('--- Poll 1: Darius picked (no role) ---');
updateSelections([{ championId: 122, position: '' }]);
// Expected: Darius in Top

console.log('\n--- Poll 2: Darius picked (no role) - SAME DATA ---');
updateSelections([{ championId: 122, position: '' }]);
// Expected: No change
// Actual (Bug): Darius will be put in Jungle (or next available) because inferRole sees Top is taken (by Darius!) and finds next slot.

console.log('\n--- Poll 3: Darius picked (no role) - SAME DATA ---');
updateSelections([{ championId: 122, position: '' }]);
