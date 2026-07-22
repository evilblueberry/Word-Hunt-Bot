import { useEffect, useRef, useState } from 'react';
import './App.css';

type View = 'home' | 'dependencies' | 'run';

type LogEntry = {
  id: number;
  message: string;
  timestamp: string;
};

type Config = {
  bundleId: string;
  host: string;
  port: number;
  teamId: string;
  udid: string;
  xcodeSigningId: string;
  updatedWDABundleId: string;
};

type EnvironmentStatus = {
  python: boolean;
  node: boolean;
  venv: boolean;
  appium: boolean;
  xcuitest: boolean;
  tesseract: boolean;
};

type PreflightResults = {
  xcodeAppExists: boolean;
  xcodeSelectValid: boolean;
  xcodebuildValid: boolean;
  deviceVisible: boolean;
  xcuitestInstalled: boolean;
  hasDeveloperCert: boolean;
  tesseractInstalled: boolean;
};

type WdaTestResult =
  | 'idle'
  | 'testing'
  | 'success'
  | 'devmode'
  | 'untrusted'
  | 'xcode'
  | 'signing'
  | 'port'
  | 'unknown';

type ElectronApi = {
  getConfig: () => Promise<Config>;
  saveConfig: (config: Config) => Promise<boolean>;
  getOsUsername: () => Promise<string>;
  checkEnv: () => Promise<EnvironmentStatus>;
  installDeps: () => Promise<boolean>;
  startAppium: () => Promise<boolean>;
  stopAppium: () => Promise<boolean>;
  startBot: () => Promise<boolean>;
  stopBot: () => Promise<boolean>;
  runPreflights: (udid: string) => Promise<PreflightResults>;
  testWda: () => Promise<boolean>;
  onLog: (callback: (log: string) => void) => (() => void) | void;
};

declare global {
  interface Window {
    electronAPI: ElectronApi;
  }
}

const defaultConfig: Config = {
  bundleId: 'com.apple.MobileSMS',
  host: '127.0.0.1',
  port: 4723,
  teamId: '',
  udid: '',
  xcodeSigningId: 'Apple Development',
  updatedWDABundleId: '',
};

