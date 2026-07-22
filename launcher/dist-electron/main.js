import { app as g, BrowserWindow as C, ipcMain as d } from "electron";
import * as s from "path";
import { spawn as P, exec as k } from "child_process";
import * as c from "fs";
import * as R from "os";
import { fileURLToPath as L } from "url";
const U = L(import.meta.url), b = s.dirname(U), _ = R.platform() === "win32";
let v = null, l = null, m = null;
function j() {
  return g.isPackaged ? process.resourcesPath : s.join(b, "../..");
}
function f(t) {
  c.mkdirSync(t, { recursive: !0 });
}
function h() {
  const t = s.join(g.getPath("userData"), "runtime"), e = s.join(t, "venv"), n = s.join(t, "appium"), a = s.join(t, "appium-home"), i = s.join(t, "output"), r = _ ? s.join(e, "Scripts", "python.exe") : s.join(e, "bin", "python"), o = _ ? s.join(e, "Scripts", "pip.exe") : s.join(e, "bin", "pip"), p = _ ? s.join(n, "node_modules", ".bin", "appium.cmd") : s.join(n, "node_modules", ".bin", "appium");
  return {
    runtimeRoot: t,
    venvPath: e,
    appiumRuntimePath: n,
    appiumHomePath: a,
    outputPath: i,
    pythonExec: r,
    pipExec: o,
    appiumExec: p
  };
}
function w(t = {}) {
  const e = h(), n = s.join(e.appiumRuntimePath, "node_modules", ".bin");
  return {
    ...process.env,
    PATH: [
      process.env.PATH || "",
      "/usr/local/bin",
      "/opt/homebrew/bin",
      "/usr/bin",
      "/bin",
      n,
      s.join(R.homedir(), ".npm-global", "bin")
    ].filter(Boolean).join(s.delimiter),
    APPIUM_HOME: e.appiumHomePath,
    ...t
  };
}
function T() {
  v = new C({
    width: 1280,
    height: 860,
    minWidth: 1100,
    minHeight: 760,
    backgroundColor: "#0b0b0b",
    webPreferences: {
      preload: s.join(b, "preload.mjs"),
      nodeIntegration: !1,
      contextIsolation: !0
    }
  }), process.env.VITE_DEV_SERVER_URL ? v.loadURL(process.env.VITE_DEV_SERVER_URL) : v.loadFile(s.join(b, "../dist/index.html"));
}
g.whenReady().then(() => {
  const t = h();
  f(t.runtimeRoot), f(t.appiumRuntimePath), f(t.appiumHomePath), f(t.outputPath), T();
});
g.on("window-all-closed", () => {
  process.platform !== "darwin" && g.quit();
});
g.on("activate", () => {
  C.getAllWindows().length === 0 && T();
});
g.on("before-quit", () => {
  l?.kill(), m?.kill();
});
const E = s.join(g.getPath("userData"), "wordhunt_config.json");
function I() {
  return c.existsSync(E) ? JSON.parse(c.readFileSync(E, "utf-8")) : {
    bundleId: "com.apple.MobileSMS",
    host: "127.0.0.1",
    port: 4723,
    teamId: "",
    udid: "",
    xcodeSigningId: "Apple Development",
    updatedWDABundleId: ""
  };
}
function u(t, e) {
  t.sender.send("log", e);
}
function $() {
  const t = h(), e = s.join(t.appiumRuntimePath, "package.json");
  c.existsSync(e) || c.writeFileSync(
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
function x(t, e, n = {}) {
  return new Promise((a) => {
    const i = k(t, { cwd: n.cwd, env: n.env });
    let r = "";
    i.stdout?.on("data", (o) => {
      const p = o.toString();
      r += p;
    }), i.stderr?.on("data", (o) => {
      const p = o.toString();
      r += p;
    }), i.on("close", (o) => {
      a({ success: o === 0, output: r, code: o });
    });
  });
}
function y(t, e, n, a = {}) {
  return new Promise((i, r) => {
    const o = P(e, n, {
      ...a,
      env: a.env ?? w(),
      shell: !1
    });
    o.stdout?.on("data", (p) => u(t, p.toString())), o.stderr?.on("data", (p) => u(t, p.toString())), o.on("error", r), o.on("close", (p) => {
      if (p === 0) {
        i();
        return;
      }
      r(new Error(`${e} exited with code ${p}`));
    });
  });
}
function N() {
  return s.join(j(), "Scripts", "main.py");
}
function J() {
  return s.join(j(), "requirements.txt");
}
d.handle("get-config", async () => I());
d.handle("save-config", async (t, e) => (c.writeFileSync(E, JSON.stringify(e, null, 2)), !0));
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
    venv: c.existsSync(t.pythonExec),
    appium: c.existsSync(t.appiumExec),
    xcuitest: !1,
    tesseract: !1
  }, n = w(), a = await x("python3 --version", void 0, { env: n });
  if (e.python = a.success, e.appium) {
    const r = await x(`"${t.appiumExec}" driver list --installed`, void 0, {
      cwd: t.appiumRuntimePath,
      env: n
    });
    e.xcuitest = r.output.toLowerCase().includes("xcuitest");
  }
  const i = await x("tesseract --version", void 0, { env: n });
  return e.tesseract = i.success, e;
});
d.handle("install-deps", async (t) => {
  const e = h(), n = w();
  try {
    return f(e.runtimeRoot), f(e.appiumRuntimePath), f(e.appiumHomePath), f(e.outputPath), $(), u(t, `Preparing isolated runtime...
`), c.existsSync(e.pythonExec) ? u(t, `Python virtual environment already exists.
`) : (u(t, `Creating Python virtual environment...
`), await y(t, "python3", ["-m", "venv", e.venvPath], {
      cwd: e.runtimeRoot,
      env: n
    })), u(t, `Upgrading pip tooling...
`), await y(
      t,
      e.pythonExec,
      ["-m", "pip", "install", "--upgrade", "pip", "setuptools", "wheel"],
      { cwd: e.runtimeRoot, env: n }
    ), u(t, `Installing Python dependencies...
`), await y(
      t,
      e.pythonExec,
      ["-m", "pip", "install", "-r", J()],
      { cwd: e.runtimeRoot, env: n }
    ), u(t, `Installing local Appium runtime and XCUITest driver...
`), await y(
      t,
      "npm",
      ["install", "--save-exact", "appium", "appium-xcuitest-driver"],
      { cwd: e.appiumRuntimePath, env: n }
    ), u(
      t,
      `Dependency install complete. Tesseract remains optional because the bot now uses EasyOCR directly.
`
    ), !0;
  } catch (a) {
    return u(t, `Dependency install failed: ${String(a)}
`), !1;
  }
});
d.handle("start-appium", async (t) => {
  if (l)
    return !0;
  const e = h();
  return c.existsSync(e.appiumExec) ? new Promise((n) => {
    u(t, `Starting Appium...
`);
    let a = !1;
    l = P(
      e.appiumExec,
      ["server", "--use-drivers=xcuitest", "--base-path", "/"],
      {
        cwd: e.appiumRuntimePath,
        env: w(),
        shell: !1
      }
    );
    const i = (r) => {
      a || (a = !0, n(r));
    };
    l.stdout?.on("data", (r) => {
      const o = r.toString();
      u(t, o), (o.includes("Appium REST http interface listener started") || o.includes("listener started on")) && i(!0);
    }), l.stderr?.on("data", (r) => {
      u(t, r.toString());
    }), l.on("error", (r) => {
      u(t, `Failed to start Appium: ${String(r)}
`), l = null, i(!1);
    }), l.on("close", () => {
      l = null, i(!1);
    });
  }) : (u(t, `Appium runtime is missing. Install dependencies first.
`), !1);
});
d.handle("stop-appium", async () => (l?.kill(), l = null, !0));
d.handle("run-preflights", async (t, e) => {
  const n = h(), a = w(), i = (A) => x(A, void 0, { env: a, cwd: n.appiumRuntimePath }), r = c.existsSync("/Applications/Xcode.app"), o = await i("xcode-select -p"), p = await i("xcodebuild -version");
  let S = !1;
  e ? S = (await i("xcrun xctrace list devices")).output.toLowerCase().includes(e.toLowerCase()) : S = !0;
  const O = c.existsSync(n.appiumExec) ? await i(`"${n.appiumExec}" driver list --installed`) : { output: "" }, D = await i("security find-identity -v -p codesigning"), B = D.output.toLowerCase().includes("apple development") || D.output.toLowerCase().includes("iphone developer"), W = await i("tesseract --version");
  return {
    xcodeAppExists: r,
    xcodeSelectValid: o.success && o.output.includes("Xcode.app"),
    xcodebuildValid: p.success,
    deviceVisible: S,
    xcuitestInstalled: O.output.toLowerCase().includes("xcuitest"),
    hasDeveloperCert: B,
    tesseractInstalled: W.success
  };
});
d.handle("test-wda", async (t) => {
  const e = h(), n = I(), a = s.join(e.runtimeRoot, "test_wda_runtime.py"), i = `
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
  return c.writeFileSync(a, i), new Promise((r) => {
    const o = P(e.pythonExec, [a], {
      cwd: e.runtimeRoot,
      env: w(),
      shell: !1
    });
    o.stdout?.on("data", (p) => u(t, p.toString())), o.stderr?.on("data", (p) => u(t, p.toString())), o.on("close", (p) => {
      c.existsSync(a) && c.unlinkSync(a), u(t, `WDA test exited with code ${p}
`), r(p === 0);
    });
  });
});
d.handle("start-bot", async (t) => {
  if (m)
    return !1;
  const e = h(), n = I();
  return new Promise((a) => {
    u(t, `Starting bot...
`), m = P(e.pythonExec, [N()], {
      cwd: e.outputPath,
      env: w({
        BOT_UDID: n.udid || "",
        BOT_TEAM_ID: n.teamId || "",
        BOT_BUNDLE_ID: n.bundleId || "com.apple.MobileSMS",
        BOT_PORT: String(n.port || 4723),
        BOT_XCODE_SIGNING_ID: n.xcodeSigningId || "Apple Development",
        BOT_UPDATED_WDA_BUNDLE_ID: n.updatedWDABundleId || "",
        BOT_WORKDIR: e.outputPath
      }),
      shell: !1
    }), m.stdout?.on("data", (i) => u(t, i.toString())), m.stderr?.on("data", (i) => u(t, i.toString())), m.on("close", (i) => {
      u(t, `Bot exited with code ${i}
`), m = null, a(i === 0);
    });
  });
});
d.handle("stop-bot", async () => (m?.kill(), m = null, !0));
