import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron';
import * as path from 'path';
import { spawn, exec, type ChildProcess, type SpawnOptionsWithoutStdio } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isWindows = os.platform() === 'win32';
const APPIUM_VERSION = '4.0.0';
const XCUITEST_DRIVER_VERSION = '13.5.0';
const TEAM_ID_RE = /^[A-Z0-9]{10}$/;
const UDID_RE = /^(?:[0-9a-f]{8}-[0-9a-f]{16}|[0-9a-f]{24,40})$/i;
const BUNDLE_ID_RE = /^[A-Za-z0-9]+(?:\.[A-Za-z0-9-]+)+$/;
const LEGACY_WRONG_TEAM_ID = '3285Q523PM';

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
  const defaults = {
    bundleId: 'com.apple.MobileSMS',
    host: '127.0.0.1',
    port: 4723,
    teamId: '287MYRCJ37',
    udid: '',
    xcodeSigningId: 'Apple Development',
    updatedWDABundleId: '',
    speedPreset: 'fast',
    speedConfigVersion: 2,
  };
  if (fs.existsSync(configPath)) {
    const saved = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const config = { ...defaults, ...saved };
    if (saved.speedConfigVersion !== defaults.speedConfigVersion) {
      config.speedPreset = 'fast';
      config.speedConfigVersion = defaults.speedConfigVersion;
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    }
    if (config.teamId === LEGACY_WRONG_TEAM_ID) {
      config.teamId = defaults.teamId;
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    }
    return config;
  }
  return defaults;
}

function sendLog(event: IpcMainInvokeEvent, message: string) {
  event.sender.send('log', message);
}

function writeRuntimePackageJson() {
  const runtimePaths = getRuntimePaths();
  const packageJsonPath = path.join(runtimePaths.appiumRuntimePath, 'package.json');
  fs.writeFileSync(
    packageJsonPath,
    JSON.stringify(
      {
        name: 'word-hunt-bot-appium-runtime',
        private: true,
        dependencies: { appium: APPIUM_VERSION },
      },
      null,
      2,
    ),
  );
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

function checkConnectedDevice(udid: string) {
  return new Promise<{ connected: boolean; message: string; platform_version?: string }>((resolve) => {
    const child = spawn(getRuntimePaths().pythonExec, [path.join(getAssetRoot(), 'Scripts', 'device_connection.py'), '--udid', udid], {
      env: getAppEnv(), shell: false,
    });
    let output = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill();
      resolve({ connected: false, message: 'iPhone connection check timed out. Reconnect and unlock the phone, then retry.' });
    }, 20000);
    child.stdout?.on('data', (data) => { output += data.toString(); });
    child.stderr?.on('data', (data) => { stderr += data.toString(); });
    child.on('error', (error) => {
      clearTimeout(timeout);
      resolve({ connected: false, message: `Could not check iPhone connection: ${String(error)}` });
    });
    child.on('close', () => {
      clearTimeout(timeout);
      try {
        resolve(JSON.parse(output));
      } catch {
        resolve({ connected: false, message: `Could not check iPhone connection: ${stderr || output}` });
      }
    });
  });
}

function validateConfig(config: { teamId?: string; xcodeSigningId?: string; udid?: string; updatedWDABundleId?: string }) {
  const errors: string[] = [];
  const teamId = (config.teamId || '').trim();
  const signingId = (config.xcodeSigningId || '').trim();
  const udid = (config.udid || '').trim();
  const wdaBundleId = (config.updatedWDABundleId || '').trim();
  if (!TEAM_ID_RE.test(teamId)) errors.push('Apple Team ID must be the 10-character alphanumeric Team ID, not an email or certificate suffix.');
  if (!signingId) errors.push("Xcode signing ID is required; use the certificate common name, usually 'Apple Development'.");
  else if (/^[A-Z0-9]{8,12}$/i.test(signingId) && signingId.toLowerCase() !== 'apple development') errors.push("Xcode signing ID looks like a certificate suffix/Team ID; use the certificate name 'Apple Development'.");
  if (!UDID_RE.test(udid)) errors.push('Device UDID must be a complete 24-40 character hex UDID (hyphenated UDIDs are accepted).');
  if (!BUNDLE_ID_RE.test(wdaBundleId)) errors.push('Updated WDA bundle ID must be a reverse-DNS identifier such as com.example.wordhuntbot.wda.');
  else if (wdaBundleId === 'com.apple.WebDriverAgentRunner.xctrunner') errors.push("Updated WDA bundle ID must be unique; do not use Apple's default WDA bundle ID.");
  return errors;
}

