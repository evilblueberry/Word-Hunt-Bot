import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron';
import * as path from 'path';
import { spawn, exec, type ChildProcess, type SpawnOptionsWithoutStdio } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isWindows = os.platform() === 'win32';
const XCUITEST_DRIVER_VERSION = '9.2.4';

let mainWindow: BrowserWindow | null = null;
let appiumProcess: ChildProcess | null = null;
let botProcess: ChildProcess | null = null;

function getAssetRoot() {
  return app.isPackaged ? process.resourcesPath : path.join(__dirname, '../..');
}

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function getRuntimePaths() {
  const runtimeRoot = path.join(app.getPath('userData'), 'runtime');
  const venvPath = path.join(runtimeRoot, 'venv');
  const appiumRuntimePath = path.join(runtimeRoot, 'appium');
  const appiumHomePath = path.join(runtimeRoot, 'appium-home');
  const outputPath = path.join(runtimeRoot, 'output');
  const pythonExec = isWindows
    ? path.join(venvPath, 'Scripts', 'python.exe')
    : path.join(venvPath, 'bin', 'python');
  const pipExec = isWindows
    ? path.join(venvPath, 'Scripts', 'pip.exe')
    : path.join(venvPath, 'bin', 'pip');
  const appiumExec = isWindows
    ? path.join(appiumRuntimePath, 'node_modules', '.bin', 'appium.cmd')
    : path.join(appiumRuntimePath, 'node_modules', '.bin', 'appium');

  return {
    runtimeRoot,
    venvPath,
    appiumRuntimePath,
    appiumHomePath,
    outputPath,
    pythonExec,
    pipExec,
    appiumExec,
  };
}

function getAppEnv(extra: Record<string, string> = {}) {
  const runtimePaths = getRuntimePaths();
  const npmBinPath = path.join(runtimePaths.appiumRuntimePath, 'node_modules', '.bin');

  return {
    ...process.env,
    PATH: [
      process.env.PATH || '',
      '/usr/local/bin',
      '/opt/homebrew/bin',
      '/usr/bin',
      '/bin',
      npmBinPath,
      path.join(os.homedir(), '.npm-global', 'bin'),
    ].filter(Boolean).join(path.delimiter),
    APPIUM_HOME: runtimePaths.appiumHomePath,
    ...extra,
  };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1100,
    minHeight: 760,
    backgroundColor: '#0b0b0b',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  const runtimePaths = getRuntimePaths();
  ensureDir(runtimePaths.runtimeRoot);
  ensureDir(runtimePaths.appiumRuntimePath);
  ensureDir(runtimePaths.appiumHomePath);
  ensureDir(runtimePaths.outputPath);
  createWindow();
});

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

app.on('before-quit', () => {
  appiumProcess?.kill();
  botProcess?.kill();
});

const configPath = path.join(app.getPath('userData'), 'wordhunt_config.json');

function readConfig() {
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }

  return {
    bundleId: 'com.apple.MobileSMS',
    host: '127.0.0.1',
    port: 4723,
    teamId: '',
    udid: '',
    xcodeSigningId: 'Apple Development',
    updatedWDABundleId: '',
  };
}

function sendLog(event: IpcMainInvokeEvent, message: string) {
  event.sender.send('log', message);
}

function writeRuntimePackageJson() {
  const runtimePaths = getRuntimePaths();
  const packageJsonPath = path.join(runtimePaths.appiumRuntimePath, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    fs.writeFileSync(
      packageJsonPath,
      JSON.stringify(
        {
          name: 'word-hunt-bot-appium-runtime',
          private: true,
        },
        null,
        2,
      ),
    );
  }
}

