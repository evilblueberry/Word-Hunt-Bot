import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    getConfig: () => ipcRenderer.invoke('get-config'),
    saveConfig: (config: any) => ipcRenderer.invoke('save-config', config),
    checkEnv: () => ipcRenderer.invoke('check-env'),
    installDeps: () => ipcRenderer.invoke('install-deps'),
    startAppium: () => ipcRenderer.invoke('start-appium'),
    stopAppium: () => ipcRenderer.invoke('stop-appium'),
    startBot: () => ipcRenderer.invoke('start-bot'),
    stopBot: () => ipcRenderer.invoke('stop-bot'),
    onLog: (callback: (log: string) => void) => {
        ipcRenderer.on('log', (_event, log) => callback(log));
    }
});
