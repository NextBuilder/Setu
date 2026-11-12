import { test } from "node:test";
import assert from "node:assert/strict";
import { calc, E24, E96, series, tools } from "../server/tools/engineering.mjs";

const close = (a, b, rel) => Math.abs((a - b) / b) <= rel;
const run = (name, args) => JSON.parse(tools.find((t) => t.name === name).run(args).content[0].text);

const MICROSTRIP = [
  [0.36, 0.2104, 0.035, 4.4, 50.922, 3.1763],
  [0.2, 0.2104, 0.035, 4.4, 67.9407, 2.9929],
  [0.18, 0.0994, 0.035, 4.1, 49.2177, 2.9354],
  [1.0, 0.2104, 0.035, 4.4, 26.2973, 3.5497],
  [3.0, 1.53, 0.035, 4.5, 48.3428, 3.3807],
  [0.5, 1.53, 0.035, 4.5, 106.7684, 2.987],
  [0.1, 0.0764, 0.0, 3.91, 65.2917, 2.9109],
  [2.0, 0.5, 0.0, 10.2, 20.5387, 7.8982],
];
const CPWG = [
  [0.3, 0.15, 0.2104, 4.4, 54.7208, 3.0513],
  [0.5, 0.2, 0.2104, 4.4, 42.0979, 3.2572],
  [1.0, 0.15, 1.53, 4.5, 50.0671, 2.8045],
  [0.25, 0.1, 0.0994, 4.1, 42.1222, 3.0853],
];

test("IPC-2221 reference point", () => {
  const w = calc.ipc2221WidthMm(1, 10, 0.035, true);
  assert.ok(close(w, 0.3, 0.03), String(w));
  assert.ok(close(calc.ipc2221CurrentA(w, 0.035, 10, true), 1, 1e-9));
  assert.ok(calc.ipc2221WidthMm(1, 10, 0.035, false) > w * 2.5);
});

test("elliptic K known values", () => {
  assert.ok(close(calc.ellipK(0), Math.PI / 2, 1e-12));
  assert.ok(close(calc.ellipK(Math.SQRT1_2), 1.854074677301372, 1e-12));
});

test("microstrip and CPWG match scikit-rf", () => {
  for (const [w, h, t, er, z, e] of MICROSTRIP) {
    const [zz, ee] = calc.microstrip(w, h, t, er);
    assert.ok(close(zz, z, 0.002) && close(ee, e, 0.002), `${w} ${h}: ${zz} ${ee}`);
  }
  for (const [w, s, h, er, z, e] of CPWG) {
    const [zz, ee] = calc.cpwg(w, s, h, er);
    assert.ok(close(zz, z, 0.005) && close(ee, e, 0.005), `${w} ${s}: ${zz} ${ee}`);
  }
});

test("Wheeler stripline converges to the exact thin strip", () => {
  for (const [w, b] of [[0.1, 0.5], [0.2, 0.5], [0.3, 1.0], [1.0, 1.2]]) assert.ok(close(calc.stripline(w, b, 1e-9, 4.3), calc.striplineExactThin(w, b, 4.3), 0.006));
  assert.ok(calc.stripline(0.2, 0.5, 0.035, 4.3) < calc.stripline(0.2, 0.5, 1e-9, 4.3));
  assert.ok(close(calc.striplineAsym(0.2, 0.2325, 0.2325, 0.035, 4.3), calc.stripline(0.2, 0.5, 0.035, 4.3), 1e-9));
});

test("width solver inverts the model", () => {
  const w = calc.solveDecreasing(50, 0.01, 20, (w) => calc.microstrip(w, 0.2104, 0.035, 4.4)[0]);
  assert.ok(close(calc.microstrip(w, 0.2104, 0.035, 4.4)[0], 50, 1e-6));
  assert.ok(w > 0.3 && w < 0.45);
});

test("E-series tables", () => {
  assert.equal(E96.length, 96);
  assert.equal(E24.length, 24);
  assert.deepEqual(series("E12"), [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2]);
  assert.equal(run("calc_passive", { kind: "led", supply_v: 5, vf_v: 2.85, if_ma: 5 }).result.resistor_ohm, 430);
});

test("divider finds the exact feedback pair", () => {
  const v = run("calc_divider", { mode: "feedback", vref: 0.6, vout: 3.3, series: "E96", fixed_rbot_ohm: 10000 });
  assert.equal(v.best[0].r_top_ohm, 45300);
  assert.ok(v.best[0].error_pct < 0.6);
});

test("stackup presets resolve EasyEDA layer names", () => {
  const top = run("calc_impedance", { structure: "microstrip", stackup: "jlc04161h-7628", layer: "top", width_mm: 0.36 });
  assert.deepEqual([top.geometry.height_mm, top.geometry.thickness_mm, top.geometry.er], [0.2104, 0.035, 4.4]);
  const six = run("calc_impedance", { structure: "stripline", stackup: "JLC06161H-NOREQ", layer: "inner2", width_mm: 0.15 });
  assert.deepEqual([six.geometry.height_mm, six.geometry.height2_mm], [0.55, 0.1164]);
  assert.ok(tools.find((t) => t.name === "calc_impedance").run({ structure: "microstrip", stackup: "JLC04161H-7628", layer: "inner1", width_mm: 0.2 }).isError);
});

test("I2C pull-ups follow UM10204", () => {
  const v = run("calc_passive", { kind: "i2c", supply_v: 3.3, bus_pf: 200, i2c_mode: "fast" }).result;
  assert.ok(close(v.r_min_ohm, 967, 0.002) && close(v.r_max_ohm, 1770, 0.002));
  assert.ok(v.recommended_ohm >= 967 && v.recommended_ohm <= 1770);
});

test("buck and regulator calculators answer", () => {
  assert.ok(run("calc_buck", { vin_min: 7, vin_max: 12, vout: 3.3, iout_a: 2, fsw_hz: 500000 }).inductor.standard_uh > 0);
  assert.equal(run("calc_regulator_thermal", { vin: 5, vout: 3.3, iout_a: 0.5, theta_ja_c_per_w: 60 }).verdict, "ok");
});