function runExecCommand(
  command: string,
  event?: IpcMainInvokeEvent,
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
) {
  return new Promise<{ success: boolean; output: string; code: number | null }>((resolve) => {
    const proc = exec(command, { cwd: options.cwd, env: options.env });
    let output = '';

    proc.stdout?.on('data', (data) => {
      const text = data.toString();
      output += text;
      if (event) sendLog(event, text);
    });

    proc.stderr?.on('data', (data) => {
      const text = data.toString();
      output += text;
      if (event) sendLog(event, text);
    });

    proc.on('close', (code) => {
      resolve({ success: code === 0, output, code });
    });
  });
}

function runSpawnCommand(
  event: IpcMainInvokeEvent,
  command: string,
  args: string[],
  options: SpawnOptionsWithoutStdio = {},
) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      env: options.env ?? getAppEnv(),
      shell: false,
    });

    child.stdout?.on('data', (data) => sendLog(event, data.toString()));
    child.stderr?.on('data', (data) => sendLog(event, data.toString()));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

function getPythonScriptPath() {
  return path.join(getAssetRoot(), 'Scripts', 'main.py');
}

function getRequirementsPath() {
  return path.join(getAssetRoot(), 'requirements.txt');
}

ipcMain.handle('get-config', async () => readConfig());

ipcMain.handle('save-config', async (_, newConfig) => {
  fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
  return true;
});

ipcMain.handle('get-os-username', () => {
  try {
    return os.userInfo().username;
  } catch {
    return 'user';
  }
});

ipcMain.handle('check-env', async () => {
  const runtimePaths = getRuntimePaths();
  const result = {
    python: false,
    node: true,
    venv: fs.existsSync(runtimePaths.pythonExec),
    appium: fs.existsSync(runtimePaths.appiumExec),
    xcuitest: false,
    tesseract: false,
  };

  const env = getAppEnv();

  const pythonCheck = await runExecCommand('python3 --version', undefined, { env });
  result.python = pythonCheck.success;

  if (result.appium) {
    const appiumCheck = await runExecCommand(`"${runtimePaths.appiumExec}" driver list --installed`, undefined, {
      cwd: runtimePaths.appiumRuntimePath,
      env,
    });
    result.xcuitest = appiumCheck.output.toLowerCase().includes('xcuitest');
  }

  const tesseractCheck = await runExecCommand('tesseract --version', undefined, { env });
  result.tesseract = tesseractCheck.success;

  return result;
});

ipcMain.handle('install-deps', async (event) => {
  const runtimePaths = getRuntimePaths();
  const env = getAppEnv();

  try {
    ensureDir(runtimePaths.runtimeRoot);
    ensureDir(runtimePaths.appiumRuntimePath);
    ensureDir(runtimePaths.appiumHomePath);
    ensureDir(runtimePaths.outputPath);
    writeRuntimePackageJson();

    sendLog(event, 'Preparing isolated runtime...\n');

    if (!fs.existsSync(runtimePaths.pythonExec)) {
      sendLog(event, 'Creating Python virtual environment...\n');
      await runSpawnCommand(event, 'python3', ['-m', 'venv', runtimePaths.venvPath], {
        cwd: runtimePaths.runtimeRoot,
        env,
      });
    } else {
      sendLog(event, 'Python virtual environment already exists.\n');
    }

    sendLog(event, 'Upgrading pip tooling...\n');
    await runSpawnCommand(
      event,
      runtimePaths.pythonExec,
      ['-m', 'pip', 'install', '--upgrade', 'pip', 'setuptools', 'wheel'],
      { cwd: runtimePaths.runtimeRoot, env },
    );

    sendLog(event, 'Installing Python dependencies...\n');
    await runSpawnCommand(
      event,
      runtimePaths.pythonExec,
      ['-m', 'pip', 'install', '-r', getRequirementsPath()],
      { cwd: runtimePaths.runtimeRoot, env },
    );

    sendLog(event, 'Installing local Appium runtime...\n');
    await runSpawnCommand(
      event,
      'npm',
      ['install', '--save-exact', 'appium'],
      { cwd: runtimePaths.appiumRuntimePath, env },
    );

    sendLog(event, `Registering the XCUITest driver with Appium (xcuitest@${XCUITEST_DRIVER_VERSION})...\n`);
    const driverInstall = await runExecCommand(
      `"${runtimePaths.appiumExec}" driver install "xcuitest@${XCUITEST_DRIVER_VERSION}"`,
      event,
      { cwd: runtimePaths.appiumRuntimePath, env },
    );

    if (!driverInstall.success) {
      if (driverInstall.output.includes('already installed')) {
        sendLog(event, 'XCUITest driver is already installed. Continuing.\n');
      } else {
        throw new Error(`Appium driver install failed with code ${driverInstall.code}`);
      }
    }

    sendLog(
      event,
      'Dependency install complete. Tesseract remains optional because the bot now uses EasyOCR directly.\n',
    );
    return true;
  } catch (error) {
    sendLog(event, `Dependency install failed: ${String(error)}\n`);
    return false;
  }
});

