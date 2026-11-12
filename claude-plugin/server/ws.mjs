import { createHash, randomBytes } from "node:crypto";
import { request } from "node:http";

const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

export function acceptKey(key) {
  return createHash("sha1").update(key + GUID).digest("base64");
}

export function frame(opcode, payload, mask = false) {
  const data = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  const len = data.length;
  const head = len < 126 ? 2 : len < 65536 ? 4 : 10;
  const out = Buffer.alloc(head + (mask ? 4 : 0) + len);
  out[0] = 0x80 | opcode;
  if (len < 126) out[1] = len;
  else if (len < 65536) {
    out[1] = 126;
    out.writeUInt16BE(len, 2);
  } else {
    out[1] = 127;
    out.writeBigUInt64BE(BigInt(len), 2);
  }
  if (!mask) {
    data.copy(out, head);
    return out;
  }
  out[1] |= 0x80;
  const key = randomBytes(4);
  key.copy(out, head);
  for (let i = 0; i < len; i++) out[head + 4 + i] = data[i] ^ key[i & 3];
  return out;
}

export class Socket {
  constructor(sock, { mask = false } = {}) {
    this.sock = sock;
    this.mask = mask;
    this.buf = Buffer.alloc(0);
    this.parts = [];
    this.open = true;
    this.handlers = { message: [], close: [] };
    this.queue = [];
    sock.setNoDelay?.(true);
    sock.on("data", (d) => this.feed(d));
    sock.on("close", () => this.closed());
    sock.on("error", () => this.closed());
  }

  on(event, fn) {
    this.handlers[event].push(fn);
    if (event === "message" && this.queue.length) {
      const q = this.queue;
      this.queue = [];
      for (const t of q) fn(t);
    }
    return this;
  }

  send(text) {
    if (this.open) this.sock.write(frame(1, text, this.mask));
  }

  close() {
    if (!this.open) return;
    try {
      this.sock.write(frame(8, Buffer.alloc(0), this.mask));
    } catch {}
    this.sock.end();
    this.closed();
  }

  closed() {
    if (!this.open) return;
    this.open = false;
    for (const fn of this.handlers.close) fn();
  }

  feed(chunk) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
    for (;;) {
      if (this.buf.length < 2) return;
      const fin = (this.buf[0] & 0x80) !== 0;
      const opcode = this.buf[0] & 0x0f;
      const masked = (this.buf[1] & 0x80) !== 0;
      let len = this.buf[1] & 0x7f;
      let off = 2;
      if (len === 126) {
        if (this.buf.length < 4) return;
        len = this.buf.readUInt16BE(2);
        off = 4;
      } else if (len === 127) {
        if (this.buf.length < 10) return;
        len = Number(this.buf.readBigUInt64BE(2));
        off = 10;
      }
      const keyOff = off;
      if (masked) off += 4;
      if (this.buf.length < off + len) return;
      let data = this.buf.subarray(off, off + len);
      if (masked) {
        const key = this.buf.subarray(keyOff, keyOff + 4);
        data = Buffer.from(data);
        for (let i = 0; i < data.length; i++) data[i] ^= key[i & 3];
      }
      this.buf = this.buf.subarray(off + len);
      if (opcode === 8) return this.close();
      if (opcode === 9) {
        this.sock.write(frame(10, data, this.mask));
        continue;
      }
      if (opcode === 10) continue;
      if (opcode === 1 || opcode === 2 || opcode === 0) {
        this.parts.push(Buffer.from(data));
        if (fin) {
          const text = Buffer.concat(this.parts).toString("utf8");
          this.parts = [];
          if (!this.handlers.message.length) this.queue.push(text);
          for (const fn of this.handlers.message) fn(text);
        }
      }
    }
  }
}

export function upgrade(req, sock, head) {
  const key = req.headers["sec-websocket-key"];
  if (!key || String(req.headers.upgrade).toLowerCase() !== "websocket") {
    sock.end("HTTP/1.1 400 Bad Request\r\n\r\n");
    return null;
  }
  sock.write(
    "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n" +
      `Sec-WebSocket-Accept: ${acceptKey(key)}\r\n\r\n`,
  );
  const ws = new Socket(sock);
  if (head && head.length) ws.feed(head);
  return ws;
}

export function connect(url) {
  const u = new URL(url);
  const key = randomBytes(16).toString("base64");
  return new Promise((resolve, reject) => {
    const req = request({
      host: u.hostname,
      port: u.port,
      path: u.pathname,
      headers: { Connection: "Upgrade", Upgrade: "websocket", "Sec-WebSocket-Key": key, "Sec-WebSocket-Version": "13" },
    });
    req.on("upgrade", (res, sock, head) => {
      if (res.headers["sec-websocket-accept"] !== acceptKey(key)) return reject(new Error("bad WebSocket handshake"));
      const ws = new Socket(sock, { mask: true });
      if (head && head.length) ws.feed(head);
      resolve(ws);
    });
    req.on("response", (res) => reject(new Error(`HTTP ${res.statusCode}`)));
    req.on("error", reject);
    req.end();
  });
}
