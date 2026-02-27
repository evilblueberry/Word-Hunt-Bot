import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { spawn, exec } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';

let mainWindow: BrowserWindow | null = null;
let appiumProcess: any = null;
let botProcess: any = null;
let wdaProcess: any = null;

const rootDir = path.join(__dirname, '../../..'); 
const venvPath = path.join(rootDir, 'venv');
const pythonExec = os.platform() === 'win32' ? path.join(venvPath, 'Scripts', 'python.exe') : path.join(venvPath, 'bin', 'python');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Clean up processes on exit
app.on('before-quit', () => {
  if (appiumProcess) appiumProcess.kill();
  if (botProcess) botProcess.kill();
  if (wdaProcess) wdaProcess.kill();
});

// Config logic
const configPath = path.join(app.getPath('userData'), 'wordhunt_config.json');

ipcMain.handle('get-config', async () => {
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }
  return { bundleId: 'com.apple.MobileSMS', host: '127.0.0.1', port: 4723, teamId: '', udid: '' };
});

ipcMain.handle('save-config', async (_, newConfig) => {
  fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
  return true;
});

// Environment setup checks
ipcMain.handle('check-env', async () => {
  const result = { python: false, node: false, venv: false, appium: false };
  try {
     result.node = true; // Electron implies node.
     const pVer = await new Promise((res) => exec('python3 --version', (err) => res(!err)));
     result.python = pVer as boolean;
     result.venv = fs.existsSync(pythonExec);
     const appiumCheck = await new Promise((res) => exec('appium -v', (err) => res(!err)));
     result.appium = appiumCheck as boolean;
  } catch(e) {}
  return result;
});

// Process runners (Appium, python venv install, script runner)
ipcMain.handle('install-deps', async (event) => {
  return new Promise((resolve, reject) => {
    event.sender.send('log', 'Starting dependency installation...\n');
    const cmds = [];
    if (!fs.existsSync(pythonExec)) {
        cmds.push(`python3 -m venv "${venvPath}"`);
    }
    const pipCmd = os.platform() === 'win32' ? `"${venvPath}\\Scripts\\pip"` : `"${venvPath}/bin/pip"`;
    cmds.push(`${pipCmd} install -r "${path.join(rootDir, 'requirements.txt')}"`);
    
    // We assume Appium global install needs to be done manually or via npm wrapper
    // cmds.push('npm install -g appium'); 
    
    const cmdStr = cmds.join(' && ');
    event.sender.send('log', `Running: ${cmdStr}\n`);
    const proc = exec(cmdStr, { cwd: rootDir });
    proc.stdout?.on('data', d => event.sender.send('log', d));
    proc.stderr?.on('data', d => event.sender.send('log', d));
    proc.on('close', code => {
      event.sender.send('log', `Dependency install exited with ${code}\n`);
      resolve(code === 0);
    });
  });
});

ipcMain.handle('start-appium', async (event) => {
  if (appiumProcess) return true;
  return new Promise((resolve) => {
    event.sender.send('log', 'Starting Appium...\n');
    appiumProcess = spawn('appium', [], { cwd: rootDir, shell: true });
    appiumProcess.stdout?.on('data', (d: any) => {
        event.sender.send('log', d.toString());
        if (d.toString().includes('Appium REST http interface listener started')) {
            resolve(true); // Appium is ready
        }
    });
    appiumProcess.stderr?.on('data', (d: any) => event.sender.send('log', d.toString()));
    appiumProcess.on('close', () => { appiumProcess = null; });
  });
});

ipcMain.handle('stop-appium', async () => {
    if (appiumProcess) {
        appiumProcess.kill();
        appiumProcess = null;
    }
    return true;
});

ipcMain.handle('start-bot', async (event) => {
  if (botProcess) return false;
  return new Promise((resolve) => {
    event.sender.send('log', 'Starting Bot...\n');
    const scriptPath = path.join(rootDir, 'Scripts', 'main.py');
    // We will supply config via env variables
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8') || "{}");
    const env = { ...process.env, 
        BOT_UDID: config.udid, 
        BOT_TEAM_ID: config.teamId,
        BOT_BUNDLE_ID: config.bundleId 
    };
    
    botProcess = spawn(pythonExec, [scriptPath], { cwd: rootDir, env });
    botProcess.stdout?.on('data', (d: any) => event.sender.send('log', d.toString()));
    botProcess.stderr?.on('data', (d: any) => event.sender.send('log', d.toString()));
    botProcess.on('close', (code: any) => { 
        event.sender.send('log', `Bot exited with code ${code}\n`);
        botProcess = null; 
        resolve(true);
    });
  });
});

ipcMain.handle('stop-bot', async () => {
    if (botProcess) {
        botProcess.kill();
        botProcess = null;
    }
    return true;
});
