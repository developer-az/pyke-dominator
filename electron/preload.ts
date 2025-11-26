import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    connectLCU: () => ipcRenderer.invoke('lcu-connect'),
    requestLCU: (method: string, endpoint: string, body?: unknown) => ipcRenderer.invoke('lcu-request', method, endpoint, body),
    onUpdate: (callback: (value: unknown) => void) => ipcRenderer.on('main-process-message', (_event, value) => callback(value)),
    exportItemSet: (build: { starter: Array<{ id: string }>; core: Array<{ id: string }>; boots: { id: string }; situational: Array<{ id: string }>; buildPath: Array<{ id: string }> }) => 
      ipcRenderer.invoke('lcu-export-item-set', build),
    windowMinimize: () => ipcRenderer.invoke('window-minimize'),
    windowMaximize: () => ipcRenderer.invoke('window-maximize'),
    windowClose: () => ipcRenderer.invoke('window-close'),
});
