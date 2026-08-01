import { app, BrowserWindow, screen } from 'electron';
import fs from 'fs';
import path from 'path';
import { readLeagueHudScales } from './league-settings';

export interface FrameCalibration {
    dx: number;
    dy: number;
    dw: number;
    dh: number;
}

export interface OverlayCalibration {
    ability: FrameCalibration;
    minimap: FrameCalibration;
}

const DEFAULT_CALIBRATION: OverlayCalibration = {
    ability: { dx: 0, dy: 0, dw: 0, dh: 0 },
    minimap: { dx: 0, dy: 0, dw: 0, dh: 0 },
};

let overlayWin: BrowserWindow | null = null;

/** When the overlay is hidden, allow Chromium to throttle it and free GPU/CPU for League. */
function setOverlayThrottling(enabled: boolean): void {
    if (!overlayWin || overlayWin.isDestroyed()) return;
    try {
        overlayWin.webContents.setBackgroundThrottling(enabled);
    } catch {
        // Older Electron builds — ignore
    }
}

let clickThrough = true;
let userHidden = false;
let hudScale = 20;
/** Default ~MinimapScale 1.0 (was 88 ≈ 1.82 — caused huge map frame vs HUD). */
let mapScale = 33;
let chromeColor = '#d4d8de';
let gameWidth = 1920;
let gameHeight = 1080;
let calibration: OverlayCalibration = { ...DEFAULT_CALIBRATION, ability: { ...DEFAULT_CALIBRATION.ability }, minimap: { ...DEFAULT_CALIBRATION.minimap } };

function normalizeChromeColor(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const v = value.trim();
    return /^#[0-9A-Fa-f]{6}$/.test(v) ? v.toLowerCase() : null;
}

function normalizeFrameCalibration(value: unknown): FrameCalibration | null {
    if (!value || typeof value !== 'object') return null;
    const v = value as Record<string, unknown>;
    const nums = ['dx', 'dy', 'dw', 'dh'].map((k) => (Number.isFinite(v[k]) ? Number(v[k]) : 0));
    return { dx: nums[0], dy: nums[1], dw: nums[2], dh: nums[3] };
}
let interactiveBounds: Electron.Rectangle | null = null;

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

function getOverlayUrl(): string {
    if (VITE_DEV_SERVER_URL) {
        return `${VITE_DEV_SERVER_URL.replace(/\/$/, '')}/overlay.html`;
    }
    if (!app.isPackaged) {
        return 'http://localhost:5173/overlay.html';
    }
    return path.join(process.env.DIST || '', 'overlay.html');
}

export function getOverlayWindow(): BrowserWindow | null {
    return overlayWin;
}

export function isOverlayUserHidden(): boolean {
    return userHidden;
}

function settingsPath(): string {
    return path.join(app.getPath('userData'), 'overlay-settings.json');
}

function loadSettings(): void {
    // Prefer live League game.cfg (your actual Interface scales)
    const league = readLeagueHudScales();
    if (league) {
        hudScale = league.hudScale;
        mapScale = league.mapScale;
        gameWidth = league.width;
        gameHeight = league.height;
    }

    try {
        const settings = JSON.parse(fs.readFileSync(settingsPath(), 'utf8')) as {
            hudScale?: unknown;
            mapScale?: unknown;
            chromeColor?: unknown;
            interactiveBounds?: Electron.Rectangle;
            preferLeagueCfg?: unknown;
        };
        // Only override with saved values if user explicitly tuned after import
        // (preferLeagueCfg false). Default: keep League cfg values.
        if (settings.preferLeagueCfg === false) {
            if (typeof settings.hudScale === 'number') {
                hudScale = Math.max(0, Math.min(100, Math.round(settings.hudScale)));
            }
            if (typeof settings.mapScale === 'number') {
                mapScale = Math.max(0, Math.min(100, Math.round(settings.mapScale)));
            }
        }
        const savedColor = normalizeChromeColor(settings.chromeColor);
        if (savedColor) chromeColor = savedColor;
        const savedCalibration = settings as { calibration?: { ability?: unknown; minimap?: unknown } };
        if (savedCalibration.calibration) {
            const ability = normalizeFrameCalibration(savedCalibration.calibration.ability);
            const minimap = normalizeFrameCalibration(savedCalibration.calibration.minimap);
            if (ability) calibration.ability = ability;
            if (minimap) calibration.minimap = minimap;
        }
        if (settings.interactiveBounds &&
            Number.isFinite(settings.interactiveBounds.x) &&
            Number.isFinite(settings.interactiveBounds.y) &&
            Number.isFinite(settings.interactiveBounds.width) &&
            Number.isFinite(settings.interactiveBounds.height)) {
            interactiveBounds = settings.interactiveBounds;
        }
    } catch {
        // No saved settings yet.
    }
}

