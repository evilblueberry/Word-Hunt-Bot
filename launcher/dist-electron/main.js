import { app as g, BrowserWindow as T, ipcMain as d } from "electron";
import * as s from "path";
import { spawn as P, exec as $ } from "child_process";
import * as c from "fs";
import * as R from "os";
import { fileURLToPath as U } from "url";
const L = U(import.meta.url), v = s.dirname(L), _ = R.platform() === "win32", C = "9.2.4";
let b = null, l = null, m = null;
function j() {
  return g.isPackaged ? process.resourcesPath : s.join(v, "../..");
}
function f(t) {
  c.mkdirSync(t, { recursive: !0 });
}
function h() {
  const t = s.join(g.getPath("userData"), "runtime"), e = s.join(t, "venv"), n = s.join(t, "appium"), r = s.join(t, "appium-home"), i = s.join(t, "output"), u = _ ? s.join(e, "Scripts", "python.exe") : s.join(e, "bin", "python"), o = _ ? s.join(e, "Scripts", "pip.exe") : s.join(e, "bin", "pip"), p = _ ? s.join(n, "node_modules", ".bin", "appium.cmd") : s.join(n, "node_modules", ".bin", "appium");
  return {
    runtimeRoot: t,
    venvPath: e,
    appiumRuntimePath: n,
    appiumHomePath: r,
    outputPath: i,
    pythonExec: u,
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
function O() {
  b = new T({
    width: 1280,
    height: 860,
    minWidth: 1100,
    minHeight: 760,
    backgroundColor: "#0b0b0b",
    webPreferences: {
      preload: s.join(v, "preload.mjs"),
      nodeIntegration: !1,
      contextIsolation: !0
    }
  }), process.env.VITE_DEV_SERVER_URL ? b.loadURL(process.env.VITE_DEV_SERVER_URL) : b.loadFile(s.join(v, "../dist/index.html"));
}
g.whenReady().then(() => {
  const t = h();
  f(t.runtimeRoot), f(t.appiumRuntimePath), f(t.appiumHomePath), f(t.outputPath), O();
});
g.on("window-all-closed", () => {
  process.platform !== "darwin" && g.quit();
});
g.on("activate", () => {
  T.getAllWindows().length === 0 && O();
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
function a(t, e) {
  t.sender.send("log", e);
}
function N() {
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
  return new Promise((r) => {
    const i = $(t, { cwd: n.cwd, env: n.env });
    let u = "";
    i.stdout?.on("data", (o) => {
      const p = o.toString();
      u += p;
    }), i.stderr?.on("data", (o) => {
      const p = o.toString();
      u += p;
    }), i.on("close", (o) => {
      r({ success: o === 0, output: u, code: o });
    });
  });
}
function y(t, e, n, r = {}) {
  return new Promise((i, u) => {
    const o = P(e, n, {
      ...r,
      env: r.env ?? w(),
      shell: !1
    });
    o.stdout?.on("data", (p) => a(t, p.toString())), o.stderr?.on("data", (p) => a(t, p.toString())), o.on("error", u), o.on("close", (p) => {
      if (p === 0) {
        i();
        return;
      }
      u(new Error(`${e} exited with code ${p}`));
    });
  });
}
function V() {
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
  }, n = w(), r = await x("python3 --version", void 0, { env: n });
  if (e.python = r.success, e.appium) {
    const u = await x(`"${t.appiumExec}" driver list --installed`, void 0, {
      cwd: t.appiumRuntimePath,
      env: n
    });
    e.xcuitest = u.output.toLowerCase().includes("xcuitest");
  }
  const i = await x("tesseract --version", void 0, { env: n });
  return e.tesseract = i.success, e;
});
d.handle("install-deps", async (t) => {
  const e = h(), n = w();
  try {
    return f(e.runtimeRoot), f(e.appiumRuntimePath), f(e.appiumHomePath), f(e.outputPath), N(), a(t, `Preparing isolated runtime...
`), c.existsSync(e.pythonExec) ? a(t, `Python virtual environment already exists.
`) : (a(t, `Creating Python virtual environment...
`), await y(t, "python3", ["-m", "venv", e.venvPath], {
      cwd: e.runtimeRoot,
      env: n
    })), a(t, `Upgrading pip tooling...
`), await y(
      t,
      e.pythonExec,
      ["-m", "pip", "install", "--upgrade", "pip", "setuptools", "wheel"],
      { cwd: e.runtimeRoot, env: n }
    ), a(t, `Installing Python dependencies...
`), await y(
      t,
      e.pythonExec,
      ["-m", "pip", "install", "-r", J()],
      { cwd: e.runtimeRoot, env: n }
    ), a(t, `Installing local Appium runtime...
`), await y(
      t,
      "npm",
      ["install", "--save-exact", "appium"],
      { cwd: e.appiumRuntimePath, env: n }
    ), a(t, `Registering the XCUITest driver with Appium (xcuitest@${C})...
`), await y(
      t,
      e.appiumExec,
      ["driver", "install", `xcuitest@${C}`],
      { cwd: e.appiumRuntimePath, env: n }
    ), a(
      t,
      `Dependency install complete. Tesseract remains optional because the bot now uses EasyOCR directly.
`
    ), !0;
  } catch (r) {
    return a(t, `Dependency install failed: ${String(r)}
`), !1;
  }
});
d.handle("start-appium", async (t) => {
  if (l)
    return !0;
  const e = h();
  return c.existsSync(e.appiumExec) ? new Promise((n) => {
    a(t, `Starting Appium...
`);
    let r = !1;
    l = P(
      e.appiumExec,
      ["server", "--use-drivers=xcuitest", "--base-path", "/"],
      {
        cwd: e.appiumRuntimePath,
        env: w(),
        shell: !1
      }
    );
    const i = (u) => {
      r || (r = !0, n(u));
    };
    l.stdout?.on("data", (u) => {
      const o = u.toString();
      a(t, o), (o.includes("Appium REST http interface listener started") || o.includes("listener started on")) && i(!0);
    }), l.stderr?.on("data", (u) => {
      a(t, u.toString());
    }), l.on("error", (u) => {
      a(t, `Failed to start Appium: ${String(u)}
`), l = null, i(!1);
    }), l.on("close", () => {
      l = null, i(!1);
    });
  }) : (a(t, `Appium runtime is missing. Install dependencies first.
`), !1);
});
d.handle("stop-appium", async () => (l?.kill(), l = null, !0));
d.handle("run-preflights", async (t, e) => {
  const n = h(), r = w(), i = (A) => x(A, void 0, { env: r, cwd: n.appiumRuntimePath }), u = c.existsSync("/Applications/Xcode.app"), o = await i("xcode-select -p"), p = await i("xcodebuild -version");
  let S = !1;
  e ? S = (await i("xcrun xctrace list devices")).output.toLowerCase().includes(e.toLowerCase()) : S = !0;
  const B = c.existsSync(n.appiumExec) ? await i(`"${n.appiumExec}" driver list --installed`) : { output: "" }, D = await i("security find-identity -v -p codesigning"), W = D.output.toLowerCase().includes("apple development") || D.output.toLowerCase().includes("iphone developer"), k = await i("tesseract --version");
  return {
    xcodeAppExists: u,
    xcodeSelectValid: o.success && o.output.includes("Xcode.app"),
    xcodebuildValid: p.success,
    deviceVisible: S,
    xcuitestInstalled: B.output.toLowerCase().includes("xcuitest"),
    hasDeveloperCert: W,
    tesseractInstalled: k.success
  };
});
d.handle("test-wda", async (t) => {
  const e = h(), n = I(), r = s.join(e.runtimeRoot, "test_wda_runtime.py"), i = `
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
  return c.writeFileSync(r, i), new Promise((u) => {
    const o = P(e.pythonExec, [r], {
      cwd: e.runtimeRoot,
      env: w(),
      shell: !1
    });
    o.stdout?.on("data", (p) => a(t, p.toString())), o.stderr?.on("data", (p) => a(t, p.toString())), o.on("close", (p) => {
      c.existsSync(r) && c.unlinkSync(r), a(t, `WDA test exited with code ${p}
`), u(p === 0);
    });
  });
});
d.handle("start-bot", async (t) => {
  if (m)
    return !1;
  const e = h(), n = I();
  return new Promise((r) => {
    a(t, `Starting bot...
`), m = P(e.pythonExec, [V()], {
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
    }), m.stdout?.on("data", (i) => a(t, i.toString())), m.stderr?.on("data", (i) => a(t, i.toString())), m.on("close", (i) => {
      a(t, `Bot exited with code ${i}
`), m = null, r(i === 0);
    });
  });
});
d.handle("stop-bot", async () => (m?.kill(), m = null, !0));
