import { useState, useEffect, useRef } from 'react';
import './App.css';
import { Play, Square, Terminal, Phone, Package, Search } from 'lucide-react';

export default function App() {
  const [logs, setLogs] = useState<string[]>([]);
  const [envStatus, setEnvStatus] = useState<any>(null);
  const [config, setConfig] = useState<any>({});
  const [step, setStep] = useState(1);
  const [installing, setInstalling] = useState(false);
  const [appiumRunning, setAppiumRunning] = useState(false);
  const [botRunning, setBotRunning] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (window as any).electronAPI.getConfig().then(setConfig);
    checkEnvironment();

    (window as any).electronAPI.onLog((log: string) => {
      setLogs((prev) => [...prev, log.trim()].filter(Boolean));
    });
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const checkEnvironment = async () => {
    const status = await (window as any).electronAPI.checkEnv();
    setEnvStatus(status);
  };

  const handleInstallDeps = async () => {
    setInstalling(true);
    const success = await (window as any).electronAPI.installDeps();
    setInstalling(false);
    checkEnvironment();
    if (success) setStep(4);
  };

  const saveConfig = async (newConfig: any) => {
    setConfig(newConfig);
    await (window as any).electronAPI.saveConfig(newConfig);
  };

  const toggleAppium = async () => {
    if (appiumRunning) {
      await (window as any).electronAPI.stopAppium();
      setAppiumRunning(false);
    } else {
      const started = await (window as any).electronAPI.startAppium();
      if (started) setAppiumRunning(true);
    }
  };

  const toggleBot = async () => {
    if (botRunning) {
      await (window as any).electronAPI.stopBot();
      setBotRunning(false);
    } else {
      setBotRunning(true); // Optimistic UI
      await (window as any).electronAPI.startBot();
      setBotRunning(false); // When it exits
    }
  };

  if (step === 1) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-8">
        <h1 className="text-4xl font-bold mb-4 font-sans tracking-tight">Word Hunt Bot</h1>
        <p className="text-lg text-gray-400 mb-8 max-w-xl text-center">
          This app controls Word Hunt on your iPhone using Appium + WebDriverAgent.
        </p>
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 max-w-2xl mb-8 flex text-sm text-red-200">
          <Terminal className="mr-3 shrink-0" />
          <p>
            iOS requires Developer Mode, trusting the computer, and a valid Apple Team ID to sign WebDriverAgent. This app cannot bypass Apple’s security requirements.
          </p>
        </div>
        <button onClick={() => setStep(2)} className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-8 py-3 rounded-md transition duration-200">
          Start Setup Wizard
        </button>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col p-8">
        <div className="max-w-3xl mx-auto w-full">
          <h2 className="text-2xl font-bold mb-6">Step 1: Connect Device & Trust</h2>

          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-medium mb-3 flex items-center">
              <Phone className="mr-2" size={20} /> Connect iPhone via USB
            </h3>
            <ul className="list-disc list-inside text-gray-400 mb-4 space-y-2">
              <li>Plug your iPhone into your Mac.</li>
              <li>Tap "Trust This Computer" on the iPhone screen if prompted.</li>
              <li>Go to Settings → Privacy & Security → Developer Mode, and turn it ON.</li>
            </ul>

            <div className="flex gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Device UDID</label>
                <input type="text" value={config.udid || ''} onChange={e => saveConfig({ ...config, udid: e.target.value })} className="bg-gray-900 border border-gray-700 rounded px-3 py-2 w-64 text-sm font-mono placeholder-gray-500" placeholder="e.g. 00008120-000C..." />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">Find your UDID in Finder or Xcode.</p>
          </div>

          <div className="flex justify-end">
            <button onClick={() => setStep(3)} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-md">Next Step</button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col p-8">
        <div className="max-w-3xl mx-auto w-full">
          <h2 className="text-2xl font-bold mb-6">Step 2: Apple Developer Team ID</h2>

          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <p className="text-gray-400 mb-4 border-l-4 border-blue-500 pl-3">
              Appium needs your Team ID to compile the WebDriverAgent runner and deploy it to your device.
              You can find your Team ID in your Apple Developer account or in Keychain.
            </p>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Apple Team ID</label>
              <input type="text" value={config.teamId || ''} onChange={e => saveConfig({ ...config, teamId: e.target.value })} className="bg-gray-900 border border-gray-700 rounded px-3 py-2 w-48 text-sm font-mono placeholder-gray-500" placeholder="e.g. AB12345678" />
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-medium mb-3 flex items-center">
              <Package className="mr-2" size={20} /> Install Dependencies
            </h3>
            <div className="text-sm text-gray-400 mb-4 space-y-1">
              <p>Python 3: {envStatus?.python ? <span className="text-green-500">Found</span> : <span className="text-yellow-500">Not Verified</span>}</p>
              <p>Appium: {envStatus?.appium ? <span className="text-green-500">Found</span> : <span className="text-yellow-500">Not Verified</span>}</p>
              <p>Venv: {envStatus?.venv ? <span className="text-green-500">Found</span> : <span className="text-yellow-500">Not Verified</span>}</p>
            </div>
            <button disabled={installing} onClick={handleInstallDeps} className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white px-4 py-2 rounded-md transition">
              {installing ? 'Installing...' : 'Install Python Requirements'}
            </button>
          </div>

          <div className="flex justify-between items-center">
            <button onClick={() => setStep(2)} className="text-gray-400 hover:text-white px-4 py-2">Back</button>
            <button onClick={() => setStep(4)} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-md">Complete Setup</button>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard
  return (
    <div className="min-h-screen bg-gray-900 text-white flex h-screen overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 bg-gray-800 border-r border-gray-700 p-4 flex flex-col">
        <h2 className="text-xl font-bold mb-8 tracking-tight items-center flex gap-2">
          <Search size={22} className="text-blue-400" /> Word Hunt Bot
        </h2>

        <div className="space-y-4 mb-auto">
          <div className="bg-gray-900/50 p-3 rounded border border-gray-700">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-gray-400 font-medium">Appium</span>
              <span className={`w-2 h-2 rounded-full ${appiumRunning ? 'bg-green-500' : 'bg-red-500'}`}></span>
            </div>
            <button onClick={toggleAppium} className="w-full mt-2 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs transition">
              {appiumRunning ? 'Stop Server' : 'Start Server'}
            </button>
          </div>

          <div className="bg-gray-900/50 p-3 rounded border border-gray-700">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-gray-400 font-medium">Device</span>
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            </div>
            <div className="text-xs text-mono text-gray-500 truncate">{config.udid || 'No UDID set'}</div>
          </div>
        </div>

        <button onClick={toggleBot} disabled={!appiumRunning && !botRunning} className={`w-full py-3 rounded-md font-medium shadow-sm transition flex justify-center items-center gap-2 ${appiumRunning ? (botRunning ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' : 'bg-blue-600 hover:bg-blue-500 text-white') : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'}`}>
          {botRunning ? <><Square size={18} fill="currentColor" /> Stop Bot</> : <><Play size={18} fill="currentColor" /> Start Bot</>}
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full relative">
        <div className="h-14 border-b border-gray-700 flex items-center px-6 justify-between bg-gray-800/50">
          <h3 className="text-sm font-medium text-gray-300">Console Output</h3>
          <button onClick={() => setLogs([])} className="text-xs text-gray-500 hover:text-gray-300">Clear</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 bg-black/40 font-mono text-xs leading-relaxed">
          {logs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-600">No logs yet.</div>
          ) : (
            <div className="space-y-1">
              {logs.map((log, i) => (
                <div key={i} className={log.toLowerCase().includes('error') ? 'text-red-400' : 'text-gray-300'}>
                  <span className="text-gray-600 mr-3">
                    {new Date().toLocaleTimeString('en-US', { hour12: false, hour: 'numeric', minute: 'numeric', second: 'numeric' })}
                  </span>
                  {log}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
