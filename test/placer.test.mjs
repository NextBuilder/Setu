import { test } from "node:test";
import assert from "node:assert/strict";
import { place, audit, classify, netKind } from "../server/tools/placer.mjs";

const part = (designator, x, y, w, h, nets, extra = {}) => ({
  designator,
  x,
  y,
  layer: "top",
  bbox: { minX: x - w / 2, minY: y - h / 2, maxX: x + w / 2, maxY: y + h / 2 },
  pads: nets.map((net, i) => ({ net, number: String(i + 1) })),
  ...extra,
});

const parts = () => [
  part("J1", -40, 10, 9, 7, ["VBUS", "GND", "D+", "D-"]),
  part("U1", -10, 10, 18, 25, ["3V3", "GND", "D+", "D-", "SDA", "SCL", "EN"], { footprint: "ESP32-S3-WROOM-1" }),
  part("U2", -25, 10, 3, 3, ["VBUS", "3V3", "GND"]),
  part("C1", 30, 30, 1.6, 0.8, ["3V3", "GND"]),
  part("C2", 31, 31, 1.6, 0.8, ["VBUS", "GND"]),
  part("R1", 32, 32, 1.6, 0.8, ["SDA", "3V3"]),
  part("R2", 33, 33, 1.6, 0.8, ["SCL", "3V3"]),
  part("R3", 34, 34, 1.6, 0.8, ["EN", "3V3"]),
  part("C3", 35, 35, 1.6, 0.8, ["EN", "GND"]),
  part("J2", 20, 10, 10, 2.5, ["3V3", "SDA", "SCL", "GND"]),
];

const board = { minX: 0, minY: 0, maxX: 50, maxY: 40 };

const rect = (p, plan) => {
  const at = plan.placements.find((q) => q.designator === p.designator);
  const dx = at.x - p.x;
  const dy = at.y - p.y;
  return { ...p.bbox, minX: p.bbox.minX + dx, maxX: p.bbox.maxX + dx, minY: p.bbox.minY + dy, maxY: p.bbox.maxY + dy };
};

test("classifies parts and nets", () => {
  assert.equal(classify({ designator: "U1", footprint: "ESP32-S3-WROOM-1" }), "module");
  assert.equal(classify({ designator: "J3" }), "connector");
  assert.equal(classify({ designator: "C12" }), "cap");
  assert.equal(classify({ designator: "Y1" }), "crystal");
  assert.equal(netKind("GND"), "ground");
  assert.equal(netKind("+3V3"), "power");
  assert.equal(netKind("VBUS"), "power");
  assert.equal(netKind("SDA"), "signal");
});

test("places every part on the board without overlaps", () => {
  const src = parts();
  const plan = place(src, { board });
  assert.equal(plan.unplaced.length, 0);
  assert.equal(plan.placements.length, src.length);
  const rects = src.map((p) => rect(p, plan));
  for (const r of rects) assert.ok(r.minX >= 0 && r.minY >= 0 && r.maxX <= 50 && r.maxY <= 40, JSON.stringify(r));
  for (let i = 0; i < rects.length; i++)
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i];
      const b = rects[j];
      assert.ok(a.maxX <= b.minX || b.maxX <= a.minX || a.maxY <= b.minY || b.maxY <= a.minY, `${src[i].designator} overlaps ${src[j].designator}`);
    }
});

test("connectors go to an edge, the module to the top edge, decoupling next to its IC", () => {
  const src = parts();
  const plan = place(src, { board });
  const at = (d) => plan.placements.find((p) => p.designator === d);
  assert.ok(at("J1").edge && at("J2").edge);
  assert.equal(at("U1").edge, "top");
  assert.equal(at("C1").near, "U1");
  const moved = src.map((p) => {
    const q = at(p.designator);
    return { ...p, x: q.x, y: q.y, bbox: rect(p, plan) };
  });
  const report = audit(moved, board);
  assert.equal(report.errors, 0, JSON.stringify(report.findings));
  assert.ok(report.score >= 80, JSON.stringify(report.findings));
});

test("keeps locked parts and suggests a board when there is none", () => {
  const src = parts();
  src[3].locked = true;
  const plan = place(src);
  assert.ok(plan.board.suggested);
  assert.ok(plan.fixed.includes("C1"));
  assert.ok(!plan.placements.some((p) => p.designator === "C1"));
});

test("audit finds overlaps, off-board parts and far decoupling", () => {
  const report = audit(parts(), board);
  const rules = new Set(report.findings.map((f) => f.rule));
  assert.ok(rules.has("off_board"));
  assert.ok(report.errors > 0);
  const lone = audit([part("U1", 10, 10, 5, 5, ["3V3", "GND"]), part("C1", 40, 30, 1.6, 0.8, ["3V3", "GND"]), part("C2", 40, 30.2, 1.6, 0.8, ["3V3", "GND"])], board);
  assert.ok(lone.findings.some((f) => f.rule === "decoupling"));
  assert.ok(lone.findings.some((f) => f.rule === "overlap"));
});

test("audit flags a PCB without nets and judges overlap by pads when it has them", () => {
  const bare = audit([part("U1", 10, 10, 5, 5, []), part("C1", 20, 20, 1.6, 0.8, [])], board);
  assert.ok(bare.findings.some((f) => f.rule === "no_nets"));
  const a = { ...part("SW1", 10, 10, 8, 10, ["A", "B"]), copper: { minX: 7, maxX: 13, minY: 7, maxY: 9 } };
  const b = { ...part("C3", 13.5, 10, 2, 3.4, ["A", "GND"]), copper: { minX: 13, maxX: 14, minY: 9.5, maxY: 10.5 } };
  const r = audit([a, b], board);
  assert.ok(!r.findings.some((f) => f.rule === "overlap"));
  assert.ok(r.findings.some((f) => f.rule === "body_overlap"));
});
