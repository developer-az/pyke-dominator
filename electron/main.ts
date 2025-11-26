import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { connectToLCU, makeLCURequest } from './lcu-connector';

process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(__dirname, '../public');

let win: BrowserWindow | null;
// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
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
        },
        backgroundColor: '#0a1116',
        frame: false,
        transparent: false,
        titleBarStyle: 'hidden',
        titleBarOverlay: {
            color: '#0a1116',
            symbolColor: '#00ff9d',
            height: 40
        }
    });

    // Test active push message to Renderer-process.
    win.webContents.on('did-finish-load', () => {
        win?.webContents.send('main-process-message', (new Date).toLocaleString());
    });

    if (VITE_DEV_SERVER_URL) {
        win.loadURL(VITE_DEV_SERVER_URL);
    } else {
        // Fallback for dev if env var is missing but we are not packaged
        if (!app.isPackaged) {
            win.loadURL('http://localhost:5173');
            win.webContents.openDevTools();
        } else {
            win.loadFile(path.join(process.env.DIST, 'index.html'));
        }
    }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
        win = null;
    }
});

app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

app.whenReady().then(() => {
    createWindow();

    // IPC Handlers
    ipcMain.handle('lcu-connect', async () => {
        try {
            const credentials = await connectToLCU();
            return { success: true, credentials };
        } catch (error: unknown) {
            const err = error as { message?: string };
            return { success: false, error: err.message || 'Unknown error' };
        }
    });

    ipcMain.handle('lcu-request', async (_event, method, endpoint, body) => {
        try {
            const response = await makeLCURequest(method, endpoint, body);
            
            // Handle 404 responses gracefully (expected when not in champ select)
            if (response === null) {
                return { success: false, error: '404 - Not found (expected when not in champ select)' };
            }
            
            return { success: true, data: response };
        } catch (error: unknown) {
            // Don't log 404 errors as they're expected
            const err = error as { response?: { status?: number }; message?: string };
            const is404 = err.response?.status === 404 || err.message?.includes('404');
            if (!is404) {
                console.error('LCU Request Error:', err.message || 'Unknown error');
            }
            return { success: false, error: err.message || 'Unknown error' };
        }
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
