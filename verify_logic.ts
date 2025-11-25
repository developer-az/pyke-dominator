
import { calculateBuild, calculateRunes, Champion } from './src/logic/pykeLogic';

// Mock Enemy Team: 3 CC Heavy Tanks/Supports
const enemyTeam: Champion[] = [
    { id: 'Nautilus', key: '111', name: 'Nautilus', tags: ['Tank', 'Support'] },
    { id: 'Leona', key: '89', name: 'Leona', tags: ['Tank', 'Support'] },
    { id: 'Amumu', key: '32', name: 'Amumu', tags: ['Tank', 'Mage'] },
    { id: 'Jinx', key: '222', name: 'Jinx', tags: ['Marksman'] },
    { id: 'Zed', key: '238', name: 'Zed', tags: ['Assassin'] }
];

console.log("Testing Logic Engine...");
const build = calculateBuild(enemyTeam);
const runes = calculateRunes(enemyTeam);

console.log("\n--- Boots ---");
console.log(`Selected: ${build.boots.name}`);
console.log(`Reason: ${build.boots.reason}`);

console.log("\n--- Core Items ---");
build.core.forEach(item => {
    console.log(`- ${item.name}: ${item.reason}`);
});

console.log("\n--- Situational Items ---");
build.situational.forEach(item => {
    console.log(`- ${item.name}: ${item.reason}`);
});

console.log("\n--- Runes ---");
console.log(`Secondary Tree ID: ${runes.subStyleId}`);
console.log(`Reason for Triumph (if present): ${runes.reasons[9111]}`);
