import { app as w, BrowserWindow as T, ipcMain as d } from "electron";
import * as u from "path";
import { spawn as P, exec as k } from "child_process";
import * as p from "fs";
import * as R from "os";
import { fileURLToPath as U } from "url";
const L = U(import.meta.url), v = u.dirname(L), _ = R.platform() === "win32", C = "9.2.4";
let b = null, l = null, m = null;
function j() {
  return w.isPackaged ? process.resourcesPath : u.join(v, "../..");
}
function f(t) {
  p.mkdirSync(t, { recursive: !0 });
}
function h() {
  const t = u.join(w.getPath("userData"), "runtime"), e = u.join(t, "venv"), n = u.join(t, "appium"), o = u.join(t, "appium-home"), i = u.join(t, "output"), c = _ ? u.join(e, "Scripts", "python.exe") : u.join(e, "bin", "python"), a = _ ? u.join(e, "Scripts", "pip.exe") : u.join(e, "bin", "pip"), r = _ ? u.join(n, "node_modules", ".bin", "appium.cmd") : u.join(n, "node_modules", ".bin", "appium");
  return {
    runtimeRoot: t,
    venvPath: e,
    appiumRuntimePath: n,
    appiumHomePath: o,
    outputPath: i,
    pythonExec: c,
    pipExec: a,
    appiumExec: r
  };
}
function g(t = {}) {
  const e = h(), n = u.join(e.appiumRuntimePath, "node_modules", ".bin");
  return {
    ...process.env,
    PATH: [
      process.env.PATH || "",
      "/usr/local/bin",
      "/opt/homebrew/bin",
      "/usr/bin",
      "/bin",
      n,
      u.join(R.homedir(), ".npm-global", "bin")
    ].filter(Boolean).join(u.delimiter),
    APPIUM_HOME: e.appiumHomePath,
    ...t
  };
}
function O() {
  b = new T({
    width: 1280,
    height: 860,
    minWidth: 1100,
    minHeight: 760,
    backgroundColor: "#0b0b0b",
    webPreferences: {
      preload: u.join(v, "preload.mjs"),
      nodeIntegration: !1,
      contextIsolation: !0
    }
  }), process.env.VITE_DEV_SERVER_URL ? b.loadURL(process.env.VITE_DEV_SERVER_URL) : b.loadFile(u.join(v, "../dist/index.html"));
}
w.whenReady().then(() => {
  const t = h();
  f(t.runtimeRoot), f(t.appiumRuntimePath), f(t.appiumHomePath), f(t.outputPath), O();
});
w.on("window-all-closed", () => {
  process.platform !== "darwin" && w.quit();
});
w.on("activate", () => {
  T.getAllWindows().length === 0 && O();
});
w.on("before-quit", () => {
  l?.kill(), m?.kill();
});
const E = u.join(w.getPath("userData"), "wordhunt_config.json");
function I() {
  return p.existsSync(E) ? JSON.parse(p.readFileSync(E, "utf-8")) : {
    bundleId: "com.apple.MobileSMS",
    host: "127.0.0.1",
    port: 4723,
    teamId: "",
    udid: "",
    xcodeSigningId: "Apple Development",
    updatedWDABundleId: ""
  };
}
function s(t, e) {
  t.sender.send("log", e);
}
function N() {
  const t = h(), e = u.join(t.appiumRuntimePath, "package.json");
  p.existsSync(e) || p.writeFileSync(
    e,
    JSON.stringify(
      {
        name: "word-hunt-bot-appium-runtime",
        private: !0
      },
      null,
      2
    )
  );
}
function y(t, e, n = {}) {
  return new Promise((o) => {
    const i = k(t, { cwd: n.cwd, env: n.env });
    let c = "";
    i.stdout?.on("data", (a) => {
      const r = a.toString();
      c += r, e && s(e, r);
    }), i.stderr?.on("data", (a) => {
      const r = a.toString();
      c += r, e && s(e, r);
    }), i.on("close", (a) => {
      o({ success: a === 0, output: c, code: a });
    });
  });
}
function x(t, e, n, o = {}) {
  return new Promise((i, c) => {
    const a = P(e, n, {
      ...o,
      env: o.env ?? g(),
      shell: !1
    });
    a.stdout?.on("data", (r) => s(t, r.toString())), a.stderr?.on("data", (r) => s(t, r.toString())), a.on("error", c), a.on("close", (r) => {
      if (r === 0) {
        i();
        return;
      }
      c(new Error(`${e} exited with code ${r}`));
    });
  });
}
function V() {
  return u.join(j(), "Scripts", "main.py");
}
function J() {
  return u.join(j(), "requirements.txt");
}
d.handle("get-config", async () => I());
d.handle("save-config", async (t, e) => (p.writeFileSync(E, JSON.stringify(e, null, 2)), !0));
d.handle("get-os-username", () => {
  try {
    return R.userInfo().username;
  } catch {
    return "user";
  }
});
d.handle("check-env", async () => {
  const t = h(), e = {
    python: !1,
    node: !0,
    venv: p.existsSync(t.pythonExec),
    appium: p.existsSync(t.appiumExec),
    xcuitest: !1,
    tesseract: !1
  }, n = g(), o = await y("python3 --version", void 0, { env: n });
  if (e.python = o.success, e.appium) {
    const c = await y(`"${t.appiumExec}" driver list --installed`, void 0, {
      cwd: t.appiumRuntimePath,
      env: n
    });
    e.xcuitest = c.output.toLowerCase().includes("xcuitest");
  }
  const i = await y("tesseract --version", void 0, { env: n });
  return e.tesseract = i.success, e;
});
d.handle("install-deps", async (t) => {
  const e = h(), n = g();
  try {
    f(e.runtimeRoot), f(e.appiumRuntimePath), f(e.appiumHomePath), f(e.outputPath), N(), s(t, `Preparing isolated runtime...
`), p.existsSync(e.pythonExec) ? s(t, `Python virtual environment already exists.
`) : (s(t, `Creating Python virtual environment...
`), await x(t, "python3", ["-m", "venv", e.venvPath], {
      cwd: e.runtimeRoot,
      env: n
    })), s(t, `Upgrading pip tooling...
`), await x(
      t,
      e.pythonExec,
      ["-m", "pip", "install", "--upgrade", "pip", "setuptools", "wheel"],
      { cwd: e.runtimeRoot, env: n }
    ), s(t, `Installing Python dependencies...
`), await x(
      t,
      e.pythonExec,
      ["-m", "pip", "install", "-r", J()],
      { cwd: e.runtimeRoot, env: n }
    ), s(t, `Installing local Appium runtime...
`), await x(
      t,
      "npm",
      ["install", "--save-exact", "appium"],
      { cwd: e.appiumRuntimePath, env: n }
    ), s(t, `Registering the XCUITest driver with Appium (xcuitest@${C})...
`);
    const o = await y(
      `"${e.appiumExec}" driver install "xcuitest@${C}"`,
      t,
      { cwd: e.appiumRuntimePath, env: n }
    );
    if (!o.success)
      if (o.output.includes("already installed"))
        s(t, `XCUITest driver is already installed. Continuing.
`);
      else
        throw new Error(`Appium driver install failed with code ${o.code}`);
    return s(
      t,
      `Dependency install complete. Tesseract remains optional because the bot now uses EasyOCR directly.
`
    ), !0;
  } catch (o) {
    return s(t, `Dependency install failed: ${String(o)}
`), !1;
  }
});
d.handle("start-appium", async (t) => {
  if (l)
    return !0;
  const e = h();
  return p.existsSync(e.appiumExec) ? new Promise((n) => {
    s(t, `Starting Appium...
`);
    let o = !1;
    l = P(
      e.appiumExec,
      ["server", "--use-drivers=xcuitest", "--base-path", "/"],
      {
        cwd: e.appiumRuntimePath,
        env: g(),
        shell: !1
      }
    );
    const i = (c) => {
      o || (o = !0, n(c));
    };
    l.stdout?.on("data", (c) => {
      const a = c.toString();
      s(t, a), (a.includes("Appium REST http interface listener started") || a.includes("listener started on")) && i(!0);
    }), l.stderr?.on("data", (c) => {
      s(t, c.toString());
    }), l.on("error", (c) => {
      s(t, `Failed to start Appium: ${String(c)}
`), l = null, i(!1);
    }), l.on("close", () => {
      l = null, i(!1);
    });
  }) : (s(t, `Appium runtime is missing. Install dependencies first.
`), !1);
});
d.handle("stop-appium", async () => (l?.kill(), l = null, !0));
d.handle("run-preflights", async (t, e) => {
  const n = h(), o = g(), i = (A) => y(A, void 0, { env: o, cwd: n.appiumRuntimePath }), c = p.existsSync("/Applications/Xcode.app"), a = await i("xcode-select -p"), r = await i("xcodebuild -version");
  let S = !1;
  e ? S = (await i("xcrun xctrace list devices")).output.toLowerCase().includes(e.toLowerCase()) : S = !0;
  const $ = p.existsSync(n.appiumExec) ? await i(`"${n.appiumExec}" driver list --installed`) : { output: "" }, D = await i("security find-identity -v -p codesigning"), B = D.output.toLowerCase().includes("apple development") || D.output.toLowerCase().includes("iphone developer"), W = await i("tesseract --version");
  return {
    xcodeAppExists: c,
    xcodeSelectValid: a.success && a.output.includes("Xcode.app"),
    xcodebuildValid: r.success,
    deviceVisible: S,
    xcuitestInstalled: $.output.toLowerCase().includes("xcuitest"),
    hasDeveloperCert: B,
    tesseractInstalled: W.success
  };
});
d.handle("test-wda", async (t) => {
  const e = h(), n = I(), o = u.join(e.runtimeRoot, "test_wda_runtime.py"), i = `
import sys
from appium import webdriver
from appium.options.ios import XCUITestOptions

options = XCUITestOptions()
options.platform_name = 'iOS'
options.udid = ${JSON.stringify(n.udid || "")}
options.automation_name = 'XCUITest'
options.bundle_id = 'com.apple.Preferences'
options.set_capability('appium:wdaLaunchTimeout', 180000)
options.set_capability('appium:wdaConnectionTimeout', 180000)
options.set_capability('appium:useNewWDA', True)

team_id = ${JSON.stringify(n.teamId || "")}
signing_id = ${JSON.stringify(n.xcodeSigningId || "Apple Development")}
wda_bundle = ${JSON.stringify(n.updatedWDABundleId || "")}

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
  return p.writeFileSync(o, i), new Promise((c) => {
    const a = P(e.pythonExec, [o], {
      cwd: e.runtimeRoot,
      env: g(),
      shell: !1
    });
    a.stdout?.on("data", (r) => s(t, r.toString())), a.stderr?.on("data", (r) => s(t, r.toString())), a.on("close", (r) => {
      p.existsSync(o) && p.unlinkSync(o), s(t, `WDA test exited with code ${r}
`), c(r === 0);
    });
  });
});
d.handle("start-bot", async (t) => {
  if (m)
    return !1;
  const e = h(), n = I();
  return new Promise((o) => {
    s(t, `Starting bot...
`), m = P(e.pythonExec, [V()], {
      cwd: e.outputPath,
      env: g({
        BOT_UDID: n.udid || "",
        BOT_TEAM_ID: n.teamId || "",
        BOT_BUNDLE_ID: n.bundleId || "com.apple.MobileSMS",
        BOT_PORT: String(n.port || 4723),
        BOT_XCODE_SIGNING_ID: n.xcodeSigningId || "Apple Development",
        BOT_UPDATED_WDA_BUNDLE_ID: n.updatedWDABundleId || "",
        BOT_WORKDIR: e.outputPath
      }),
      shell: !1
    }), m.stdout?.on("data", (i) => s(t, i.toString())), m.stderr?.on("data", (i) => s(t, i.toString())), m.on("close", (i) => {
      s(t, `Bot exited with code ${i}
`), m = null, o(i === 0);
    });
  });
});
d.handle("stop-bot", async () => (m?.kill(), m = null, !0));
