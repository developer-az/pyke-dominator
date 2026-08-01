import { app, BrowserWindow, ipcMain, globalShortcut, clipboard } from 'electron';
import path from 'path';
import { connectToLCU, makeLCURequest } from './lcu-connector';
import { fetchLiveClientData } from './live-client';
import { startGameMonitor, stopGameMonitor, isCurrentlyInGame, setGameStateChangeHandler } from './game-monitor';
import {
    destroyOverlay,
    toggleOverlayVisibility,
    setOverlayUserHidden,
    toggleClickThrough,
    isClickThrough,
    isAlignMode,
    setAlignMode,
    isOverlayUserHidden,
    showOverlay,
    getHudScale,
    setHudScale,
    getMapScale,
    setMapScale,
    getChromeColor,
    setChromeColor,
    syncScalesFromLeague,
    getCalibration,
    adjustCalibration,
    resetCalibration,
    getGameResolution,
    broadcastOverlayMeta,
    type FrameCalibration,
} from './overlay-window';
import { formatAdcClipboard } from './summoner-tracker';

process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(__dirname, '../public');

let win: BrowserWindow | null;
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

function createWindow() {
    win = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        icon: path.join(process.env.VITE_PUBLIC || '', 'electron-vite.svg'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            // Default true — keep main UI throttled when unfocused/minimized so
            // it does not compete with League for CPU while a match is running.
            backgroundThrottling: true,
        },
        backgroundColor: '#070708',
        frame: false,
        transparent: false,
        titleBarStyle: 'hidden',
        titleBarOverlay: {
            color: '#070708',
            symbolColor: '#d4d8de',
            height: 40
        }
    });

    win.on('closed', () => {
        win = null;
        stopGameMonitor();
        destroyOverlay();
        globalShortcut.unregisterAll();
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });

    win.webContents.on('did-finish-load', () => {
        win?.webContents.send('main-process-message', (new Date).toLocaleString());
    });

    const loadMain = async () => {
        if (VITE_DEV_SERVER_URL) {
            await win?.loadURL(VITE_DEV_SERVER_URL);
        } else if (!app.isPackaged) {
            await win?.loadURL('http://localhost:5173/');
            // DevTools are heavy on GPU/CPU — only open when explicitly requested.
            if (process.env.PYKE_OPEN_DEVTOOLS === '1') {
                win?.webContents.openDevTools();
            }
        } else {
            await win?.loadFile(path.join(process.env.DIST || '', 'index.html'));
        }
    };
    void loadMain();
}

function registerOverlayHotkeys() {
    // Avoid Ctrl+Shift+I — Electron/Chromium reserves it for DevTools
    const hideOk = globalShortcut.register('CommandOrControl+Shift+H', () => {
        const visible = toggleOverlayVisibility();
        win?.webContents.send('overlay-visibility-changed', { visible });
    });

    const clickOk = globalShortcut.register('CommandOrControl+Shift+U', () => {
        // Unlock = compact movable panel; Lock = fullscreen click-through.
        // (HUD align is a separate mode — do not cover the whole screen here.)
        const clickThrough = toggleClickThrough();
        win?.webContents.send('overlay-clickthrough-changed', { clickThrough });
        broadcastOverlayMeta();
    });

    if (!hideOk || !globalShortcut.isRegistered('CommandOrControl+Shift+H')) {
        console.warn('[overlay] Failed to register Ctrl+Shift+H (hide); another app may own it.');
    }
    if (!clickOk || !globalShortcut.isRegistered('CommandOrControl+Shift+U')) {
        console.warn('[overlay] Failed to register Ctrl+Shift+U (lock/unlock); another app may own it.');
    }
}