export default function App() {
  const [view, setView] = useState<View>('home');
  const [config, setConfig] = useState<Config>(defaultConfig);
  const [envStatus, setEnvStatus] = useState<EnvironmentStatus | null>(null);
  const [preflightResults, setPreflightResults] = useState<PreflightResults | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [installing, setInstalling] = useState(false);
  const [testingWda, setTestingWda] = useState(false);
  const [wdaTestResult, setWdaTestResult] = useState<WdaTestResult>('idle');
  const [appiumRunning, setAppiumRunning] = useState(false);
  const [botRunning, setBotRunning] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsRef = useRef<LogEntry[]>([]);

  function addLog(message: string) {
    const cleanMessage = message.trim();
    if (!cleanMessage) return;

    setLogs((previous) => {
      const next = [
        ...previous,
        {
          id: previous.length + 1,
          message: cleanMessage,
          timestamp: new Date().toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
        },
      ];
      logsRef.current = next;
      return next;
    });

    const normalized = cleanMessage.toLowerCase();
    if (normalized.includes('listener started on') || normalized.includes('appium rest http interface listener started')) {
      setAppiumRunning(true);
    }
    if (normalized.includes('bot exited with code')) {
      setBotRunning(false);
    }
  }

  async function refreshEnvironment() {
    const status = await window.electronAPI.checkEnv();
    setEnvStatus(status);
  }

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const savedConfig = await window.electronAPI.getConfig();
      if (!savedConfig.updatedWDABundleId) {
        const username = await window.electronAPI.getOsUsername();
        savedConfig.updatedWDABundleId = `com.${username.toLowerCase().replace(/[^a-z0-9]/g, '')}.wordhuntbot.wda`;
        await window.electronAPI.saveConfig(savedConfig);
      }

      if (!mounted) return;
      setConfig(savedConfig);
      await refreshEnvironment();
    };

    void load();

    const unsubscribe = window.electronAPI.onLog((message) => addLog(message));

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [logs]);

  const updateConfig = async (patch: Partial<Config>) => {
    const nextConfig = { ...config, ...patch };
    setConfig(nextConfig);
    await window.electronAPI.saveConfig(nextConfig);
  };

  const handleInstallDependencies = async () => {
    setInstalling(true);
    addLog('Installing dependencies into the isolated launcher runtime.');
    const success = await window.electronAPI.installDeps();
    setInstalling(false);
    await refreshEnvironment();
    if (success) {
      setView('run');
    }
  };

  const handleTestWda = async () => {
    setTestingWda(true);
    setWdaTestResult('testing');
    setPreflightResults(null);

    const preflights = await window.electronAPI.runPreflights(config.udid);
    setPreflightResults(preflights);

    if (
      !preflights.xcodeAppExists ||
      !preflights.xcodeSelectValid ||
      !preflights.xcodebuildValid ||
      !preflights.deviceVisible ||
      !preflights.xcuitestInstalled
    ) {
      setWdaTestResult('idle');
      setTestingWda(false);
      return;
    }

    if (!appiumRunning) {
      const started = await window.electronAPI.startAppium();
      setAppiumRunning(started);
      if (!started) {
        setTestingWda(false);
        setWdaTestResult('port');
        return;
      }
    }

    const success = await window.electronAPI.testWda();
    setTestingWda(false);

    if (success) {
      setWdaTestResult('success');
      return;
    }

    const fullLog = logsRef.current.map((entry) => entry.message).join(' ').toLowerCase();
    if (fullLog.includes('developer mode')) setWdaTestResult('devmode');
    else if (fullLog.includes('untrusted') || fullLog.includes('trust') || fullLog.includes('permission denied')) setWdaTestResult('untrusted');
    else if (fullLog.includes('xcode') || fullLog.includes('xcodebuild') || fullLog.includes('license')) setWdaTestResult('xcode');
    else if (fullLog.includes('requires a provision profile') || fullLog.includes('signing') || fullLog.includes('provisioning') || fullLog.includes('certificate') || fullLog.includes('profile')) setWdaTestResult('signing');
    else if (fullLog.includes('eaddrinuse') || fullLog.includes('port')) setWdaTestResult('port');
    else setWdaTestResult('unknown');
  };

  const handleRunBot = async () => {
    if (botRunning) {
      await window.electronAPI.stopBot();
      setBotRunning(false);
      return;
    }

    if (!appiumRunning) {
      const started = await window.electronAPI.startAppium();
      setAppiumRunning(started);
      if (!started) return;
    }

    setBotRunning(true);
    const startedBot = await window.electronAPI.startBot();
    if (!startedBot) {
      setBotRunning(false);
    }
  };

  const handleStopAppium = async () => {
    await window.electronAPI.stopAppium();
    setAppiumRunning(false);
  };

  const readinessItems = [
    { label: 'Python runtime', ready: Boolean(envStatus?.python && envStatus?.venv) },
    { label: 'Appium runtime', ready: Boolean(envStatus?.appium && envStatus?.xcuitest) },
    { label: 'Apple signing', ready: Boolean(preflightResults?.hasDeveloperCert) },
    { label: 'Device visibility', ready: Boolean(preflightResults?.deviceVisible) },
  ];

  const readyCount = readinessItems.filter((item) => item.ready).length;

  return (
    <div className="app-shell">
      <aside className="rail">
        <div>
          <div className="wordmark">Word Hunt Bot</div>
          <p className="rail-copy">
            A stripped-back launcher for a once-finicky iPhone automation stack.
          </p>
        </div>

        <nav className="rail-nav" aria-label="Primary">
          <button className={navClass(view === 'home')} onClick={() => setView('home')}>Home</button>
          <button className={navClass(view === 'dependencies')} onClick={() => setView('dependencies')}>Dependencies</button>
          <button className={navClass(view === 'run')} onClick={() => setView('run')}>Run Bot</button>
        </nav>

        <div className="rail-status">
          <span>Readiness</span>
          <strong>{readyCount}/4</strong>
        </div>
      </aside>

      <main className="stage">
        <section className="view-frame">
          {view === 'home' && (
            <div className="view view-home">
              <div className="hero-copy">
                <p className="eyebrow">iPhone automation, simplified</p>
                <h1>One launcher. Three screens. No buried setup maze.</h1>
                <p className="lede">
                  The bot logic stays intact, but the runtime now installs into an isolated local environment,
                  Appium uses a modern project-local XCUITest setup, and the UI only asks you to do three things:
                  understand the constraints, install what is needed, and run the bot.
                </p>
              </div>

              <div className="feature-strip">
                <article className="feature">
                  <span className="feature-index">01</span>
                  <h2>Home</h2>
                  <p>What the launcher does, what Apple still requires, and where to go next.</p>
                </article>
                <article className="feature">
                  <span className="feature-index">02</span>
                  <h2>Dependencies</h2>
                  <p>Install Python + Appium runtime, enter your device info, then verify WDA can build.</p>
                </article>
                <article className="feature">
                  <span className="feature-index">03</span>
                  <h2>Run Bot</h2>
                  <p>Launch Appium if needed, run the bot, and watch the live console in one place.</p>
                </article>
              </div>

              <div className="notice-grid">
                <div className="notice">
                  <span>Still required</span>
                  <p>Xcode, Developer Mode, device trust, and Apple code signing remain Apple-enforced.</p>
                </div>
                <div className="notice">
                  <span>Now fixed</span>
                  <p>Global Appium assumptions, root-writable paths, and deprecated touch entrypoints are gone.</p>
                </div>
              </div>

              <div className="hero-actions">
                <button className="button button-primary" onClick={() => setView('dependencies')}>
                  Install dependencies
                </button>
                <button className="button button-secondary" onClick={() => setView('run')}>
                  Go to run view
                </button>
              </div>
            </div>
          )}

          {view === 'dependencies' && (
            <div className="view view-dependencies">
              <div className="section-heading">
                <p className="eyebrow">Dependencies</p>
                <h1>Prepare the runtime and verify the Apple side of the stack.</h1>
              </div>

              <div className="dependency-grid">
                <section className="panel panel-large">
                  <div className="panel-header">
                    <div>
                      <h2>Install runtime</h2>
                      <p>Creates an isolated Python/Appium runtime for this launcher instead of relying on fragile global installs.</p>
                    </div>
                    <button className="button button-primary" onClick={handleInstallDependencies} disabled={installing}>
                      {installing ? 'Installing…' : 'Install dependencies'}
                    </button>
                  </div>

                  <div className="status-grid">
                    <StatusPill label="Python" ok={Boolean(envStatus?.python)} />
                    <StatusPill label="Virtual env" ok={Boolean(envStatus?.venv)} />
                    <StatusPill label="Appium" ok={Boolean(envStatus?.appium)} />
                    <StatusPill label="XCUITest driver" ok={Boolean(envStatus?.xcuitest)} />
                    <StatusPill label="Tesseract (legacy optional)" ok={Boolean(envStatus?.tesseract)} subtle />
                  </div>
                </section>

                <section className="panel">
                  <h2>Device configuration</h2>
                  <div className="field-grid">
                    <label className="field">
                      <span>Device UDID</span>
                      <input
                        value={config.udid}
                        onChange={(event) => void updateConfig({ udid: event.target.value })}
                        placeholder="00008120-000C..."
                      />
                    </label>
                    <label className="field">
                      <span>App bundle ID</span>
                      <input
                        value={config.bundleId}
                        onChange={(event) => void updateConfig({ bundleId: event.target.value })}
                        placeholder="com.apple.MobileSMS"
                      />
                    </label>
                    <label className="field">
                      <span>Apple Team ID</span>
                      <input
                        value={config.teamId}
                        onChange={(event) => void updateConfig({ teamId: event.target.value })}
                        placeholder="AB12345678"
                      />
                    </label>
                    <label className="field">
                      <span>Xcode signing ID</span>
                      <input
                        value={config.xcodeSigningId}
                        onChange={(event) => void updateConfig({ xcodeSigningId: event.target.value })}
                        placeholder="Apple Development"
                      />
                    </label>
                    <label className="field field-wide">
                      <span>Updated WDA bundle ID</span>
                      <input
                        value={config.updatedWDABundleId}
                        onChange={(event) => void updateConfig({ updatedWDABundleId: event.target.value })}
                        placeholder="com.yourname.wordhuntbot.wda"
                      />
                    </label>
                  </div>
                </section>

                <section className="panel panel-large">
                  <div className="panel-header">
                    <div>
                      <h2>Verify WDA</h2>
                      <p>Runs preflights, starts Appium if needed, then attempts a real WDA build against your device.</p>
                    </div>
                    <button className="button button-secondary" onClick={handleTestWda} disabled={testingWda || !config.udid}>
                      {testingWda ? 'Testing…' : 'Run WDA test'}
                    </button>
                  </div>

                  {preflightResults && (
                    <div className="preflight-grid">
                      <PreflightCard ok={preflightResults.xcodeAppExists} label="Xcode in /Applications" />
                      <PreflightCard ok={preflightResults.xcodeSelectValid} label="xcode-select points to Xcode" />
                      <PreflightCard ok={preflightResults.xcodebuildValid} label="xcodebuild works" />
                      <PreflightCard ok={preflightResults.deviceVisible} label="Device visible to xctrace" />
                      <PreflightCard ok={preflightResults.hasDeveloperCert} label="Signing certificate found" />
                      <PreflightCard ok={preflightResults.xcuitestInstalled} label="XCUITest driver ready" />
                    </div>
                  )}

                  {wdaTestResult !== 'idle' && (
                    <div className={`callout ${wdaTestResult === 'success' ? 'callout-success' : 'callout-warning'}`}>
                      {getWdaMessage(wdaTestResult)}
                    </div>
                  )}
                </section>
              </div>
            </div>
          )}

          {view === 'run' && (
            <div className="view view-run">
              <div className="section-heading">
                <p className="eyebrow">Run Bot</p>
                <h1>Launch the iPhone flow and watch the runtime in motion.</h1>
              </div>

              <div className="run-grid">
                <section className="panel">
                  <h2>Readiness</h2>
                  <div className="readiness-list">
                    {readinessItems.map((item) => (
                      <div className="readiness-row" key={item.label}>
                        <span>{item.label}</span>
                        <strong>{item.ready ? 'Ready' : 'Pending'}</strong>
                      </div>
                    ))}
                  </div>

                  <div className="cta-stack">
                    <button className="button button-primary" onClick={handleRunBot} disabled={!envStatus?.venv || !envStatus?.xcuitest}>
                      {botRunning ? 'Stop bot' : 'Run bot'}
                    </button>
                    <button className="button button-secondary" onClick={appiumRunning ? handleStopAppium : async () => setAppiumRunning(await window.electronAPI.startAppium())}>
                      {appiumRunning ? 'Stop Appium' : 'Start Appium'}
                    </button>
                  </div>
                </section>

                <section className="panel panel-wide">
                  <div className="panel-header">
                    <div>
                      <h2>Live console</h2>
                      <p>Everything the launcher, Appium, WDA, and Python bot say in one stream.</p>
                    </div>
                    <button
                      className="button button-ghost"
                      onClick={() => {
                        logsRef.current = [];
                        setLogs([]);
                      }}
                    >
                      Clear
                    </button>
                  </div>

                  <div className="console">
                    {logs.length === 0 ? (
                      <div className="console-empty">No logs yet. Install dependencies or run the bot to begin.</div>
                    ) : (
                      logs.map((entry) => (
                        <div key={entry.id} className={`console-line ${entry.message.toLowerCase().includes('error') ? 'console-line-error' : ''}`}>
                          <span>{entry.timestamp}</span>
                          <p>{entry.message}</p>
                        </div>
                      ))
                    )}
                    <div ref={logsEndRef} />
                  </div>
                </section>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function navClass(active: boolean) {
  return active ? 'nav-link nav-link-active' : 'nav-link';
}

function StatusPill({ label, ok, subtle = false }: { label: string; ok: boolean; subtle?: boolean }) {
  return (
    <div className={`status-pill ${ok ? 'status-pill-ok' : subtle ? 'status-pill-subtle' : 'status-pill-off'}`}>
      <span>{label}</span>
      <strong>{ok ? 'Ready' : subtle ? 'Optional' : 'Missing'}</strong>
    </div>
  );
}

function PreflightCard({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className={ok ? 'preflight-card preflight-card-ok' : 'preflight-card preflight-card-off'}>
      <span>{label}</span>
      <strong>{ok ? 'Passed' : 'Needs attention'}</strong>
    </div>
  );
}

function getWdaMessage(state: WdaTestResult) {
  switch (state) {
    case 'success':
      return 'WDA built and launched successfully. You can move to Run Bot.';
    case 'devmode':
      return 'Developer Mode appears to be disabled on the iPhone. Turn it on in Settings and restart the device.';
    case 'untrusted':
      return 'The iPhone still needs to trust the developer certificate. Approve it in VPN & Device Management on the device.';
    case 'xcode':
      return 'Xcode tooling is not fully ready yet. Open Xcode once, accept the license, and confirm xcodebuild works in Terminal.';
    case 'signing':
      return 'WDA failed at signing. Double-check your Team ID, signing identity, and custom WDA bundle ID.';
    case 'port':
      return 'Appium could not claim or keep the expected port. Stop any existing Appium process and try again.';
    case 'unknown':
      return 'WDA failed for a less specific reason. Review the console for the exact Appium or Xcode error.';
    case 'testing':
      return 'Running preflights and attempting a fresh WDA build.';
    default:
      return '';
  }
}
