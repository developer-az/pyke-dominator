// Self-contained Electron perf harness: recreates the exact overlay
// BrowserWindow configuration used in production (electron/overlay-window.ts)
// and measures its own process CPU/memory via Electron's built-in
// app.getAppMetrics() API — no external OS automation, no keystroke
// injection, no debug ports. Run with: npx electron scripts/perf-harness.mjs
import { app, BrowserWindow, screen } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function sampleMetrics(label) {
  const metrics = app.getAppMetrics();
  let total = 0;
  for (const m of metrics) total += m.cpu.percentCPUUsage;
  console.log(`\n[${label}]  total CPU%%=${total.toFixed(1)}  (across ${metrics.length} process(es))`);
  for (const m of metrics) {
    const mem = m.memory && m.memory.workingSetSize ? (m.memory.workingSetSize / 1024).toFixed(1) : '?';
    console.log(`   type=${String(m.type).padEnd(10)} pid=${String(m.pid).padEnd(7)} cpu%=${m.cpu.percentCPUUsage.toFixed(1).padStart(5)}  mem=${mem}MB`);
  }
  return total;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.bounds;

  const win = new BrowserWindow({
    width,
    height,
    x: display.bounds.x,
    y: display.bounds.y,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: false,
    hasShadow: false,
    fullscreenable: false,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
    },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setIgnoreMouseEvents(true, { forward: true });

  await win.loadFile(path.join(__dirname, '../dist/overlay.html'));
  console.log(`Loaded overlay.html into a ${width}x${height} transparent always-on-top window (hidden).`);

  // Prime the CPU counters (first sample includes process startup cost)
  sampleMetrics('startup (includes load cost, discard)');
  await wait(4000);
  const baseline = sampleMetrics('BASELINE — window created, still hidden');

  console.log('\n>>> Calling win.showInactive() — this is the exact call showOverlay() makes <<<');
  win.showInactive();
  await wait(1500);
  const showTransition = sampleMetrics('TRANSITION — first ~1.5s after show()');

  await wait(9000);
  const steadyShown = sampleMetrics('STEADY STATE — overlay visible ~9s later, idle content');

  await wait(9000);
  const steadyShown2 = sampleMetrics('STEADY STATE — overlay visible ~18s later, idle content');

  win.hide();
  await wait(3000);
  const afterHide = sampleMetrics('AFTER hide() — back to hidden');

  console.log('\n=== SUMMARY (total CPU% across all processes) ===');
  console.log(`baseline (hidden):        ${baseline.toFixed(1)}%`);
  console.log(`show() transition burst:  ${showTransition.toFixed(1)}%`);
  console.log(`steady state (shown) #1:  ${steadyShown.toFixed(1)}%`);
  console.log(`steady state (shown) #2:  ${steadyShown2.toFixed(1)}%`);
  console.log(`after hide():             ${afterHide.toFixed(1)}%`);

  app.quit();
});

app.on('window-all-closed', () => app.quit());
