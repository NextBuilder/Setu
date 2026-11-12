import { createServer, request } from "node:http";
import { randomUUID } from "node:crypto";
import { upgrade } from "./ws.mjs";

export const SERVICE = "easyeda-bridge";
export const FIRST_PORT = 49620;
export const LAST_PORT = 49629;

const NO_WINDOW = "No EasyEDA window is connected. Open EasyEDA Pro with the API gateway extension running.";

export class Hub {
  constructor() {
    this.windows = new Map();
    this.active = null;
    this.pending = new Map();
  }

  list() {
    return [...this.windows.keys()].map((id) => ({ windowId: id, active: id === this.active }));
  }

  select(id) {
    if (!this.windows.has(id)) throw new Error(`EasyEDA window "${id}" is not connected`);
    this.active = id;
  }

  register(id, ws) {
    this.windows.delete(id);
    this.windows.set(id, ws);
    if (!this.active) this.active = id;
  }

  unregister(id, ws) {
    if (this.windows.get(id) !== ws) return;
    this.windows.delete(id);
    if (this.active === id) this.active = this.windows.keys().next().value ?? null;
    for (const [key, p] of this.pending) {
      if (p.window === id) {
        this.pending.delete(key);
        p.reject(new Error(`EasyEDA window "${id}" disconnected`));
      }
    }
  }

  resolve(id, error, value) {
    const p = this.pending.get(id);
    if (!p) return;
    this.pending.delete(id);
    clearTimeout(p.timer);
    if (error) p.reject(new Error(error));
    else p.resolve(value);
  }

  execute(code, window, waitMs) {
    const target = window || this.active;
    if (!target) return Promise.reject(new Error(NO_WINDOW));
    const ws = this.windows.get(target);
    if (!ws) return Promise.reject(new Error(`EasyEDA window "${target}" is not connected`));
    const id = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`EasyEDA did not answer within ${Math.round(waitMs / 1000)} s`));
      }, waitMs);
      this.pending.set(id, { window: target, resolve, reject, timer });
      ws.send(JSON.stringify({ type: "execute", id, code, windowId: target, timestamp: Date.now() }));
    });
  }
}

function handshake(kind) {
  return JSON.stringify({ type: "handshake", service: SERVICE, clientType: kind, timestamp: Date.now() });
}

function body(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}

function reply(res, status, value) {
  const text = JSON.stringify(value);
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(text);
}

function edaSession(ws, hub) {
  let window = null;
  ws.send(handshake("eda"));
  ws.on("message", (text) => {
    let msg;
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }
    if (msg.type === "register" && typeof msg.windowId === "string") {
      window = msg.windowId;
      hub.register(window, ws);
    } else if (msg.type === "ping") ws.send(JSON.stringify({ type: "pong", id: msg.id, timestamp: Date.now() }));
    else if (msg.type === "result" && msg.id) hub.resolve(msg.id, null, msg.result ?? null);
    else if (msg.type === "error" && msg.id) hub.resolve(msg.id, typeof msg.error === "string" ? msg.error : JSON.stringify(msg.error ?? "Unknown EasyEDA error"));
  });
  ws.on("close", () => window && hub.unregister(window, ws));
}

function agentSession(ws, hub) {
  ws.send(handshake("agent"));
  ws.on("message", async (text) => {
    let msg;
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }
    if (msg.type === "ping") return ws.send(JSON.stringify({ type: "pong", id: msg.id, timestamp: Date.now() }));
    if (msg.type !== "execute") return;
    try {
      const result = await hub.execute(String(msg.code ?? ""), msg.windowId, 120000);
      ws.send(JSON.stringify({ type: "result", id: msg.id, result, timestamp: Date.now() }));
    } catch (e) {
      ws.send(JSON.stringify({ type: "error", id: msg.id, error: e.message, timestamp: Date.now() }));
    }
  });
}

export function createBridgeServer(hub) {
  const server = createServer(async (req, res) => {
    const path = new URL(req.url, "http://x").pathname;
    if (req.method === "OPTIONS") {
      res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET, POST" });
      return res.end();
    }
    if (req.method === "GET" && path === "/health") {
      const list = hub.list();
      return reply(res, 200, {
        service: SERVICE,
        status: "ok",
        server: "setu",
        edaConnected: list.length > 0,
        edaWindowCount: list.length,
        activeWindowId: hub.active,
        pendingRequests: hub.pending.size,
        timestamp: Date.now(),
      });
    }
    if (req.method === "GET" && path === "/eda-windows") {
      return reply(res, 200, { windows: hub.list().map((w) => ({ ...w, connected: true })), activeWindowId: hub.active, count: hub.windows.size });
    }
    if (req.method === "POST" && path === "/eda-windows/select") {
      const b = await body(req);
      try {
        hub.select(String(b.windowId ?? ""));
        return reply(res, 200, { success: true, activeWindowId: b.windowId });
      } catch (e) {
        return reply(res, 404, { error: e.message });
      }
    }
    if (req.method === "POST" && path === "/execute") {
      const b = await body(req);
      if (typeof b.code !== "string") return reply(res, 400, { error: 'Missing "code" field (string)' });
      const wait = Math.min(Math.max(Number(b.timeoutMs) || 120000, 1000), 900000);
      try {
        return reply(res, 200, { success: true, result: await hub.execute(b.code, b.windowId, wait) });
      } catch (e) {
        return reply(res, 500, { success: false, error: e.message });
      }
    }
    reply(res, 404, { error: "Not found" });
  });
  server.on("upgrade", (req, sock, head) => {
    const path = new URL(req.url, "http://x").pathname;
    const ws = upgrade(req, sock, head);
    if (!ws) return;
    if (path === "/eda") edaSession(ws, hub);
    else agentSession(ws, hub);
  });
  server.requestTimeout = 0;
  server.headersTimeout = 0;
  return server;
}

