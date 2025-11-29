
import { analyzeMatchup, calculateBuild, Champion, Build, Item } from './src/logic/pykeLogic';

// Mock Champions
const jinx: Champion = { id: 'Jinx', key: '222', name: 'Jinx', tags: ['Marksman'] };
const lulu: Champion = { id: 'Lulu', key: '117', name: 'Lulu', tags: ['Support', 'Mage'] };
const lux: Champion = { id: 'Lux', key: '99', name: 'Lux', tags: ['Mage', 'Support'] };
const zed: Champion = { id: 'Zed', key: '238', name: 'Zed', tags: ['Assassin'] };
const teemo: Champion = { id: 'Teemo', key: '17', name: 'Teemo', tags: ['Marksman', 'Mage'] };

// 3+ Squishies -> Snowball Mode
const enemyTeamSnowball: Champion[] = [jinx, lulu, lux, zed, teemo];

console.log('--- Test 3: Snowball Mode (5 Squishies) ---');
const buildSnowball = calculateBuild(enemyTeamSnowball);
console.log('Core Items:');
buildSnowball.core.forEach(item => {
    console.log(`- ${item.name}: ${item.reason}`);
});

const firstItem = buildSnowball.core[0];
if (firstItem.id === '3179') { // Umbral Glaive ID
    console.log('SUCCESS: Umbral Glaive is the first core item.');
} else {
    console.log(`FAILURE: First item is ${firstItem.name} (Expected Umbral Glaive)`);
}