ipcMain.handle('start-appium', async (event) => {
  if (appiumProcess) {
    return true;
  }

  const runtimePaths = getRuntimePaths();

  if (!fs.existsSync(runtimePaths.appiumExec)) {
    sendLog(event, 'Appium runtime is missing. Install dependencies first.\n');
    return false;
  }

  return new Promise((resolve) => {
    sendLog(event, 'Starting Appium...\n');
    let resolved = false;

    appiumProcess = spawn(
      runtimePaths.appiumExec,
      ['server', '--use-drivers=xcuitest', '--base-path', '/'],
      {
        cwd: runtimePaths.appiumRuntimePath,
        env: getAppEnv(),
        shell: false,
      },
    );

    const settle = (value: boolean) => {
      if (!resolved) {
        resolved = true;
        resolve(value);
      }
    };

    appiumProcess.stdout?.on('data', (data) => {
      const text = data.toString();
      sendLog(event, text);

      if (
        text.includes('Appium REST http interface listener started') ||
        text.includes('listener started on')
      ) {
        settle(true);
      }
    });

    appiumProcess.stderr?.on('data', (data) => {
      sendLog(event, data.toString());
    });

    appiumProcess.on('error', (error) => {
      sendLog(event, `Failed to start Appium: ${String(error)}\n`);
      appiumProcess = null;
      settle(false);
    });

    appiumProcess.on('close', () => {
      appiumProcess = null;
      settle(false);
    });
  });
});

ipcMain.handle('stop-appium', async () => {
  appiumProcess?.kill();
  appiumProcess = null;
  return true;
});

ipcMain.handle('run-preflights', async (_event, udid: string) => {
  const runtimePaths = getRuntimePaths();
  const env = getAppEnv();

  const runCmd = (command: string) => runExecCommand(command, undefined, { env, cwd: runtimePaths.appiumRuntimePath });

  const xcodeAppExists = fs.existsSync('/Applications/Xcode.app');
  const xcodeSelect = await runCmd('xcode-select -p');
  const xcodebuild = await runCmd('xcodebuild -version');

  let deviceVisible = false;
  if (udid) {
    const xctrace = await runCmd('xcrun xctrace list devices');
    const normalized = xctrace.output.toLowerCase();
    deviceVisible = normalized.includes(udid.toLowerCase());
  } else {
    deviceVisible = true;
  }

  const appiumDriver = fs.existsSync(runtimePaths.appiumExec)
    ? await runCmd(`"${runtimePaths.appiumExec}" driver list --installed`)
    : { success: false, output: '', code: 1 };

  const identities = await runCmd('security find-identity -v -p codesigning');
  const hasDeveloperCert =
    identities.output.toLowerCase().includes('apple development') ||
    identities.output.toLowerCase().includes('iphone developer');

  const tesseractCheck = await runCmd('tesseract --version');

  return {
    xcodeAppExists,
    xcodeSelectValid: xcodeSelect.success && xcodeSelect.output.includes('Xcode.app'),
    xcodebuildValid: xcodebuild.success,
    deviceVisible,
    xcuitestInstalled: appiumDriver.output.toLowerCase().includes('xcuitest'),
    hasDeveloperCert,
    tesseractInstalled: tesseractCheck.success,
  };
});

