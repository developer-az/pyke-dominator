
import { calculateBuild, calculateRunes, analyzeMatchup, Champion } from './src/logic/pykeLogic';

// Scenario 1: Control Mode (Vs Tanks)
const tankTeam: Champion[] = [
    { id: 'Nautilus', key: '111', name: 'Nautilus', tags: ['Tank', 'Support'] },
    { id: 'Leona', key: '89', name: 'Leona', tags: ['Tank', 'Support'] },
    { id: 'Amumu', key: '32', name: 'Amumu', tags: ['Tank', 'Mage'] },
    { id: 'Jinx', key: '222', name: 'Jinx', tags: ['Marksman'] },
    { id: 'Zed', key: '238', name: 'Zed', tags: ['Assassin'] }
];

console.log("\n--- TEST 1: Control Mode (Vs Tanks) ---");
const analysis1 = analyzeMatchup(tankTeam);
console.log(`Title: ${analysis1.title}`);
console.log(`Aggression: ${analysis1.aggressionLevel}`);
console.log(`Description: ${analysis1.description}`);


// Scenario 2: Snowball Mode (Vs Squishies)
const squishyTeam: Champion[] = [
    { id: 'Lux', key: '99', name: 'Lux', tags: ['Mage', 'Support'] },
    { id: 'Jinx', key: '222', name: 'Jinx', tags: ['Marksman'] },
    { id: 'Zed', key: '238', name: 'Zed', tags: ['Assassin'] },
    { id: 'Teemo', key: '17', name: 'Teemo', tags: ['Mage', 'Marksman'] },
    { id: 'Yi', key: '11', name: 'Master Yi', tags: ['Assassin', 'Fighter'] }
];

console.log("\n--- TEST 2: Snowball Mode (Vs Squishies) ---");
const analysis2 = analyzeMatchup(squishyTeam);
console.log(`Title: ${analysis2.title}`);
console.log(`Aggression: ${analysis2.aggressionLevel}`);
console.log(`Primary Targets: ${analysis2.primaryTargets.join(', ')}`);
