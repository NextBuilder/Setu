import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:net";
import { Bridge, SERVICE } from "../server/bridge.mjs";
import { connect } from "../server/ws.mjs";

const freePort = () =>
  new Promise((resolve) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });

async function fakeEda(port, id = "w1") {
  const ws = await connect(`ws://127.0.0.1:${port}/eda`);
  const first = await new Promise((r) => ws.on("message", (t) => r(JSON.parse(t))));
  assert.equal(first.service, SERVICE);
  ws.on("message", (t) => {
    const m = JSON.parse(t);
    if (m.type !== "execute") return;
    if (m.code.includes("boom")) ws.send(JSON.stringify({ type: "error", id: m.id, error: "boom" }));
    else ws.send(JSON.stringify({ type: "result", id: m.id, result: { echo: m.code, big: m.code.includes("big") ? "x".repeat(200000) : undefined } }));
  });
  ws.send(JSON.stringify({ type: "register", windowId: id }));
  await new Promise((r) => setTimeout(r, 50));
  return ws;
}

test("hosts the bridge, runs code in EasyEDA and shares it with a second server", async () => {
  const p = await freePort();
  const bridge = new Bridge(p, p);
  await bridge.start();
  assert.equal(bridge.mode.kind, "host");
  const eda = await fakeEda(p);
  assert.equal((await bridge.execute("return 1", 2000)).echo, "return 1");
  assert.equal((await bridge.execute("big", 2000)).big.length, 200000);
  await assert.rejects(bridge.execute("boom", 2000), /boom/);
  const second = new Bridge(p, p);
  assert.equal((await second.execute("return 2", 2000)).echo, "return 2");
  assert.equal((await second.status()).bridge, "shared");
  assert.deepEqual((await bridge.status()).windows, [{ windowId: "w1", active: true }]);
  eda.close();
  await new Promise((r) => setTimeout(r, 50));
  await assert.rejects(bridge.execute("return 3", 500), /No EasyEDA window/);
  bridge.stop();
});

test("switches windows and explains when none is connected", async () => {
  const p = await freePort();
  const bridge = new Bridge(p, p);
  await assert.rejects(bridge.execute("return 1", 500), /No EasyEDA window/);
  const a = await fakeEda(p, "a");
  const b = await fakeEda(p, "b");
  await bridge.select("b");
  assert.equal((await bridge.status()).windows.find((w) => w.active).windowId, "b");
  await assert.rejects(bridge.select("zzz"), /not connected/);
  a.close();
  b.close();
  bridge.stop();
});