function parseCertificateTeamIds(output: string) {
  return [...output.matchAll(/OU=([A-Z0-9]{10})/g)].map((match) => match[1]).filter((value, index, values) => values.indexOf(value) === index);
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

    sendLog(event, `Installing exact Appium runtime (appium@${APPIUM_VERSION})...\n`);
    await runSpawnCommand(
      event,
      'npm',
      ['install', '--save-exact', '--legacy-peer-deps', `appium@${APPIUM_VERSION}`],
      { cwd: runtimePaths.appiumRuntimePath, env },
    );

    const installedDrivers = await runExecCommand(
      `"${runtimePaths.appiumExec}" driver list --installed`,
      event,
      { cwd: runtimePaths.appiumRuntimePath, env },
    );
    if (!installedDrivers.output.includes(`xcuitest@${XCUITEST_DRIVER_VERSION}`)) {
      sendLog(event, `Replacing stale XCUITest driver with xcuitest@${XCUITEST_DRIVER_VERSION}...\n`);
      await runExecCommand(`"${runtimePaths.appiumExec}" driver uninstall xcuitest`, event, {
        cwd: runtimePaths.appiumRuntimePath,
        env,
      });
      const driverInstall = await runExecCommand(
        `"${runtimePaths.appiumExec}" driver install "xcuitest@${XCUITEST_DRIVER_VERSION}"`,
        event,
        { cwd: runtimePaths.appiumRuntimePath, env },
      );
      if (!driverInstall.success) throw new Error(`Appium driver install failed with code ${driverInstall.code}`);
    } else {
      sendLog(event, `XCUITest driver ${XCUITEST_DRIVER_VERSION} is already installed.\n`);
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
  const config = readConfig();
  const env = getAppEnv();

  const runCmd = (command: string) => runExecCommand(command, undefined, { env, cwd: runtimePaths.appiumRuntimePath });

  const xcodeAppExists = fs.existsSync('/Applications/Xcode.app');
  const xcodeSelect = await runCmd('xcode-select -p');
  const xcodebuild = await runCmd('xcodebuild -version');

  const xctrace = await runCmd('xcrun xctrace list devices');
  const devicectl = await runCmd('xcrun devicectl list devices');
  const deviceCheck = await checkConnectedDevice(udid);
  const deviceVisible = deviceCheck.connected;

  const appiumDriver = fs.existsSync(runtimePaths.appiumExec)
    ? await runCmd(`"${runtimePaths.appiumExec}" driver list --installed`)
    : { success: false, output: '', code: 1 };

  const identities = await runCmd('security find-identity -v -p codesigning');
  const certificates = await runCmd('security find-certificate -a -c "Apple Development" -p | openssl x509 -noout -subject -enddate');
  const detectedTeamIds = parseCertificateTeamIds(certificates.output);
  const hasDeveloperCert =
    identities.success && (identities.output.toLowerCase().includes('apple development') || identities.output.toLowerCase().includes('iphone developer')) && !identities.output.toLowerCase().includes('expired');
  const teamMatchesCertificate = detectedTeamIds.includes((config.teamId || '').trim());

  const tesseractCheck = await runCmd('tesseract --version');

  return {
    xcodeAppExists,
    xcodeSelectValid: xcodeSelect.success && xcodeSelect.output.includes('Xcode.app'),
    xcodebuildValid: xcodebuild.success,
    deviceVisible,
    xcuitestInstalled: appiumDriver.output.toLowerCase().includes('xcuitest'),
    hasDeveloperCert,
    tesseractInstalled: tesseractCheck.success,
    configValid: validateConfig({ ...config, udid }),
    diagnostics: [
      ...validateConfig({ ...config, udid }),
      ...(teamMatchesCertificate ? [] : [`Entered Team ID ${(config.teamId || '').trim()} does not match any Apple Development certificate OU. Detected certificate Team ID(s): ${detectedTeamIds.join(', ') || '(none)'}.`]),
      ...(identities.output.includes('Apple Development') ? [] : ['No valid Apple Development identity with a private key was found.']),
      ...(xcodeSelect.success ? [] : [`xcode-select failed: ${xcodeSelect.output.trim()}`]),
      ...(xcodebuild.success ? [] : [`xcodebuild failed: ${xcodebuild.output.trim()}`]),
      ...(deviceVisible ? [] : [deviceCheck.message]),
      ...(hasDeveloperCert ? [] : [`No valid Apple Development certificate found. security output: ${identities.output.trim()}`]),
      ...(appiumDriver.output.toLowerCase().includes('xcuitest') ? [] : [`XCUITest driver check failed: ${appiumDriver.output.trim()}`]),
    ],
    deviceOutput: `${xctrace.output}\n${devicectl.output}`,
    identityOutput: identities.output,
    detectedTeamIds,
    teamMatchesCertificate,
    certificateOutput: certificates.output,
  };
});