function saveSettings(): void {
    try {
        fs.writeFileSync(
            settingsPath(),
            JSON.stringify({ hudScale, mapScale, chromeColor, interactiveBounds, calibration, preferLeagueCfg: false }),
            'utf8'
        );
    } catch (error) {
        console.warn('[overlay] Failed to save settings:', error);
    }
}

/** Re-read League game.cfg and push scales to overlay + callers. */
export function syncScalesFromLeague(): {
    hudScale: number;
    mapScale: number;
    source?: string;
    gameWidth?: number;
    gameHeight?: number;
} {
    const league = readLeagueHudScales();
    if (league) {
        hudScale = league.hudScale;
        mapScale = league.mapScale;
        gameWidth = league.width;
        gameHeight = league.height;
        try {
            // Must include calibration/etc — this used to omit them and silently
            // wipe the user's saved nudge positions from disk on every game start.
            fs.writeFileSync(
                settingsPath(),
                JSON.stringify({ hudScale, mapScale, chromeColor, interactiveBounds, calibration, preferLeagueCfg: true }),
                'utf8'
            );
        } catch {
            // ignore
        }
        broadcastOverlayMeta();
        return {
            hudScale,
            mapScale,
            source: league.source,
            gameWidth,
            gameHeight,
        };
    }
    return { hudScale, mapScale, gameWidth, gameHeight };
}

function assertAlwaysOnTop(win: BrowserWindow): void {
    win.setAlwaysOnTop(true, 'screen-saver');
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
}

export function createOverlayWindow(): BrowserWindow {
    if (overlayWin && !overlayWin.isDestroyed()) {
        return overlayWin;
    }

    loadSettings();
    // Always re-read game.cfg on overlay create so frames match Interface scales
    syncScalesFromLeague();
    const display = screen.getPrimaryDisplay();
    const { width, height } = display.bounds;

    overlayWin = new BrowserWindow({
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
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            backgroundThrottling: false,
        },
    });

    assertAlwaysOnTop(overlayWin);

    // Default: a fullscreen click-through surface, so the game is never blocked.
    setClickThrough(true);

    const url = getOverlayUrl();
    if (url.startsWith('http')) {
        overlayWin.loadURL(url);
    } else {
        overlayWin.loadFile(url);
    }

    overlayWin.on('closed', () => {
        overlayWin = null;
    });
    let moveSaveTimer: ReturnType<typeof setTimeout> | null = null;
    overlayWin.on('moved', () => {
        if (clickThrough || !overlayWin || overlayWin.isDestroyed()) return;
        interactiveBounds = overlayWin.getBounds();
        // 'moved' fires repeatedly through a drag gesture — debounce the
        // synchronous disk write instead of blocking the main thread per event.
        if (moveSaveTimer) clearTimeout(moveSaveTimer);
        moveSaveTimer = setTimeout(saveSettings, 300);
    });

    return overlayWin;
}

/**
 * Cheap periodic self-heal: Windows can occasionally drop the topmost flag
 * (e.g. another app briefly requests foreground/topmost). Only re-applies
 * setAlwaysOnTop — a native call — when the query says it's actually needed,
 * and skips entirely if the window isn't visible. Deliberately does NOT touch
 * bounds / click-through / broadcast every call like showOverlay() does.
 */
export function keepOverlayOnTop(): void {
    if (!overlayWin || overlayWin.isDestroyed() || !overlayWin.isVisible()) return;
    if (!overlayWin.isAlwaysOnTop()) {
        assertAlwaysOnTop(overlayWin);
    }
}

export function showOverlay(): void {
    if (userHidden) return;

    const win = createOverlayWindow();
    setOverlayThrottling(false);
    if (!win.isVisible()) {
        win.showInactive();
    }
    assertAlwaysOnTop(win);
    // Re-apply click-through after show — Windows can drop ignore-mouse state on hide/show
    setClickThrough(clickThrough);
}

export function hideOverlay(): void {
    if (overlayWin && !overlayWin.isDestroyed()) {
        if (overlayWin.isVisible()) {
            overlayWin.hide();
        }
        // Hidden overlay should not keep a hot compositor path against the game.
        setOverlayThrottling(true);
    }
}