export function httpJson(method, port, path, payload, timeoutMs) {
  return new Promise((resolve, reject) => {
    const data = payload === undefined ? null : Buffer.from(JSON.stringify(payload));
    const req = request(
      { host: "127.0.0.1", port, path, method, headers: data ? { "Content-Type": "application/json", "Content-Length": data.length } : {} },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString("utf8")) });
          } catch {
            resolve({ status: res.statusCode, body: null });
          }
        });
      },
    );
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`no answer within ${Math.round(timeoutMs / 1000)} s`)));
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

function listen(server, port) {
  return new Promise((resolve) => {
    const fail = (e) => {
      server.off("listening", ok);
      resolve(e);
    };
    const ok = () => {
      server.off("error", fail);
      resolve(null);
    };
    server.once("error", fail);
    server.once("listening", ok);
    server.listen(port, "127.0.0.1");
  });
}

export class Bridge {
  constructor(first = FIRST_PORT, last = LAST_PORT) {
    this.hub = new Hub();
    this.mode = { kind: "idle" };
    this.ports = [first, last];
    this.server = null;
    this.starting = null;
  }

  async probe(port) {
    try {
      const r = await httpJson("GET", port, "/health", undefined, 800);
      return r.body?.service === SERVICE;
    } catch {
      return false;
    }
  }

  start() {
    if (!this.starting) this.starting = this.doStart().finally(() => (this.starting = null));
    return this.starting;
  }

  async doStart() {
    if (this.mode.kind === "host") return;
    if (this.mode.kind === "client" && (await this.probe(this.mode.port))) return;
    const [first, last] = this.ports;
    for (let p = first; p <= last; p++) {
      if (await this.probe(p)) {
        this.mode = { kind: "client", port: p };
        return;
      }
    }
    let lastError = null;
    for (let p = first; p <= last; p++) {
      const server = createBridgeServer(this.hub);
      const e = await listen(server, p);
      if (!e) {
        server.unref();
        this.server = server;
        this.mode = { kind: "host", port: p };
        return;
      }
      lastError = e;
    }
    if (lastError?.code === "EACCES")
      throw new Error(
        `Windows has reserved ports ${first}-${last}, which EasyEDA's gateway extension needs. Check with \`netsh interface ipv4 show excludedportrange protocol=tcp\`; restarting the WinNAT service (\`net stop winnat\` then \`net start winnat\` in an administrator terminal) usually frees them`,
      );
    throw new Error(`Ports ${first}-${last} are all in use by other programs (${lastError?.message ?? "unknown"})`);
  }

  async status() {
    try {
      await this.start();
    } catch (e) {
      return { bridge: "not running", error: e.message };
    }
    if (this.mode.kind === "host") return { bridge: "setu", port: this.mode.port, windows: this.hub.list() };
    try {
      const r = await httpJson("GET", this.mode.port, "/eda-windows", undefined, 3000);
      return { bridge: "shared", port: this.mode.port, windows: r.body?.windows ?? [] };
    } catch (e) {
      return { bridge: "shared", port: this.mode.port, error: e.message };
    }
  }

  async select(id) {
    await this.start();
    if (this.mode.kind !== "client") return this.hub.select(id);
    const r = await httpJson("POST", this.mode.port, "/eda-windows/select", { windowId: id }, 5000);
    if (r.status !== 200) throw new Error(`EasyEDA window "${id}" is not connected`);
  }

  async execute(code, waitMs = 60000) {
    await this.start();
    if (this.mode.kind !== "client") return this.hub.execute(code, null, waitMs);
    const r = await httpJson("POST", this.mode.port, "/execute", { code, timeoutMs: waitMs }, waitMs + 5000);
    if (r.body?.success === true) return r.body.result;
    throw new Error(r.body?.error ?? "EasyEDA bridge error");
  }

  stop() {
    this.server?.close();
    this.server?.closeAllConnections?.();
  }
}
