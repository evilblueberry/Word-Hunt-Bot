import { app as c, BrowserWindow as P, ipcMain as l } from "electron";
import * as i from "path";
import { exec as S, spawn as j } from "child_process";
import * as u from "fs";
import * as b from "os";
import { fileURLToPath as x } from "url";
const I = x(import.meta.url), v = i.dirname(I);
let y = null, t = null, o = null;
const m = i.join(v, "../../.."), f = i.join(m, "venv"), _ = b.platform() === "win32" ? i.join(f, "Scripts", "python.exe") : i.join(f, "bin", "python");
function E() {
  y = new P({
    width: 900,
    height: 700,
    webPreferences: {
      preload: i.join(v, "preload.mjs"),
      nodeIntegration: !1,
      contextIsolation: !0
    }
  }), process.env.VITE_DEV_SERVER_URL ? y.loadURL(process.env.VITE_DEV_SERVER_URL) : y.loadFile(i.join(v, "../dist/index.html"));
}
c.whenReady().then(E);
c.on("window-all-closed", () => {
  process.platform !== "darwin" && c.quit();
});
c.on("activate", () => {
  P.getAllWindows().length === 0 && E();
});
c.on("before-quit", () => {
  t && t.kill(), o && o.kill();
});
const g = i.join(c.getPath("userData"), "wordhunt_config.json");
l.handle("get-config", async () => u.existsSync(g) ? JSON.parse(u.readFileSync(g, "utf-8")) : { bundleId: "com.apple.MobileSMS", host: "127.0.0.1", port: 4723, teamId: "", udid: "" });
l.handle("save-config", async (n, s) => (u.writeFileSync(g, JSON.stringify(s, null, 2)), !0));
const h = () => ({
  ...process.env,
  PATH: `${process.env.PATH || ""}:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/Users/${b.userInfo().username}/.npm-global/bin`
});
l.handle("check-env", async () => {
  const n = { python: !1, node: !1, venv: !1, appium: !1 };
  try {
    n.node = !0;
    const s = await new Promise((e) => S("python3 --version", { env: h() }, (d) => e(!d)));
    n.python = s, n.venv = u.existsSync(_);
    const r = await new Promise((e) => S("appium -v", { env: h() }, (d) => e(!d)));
    n.appium = r;
  } catch {
  }
  return n;
});
l.handle("install-deps", async (n) => new Promise((s, r) => {
  n.sender.send("log", `Starting dependency installation...
`);
  const e = [];
  u.existsSync(_) || e.push(`python3 -m venv "${f}"`);
  const d = b.platform() === "win32" ? `"${f}\\Scripts\\pip"` : `"${f}/bin/pip"`;
  e.push(`${d} install -r "${i.join(m, "requirements.txt")}"`), e.push("npm install -g appium"), e.push("appium driver install xcuitest || true");
  const a = e.join(" && ");
  n.sender.send("log", `Running: ${a}
`);
  const w = S(a, { cwd: m, env: h() });
  w.stdout?.on("data", (p) => n.sender.send("log", p)), w.stderr?.on("data", (p) => n.sender.send("log", p)), w.on("close", (p) => {
    n.sender.send("log", `Dependency install exited with ${p}
`), s(p === 0);
  });
}));
l.handle("start-appium", async (n) => t ? !0 : new Promise((s) => {
  n.sender.send("log", `Starting Appium...
`), t = j("appium", [], { cwd: m, shell: !0, env: h() }), t.stdout?.on("data", (r) => {
    n.sender.send("log", r.toString()), r.toString().includes("Appium REST http interface listener started") && s(!0);
  }), t.stderr?.on("data", (r) => n.sender.send("log", r.toString())), t.on("close", () => {
    t = null;
  });
}));
l.handle("stop-appium", async () => (t && (t.kill(), t = null), !0));
l.handle("start-bot", async (n) => o ? !1 : new Promise((s) => {
  n.sender.send("log", `Starting Bot...
`);
  const r = i.join(m, "Scripts", "main.py"), e = JSON.parse(u.readFileSync(g, "utf-8") || "{}"), d = {
    ...process.env,
    ...h(),
    BOT_UDID: e.udid,
    BOT_TEAM_ID: e.teamId,
    BOT_BUNDLE_ID: e.bundleId
  };
  o = j(_, [r], { cwd: m, env: d }), o.stdout?.on("data", (a) => n.sender.send("log", a.toString())), o.stderr?.on("data", (a) => n.sender.send("log", a.toString())), o.on("close", (a) => {
    n.sender.send("log", `Bot exited with code ${a}
`), o = null, s(!0);
  });
}));
l.handle("stop-bot", async () => (o && (o.kill(), o = null), !0));
