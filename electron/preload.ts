import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    connectLCU: () => ipcRenderer.invoke('lcu-connect'),
    requestLCU: (method: string, endpoint: string, body?: any) => ipcRenderer.invoke('lcu-request', method, endpoint, body),
    onUpdate: (callback: (value: any) => void) => ipcRenderer.on('main-process-message', (_event, value) => callback(value)),
});
