import { app as w, BrowserWindow as V, ipcMain as h } from "electron";
import * as u from "path";
import { spawn as I, exec as q } from "child_process";
import * as p from "fs";
import * as k from "os";
import { fileURLToPath as Z } from "url";
const G = Z(import.meta.url), $ = u.dirname(G), C = k.platform() === "win32", O = "4.0.0", b = "13.5.0", z = /^[A-Z0-9]{10}$/, Y = /^(?:[0-9a-f]{8}-[0-9a-f]{16}|[0-9a-f]{24,40})$/i, K = /^[A-Za-z0-9]+(?:\.[A-Za-z0-9-]+)+$/, Q = "3285Q523PM";
let T = null, l = null, m = null;
function _() {
  return w.isPackaged ? process.resourcesPath : u.join($, "../..");
}
function g(e) {
  p.mkdirSync(e, { recursive: !0 });
}
function f() {
  const e = u.join(w.getPath("userData"), "runtime"), t = u.join(e, "venv"), i = u.join(e, "appium"), n = u.join(e, "appium-home"), c = u.join(e, "output"), o = C ? u.join(t, "Scripts", "python.exe") : u.join(t, "bin", "python"), s = C ? u.join(t, "Scripts", "pip.exe") : u.join(t, "bin", "pip"), a = C ? u.join(i, "node_modules", ".bin", "appium.cmd") : u.join(i, "node_modules", ".bin", "appium");
  return {
    runtimeRoot: e,
    venvPath: t,
    appiumRuntimePath: i,
    appiumHomePath: n,
    outputPath: c,
    pythonExec: o,
    pipExec: s,
    appiumExec: a
  };
}
function y(e = {}) {
  const t = f(), i = u.join(t.appiumRuntimePath, "node_modules", ".bin");
  return {
    ...process.env,
    PATH: [
      process.env.PATH || "",
      "/usr/local/bin",
      "/opt/homebrew/bin",
      "/usr/bin",
      "/bin",
      i,
      u.join(k.homedir(), ".npm-global", "bin")
    ].filter(Boolean).join(u.delimiter),
    APPIUM_HOME: t.appiumHomePath,
    ...e
  };
}
function M() {
  T = new V({
    width: 1280,
    height: 860,
    minWidth: 1100,
    minHeight: 760,
    backgroundColor: "#0b0b0b",
    webPreferences: {
      preload: u.join($, "preload.mjs"),
      nodeIntegration: !1,
      contextIsolation: !0
    }
  }), process.env.VITE_DEV_SERVER_URL ? T.loadURL(process.env.VITE_DEV_SERVER_URL) : T.loadFile(u.join($, "../dist/index.html"));
}
w.whenReady().then(() => {
  const e = f();
  g(e.runtimeRoot), g(e.appiumRuntimePath), g(e.appiumHomePath), g(e.outputPath), M();
});
w.on("window-all-closed", () => {
  process.platform !== "darwin" && w.quit();
});
w.on("activate", () => {
  V.getAllWindows().length === 0 && M();
});
w.on("before-quit", () => {
  l?.kill(), m?.kill();
});
const D = u.join(w.getPath("userData"), "wordhunt_config.json");
function v() {
  const e = {
    bundleId: "com.apple.MobileSMS",
    host: "127.0.0.1",
    port: 4723,
    teamId: "287MYRCJ37",
    udid: "",
    xcodeSigningId: "Apple Development",
    updatedWDABundleId: "",
    speedPreset: "fast",
    speedConfigVersion: 2
  };
  if (p.existsSync(D)) {
    const t = JSON.parse(p.readFileSync(D, "utf-8")), i = { ...e, ...t };
    return t.speedConfigVersion !== e.speedConfigVersion && (i.speedPreset = "fast", i.speedConfigVersion = e.speedConfigVersion, p.writeFileSync(D, JSON.stringify(i, null, 2))), i.teamId === Q && (i.teamId = e.teamId, p.writeFileSync(D, JSON.stringify(i, null, 2))), i;
  }
  return e;
}
function r(e, t) {
  e.sender.send("log", t);
}
function ee() {
  const e = f(), t = u.join(e.appiumRuntimePath, "package.json");
  p.writeFileSync(
    t,
    JSON.stringify(
      {
        name: "word-hunt-bot-appium-runtime",
        private: !0,
        dependencies: { appium: O }
      },
      null,
      2
    )
  );
}
function P(e, t, i = {}) {
  return new Promise((n) => {
    const c = q(e, { cwd: i.cwd, env: i.env });
    let o = "";
    c.stdout?.on("data", (s) => {
      const a = s.toString();
      o += a, t && r(t, a);
    }), c.stderr?.on("data", (s) => {
      const a = s.toString();
      o += a, t && r(t, a);
    }), c.on("close", (s) => {
      n({ success: s === 0, output: o, code: s });
    });
  });
}
function S(e, t, i, n = {}) {
  return new Promise((c, o) => {
    const s = I(t, i, {
      ...n,
      env: n.env ?? y(),
      shell: !1
    });
    s.stdout?.on("data", (a) => r(e, a.toString())), s.stderr?.on("data", (a) => r(e, a.toString())), s.on("error", o), s.on("close", (a) => {
      if (a === 0) {
        c();
        return;
      }
      o(new Error(`${t} exited with code ${a}`));
    });
  });
}
function te() {
  return u.join(_(), "Scripts", "main.py");
}
function ie() {
  return u.join(_(), "requirements.txt");
}
function F(e) {
  return new Promise((t) => {
    const i = I(f().pythonExec, [u.join(_(), "Scripts", "device_connection.py"), "--udid", e], {
      env: y(),
      shell: !1
    });
    let n = "", c = "";
    const o = setTimeout(() => {
      i.kill(), t({ connected: !1, message: "iPhone connection check timed out. Reconnect and unlock the phone, then retry." });
    }, 2e4);
    i.stdout?.on("data", (s) => {
      n += s.toString();
    }), i.stderr?.on("data", (s) => {
      c += s.toString();
    }), i.on("error", (s) => {
      clearTimeout(o), t({ connected: !1, message: `Could not check iPhone connection: ${String(s)}` });
    }), i.on("close", () => {
      clearTimeout(o);
      try {
        t(JSON.parse(n));
      } catch {
        t({ connected: !1, message: `Could not check iPhone connection: ${c || n}` });
      }
    });
  });
}
function j(e) {
  const t = [], i = (e.teamId || "").trim(), n = (e.xcodeSigningId || "").trim(), c = (e.udid || "").trim(), o = (e.updatedWDABundleId || "").trim();
  return z.test(i) || t.push("Apple Team ID must be the 10-character alphanumeric Team ID, not an email or certificate suffix."), n ? /^[A-Z0-9]{8,12}$/i.test(n) && n.toLowerCase() !== "apple development" && t.push("Xcode signing ID looks like a certificate suffix/Team ID; use the certificate name 'Apple Development'.") : t.push("Xcode signing ID is required; use the certificate common name, usually 'Apple Development'."), Y.test(c) || t.push("Device UDID must be a complete 24-40 character hex UDID (hyphenated UDIDs are accepted)."), K.test(o) ? o === "com.apple.WebDriverAgentRunner.xctrunner" && t.push("Updated WDA bundle ID must be unique; do not use Apple's default WDA bundle ID.") : t.push("Updated WDA bundle ID must be a reverse-DNS identifier such as com.example.wordhuntbot.wda."), t;
}
function ne(e) {
  return [...e.matchAll(/OU=([A-Z0-9]{10})/g)].map((t) => t[1]).filter((t, i, n) => n.indexOf(t) === i);
}
h.handle("get-config", async () => v());
h.handle("save-config", async (e, t) => (p.writeFileSync(D, JSON.stringify(t, null, 2)), !0));
h.handle("get-os-username", () => {
  try {
    return k.userInfo().username;
  } catch {
    return "user";
  }
});
h.handle("check-env", async () => {
  const e = f(), t = {
    python: !1,
    node: !0,
    venv: p.existsSync(e.pythonExec),
    appium: p.existsSync(e.appiumExec),
    xcuitest: !1,
    tesseract: !1
  }, i = y(), n = await P("python3 --version", void 0, { env: i });
  if (t.python = n.success, t.appium) {
    const o = await P(`"${e.appiumExec}" driver list --installed`, void 0, {
      cwd: e.appiumRuntimePath,
      env: i
    });
    t.xcuitest = o.output.toLowerCase().includes("xcuitest");
  }
  const c = await P("tesseract --version", void 0, { env: i });
  return t.tesseract = c.success, t;
});
h.handle("install-deps", async (e) => {
  const t = f(), i = y();
  try {
    if (g(t.runtimeRoot), g(t.appiumRuntimePath), g(t.appiumHomePath), g(t.outputPath), ee(), r(e, `Preparing isolated runtime...
`), p.existsSync(t.pythonExec) ? r(e, `Python virtual environment already exists.
`) : (r(e, `Creating Python virtual environment...
`), await S(e, "python3", ["-m", "venv", t.venvPath], {
      cwd: t.runtimeRoot,
      env: i
    })), r(e, `Upgrading pip tooling...
`), await S(
      e,
      t.pythonExec,
      ["-m", "pip", "install", "--upgrade", "pip", "setuptools", "wheel"],
      { cwd: t.runtimeRoot, env: i }
    ), r(e, `Installing Python dependencies...
`), await S(
      e,
      t.pythonExec,
      ["-m", "pip", "install", "-r", ie()],
      { cwd: t.runtimeRoot, env: i }
    ), r(e, `Installing exact Appium runtime (appium@${O})...
`), await S(
      e,
      "npm",
      ["install", "--save-exact", "--legacy-peer-deps", `appium@${O}`],
      { cwd: t.appiumRuntimePath, env: i }
    ), (await P(
      `"${t.appiumExec}" driver list --installed`,
      e,
      { cwd: t.appiumRuntimePath, env: i }
    )).output.includes(`xcuitest@${b}`))
      r(e, `XCUITest driver ${b} is already installed.
`);
    else {
      r(e, `Replacing stale XCUITest driver with xcuitest@${b}...
`), await P(`"${t.appiumExec}" driver uninstall xcuitest`, e, {
        cwd: t.appiumRuntimePath,
        env: i
      });
      const c = await P(
        `"${t.appiumExec}" driver install "xcuitest@${b}"`,
        e,
        { cwd: t.appiumRuntimePath, env: i }
      );
      if (!c.success) throw new Error(`Appium driver install failed with code ${c.code}`);
    }
    return r(
      e,
      `Dependency install complete. Tesseract remains optional because the bot now uses EasyOCR directly.
`
    ), !0;
  } catch (n) {
    return r(e, `Dependency install failed: ${String(n)}
`), !1;
  }
});
h.handle("start-appium", async (e) => {
  if (l)
    return !0;
  const t = f();
  return p.existsSync(t.appiumExec) ? new Promise((i) => {
    r(e, `Starting Appium...
`);
    let n = !1;
    l = I(
      t.appiumExec,
      ["server", "--use-drivers=xcuitest", "--base-path", "/"],
      {
        cwd: t.appiumRuntimePath,
        env: y(),
        shell: !1
      }
    );
    const c = (o) => {
      n || (n = !0, i(o));
    };
    l.stdout?.on("data", (o) => {
      const s = o.toString();
      r(e, s), (s.includes("Appium REST http interface listener started") || s.includes("listener started on")) && c(!0);
    }), l.stderr?.on("data", (o) => {
      r(e, o.toString());
    }), l.on("error", (o) => {
      r(e, `Failed to start Appium: ${String(o)}
`), l = null, c(!1);
    }), l.on("close", () => {
      l = null, c(!1);
    });
  }) : (r(e, `Appium runtime is missing. Install dependencies first.
`), !1);
});
h.handle("stop-appium", async () => (l?.kill(), l = null, !0));
h.handle("run-preflights", async (e, t) => {
  const i = f(), n = v(), c = y(), o = (H) => P(H, void 0, { env: c, cwd: i.appiumRuntimePath }), s = p.existsSync("/Applications/Xcode.app"), a = await o("xcode-select -p"), d = await o("xcodebuild -version"), A = await o("xcrun xctrace list devices"), J = await o("xcrun devicectl list devices"), U = await F(t), W = U.connected, E = p.existsSync(i.appiumExec) ? await o(`"${i.appiumExec}" driver list --installed`) : { output: "" }, x = await o("security find-identity -v -p codesigning"), B = await o('security find-certificate -a -c "Apple Development" -p | openssl x509 -noout -subject -enddate'), R = ne(B.output), N = x.success && (x.output.toLowerCase().includes("apple development") || x.output.toLowerCase().includes("iphone developer")) && !x.output.toLowerCase().includes("expired"), L = R.includes((n.teamId || "").trim()), X = await o("tesseract --version");
  return {
    xcodeAppExists: s,
    xcodeSelectValid: a.success && a.output.includes("Xcode.app"),
    xcodebuildValid: d.success,
    deviceVisible: W,
    xcuitestInstalled: E.output.toLowerCase().includes("xcuitest"),
    hasDeveloperCert: N,
    tesseractInstalled: X.success,
    configValid: j({ ...n, udid: t }),
    diagnostics: [
      ...j({ ...n, udid: t }),
      ...L ? [] : [`Entered Team ID ${(n.teamId || "").trim()} does not match any Apple Development certificate OU. Detected certificate Team ID(s): ${R.join(", ") || "(none)"}.`],
      ...x.output.includes("Apple Development") ? [] : ["No valid Apple Development identity with a private key was found."],
      ...a.success ? [] : [`xcode-select failed: ${a.output.trim()}`],
      ...d.success ? [] : [`xcodebuild failed: ${d.output.trim()}`],
      ...W ? [] : [U.message],
      ...N ? [] : [`No valid Apple Development certificate found. security output: ${x.output.trim()}`],
      ...E.output.toLowerCase().includes("xcuitest") ? [] : [`XCUITest driver check failed: ${E.output.trim()}`]
    ],
    deviceOutput: `${A.output}
${J.output}`,
    identityOutput: x.output,
    detectedTeamIds: R,
    teamMatchesCertificate: L,
    certificateOutput: B.output
  };
});
h.handle("test-wda", async (e) => {
  const t = f(), i = v(), n = j(i);
  if (n.length)
    return r(e, `Preflight blocked WDA test:
${n.map((s) => `- ${s}`).join(`
`)}
`), !1;
  const c = u.join(t.runtimeRoot, "test_wda_runtime.py"), o = `
import sys
from appium import webdriver
from appium.options.ios import XCUITestOptions

options = XCUITestOptions()
options.platform_name = 'iOS'
options.udid = ${JSON.stringify(i.udid || "")}
options.automation_name = 'XCUITest'
options.bundle_id = 'com.apple.Preferences'
options.set_capability('appium:wdaLaunchTimeout', 180000)
options.set_capability('appium:wdaConnectionTimeout', 180000)
options.set_capability('appium:useNewWDA', True)
options.set_capability('appium:showXcodeLog', True)
options.set_capability('appium:allowProvisioningDeviceRegistration', True)
options.set_capability('appium:allowProvisioningUpdates', True)

team_id = ${JSON.stringify(i.teamId || "")}
signing_id = ${JSON.stringify(i.xcodeSigningId || "Apple Development")}
wda_bundle = ${JSON.stringify(i.updatedWDABundleId || "")}

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
  return p.writeFileSync(c, o), new Promise((s) => {
    const a = I(t.pythonExec, [c], {
      cwd: t.runtimeRoot,
      env: y(),
      shell: !1
    });
    a.stdout?.on("data", (d) => r(e, d.toString())), a.stderr?.on("data", (d) => r(e, d.toString())), a.on("close", (d) => {
      p.existsSync(c) && p.unlinkSync(c), r(e, `WDA test exited with code ${d}
`), s(d === 0);
    });
  });
});
h.handle("start-bot", async (e) => {
  if (m)
    return !1;
  const t = f(), i = v(), n = ["safe", "fast", "max"].includes(i.speedPreset) ? i.speedPreset : "fast", c = await F(i.udid || "");
  if (!c.connected)
    return r(e, `Cannot start bot: ${c.message}
`), !1;
  const o = ["-u", te(), "--preset", n, "--label", `launcher-${n}`];
  if (n === "fast") {
    const s = u.join(t.appiumHomePath, "node_modules", "appium-xcuitest-driver", "node_modules", "appium-webdriveragent"), a = u.join(s, "WebDriverAgentLib", "Commands", "FBTouchActionCommands.m"), d = u.join(_(), "Scripts", "wda_screen_actions.inc");
    if (!p.existsSync(a))
      return r(e, `WDA source is missing. Install dependencies first.
`), !1;
    if (!p.readFileSync(a, "utf8").includes(p.readFileSync(d, "utf8")))
      try {
        r(e, `Preparing the measured all-words WDA mode (original source is backed up)...
`), await S(e, t.pythonExec, [u.join(_(), "Scripts", "patch_wda_speed.py"), s]), o.push("--rebuild-wda");
      } catch (A) {
        return r(e, `Could not prepare Fast mode: ${String(A)}
`), !1;
      }
  }
  return new Promise((s) => {
    r(e, `Starting bot — ${n === "fast" ? "FAST: all words, 155 ms path, 60 ms between words, direct screen coordinates" : n.toUpperCase()}
`), m = I(t.pythonExec, o, {
      cwd: t.outputPath,
      env: y({
        BOT_UDID: i.udid || "",
        BOT_TEAM_ID: i.teamId || "",
        BOT_BUNDLE_ID: i.bundleId || "com.apple.MobileSMS",
        BOT_PORT: String(i.port || 4723),
        BOT_XCODE_SIGNING_ID: i.xcodeSigningId || "Apple Development",
        BOT_UPDATED_WDA_BUNDLE_ID: i.updatedWDABundleId || "",
        BOT_WORKDIR: t.outputPath,
        BOT_SPEED_PRESET: n
      }),
      shell: !1
    }), m.stdout?.on("data", (a) => r(e, a.toString())), m.stderr?.on("data", (a) => r(e, a.toString())), m.on("error", (a) => {
      r(e, `Bot launch failed: ${String(a)}
`), m = null, s(!1);
    }), m.on("close", (a) => {
      r(e, `Bot exited with code ${a}
`), m = null, s(a === 0);
    });
  });
});
h.handle("stop-bot", async () => (m?.kill(), m = null, !0));
