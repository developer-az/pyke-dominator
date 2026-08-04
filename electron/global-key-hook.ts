/**
 * Windows-capable global key capture via libuiohook (uiohook-napi).
 *
 * Electron `globalShortcut` only fires when the OS delivers RegisterHotKey to
 * the app — fullscreen / elevated League often never does. A WH_KEYBOARD_LL
 * style hook (what uiohook uses on Windows) sees keydowns system-wide.
 *
 * Caveat (UIPI): if League runs elevated and One Trick does not, Windows will
 * not deliver keys from the elevated process to a lower-integrity hook. Run
 * One Trick as admin in that case (or don't elevate League).
 */

export type FlashKeyAction = 'primary' | 'secondary';

export interface FlashKeyHandlers {
    onPrimary: () => void;
    onSecondary: () => void;
}

let started = false;
let handlers: FlashKeyHandlers | null = null;
let keydownListener: ((e: { keycode: number }) => void) | null = null;
let lastFireAt = 0;
const DEBOUNCE_MS = 180;

/** Match UiohookKey constants without importing until runtime (optional native). */
const KEY = {
    PageUp: 3657,
    PageDown: 3665,
    Numpad9: 73,
    Numpad3: 81,
    /** Numpad PageUp / PageDown when NumLock is off */
    NumpadPageUp: 3657, // same scancode path as PageUp on many layouts
    NumpadPageDown: 3665,
} as const;

function fire(action: FlashKeyAction): void {
    if (!handlers) return;
    const now = Date.now();
    if (now - lastFireAt < DEBOUNCE_MS) return;
    lastFireAt = now;
    if (action === 'primary') handlers.onPrimary();
    else handlers.onSecondary();
}

/**
 * Start the low-level keyboard hook and bind flash toggle keys.
 * Safe to call repeatedly — updates handlers and ensures the hook is running.
 */
export function startFlashKeyHook(next: FlashKeyHandlers): boolean {
    handlers = next;

    if (process.platform !== 'win32' && process.platform !== 'darwin' && process.platform !== 'linux') {
        console.warn('[keys] Unsupported platform for uiohook-napi');
        return false;
    }

    try {
        // Lazy require so electron:build / non-Windows CI can still typecheck
        // if the native binary is missing for a given arch.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { uIOhook, UiohookKey } = require('uiohook-napi') as {
            uIOhook: {
                on: (event: string, listener: (e: { keycode: number }) => void) => void;
                off: (event: string, listener: (e: { keycode: number }) => void) => void;
                start: () => void;
                stop: () => void;
            };
            UiohookKey: {
                PageUp: number;
                PageDown: number;
                Numpad9: number;
                Numpad3: number;
                NumpadPageUp?: number;
                NumpadPageDown?: number;
            };
        };

        const pageUp = UiohookKey?.PageUp ?? KEY.PageUp;
        const pageDown = UiohookKey?.PageDown ?? KEY.PageDown;
        const num9 = UiohookKey?.Numpad9 ?? KEY.Numpad9;
        const num3 = UiohookKey?.Numpad3 ?? KEY.Numpad3;
        // NumLock-off numpad PageUp/PageDown use distinct extended codes
        const numPageUp = UiohookKey?.NumpadPageUp ?? (0xee00 | 0x0049);
        const numPageDown = UiohookKey?.NumpadPageDown ?? (0xee00 | 0x0051);
        const primaryCodes = new Set([pageUp, num9, numPageUp]);
        const secondaryCodes = new Set([pageDown, num3, numPageDown]);

        if (keydownListener) {
            try {
                uIOhook.off('keydown', keydownListener);
            } catch {
                // ignore
            }
        }

        keydownListener = (e: { keycode: number }) => {
            const code = e.keycode;
            if (primaryCodes.has(code)) {
                fire('primary');
                return;
            }
            if (secondaryCodes.has(code)) {
                fire('secondary');
            }
        };

        uIOhook.on('keydown', keydownListener);

        if (!started) {
            uIOhook.start();
            started = true;
            console.log(
                '[keys] Low-level keyboard hook started (PageUp/PageDown + Numpad9/3). ' +
                    'If League is Run as Administrator, run One Trick elevated too.'
            );
        }
        return true;
    } catch (error: unknown) {
        const err = error as { message?: string };
        console.warn(
            '[keys] Failed to start uiohook-napi keyboard hook:',
            err.message || error,
            '— falling back to Electron globalShortcut (often fails while League has focus).'
        );
        return false;
    }
}

export function stopFlashKeyHook(): void {
    handlers = null;
    if (!started) return;
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { uIOhook } = require('uiohook-napi') as {
            uIOhook: {
                off: (event: string, listener: (e: { keycode: number }) => void) => void;
                stop: () => void;
            };
        };
        if (keydownListener) {
            try {
                uIOhook.off('keydown', keydownListener);
            } catch {
                // ignore
            }
            keydownListener = null;
        }
        uIOhook.stop();
    } catch (error: unknown) {
        const err = error as { message?: string };
        console.warn('[keys] Failed to stop keyboard hook:', err.message || error);
    } finally {
        started = false;
    }
}

export function isFlashKeyHookActive(): boolean {
    return started;
}
