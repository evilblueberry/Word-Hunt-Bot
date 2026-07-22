import { contextBridge, ipcRenderer } from 'electron';

type LauncherConfig = {
    bundleId: string;
    host: string;
    port: number;
    teamId: string;
    udid: string;
    xcodeSigningId: string;
    updatedWDABundleId: string;
};

contextBridge.exposeInMainWorld('electronAPI', {
    getConfig: () => ipcRenderer.invoke('get-config'),
    saveConfig: (config: LauncherConfig) => ipcRenderer.invoke('save-config', config),
    getOsUsername: () => ipcRenderer.invoke('get-os-username'),
    checkEnv: () => ipcRenderer.invoke('check-env'),
    installDeps: () => ipcRenderer.invoke('install-deps'),
    startAppium: () => ipcRenderer.invoke('start-appium'),
    stopAppium: () => ipcRenderer.invoke('stop-appium'),
    startBot: () => ipcRenderer.invoke('start-bot'),
    stopBot: () => ipcRenderer.invoke('stop-bot'),
    runPreflights: (udid: string) => ipcRenderer.invoke('run-preflights', udid),
    testWda: () => ipcRenderer.invoke('test-wda'),
    onLog: (callback: (log: string) => void) => {
        const listener = (_event: Electron.IpcRendererEvent, log: string) => callback(log);
        ipcRenderer.on('log', listener);
        return () => ipcRenderer.removeListener('log', listener);
    }
});