app.on('window-all-closed', () => {
    stopGameMonitor();
    destroyOverlay();
    globalShortcut.unregisterAll();
    if (process.platform !== 'darwin') {
        app.quit();
        win = null;
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

app.on('will-quit', () => {
    stopGameMonitor();
    globalShortcut.unregisterAll();
});

app.whenReady().then(() => {
    createWindow();
    // Overlay is created only when a match starts (see game-monitor) —
    // avoid a permanent fullscreen transparent window sitting idle.
    registerOverlayHotkeys();

    // Minimize the main window during matches so its renderer/GPU work
    // does not steal frames from League. Restore when the match ends.
    setGameStateChangeHandler((active) => {
        if (!win || win.isDestroyed()) return;
        if (active) {
            if (!win.isMinimized()) win.minimize();
        } else if (win.isMinimized()) {
            win.restore();
        }
    });

    // Start monitoring once LCU may be available — reconnect attempts happen in tick
    // Delay slightly so main window loads first
    setTimeout(() => {
        startGameMonitor();
    }, 2000);

    // IPC Handlers
    ipcMain.handle('lcu-connect', async () => {
        try {
            const credentials = await connectToLCU();
            // Kick monitor after successful connect
            startGameMonitor();
            return { success: true, credentials };
        } catch (error: unknown) {
            const err = error as { message?: string };
            return { success: false, error: err.message || 'Unknown error' };
        }
    });

    ipcMain.handle('lcu-request', async (_event, method, endpoint, body) => {
        try {
            const response = await makeLCURequest(method, endpoint, body);

            if (response === null) {
                return { success: false, error: '404 - Not found (expected when not in champ select)' };
            }

            return { success: true, data: response };
        } catch (error: unknown) {
            const err = error as { response?: { status?: number }; message?: string };
            const is404 = err.response?.status === 404 || err.message?.includes('404');
            if (!is404) {
                console.error('LCU Request Error:', err.message || 'Unknown error');
            }
            return { success: false, error: err.message || 'Unknown error' };
        }
    });

    ipcMain.handle('lcu-export-item-set', async (_event, build) => {
        try {
            const { exportItemSet } = await import('./lcu-connector');
            await exportItemSet(build);
            return { success: true };
        } catch (error: unknown) {
            const err = error as { message?: string };
            console.error('Export Item Set Error:', err.message || 'Unknown error');
            return { success: false, error: err.message || 'Unknown error' };
        }
    });

    ipcMain.handle('lcu-export-rune-page', async (_event, runePage) => {
        try {
            const { exportRunePage } = await import('./lcu-connector');
            await exportRunePage(runePage);
            return { success: true };
        } catch (error: unknown) {
            const err = error as { message?: string };
            console.error('Export Rune Page Error:', err.message || 'Unknown error');
            return { success: false, error: err.message || 'Unknown error' };
        }
    });

    ipcMain.handle('clipboard-write', async (_event, text: string) => {
        try {
            const value = typeof text === 'string' && text.trim() ? text : formatAdcClipboard();
            if (!value) return { success: false, error: 'Nothing to copy' };
            clipboard.writeText(value);
            return { success: true };
        } catch (error: unknown) {
            const err = error as { message?: string };
            return { success: false, error: err.message || 'Clipboard failed' };
        }
    });

    // Live Client Data (in-game, including Practice Tool)
    ipcMain.handle('live-client-data', async () => {
        try {
            const data = await fetchLiveClientData();
            return { success: !!data, data };
        } catch (error: unknown) {
            const err = error as { message?: string };
            return { success: false, error: err.message || 'Unknown error' };
        }
    });

    // Overlay controls
    ipcMain.handle('overlay-toggle', async () => {
        try {
            const visible = toggleOverlayVisibility();
            win?.webContents.send('overlay-visibility-changed', { visible });
            return { success: true, visible };
        } catch (error) {
            console.error('[overlay] Failed to toggle visibility:', error);
            return { success: false, visible: !isOverlayUserHidden() };
        }
    });

    ipcMain.handle('overlay-set-visible', async (_event, visible: boolean) => {
        try {
            setOverlayUserHidden(!visible);
            if (visible && isCurrentlyInGame()) {
                showOverlay();
            }
            win?.webContents.send('overlay-visibility-changed', { visible: !isOverlayUserHidden() });
            return { success: true, visible: !isOverlayUserHidden() };
        } catch (error) {
            console.error('[overlay] Failed to set visibility:', error);
            return { success: false, visible: !isOverlayUserHidden() };
        }
    });

    ipcMain.handle('overlay-toggle-clickthrough', async () => {
        try {
            const clickThrough = toggleClickThrough();
            win?.webContents.send('overlay-clickthrough-changed', { clickThrough });
            return { success: true, clickThrough };
        } catch (error) {
            console.error('[overlay] Failed to change interaction mode:', error);
            return { success: false, clickThrough: isClickThrough() };
        }
    });

    ipcMain.handle('overlay-set-align-mode', async (_event, enabled: boolean) => {
        try {
            const alignMode = setAlignMode(!!enabled);
            return { success: true, alignMode, clickThrough: isClickThrough() };
        } catch (error) {
            console.error('[overlay] Failed to set align mode:', error);
            return { success: false, alignMode: isAlignMode(), clickThrough: isClickThrough() };
        }
    });

    ipcMain.handle('overlay-set-hud-scale', async (_event, scale: number) => {
        if (!Number.isFinite(scale)) {
            return { success: false, hudScale: getHudScale() };
        }
        return { success: true, hudScale: setHudScale(scale) };
    });

    ipcMain.handle('overlay-set-map-scale', async (_event, scale: number) => {
        if (!Number.isFinite(scale)) {
            return { success: false, mapScale: getMapScale() };
        }
        return { success: true, mapScale: setMapScale(scale) };
    });

    ipcMain.handle('overlay-set-chrome-color', async (_event, color: string) => {
        return { success: true, chromeColor: setChromeColor(color) };
    });

    ipcMain.handle('overlay-sync-league-scales', async () => {
        const res = syncScalesFromLeague();
        return { success: true, ...res };
    });

    ipcMain.handle(
        'overlay-adjust-calibration',
        async (_event, target: 'ability' | 'minimap', field: keyof FrameCalibration, delta: number) => {
            const result = adjustCalibration(target, field, delta);
            return { success: true, calibration: result };
        }
    );

    ipcMain.handle('overlay-reset-calibration', async () => {
        const result = resetCalibration();
        return { success: true, calibration: result };
    });

    ipcMain.handle('overlay-get-status', () => {
        const res = getGameResolution();
        return {
            success: true,
            visible: !isOverlayUserHidden(),
            clickThrough: isClickThrough(),
            alignMode: isAlignMode(),
            inGame: isCurrentlyInGame(),
            hudScale: getHudScale(),
            mapScale: getMapScale(),
            chromeColor: getChromeColor(),
            calibration: getCalibration(),
            gameWidth: res.gameWidth,
            gameHeight: res.gameHeight,
        };
    });

    // Window Controls
    ipcMain.handle('window-minimize', () => {
        if (win) win.minimize();
    });

    ipcMain.handle('window-maximize', () => {
        if (win) {
            if (win.isMaximized()) {
                win.unmaximize();
            } else {
                win.maximize();
            }
        }
    });

    ipcMain.handle('window-close', () => {
        if (win) win.close();
    });
});