export function destroyOverlay(): void {
    if (overlayWin && !overlayWin.isDestroyed()) {
        overlayWin.destroy();
    }
    overlayWin = null;
}

export function toggleOverlayVisibility(): boolean {
    userHidden = !userHidden;
    if (userHidden) {
        hideOverlay();
    } else {
        showOverlay();
    }
    broadcastOverlayMeta();
    return !userHidden;
}

export function setOverlayUserHidden(hidden: boolean): void {
    userHidden = hidden;
    if (hidden) {
        hideOverlay();
    } else {
        showOverlay();
    }
    broadcastOverlayMeta();
}

export function setClickThrough(enabled: boolean): void {
    clickThrough = enabled;
    if (!overlayWin || overlayWin.isDestroyed()) return;

    // Always stay fullscreen over the game display. Shrinking to a 360×760
    // panel made HUD/minimap frames meaningless for alignment (they measured
    // against the tiny window, not League's HUD). Unlock = align mode with
    // mouse events on so nudge controls work; Lock = click-through again.
    const display = screen.getDisplayMatching(overlayWin.getBounds()) || screen.getPrimaryDisplay();
    overlayWin.setBounds(display.bounds);
    overlayWin.setMovable(false);

    if (enabled) {
        overlayWin.setFocusable(false);
        overlayWin.setIgnoreMouseEvents(true, { forward: true });
    } else {
        overlayWin.setFocusable(true);
        overlayWin.setIgnoreMouseEvents(false);
        overlayWin.show();
        overlayWin.focus();
    }
    broadcastOverlayMeta();
}

export function toggleClickThrough(): boolean {
    setClickThrough(!clickThrough);
    return clickThrough;
}

export function isClickThrough(): boolean {
    return clickThrough;
}

export function getHudScale(): number {
    return hudScale;
}

export function setHudScale(scale: number): number {
    hudScale = Math.max(0, Math.min(100, Math.round(scale)));
    saveSettings();
    broadcastOverlayMeta();
    return hudScale;
}

export function getMapScale(): number {
    return mapScale;
}

export function setMapScale(scale: number): number {
    mapScale = Math.max(0, Math.min(100, Math.round(scale)));
    saveSettings();
    broadcastOverlayMeta();
    return mapScale;
}

export function getCalibration(): OverlayCalibration {
    return calibration;
}

/** Nudge one dimension (dx/dy/dw/dh) of a frame (ability/minimap) by a pixel delta. Persists + broadcasts. */
export function adjustCalibration(
    target: 'ability' | 'minimap',
    field: keyof FrameCalibration,
    delta: number
): OverlayCalibration {
    if (!Number.isFinite(delta)) return calibration;
    const current = calibration[target][field];
    const next = Math.max(-400, Math.min(400, current + delta));
    calibration = {
        ...calibration,
        [target]: { ...calibration[target], [field]: next },
    };
    saveSettings();
    broadcastOverlayMeta();
    return calibration;
}

export function resetCalibration(): OverlayCalibration {
    calibration = {
        ability: { dx: 0, dy: 0, dw: 0, dh: 0 },
        minimap: { dx: 0, dy: 0, dw: 0, dh: 0 },
    };
    saveSettings();
    broadcastOverlayMeta();
    return calibration;
}

export function getChromeColor(): string {
    return chromeColor;
}

export function setChromeColor(color: string): string {
    const next = normalizeChromeColor(color);
    if (next) {
        chromeColor = next;
        saveSettings();
        broadcastOverlayMeta();
    }
    return chromeColor;
}

export function getGameResolution(): { gameWidth: number; gameHeight: number } {
    return { gameWidth, gameHeight };
}

export function broadcastOverlayMeta(): void {
    if (!overlayWin || overlayWin.isDestroyed()) return;
    overlayWin.webContents.send('overlay-meta', {
        visible: !userHidden && overlayWin.isVisible(),
        clickThrough,
        userHidden,
        hudScale,
        mapScale,
        chromeColor,
        calibration,
        gameWidth,
        gameHeight,
        alignMode: !clickThrough,
    });
}

export function sendOverlayUpdate(payload: unknown): void {
    // Broadcast to every renderer (overlay + main) so the main window can pause
    // work / reset UI when match state changes. Previously only the overlay
    // received updates, so App.tsx never saw inGame transitions.
    for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
            win.webContents.send('overlay-update', payload);
        }
    }
}