ipcMain.handle('test-wda', async (event) => {
  const runtimePaths = getRuntimePaths();
  const config = readConfig();
  const configErrors = validateConfig(config);
  if (configErrors.length) {
    sendLog(event, `Preflight blocked WDA test:\n${configErrors.map((error) => `- ${error}`).join('\n')}\n`);
    return false;
  }
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
options.set_capability('appium:showXcodeLog', True)
options.set_capability('appium:allowProvisioningDeviceRegistration', True)
options.set_capability('appium:allowProvisioningUpdates', True)

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
  const preset = ['safe','fast','max'].includes(config.speedPreset) ? config.speedPreset : 'fast';
  const deviceCheck = await checkConnectedDevice(config.udid || '');
  if (!deviceCheck.connected) {
    sendLog(event, `Cannot start bot: ${deviceCheck.message}\n`);
    return false;
  }
  const args = ['-u', getPythonScriptPath(), '--preset', preset, '--label', `launcher-${preset}`];
  if (preset === 'fast') {
    const wdaPath = path.join(runtimePaths.appiumHomePath, 'node_modules', 'appium-xcuitest-driver', 'node_modules', 'appium-webdriveragent');
    const sourcePath = path.join(wdaPath, 'WebDriverAgentLib', 'Commands', 'FBTouchActionCommands.m');
    const helperPath = path.join(getAssetRoot(), 'Scripts', 'wda_screen_actions.inc');
    if (!fs.existsSync(sourcePath)) {
      sendLog(event, 'WDA source is missing. Install dependencies first.\n');
      return false;
    }
    if (!fs.readFileSync(sourcePath, 'utf8').includes(fs.readFileSync(helperPath, 'utf8'))) {
      try {
        sendLog(event, 'Preparing the measured all-words WDA mode (original source is backed up)...\n');
        await runSpawnCommand(event, runtimePaths.pythonExec, [path.join(getAssetRoot(), 'Scripts', 'patch_wda_speed.py'), wdaPath]);
        args.push('--rebuild-wda');
      } catch (error) {
        sendLog(event, `Could not prepare Fast mode: ${String(error)}\n`);
        return false;
      }
    }
  }

  return new Promise((resolve) => {
    sendLog(event, `Starting bot — ${preset === 'fast' ? 'FAST: all words, 155 ms path, 60 ms between words, direct screen coordinates' : preset.toUpperCase()}\n`);

    botProcess = spawn(runtimePaths.pythonExec, args, {
      cwd: runtimePaths.outputPath,
      env: getAppEnv({
        BOT_UDID: config.udid || '',
        BOT_TEAM_ID: config.teamId || '',
        BOT_BUNDLE_ID: config.bundleId || 'com.apple.MobileSMS',
        BOT_PORT: String(config.port || 4723),
        BOT_XCODE_SIGNING_ID: config.xcodeSigningId || 'Apple Development',
        BOT_UPDATED_WDA_BUNDLE_ID: config.updatedWDABundleId || '',
        BOT_WORKDIR: runtimePaths.outputPath,
        BOT_SPEED_PRESET: preset,
      }),
      shell: false,
    });

    botProcess.stdout?.on('data', (data) => sendLog(event, data.toString()));
    botProcess.stderr?.on('data', (data) => sendLog(event, data.toString()));
    botProcess.on('error', (error) => {
      sendLog(event, `Bot launch failed: ${String(error)}\n`);
      botProcess = null;
      resolve(false);
    });
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
