import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    connectLCU: () => ipcRenderer.invoke('lcu-connect'),
    requestLCU: (method: string, endpoint: string, body?: unknown) => ipcRenderer.invoke('lcu-request', method, endpoint, body),
    onUpdate: (callback: (value: unknown) => void) => ipcRenderer.on('main-process-message', (_event, value) => callback(value)),
    windowMinimize: () => ipcRenderer.invoke('window-minimize'),
    windowMaximize: () => ipcRenderer.invoke('window-maximize'),
    windowClose: () => ipcRenderer.invoke('window-close'),
});
