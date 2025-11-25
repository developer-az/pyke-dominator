
const https = require('https');

const url = 'https://ddragon.leagueoflegends.com/cdn/14.23.1/data/en_US/runesReforged.json';

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        const runes = JSON.parse(data);
        const domination = runes.find(r => r.id === 8100); // Domination Tree

        if (domination) {
            console.log("Domination Tree Slots:");
            domination.slots.forEach((slot, index) => {
                console.log(`Slot ${index}:`);
                slot.runes.forEach(r => {
                    console.log(`  - ${r.name} (ID: ${r.id})`);
                });
            });
        } else {
            console.log("Domination tree not found.");
        }
    });
}).on('error', (err) => {
    console.error('Error:', err.message);
});
