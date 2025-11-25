
const https = require('https');

const url = 'https://ddragon.leagueoflegends.com/cdn/14.23.1/data/en_US/item.json';

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        const items = JSON.parse(data).data;
        for (const id in items) {
            if (items[id].name === 'Opportunity') {
                console.log(`Opportunity ID: ${id}`);
                console.log(`Icon: ${items[id].image.full}`);
            }
        }
    });
}).on('error', (err) => {
    console.error('Error:', err.message);
});
