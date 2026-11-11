import { spawn } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";

const VERSION = "0.1.0";
const REPO = "https://github.com/NextBuilder/Setu";
const win = process.platform === "win32";
const exe = win ? "setu.exe" : "setu";
const home = homedir();

function target() {
  const arch = process.arch === "arm64" ? "arm64" : "x64";
  if (win) return `setu-windows-${arch}.exe`;
  if (process.platform === "darwin") return `setu-macos-${arch}`;
  return `setu-linux-${arch}`;
}

function installDir() {
  if (win) return join(process.env.LOCALAPPDATA || join(home, "AppData", "Local"), "SETU", VERSION);
  return join(process.env.XDG_DATA_HOME || join(home, ".local", "share"), "setu", VERSION);
}

async function ensureBinary() {
  if (process.env.SETU_BIN) return process.env.SETU_BIN;
  const dir = installDir();
  const path = join(dir, exe);
  if (existsSync(path)) return path;
  const url = `${REPO}/releases/download/v$0.1.0/${target()}`;
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`download ${url} failed: HTTP ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length < 100000) throw new Error(`download ${url} returned only ${bytes.length} bytes`);
  mkdirSync(dir, { recursive: true });
  const part = `${path}.part`;
  writeFileSync(part, bytes);
  if (!win) chmodSync(part, 0o755);
  renameSync(part, path);
  return path;
}

function helper(problem) {
  const help =
    `SETU's server could not start: ${problem}. ` +
    `Download ${target()} for version $0.1.0 from ${REPO}/releases, save it anywhere, ` +
    `set the environment variable SETU_BIN to its full path, and restart Claude. ` +
    `Then open EasyEDA Pro with the Run API Gateway extension enabled.`;
  const send = (msg) => process.stdout.write(JSON.stringify(msg) + "\n");
  createInterface({ input: process.stdin }).on("line", (line) => {
    let req;
    try { req = JSON.parse(line); } catch { return; }
    if (req.id === undefined) return;
    const reply = (result) => send({ jsonrpc: "2.0", id: req.id, result });
    if (req.method === "initialize") {
      reply({ protocolVersion: req.params?.protocolVersion ?? "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "setu-setup", version: VERSION } });
    } else if (req.method === "tools/list") {
      reply({ tools: [{ name: "setu_setup", title: "SETU Setup", description: "Explains how to finish installing SETU's server on this computer.", inputSchema: { type: "object", properties: {} }, annotations: { readOnlyHint: true, openWorldHint: false } }] });
    } else if (req.method === "tools/call") {
      reply({ content: [{ type: "text", text: help }], isError: true });
    } else if (req.method === "ping") {
      reply({});
    } else {
      send({ jsonrpc: "2.0", id: req.id, error: { code: -32601, message: "Method not found" } });
    }
  });
}

try {
  const binary = await ensureBinary();
  const child = spawn(binary, process.argv.slice(2), { stdio: "inherit" });
  for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
  child.on("error", (e) => helper(e.message));
  child.on("exit", (code, signal) => (signal ? process.kill(process.pid, signal) : process.exit(code ?? 0)));
} catch (e) {
  helper(e.message);
}