ipcMain.handle('test-wda', async (event) => {
  const runtimePaths = getRuntimePaths();
  const config = readConfig();
  const testScriptPath = path.join(runtimePaths.runtimeRoot, 'test_wda_runtime.py');

  const testScriptContent = `
import sys
from appium import webdriver
from appium.options.ios import XCUITestOptions

options = XCUITestOptions()
options.platform_name = 'iOS'
options.udid = ${JSON.stringify(config.udid || '')}
options.automation_name = 'XCUITest'
options.bundle_id = 'com.apple.Preferences'
options.set_capability('appium:wdaLaunchTimeout', 180000)
options.set_capability('appium:wdaConnectionTimeout', 180000)
options.set_capability('appium:useNewWDA', True)

team_id = ${JSON.stringify(config.teamId || '')}
signing_id = ${JSON.stringify(config.xcodeSigningId || 'Apple Development')}
wda_bundle = ${JSON.stringify(config.updatedWDABundleId || '')}

if team_id:
    options.xcode_org_id = team_id
    options.xcode_signing_id = signing_id
if wda_bundle:
    options.set_capability('appium:updatedWDABundleId', wda_bundle)

try:
    print("Connecting to Appium to build WDA...")
    driver = webdriver.Remote('http://127.0.0.1:4723', options=options)
    print("WDA successfully built and launched!")
    driver.quit()
    sys.exit(0)
except Exception as error:
    print(f"WDA Error: {error}")
    sys.exit(1)
`;

  fs.writeFileSync(testScriptPath, testScriptContent);

  return new Promise((resolve) => {
    const child = spawn(runtimePaths.pythonExec, [testScriptPath], {
      cwd: runtimePaths.runtimeRoot,
      env: getAppEnv(),
      shell: false,
    });

    child.stdout?.on('data', (data) => sendLog(event, data.toString()));
    child.stderr?.on('data', (data) => sendLog(event, data.toString()));
    child.on('close', (code) => {
      if (fs.existsSync(testScriptPath)) {
        fs.unlinkSync(testScriptPath);
      }
      sendLog(event, `WDA test exited with code ${code}\n`);
      resolve(code === 0);
    });
  });
});

ipcMain.handle('start-bot', async (event) => {
  if (botProcess) {
    return false;
  }

  const runtimePaths = getRuntimePaths();
  const config = readConfig();

  return new Promise((resolve) => {
    sendLog(event, 'Starting bot...\n');

    botProcess = spawn(runtimePaths.pythonExec, [getPythonScriptPath()], {
      cwd: runtimePaths.outputPath,
      env: getAppEnv({
        BOT_UDID: config.udid || '',
        BOT_TEAM_ID: config.teamId || '',
        BOT_BUNDLE_ID: config.bundleId || 'com.apple.MobileSMS',
        BOT_PORT: String(config.port || 4723),
        BOT_XCODE_SIGNING_ID: config.xcodeSigningId || 'Apple Development',
        BOT_UPDATED_WDA_BUNDLE_ID: config.updatedWDABundleId || '',
        BOT_WORKDIR: runtimePaths.outputPath,
      }),
      shell: false,
    });

    botProcess.stdout?.on('data', (data) => sendLog(event, data.toString()));
    botProcess.stderr?.on('data', (data) => sendLog(event, data.toString()));
    botProcess.on('close', (code) => {
      sendLog(event, `Bot exited with code ${code}\n`);
      botProcess = null;
      resolve(code === 0);
    });
  });
});

ipcMain.handle('stop-bot', async () => {
  botProcess?.kill();
  botProcess = null;
  return true;
});
