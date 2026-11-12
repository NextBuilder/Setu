import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:net";
import { Bridge } from "../server/bridge.mjs";
import { Server } from "../server/mcp.mjs";
import { connect } from "../server/ws.mjs";

const freePort = () =>
  new Promise((resolve) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });

const part = (designator, x, y, w, h, nets) => ({
  designator,
  x,
  y,
  layer: "top",
  bbox: { minX: x - w / 2, minY: y - h / 2, maxX: x + w / 2, maxY: y + h / 2 },
  pads: nets.map((net, i) => ({ net, number: String(i + 1) })),
});

test("design_board runs the whole layout against EasyEDA and reports every step", async (t) => {
  const port = await freePort();
  const bridge = new Bridge(port, port);
  await bridge.start();
  const seen = [];
  let parts = [part("J1", -30, 0, 9, 7, ["VBUS", "GND"]), part("U1", -10, 0, 5, 5, ["VBUS", "3V3", "GND"]), part("C1", 5, 5, 1.6, 0.8, ["3V3", "GND"]), part("R1", 6, 6, 1.6, 0.8, ["3V3", "LED"]), part("D1", 7, 7, 1.6, 0.8, ["LED", "GND"])];
  let board = null;
  const ws = await connect(`ws://127.0.0.1:${port}/eda`);
  ws.on("message", (t) => {
    const m = JSON.parse(t);
    if (m.type !== "execute") return;
    const A = JSON.parse(/\nconst A = (.*);\n/.exec(m.code)[1]);
    let result = { ok: true };
    if (m.code.includes("p.pads = ")) result = { board, parts };
    else if (m.code.includes("pcb_PrimitivePolyline.create('', outline")) {
      board = { minX: A.x_mm, minY: A.y_mm, maxX: A.x_mm + A.width_mm, maxY: A.y_mm + A.height_mm };
      seen.push("outline");
    } else if (m.code.includes("const byRef = new Map")) {
      parts = parts.map((p) => {
        const q = A.placements.find((x) => x.designator === p.designator);
        if (!q) return p;
        const dx = q.x - p.x;
        const dy = q.y - p.y;
        return { ...p, x: q.x, y: q.y, bbox: { minX: p.bbox.minX + dx, maxX: p.bbox.maxX + dx, minY: p.bbox.minY + dy, maxY: p.bbox.maxY + dy } };
      });
      seen.push("place");
    } else if (m.code.includes("autoRouting")) seen.push("route");
    else if (m.code.includes("pcb_Drc.check")) result = { violations: 0, items: [] };
    ws.send(JSON.stringify({ type: "result", id: m.id, result }));
  });
  ws.send(JSON.stringify({ type: "register", windowId: "w" }));
  await new Promise((r) => setTimeout(r, 50));
  t.after(() => {
    ws.close();
    bridge.stop();
  });
  const server = new Server({ bridge });
  const r = await server.call("design_board", { mounting_holes: true });
  const report = JSON.parse(r.content[0].text);
  assert.equal(r.isError, false, r.content[0].text);
  assert.deepEqual(seen, ["outline", "place", "route"]);
  assert.ok(report.steps.every((s) => s.ok));
  assert.equal(report.placement.unplaced.length, 0);
  assert.equal(report.layout_audit.errors, 0, JSON.stringify(report.layout_audit.findings));
  assert.ok(r.content.some((c) => c.text.includes("easyeda-pro-review-agent")));
  const audit = JSON.parse((await server.call("audit_layout", {})).content[0].text);
  assert.equal(audit.components, 5);
});
