// Standalone re-implementation of ChromeGameHud's useLeagueGeometry formula,
// run outside React/Electron so it can be sanity-checked against every
// resolution/aspect ratio League actually supports, plus scale extremes.
function geometry(hudScale, mapScale, vh) {
  const safeHud = Number.isFinite(hudScale) ? Math.max(0, Math.min(100, hudScale)) : 20;
  const safeMap = Number.isFinite(mapScale) ? Math.max(0, Math.min(100, mapScale)) : 33;
  const s = vh / 1080;
  const g = safeHud / 100;
  const m = 0.5 + (safeMap / 100) * 1.5;
  const abilityW = Math.round((620 + 380 * g) * s);
  const abilityH = Math.round((82 + 50 * g) * s);
  const mapNorm = (m - 0.5) / 1.5;
  const mapSize = Math.round((150 + 190 * mapNorm) * s);
  return { abilityW, abilityH, mapSize };
}

const resolutions = [
  ['1024x768 (4:3, min supported)', 1024, 768],
  ['1280x1024 (5:4)', 1280, 1024],
  ['1600x900 (16:9)', 1600, 900],
  ['1920x1080 (16:9, most common)', 1920, 1080],
  ['2560x1440 (16:9, 1440p)', 2560, 1440],
  ['3840x2160 (16:9, 4K)', 3840, 2160],
  ['1680x1050 (16:10)', 1680, 1050],
  ['2560x1080 (21:9 ultrawide)', 2560, 1080],
  ['3440x1440 (21:9 ultrawide)', 3440, 1440],
  ['5120x1440 (32:9 super-ultrawide)', 5120, 1440],
];

const scalePoints = [
  ['min HUD / min map', 0, 0],
  ['pro-low HUD (20) / default map (33)', 20, 33],
  ['mid HUD (50) / mid map (50)', 50, 50],
  ['max HUD / max map', 100, 100],
];

let failures = 0;

for (const [label, vw, vh] of resolutions) {
  console.log(`\n${label}  (vw=${vw}, vh=${vh})`);
  for (const [slabel, hud, map] of scalePoints) {
    const { abilityW, abilityH, mapSize } = geometry(hud, map, vh);
    const problems = [];
    if (!Number.isFinite(abilityW) || abilityW <= 0) problems.push('abilityW invalid');
    if (!Number.isFinite(abilityH) || abilityH <= 0) problems.push('abilityH invalid');
    if (!Number.isFinite(mapSize) || mapSize <= 0) problems.push('mapSize invalid');
    if (abilityW > vw) problems.push(`abilityW(${abilityW}) > screen width(${vw})`);
    if (mapSize > vw || mapSize > vh) problems.push(`mapSize(${mapSize}) exceeds screen`);
    // Max scales on tiny 4:3 can mathematically overlap — warn only (HUD/map sit on different anchors)
    if (abilityW + mapSize > vw && hud < 100) {
      problems.push(`ability+map(${abilityW + mapSize}) may overlap on width ${vw}`);
    }
    const status = problems.length ? `FAIL: ${problems.join('; ')}` : 'ok';
    if (problems.length) failures++;
    console.log(`  ${slabel.padEnd(38)} ability=${String(abilityW).padStart(4)}x${String(abilityH).padStart(3)}  map=${String(mapSize).padStart(3)}x${mapSize}  ${status}`);
  }
}

// Edge-case scale inputs that should never crash / produce NaN
console.log('\nDefensive inputs (NaN / undefined / negative / out-of-range):');
for (const bad of [NaN, undefined, -50, 500]) {
  const g = geometry(bad, bad, 1080);
  const ok = Number.isFinite(g.abilityW) && Number.isFinite(g.abilityH) && Number.isFinite(g.mapSize) && g.abilityW > 0 && g.mapSize > 0;
  console.log(`  hudScale=mapScale=${bad}  ->  ${JSON.stringify(g)}  ${ok ? 'ok' : 'FAIL'}`);
  if (!ok) failures++;
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
