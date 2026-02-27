import { app as p, BrowserWindow as _, ipcMain as l } from "electron";
import * as r from "path";
import { exec as y, spawn as j } from "child_process";
import * as u from "fs";
import * as E from "os";
let w = null, t = null, o = null;
const m = r.join(__dirname, "../../.."), f = r.join(m, "venv"), S = E.platform() === "win32" ? r.join(f, "Scripts", "python.exe") : r.join(f, "bin", "python");
function P() {
  w = new _({
    width: 900,
    height: 700,
    webPreferences: {
      preload: r.join(__dirname, "preload.mjs"),
      nodeIntegration: !1,
      contextIsolation: !0
    }
  }), process.env.VITE_DEV_SERVER_URL ? w.loadURL(process.env.VITE_DEV_SERVER_URL) : w.loadFile(r.join(__dirname, "../dist/index.html"));
}
p.whenReady().then(P);
p.on("window-all-closed", () => {
  process.platform !== "darwin" && p.quit();
});
p.on("activate", () => {
  _.getAllWindows().length === 0 && P();
});
p.on("before-quit", () => {
  t && t.kill(), o && o.kill();
});
const h = r.join(p.getPath("userData"), "wordhunt_config.json");
l.handle("get-config", async () => u.existsSync(h) ? JSON.parse(u.readFileSync(h, "utf-8")) : { bundleId: "com.apple.MobileSMS", host: "127.0.0.1", port: 4723, teamId: "", udid: "" });
l.handle("save-config", async (n, s) => (u.writeFileSync(h, JSON.stringify(s, null, 2)), !0));
l.handle("check-env", async () => {
  const n = { python: !1, node: !1, venv: !1, appium: !1 };
  try {
    n.node = !0;
    const s = await new Promise((e) => y("python3 --version", (d) => e(!d)));
    n.python = s, n.venv = u.existsSync(S);
    const i = await new Promise((e) => y("appium -v", (d) => e(!d)));
    n.appium = i;
  } catch {
  }
  return n;
});
l.handle("install-deps", async (n) => new Promise((s, i) => {
  n.sender.send("log", `Starting dependency installation...
`);
  const e = [];
  u.existsSync(S) || e.push(`python3 -m venv "${f}"`);
  const d = E.platform() === "win32" ? `"${f}\\Scripts\\pip"` : `"${f}/bin/pip"`;
  e.push(`${d} install -r "${r.join(m, "requirements.txt")}"`);
  const a = e.join(" && ");
  n.sender.send("log", `Running: ${a}
`);
  const g = y(a, { cwd: m });
  g.stdout?.on("data", (c) => n.sender.send("log", c)), g.stderr?.on("data", (c) => n.sender.send("log", c)), g.on("close", (c) => {
    n.sender.send("log", `Dependency install exited with ${c}
`), s(c === 0);
  });
}));
l.handle("start-appium", async (n) => t ? !0 : new Promise((s) => {
  n.sender.send("log", `Starting Appium...
`), t = j("appium", [], { cwd: m, shell: !0 }), t.stdout?.on("data", (i) => {
    n.sender.send("log", i.toString()), i.toString().includes("Appium REST http interface listener started") && s(!0);
  }), t.stderr?.on("data", (i) => n.sender.send("log", i.toString())), t.on("close", () => {
    t = null;
  });
}));
l.handle("stop-appium", async () => (t && (t.kill(), t = null), !0));
l.handle("start-bot", async (n) => o ? !1 : new Promise((s) => {
  n.sender.send("log", `Starting Bot...
`);
  const i = r.join(m, "Scripts", "main.py"), e = JSON.parse(u.readFileSync(h, "utf-8") || "{}"), d = {
    ...process.env,
    BOT_UDID: e.udid,
    BOT_TEAM_ID: e.teamId,
    BOT_BUNDLE_ID: e.bundleId
  };
  o = j(S, [i], { cwd: m, env: d }), o.stdout?.on("data", (a) => n.sender.send("log", a.toString())), o.stderr?.on("data", (a) => n.sender.send("log", a.toString())), o.on("close", (a) => {
    n.sender.send("log", `Bot exited with code ${a}
`), o = null, s(!0);
  });
}));
l.handle("stop-bot", async () => (o && (o.kill(), o = null), !0));
