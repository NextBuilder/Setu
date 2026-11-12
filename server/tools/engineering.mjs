import { json, fail, invalid } from "./result.mjs";

const PI = Math.PI;
export const ETA0 = 376.730313668;
const C_MM_PER_NS = 299.792458;
const RHO_CU = 1.724e-8;
const ALPHA_CU = 0.00393;
const MM_PER_MIL = 0.0254;
const MM_PER_OZ = 0.035;

export const calc = {
  ipc2221K: (external) => (external ? 0.048 : 0.024),
  ipc2221AreaMil2: (i, rise, ext) => (i / (calc.ipc2221K(ext) * rise ** 0.44)) ** (1 / 0.725),
  ipc2221WidthMm: (i, rise, t, ext) => (calc.ipc2221AreaMil2(i, rise, ext) / (t / MM_PER_MIL)) * MM_PER_MIL,
  ipc2221CurrentA: (w, t, rise, ext) => calc.ipc2221K(ext) * rise ** 0.44 * ((w / MM_PER_MIL) * (t / MM_PER_MIL)) ** 0.725,
  copperResistance: (len, area, temp) => (RHO_CU * (1 + ALPHA_CU * (temp - 20)) * (len * 1e-3)) / (area * 1e-6),
  agm(a, b) {
    for (let i = 0; i < 64; i++) {
      const an = 0.5 * (a + b);
      const bn = Math.sqrt(a * b);
      if (Math.abs(an - bn) <= 1e-15 * an) return an;
      a = an;
      b = bn;
    }
    return 0.5 * (a + b);
  },
  ellipK: (k) => PI / (2 * calc.agm(1, Math.sqrt(1 - k * k))),
  kRatio: (k) => calc.ellipK(k) / calc.ellipK(Math.sqrt(1 - k * k)),
  microstrip(w, h, t, er) {
    const u = w / h;
    let u1 = u;
    let ur = u;
    if (t > 0) {
      const tn = t / h;
      const coth = 1 / Math.tanh(Math.sqrt(6.517 * u));
      const du1 = (tn / PI) * Math.log(1 + (4 * Math.E) / (tn * coth * coth));
      const dur = 0.5 * (1 + 1 / Math.cosh(Math.sqrt(er - 1))) * du1;
      u1 = u + du1;
      ur = u + dur;
    }
    const e = hjEeff(ur, er);
    return [hjZ01(ur) / Math.sqrt(e), e * (hjZ01(u1) / hjZ01(ur)) ** 2];
  },
  striplineExactThin(w, b, er) {
    const k = 1 / Math.cosh((PI * w) / (2 * b));
    return (ETA0 / (4 * Math.sqrt(er))) * calc.kRatio(k);
  },
  stripline(w, b, t, er) {
    const x = t / b;
    let wp = w / b;
    if (x > 0) {
      const m = 2 / (1 + ((2 / 3) * x) / (1 - x));
      const dw = (x / (PI * (1 - x))) * (1 - 0.5 * Math.log((x / (2 - x)) ** 2 + ((0.0796 * x) / (w / b + 1.1 * x)) ** m));
      wp = w / (b - t) + dw;
    }
    const q = 8 / (PI * wp);
    return (ETA0 / (4 * PI * Math.sqrt(er))) * Math.log(1 + (4 / (PI * wp)) * (q + Math.sqrt(q * q + 6.27)));
  },
  striplineAsym(w, h1, h2, t, er) {
    const z1 = calc.stripline(w, 2 * h1 + t, t, er);
    const z2 = calc.stripline(w, 2 * h2 + t, t, er);
    return (2 * z1 * z2) / (z1 + z2);
  },
  cpwg(w, s, h, er) {
    const k = w / (w + 2 * s);
    const k3 = Math.tanh((PI * w) / (4 * h)) / Math.tanh((PI * (w + 2 * s)) / (4 * h));
    const a = 1 / calc.kRatio(k);
    const b = calc.kRatio(k3);
    const eeff = (1 + er * a * b) / (1 + a * b);
    return [(60 * PI) / Math.sqrt(eeff) / (calc.kRatio(k) + calc.kRatio(k3)), eeff];
  },
  diffMicrostrip: (z0, s, h) => 2 * z0 * (1 - 0.48 * Math.exp((-0.96 * s) / h)),
  diffStripline: (z0, s, b) => 2 * z0 * (1 - 0.347 * Math.exp((-2.9 * s) / b)),
  delayPsPerMm: (eeff) => (Math.sqrt(eeff) / C_MM_PER_NS) * 1000,
  solveDecreasing(target, lo, hi, f) {
    let a = lo;
    let b = hi;
    if (f(a) < target || f(b) > target) return null;
    for (let i = 0; i < 200 && b - a >= 1e-7; i++) {
      const m = 0.5 * (a + b);
      if (f(m) > target) a = m;
      else b = m;
    }
    return 0.5 * (a + b);
  },
  viaBarrelArea: (d, p) => PI * p * (d - p),
  viaInductanceNh: (len, d) => 0.2 * len * (Math.log((4 * len) / d) + 1),
};

function hjZ01(u) {
  const f = 6 + (2 * PI - 6) * Math.exp(-((30.666 / u) ** 0.7528));
  return (ETA0 / (2 * PI)) * Math.log(f / u + Math.sqrt(1 + 4 / (u * u)));
}

function hjEeff(u, er) {
  const a = 1 + Math.log((u ** 4 + (u / 52) ** 2) / (u ** 4 + 0.432)) / 49 + Math.log(1 + (u / 18.1) ** 3) / 18.7;
  const b = 0.564 * ((er - 0.9) / (er + 3)) ** 0.053;
  return (er + 1) / 2 + ((er - 1) / 2) * (1 + 10 / u) ** (-a * b);
}

export const E24 = [1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1];
export const E96 = [
  1.0, 1.02, 1.05, 1.07, 1.1, 1.13, 1.15, 1.18, 1.21, 1.24, 1.27, 1.3, 1.33, 1.37, 1.4, 1.43, 1.47, 1.5, 1.54, 1.58, 1.62, 1.65, 1.69, 1.74, 1.78, 1.82, 1.87,
  1.91, 1.96, 2.0, 2.05, 2.1, 2.15, 2.21, 2.26, 2.32, 2.37, 2.43, 2.49, 2.55, 2.61, 2.67, 2.74, 2.8, 2.87, 2.94, 3.01, 3.09, 3.16, 3.24, 3.32, 3.4, 3.48, 3.57,
  3.65, 3.74, 3.83, 3.92, 4.02, 4.12, 4.22, 4.32, 4.42, 4.53, 4.64, 4.75, 4.87, 4.99, 5.11, 5.23, 5.36, 5.49, 5.62, 5.76, 5.9, 6.04, 6.19, 6.34, 6.49, 6.65,
  6.81, 6.98, 7.15, 7.32, 7.5, 7.68, 7.87, 8.06, 8.25, 8.45, 8.66, 8.87, 9.09, 9.31, 9.53, 9.76,
];

export function series(name) {
  if (name === "E12") return E24.filter((_, i) => i % 2 === 0);
  if (name === "E24") return [...E24];
  if (name === "E48") return E96.filter((_, i) => i % 2 === 0);
  if (name === "E96") return [...E96];
  return null;
}

export function seriesValues(mant, lo, hi) {
  const out = new Set();
  for (let decade = 10 ** (Math.floor(Math.log10(lo)) - 1); decade <= hi * 10; decade *= 10) {
    for (const m of mant) {
      const v = Math.round(m * decade * 1e6) / 1e6;
      if (v >= lo * (1 - 1e-9) && v <= hi * (1 + 1e-9)) out.add(v);
    }
  }
  return [...out].sort((a, b) => a - b);
}

const nearestAtLeast = (m, x) => seriesValues(m, x * 0.5, x * 20).find((v) => v >= x * (1 - 1e-9)) ?? x;
const nearestAtMost = (m, x) => seriesValues(m, x * 0.05, x * 2).reverse().find((v) => v <= x * (1 + 1e-9)) ?? null;
const nearest = (m, x) => seriesValues(m, x * 0.3, x * 3).reduce((best, v) => (best === null || Math.abs(Math.log(v / x)) < Math.abs(Math.log(best / x)) ? v : best), null) ?? x;

const d = (kind, construction, thickness_mm, er) => ({ kind, construction, thickness_mm, er });
const PP7628 = d("prepreg", "7628", 0.2104, 4.4);
const PP3313 = d("prepreg", "3313", 0.0994, 4.1);
const PP2116 = d("prepreg", "2116", 0.1164, 4.16);
const PP1080 = d("prepreg", "1080", 0.0764, 3.91);
const CORE_1065 = d("core", "core", 1.065, 4.43);
const CORE_1265 = d("core", "core", 1.265, 4.43);
const CORE_055 = d("core", "core", 0.55, 4.41);
const CORE_2L = d("core", "FR-4", 1.53, 4.5);
const CU4 = [0.035, 0.0152, 0.0152, 0.035];

export const STACKUP_SOURCE =
  "JLCPCB impedance-template API, as captured 2025-05-09 by github.com/gsuberland/jlcpcb_autogenerated_stackups (normalised_json). Vendor data changes: confirm the template in JLCPCB's current impedance calculator before ordering.";

export const STACKUPS = [
  { id: "JLC04161H-7628", description: "JLCPCB 4-layer 1.6 mm, 1 oz outer / 0.5 oz inner, 7628 prepreg (JLCPCB default 4L)", copper: CU4, dielectrics: [PP7628, CORE_1065, PP7628] },
  { id: "JLC04161H-3313", description: "JLCPCB 4-layer 1.6 mm, 1 oz outer / 0.5 oz inner, 3313 prepreg (thin, narrow 50 Ω traces)", copper: CU4, dielectrics: [PP3313, CORE_1265, PP3313] },
  { id: "JLC04161H-2116", description: "JLCPCB 4-layer 1.6 mm, 1 oz outer / 0.5 oz inner, 2116 prepreg", copper: CU4, dielectrics: [PP2116, CORE_1265, PP2116] },
  { id: "JLC04161H-1080", description: "JLCPCB 4-layer 1.6 mm, 1 oz outer / 0.5 oz inner, 1080 prepreg (thinnest)", copper: CU4, dielectrics: [PP1080, CORE_1265, PP1080] },
  { id: "JLC06161H-NOREQ", description: "JLCPCB 6-layer 1.6 mm default ('no requirement'), 1 oz outer / 0.5 oz inner", copper: [0.035, 0.0152, 0.0152, 0.0152, 0.0152, 0.035], dielectrics: [PP3313, CORE_055, PP2116, CORE_055, PP3313] },
  {
    id: "GENERIC-2L-1.6",
    description: "Typical 2-layer 1.6 mm FR-4, 1 oz both sides. Not an impedance-controlled product: thickness and εr are nominal, so treat results as estimates",
    copper: [0.035, 0.035],
    dielectrics: [CORE_2L],
  },
];

const stackup = (id) => STACKUPS.find((s) => s.id.toLowerCase() === String(id).toLowerCase());
const layerName = (i, n) => (i === 0 ? "top" : i + 1 === n ? "bottom" : `inner${i}`);

function layerIndex(stack, layer) {
  const n = stack.copper.length;
  const l = String(layer).toLowerCase().replace(/\s/g, "");
  const alias = { "f.cu": "top", "b.cu": "bottom" }[l] ?? l.replace(/^in(\d+)\.cu$/, "inner$1").replace(/^inner_(\d+)$/, "inner$1");
  for (let i = 0; i < n; i++) if (layerName(i, n) === alias) return i;
  return -1;
}

function stackupJson(s) {
  const n = s.copper.length;
  const layers = [];
  s.copper.forEach((t, i) => {
    layers.push({ copper: layerName(i, n), thickness_mm: t });
    const dl = s.dielectrics[i];
    if (dl) layers.push({ dielectric: dl.kind, construction: dl.construction, thickness_mm: dl.thickness_mm, er: dl.er });
  });
  const total = s.copper.reduce((a, b) => a + b, 0) + s.dielectrics.reduce((a, b) => a + b.thickness_mm, 0);
  return { id: s.id, description: s.description, copper_layers: n, pressed_thickness_mm: Math.round(total * 1000) / 1000, layers };
}

const r3 = (x) => Math.round(x * 1000) / 1000;

export function sig(x, digits) {
  if (x === 0 || !Number.isFinite(x)) return x;
  const m = 10 ** (digits - 1 - Math.floor(Math.log10(Math.abs(x))));
  return Math.round(x * m) / m;
}

export function eng(x, unit) {
  const scales = [[1e9, "G"], [1e6, "M"], [1e3, "k"], [1, ""], [1e-3, "m"], [1e-6, "µ"], [1e-9, "n"], [1e-12, "p"]];
  const [s, p] = scales.find(([s]) => Math.abs(x) >= s * 0.999999) ?? [1e-12, "p"];
  return `${sig(x / s, 3)}${p}${unit}`;
}

const num = (a, k) => (typeof a[k] === "number" && Number.isFinite(a[k]) ? a[k] : undefined);

function traceWidth(a) {
  const rise = num(a, "temp_rise_c") ?? 10;
  const external = (a.layer ?? "external") === "external";
  const thickness = num(a, "thickness_mm") ?? (num(a, "copper_oz") ?? 1) * MM_PER_OZ;
  const ambient = num(a, "ambient_c") ?? 25;
  const ci = num(a, "current_a");
  const wi = num(a, "width_mm");
  if ((ci === undefined) === (wi === undefined)) return invalid("current_a", "pass exactly one of current_a (to size a trace) or width_mm (to rate one)");
  const width = wi ?? calc.ipc2221WidthMm(ci, rise, thickness, external);
  const current = ci ?? calc.ipc2221CurrentA(wi, thickness, rise, external);
  const warnings = [];
  if (current > 35) warnings.push("IPC-2221 curves are fitted only up to 35 A");
  if (rise < 10 || rise > 100) warnings.push("IPC-2221 curves are fitted for 10–100 °C rise");
  if (width / MM_PER_MIL > 400) warnings.push("IPC-2221 curves are fitted only up to 400 mil (10.16 mm) width");
  const out = {
    method: `IPC-2221 ${external ? "external" : "internal"} layer: I = ${calc.ipc2221K(external)}·ΔT^0.44·A^0.725 (A in mil²)`,
    current_a: sig(current, 4),
    temp_rise_c: rise,
    copper_thickness_mm: thickness,
    width_mm: r3(width),
    width_mil: sig(width / MM_PER_MIL, 4),
    cross_section_mm2: sig(width * thickness, 4),
    warnings,
  };
  if (wi === undefined) out.recommended_width_mm = Math.round(Math.ceil(width / 0.05) * 0.05 * 100) / 100;
  const len = num(a, "length_mm");
  if (len !== undefined) {
    const r = calc.copperResistance(len, width * thickness, ambient + rise);
    Object.assign(out, {
      length_mm: len,
      resistance_mohm: sig(r * 1000, 4),
      voltage_drop_mv: sig(r * current * 1000, 4),
      power_loss_mw: sig(r * current * current * 1000, 4),
      resistance_basis: `ρ = 1.724e-8 Ω·m at 20 °C, α = 0.00393/°C, evaluated at ${ambient + rise} °C`,
    });
  }
  return json(out);
}

function geometry(a, structure) {
  const strip = structure.includes("stripline");
  if (a.stackup !== undefined) {
    const s = stackup(a.stackup);
    if (!s) return { error: invalid("stackup", `unknown preset '${a.stackup}'; call list_stackups`) };
    const layer = a.layer ?? "top";
    const i = layerIndex(s, layer);
    if (i < 0) return { error: invalid("layer", `${s.id} has no copper layer '${layer}'`) };
    const n = s.copper.length;
    const outer = i === 0 || i + 1 === n;
    if (outer === strip)
      return { error: invalid("structure", `${layer} is an ${outer ? "outer" : "inner"} layer; use ${outer ? "microstrip, cpwg or diff_microstrip" : "stripline or diff_stripline"}`) };
    let g;
    if (outer) {
      const dl = i === 0 ? s.dielectrics[0] : s.dielectrics[n - 2];
      g = { h: dl.thickness_mm, h2: null, t: s.copper[i], er: dl.er };
    } else {
      const up = s.dielectrics[i - 1];
      const dn = s.dielectrics[i];
      g = { h: up.thickness_mm, h2: dn.thickness_mm, t: s.copper[i], er: (up.er * up.thickness_mm + dn.er * dn.thickness_mm) / (up.thickness_mm + dn.thickness_mm) };
    }
    g.source = {
      stackup: s.id,
      layer: layerName(i, n),
      derived: { height_mm: g.h, height2_mm: g.h2, thickness_mm: g.t, er: sig(g.er, 4) },
      data_source: STACKUP_SOURCE,
      assumption: outer ? "the adjacent inner copper layer is a solid reference plane" : "both adjacent copper layers are solid reference planes; εr is the thickness-weighted mix",
    };
    if (num(a, "thickness_mm") !== undefined) g.t = a.thickness_mm;
    return { g };
  }
  const h = num(a, "height_mm");
  if (h === undefined) return { error: invalid("height_mm", "required unless stackup is given") };
  const er = num(a, "er");
  if (er === undefined) return { error: invalid("er", "required unless stackup is given") };
  return { g: { h, h2: num(a, "height2_mm") ?? null, t: num(a, "thickness_mm") ?? 0.035, er, source: { geometry: "caller-supplied" } } };
}

function impedanceAt(structure, w, g, gap) {
  if (structure === "microstrip") return [...calc.microstrip(w, g.h, g.t, g.er), null];
  if (structure === "diff_microstrip") {
    const [z, e] = calc.microstrip(w, g.h, g.t, g.er);
    return [z, e, calc.diffMicrostrip(z, gap ?? w, g.h)];
  }
  if (structure === "cpwg") return [...calc.cpwg(w, gap ?? w, g.h, g.er), null];
  if (structure === "stripline" || structure === "diff_stripline") {
    const z = g.h2 !== null && Math.abs(g.h2 - g.h) > 1e-9 ? calc.striplineAsym(w, g.h, g.h2, g.t, g.er) : calc.stripline(w, 2 * g.h + g.t, g.t, g.er);
    const b = g.h + (g.h2 ?? g.h) + g.t;
    return [z, g.er, structure === "diff_stripline" ? calc.diffStripline(z, gap ?? w, b) : null];
  }
  return [NaN, NaN, null];
}

const METHODS = {
  microstrip: "Hammerstad–Jensen (1980) with Hammerstad thickness correction; ≤1% for 0.01 ≤ W/H ≤ 100",
  cpwg: "Conductor-backed CPW conformal mapping (Wadell 1991), zero-thickness conductors; thick copper lowers Z slightly",
  stripline: "Wheeler (1978) finite-thickness stripline; offset placement combined per IPC-2141A",
  diff_microstrip: "Single-ended Hammerstad–Jensen, coupled with IPC-2141 Zdiff = 2·Z0·(1−0.48·e^(−0.96·S/H)); ±5–10%",
  diff_stripline: "Single-ended Wheeler stripline, coupled with IPC-2141 Zdiff = 2·Z0·(1−0.347·e^(−2.9·S/B)); ±5–10%",
};

function impedance(a) {
  const structure = a.structure;
  if (!METHODS[structure]) return invalid("structure", "use microstrip, stripline, cpwg, diff_microstrip or diff_stripline");
  const { g, error } = geometry(a, structure);
  if (error) return error;
  const gap = num(a, "gap_mm") ?? null;
  const diff = structure.startsWith("diff_");
  if ((structure === "cpwg" || diff) && gap === null) return invalid("gap_mm", "required for cpwg and differential structures");
  const wi = num(a, "width_mm");
  const target = num(a, "target_ohm");
  if ((wi === undefined) === (target === undefined)) return invalid("width_mm", "pass exactly one of width_mm or target_ohm");
  let width = wi;
  if (width === undefined) {
    width = calc.solveDecreasing(target, 0.01, 20, (w) => {
      const [z, , zd] = impedanceAt(structure, w, g, gap);
      return diff ? zd ?? z : z;
    });
    if (width === null) return fail(`No trace width between 0.01 and 20 mm gives ${target} Ω on this geometry; change the dielectric height, gap or structure`);
  }
  const [z0, eeff, zdiff] = impedanceAt(structure, width, g, gap);
  const warnings = ["Excludes solder mask (≈1–3 Ω lower on outer layers) and etch trapezoid"];
  if (diff) warnings.push("Coupled-line estimate: confirm with the fab's field-solver calculator before ordering");
  if (structure === "microstrip" && (width / g.h < 0.01 || width / g.h > 100)) warnings.push("W/H outside the Hammerstad–Jensen fit range");
  const out = {
    structure,
    width_mm: r3(width),
    z0_ohm: sig(z0, 4),
    eeff: sig(eeff, 4),
    delay_ps_per_mm: sig(calc.delayPsPerMm(eeff), 4),
    geometry: { height_mm: g.h, height2_mm: g.h2, thickness_mm: g.t, er: sig(g.er, 4), gap_mm: gap },
    basis: g.source,
    method: METHODS[structure],
    warnings,
  };
  if (zdiff !== null) out.zdiff_ohm = sig(zdiff, 4);
  if (target !== undefined) {
    out.target_ohm = target;
    out.recommended_width_mm = Math.round(Math.round(width / 0.005) * 0.005 * 1000) / 1000;
  }
  return json(out);
}

function via(a) {
  const drill = num(a, "drill_mm");
  if (drill === undefined) return invalid("drill_mm", "missing or not a number");
  const plating = num(a, "plating_mm") ?? 0.018;
  if (plating * 2 >= drill) return invalid("plating_mm", "plating must be less than half the drill diameter");
  const length = num(a, "length_mm") ?? 1.6;
  const rise = num(a, "temp_rise_c") ?? 10;
  const area = calc.viaBarrelArea(drill, plating);
  const iMax = calc.ipc2221K(true) * rise ** 0.44 * (area / (MM_PER_MIL * MM_PER_MIL)) ** 0.725;
  const r = calc.copperResistance(length, area, 25 + rise);
  const out = {
    drill_mm: drill,
    plating_mm: plating,
    length_mm: length,
    barrel_area_mm2: sig(area, 4),
    resistance_mohm: sig(r * 1000, 4),
    inductance_nh: sig(calc.viaInductanceNh(length, drill), 3),
    current_capacity_a: sig(iMax, 3),
    method: "Barrel area π·t·(d−t); IPC-2221 external constant on that area; Goldfarb L = 0.2·h·(ln(4h/d)+1) nH",
    note: "Vias also conduct heat into planes, so real capacity is usually higher; this is the conservative figure.",
  };
  const i = num(a, "current_a");
  if (i !== undefined) Object.assign(out, { current_a: i, vias_needed: Math.max(1, Math.ceil(i / iMax)) });
  return json(out);
}

function regulator(a) {
  for (const k of ["vin", "vout", "iout_a", "theta_ja_c_per_w"]) if (num(a, k) === undefined) return invalid(k, "missing or not a number");
  const { vin, vout, iout_a: iout, theta_ja_c_per_w: theta } = a;
  const iq = num(a, "iq_a") ?? 0;
  const ta = num(a, "ambient_c") ?? 40;
  const tjMax = num(a, "tj_max_c") ?? 125;
  if (vin <= vout) return invalid("vin", "must exceed vout for a linear regulator");
  const pd = (vin - vout) * iout + vin * iq;
  const tj = ta + pd * theta;
  const iMax = Math.max(0, ((tjMax - ta) / theta - vin * iq) / (vin - vout));
  const issues = [];
  if (tj > tjMax) issues.push(`Junction reaches ${tj.toFixed(0)} °C, above the ${tjMax.toFixed(0)} °C limit — the part will enter thermal shutdown`);
  else if (tj > tjMax - 20) issues.push(`Junction reaches ${tj.toFixed(0)} °C — less than 20 °C margin; add copper or reduce Vin`);
  const dropout = num(a, "dropout_v");
  if (dropout !== undefined && vin - vout < dropout) issues.push(`Headroom ${(vin - vout).toFixed(2)} V is below the ${dropout.toFixed(2)} V dropout — output will not regulate`);
  return json({
    power_dissipation_w: sig(pd, 3),
    junction_temp_c: sig(tj, 3),
    efficiency_pct: sig(((vout * iout) / Math.max(vin * (iout + iq), 1e-30)) * 100, 3),
    max_current_at_this_theta_a: sig(iMax, 3),
    verdict: issues.some((i) => i.includes("shutdown") || i.includes("not regulate")) ? "fail" : issues.length ? "marginal" : "ok",
    issues,
    method: "Pd = (Vin−Vout)·Iout + Vin·Iq; Tj = Ta + Pd·θJA",
  });
}

function divider(a) {
  const mode = a.mode;
  if (mode !== "divider" && mode !== "feedback") return invalid("mode", "use divider or feedback");
  const vout = num(a, "vout");
  if (vout === undefined) return invalid("vout", "missing or not a number");
  const vs = num(a, mode === "divider" ? "vin" : "vref");
  if (vs === undefined) return invalid(mode === "divider" ? "vin" : "vref", "required for this mode");
  if (mode === "divider" && vout >= vs) return invalid("vout", "must be below vin for a divider");
  if (mode === "feedback" && vout <= vs) return invalid("vout", "must be above vref for a feedback network");
  const name = a.series ?? "E96";
  const mant = series(name);
  if (!mant) return invalid("series", "use E12, E24, E48 or E96");
  const lo = num(a, "r_min_ohm") ?? 1e3;
  const hi = num(a, "r_max_ohm") ?? 1e6;
  const values = seriesValues(mant, lo, hi);
  const bottoms = num(a, "fixed_rbot_ohm") !== undefined ? [a.fixed_rbot_ohm] : values;
  const out = (rt, rb) => (mode === "divider" ? (vs * rb) / (rt + rb) : vs * (1 + rt / rb));
  const all = [];
  for (const rb of bottoms) for (const rt of values) all.push([Math.abs(out(rt, rb) - vout) / vout, rt, rb]);
  all.sort((x, y) => x[0] - y[0] || x[1] + x[2] - (y[1] + y[2]));
  const best = [];
  for (const row of all) {
    if (best.length && Math.abs(best[best.length - 1][0] - row[0]) < 1e-12) continue;
    best.push(row);
    if (best.length === 5) break;
  }
  return json({
    mode,
    target_vout: vout,
    series: name,
    range_ohm: [lo, hi],
    best: best.map(([err, rt, rb]) => {
      const v = out(rt, rb);
      return {
        r_top: eng(rt, "Ω"),
        r_bot: eng(rb, "Ω"),
        r_top_ohm: rt,
        r_bot_ohm: rb,
        vout: sig(v, 5),
        error_pct: Math.round(err * 100 * 1e4) / 1e4,
        divider_current_ua: sig(((mode === "divider" ? vs : v) / (rt + rb)) * 1e6, 3),
      };
    }),
    note: "Error excludes resistor tolerance: with 1% parts the worst-case output shifts by about ±2% (divider) or ±2%·(1−Vref/Vout) (feedback). For ADC inputs keep the source impedance within the ADC's limit.",
  });
}

function passive(a) {
  const kind = a.kind;
  const need = (k) => {
    const v = num(a, k);
    if (v === undefined) throw invalid(k, `required for kind '${kind}'`);
    return v;
  };
  try {
    let result;
    if (kind === "led") {
      const vs = need("supply_v");
      const vf = need("vf_v");
      const ima = need("if_ma");
      if (vf >= vs) return invalid("vf_v", "forward voltage must be below the supply");
      const r = (vs - vf) / (ima / 1000);
      const rs = nearestAtLeast(E24, r);
      const ia = (vs - vf) / rs;
      const p = ia * ia * rs;
      result = {
        exact_ohm: sig(r, 4),
        resistor_ohm: rs,
        resistor: eng(rs, "Ω"),
        actual_if_ma: sig(ia * 1000, 3),
        resistor_power_mw: sig(p * 1000, 3),
        min_resistor_rating: p * 2 <= 0.0625 ? "0402 (1/16 W)" : p * 2 <= 0.1 ? "0603 (1/10 W)" : p * 2 <= 0.125 ? "0805 (1/8 W)" : p * 2 <= 0.25 ? "1206 (1/4 W)" : "≥ 1/2 W — use a current-limit driver instead",
        method: "R = (Vs − Vf)/If rounded up to E24; rating at 2× dissipation",
      };
    } else if (kind === "rc") {
      let [r, c, f] = [num(a, "r_ohm"), num(a, "c_f"), num(a, "fc_hz")];
      const given = [r, c, f].filter((v) => v !== undefined).length;
      if (given !== 2) return invalid("r_ohm", "pass exactly two of r_ohm, c_f, fc_hz");
      if (f === undefined) f = 1 / (2 * PI * r * c);
      else if (c === undefined) c = 1 / (2 * PI * r * f);
      else r = 1 / (2 * PI * c * f);
      result = {
        r_ohm: sig(r, 4),
        c_f: sig(c, 4),
        fc_hz: sig(f, 4),
        r: eng(r, "Ω"),
        c: eng(c, "F"),
        fc: eng(f, "Hz"),
        nearest_standard: { r: eng(nearest(E24, r), "Ω"), c: eng(nearest(series("E12"), c), "F") },
        time_constant_s: sig(r * c, 4),
        settle_to_1pct_s: sig(4.6 * r * c, 4),
        method: "fc = 1/(2πRC); −3 dB at fc, first order (20 dB/decade)",
      };
    } else if (kind === "crystal") {
      const cl = need("cl_pf");
      const cs = num(a, "cstray_pf") ?? 4;
      const c = 2 * (cl - cs);
      if (c <= 0) return invalid("cstray_pf", "stray capacitance must be below CL");
      const std = nearest(series("E12"), c);
      result = {
        c1_c2_exact_pf: sig(c, 3),
        c1_c2_standard_pf: std,
        resulting_cl_pf: sig(std / 2 + cs, 3),
        method: "C1 = C2 = 2·(CL − Cstray); CL = C1·C2/(C1+C2) + Cstray",
        note: "Use C0G/NP0 capacitors. Many MCU datasheets (e.g. ESP32) state the exact load caps for their recommended crystal — prefer those.",
      };
    } else if (kind === "i2c") {
      const vdd = need("supply_v");
      const cb = need("bus_pf") * 1e-12;
      const mode = a.i2c_mode ?? "fast";
      const [tr, iol] = mode === "standard" ? [1000e-9, 3e-3] : mode === "fast_plus" ? [120e-9, 20e-3] : [300e-9, 3e-3];
      const vol = vdd > 2 ? 0.4 : 0.2 * vdd;
      const rmin = (vdd - vol) / iol;
      const rmax = tr / (0.8473 * cb);
      if (rmax < rmin)
        result = { verdict: "infeasible", r_min_ohm: sig(rmin, 3), r_max_ohm: sig(rmax, 3), advice: "Bus capacitance is too high for this mode: lower the speed, shorten the bus, or add a buffer (e.g. PCA9515)." };
      else {
        const pick = nearestAtMost(E24, rmax * 0.8);
        const rec = pick !== null && pick >= rmin ? pick : rmin;
        result = {
          verdict: "ok",
          mode,
          r_min_ohm: sig(rmin, 3),
          r_max_ohm: sig(rmax, 3),
          recommended_ohm: rec,
          recommended: eng(rec, "Ω"),
          method: "NXP UM10204: Rmin = (Vdd−VOL)/IOL, Rmax = tr/(0.8473·Cb)",
          note: "Fit one pull-up pair per bus, not one per device. Include each device's pin capacitance in bus_pf.",
        };
      }
    } else if (kind === "battery") {
      const h = (need("capacity_mah") * (num(a, "derating") ?? 0.8)) / need("avg_current_ma");
      result = {
        runtime_hours: sig(h, 3),
        runtime_days: sig(h / 24, 3),
        method: "t = capacity × derating / average current",
        note: "Average current must include sleep current and regulator quiescent current; Li-ion capacity also falls in cold conditions.",
      };
    } else return invalid("kind", "unknown calculator");
    return json({ kind, result });
  } catch (e) {
    if (e && e.isError) return e;
    throw e;
  }
}

function buck(a) {
  for (const k of ["vin_min", "vin_max", "vout", "iout_a", "fsw_hz"]) if (num(a, k) === undefined) return invalid(k, "missing or not a number");
  const { vin_min, vin_max, vout, iout_a: iout, fsw_hz: fsw } = a;
  if (vin_min > vin_max) return invalid("vin_min", "must not exceed vin_max");
  if (vout >= vin_min) return invalid("vout", "a buck needs vout below vin_min");
  const r = num(a, "ripple_ratio") ?? 0.3;
  const eff = num(a, "efficiency") ?? 0.9;
  const dv = num(a, "vout_ripple_mv") !== undefined ? a.vout_ripple_mv / 1000 : vout * 0.01;
  const l = (vout * (vin_max - vout)) / (vin_max * fsw * r * iout);
  const lStd = nearestAtLeast([1.0, 1.5, 2.2, 3.3, 4.7, 6.8], l);
  const di = (vout * (vin_max - vout)) / (vin_max * fsw * lStd);
  const ipk = iout + di / 2;
  const dMax = Math.min(vout / (vin_min * eff), 1);
  const dWorst = dMax >= 0.5 && vout / (vin_max * eff) <= 0.5 ? 0.5 : dMax;
  return json({
    duty_cycle_range: [sig(vout / (vin_max * eff), 3), sig(dMax, 3)],
    inductor: {
      computed_uh: sig(l * 1e6, 3),
      standard_uh: sig(lStd * 1e6, 3),
      ripple_a: sig(di, 3),
      peak_a: sig(ipk, 3),
      min_saturation_a: sig(ipk * 1.3, 3),
      min_rms_rating_a: sig(Math.sqrt(iout * iout + (di * di) / 12), 3),
    },
    output_capacitor: {
      min_effective_uf: sig((di / (8 * fsw * dv)) * 1e6, 3),
      max_esr_mohm: sig((dv / di) * 1000, 3),
      note: "Effective capacitance: ceramic X5R/X7R loses 30–70% at DC bias — check the vendor's DC-bias curve and buy 2–3× the figure. Loop stability may require more; follow the datasheet.",
    },
    input_capacitor: { rms_current_a: sig(iout * Math.sqrt(dWorst * (1 - dWorst)), 3), note: "Place within 2 mm of VIN/GND pins; this loop has the highest di/dt on the board." },
    method: "CCM buck: L = Vout(Vin_max−Vout)/(Vin_max·fsw·ΔIL); Cout = ΔIL/(8·fsw·ΔVout); Icin,rms = Iout·√(D(1−D))",
  });
}

const n = (desc, extra = {}) => ({ type: "number", ...extra, ...(desc ? { description: desc } : {}) });
const pos = (desc, extra) => n(desc, { exclusiveMinimum: 0, ...extra });

export const tools = [
  {
    name: "calc_trace_width",
    description:
      "Size a copper trace for a current (IPC-2221 closed form). Returns the minimum width for the allowed temperature rise, plus resistance, voltage drop and power loss when a length is given. IPC-2221 is conservative for internal layers; IPC-2152 charts usually allow narrower internal traces. Also answers the reverse question: pass width_mm instead of current_a to get the safe current.",
    inputSchema: {
      type: "object",
      properties: {
        current_a: pos("Continuous current (A). Omit when passing width_mm."),
        width_mm: pos("Existing trace width (mm) — returns its current capacity instead"),
        temp_rise_c: pos("Allowed rise above ambient (°C). 10 is the usual design value.", { default: 10 }),
        copper_oz: pos("Copper weight in oz (1 oz ≈ 35 µm). Ignored when thickness_mm is given.", { default: 1 }),
        thickness_mm: pos("Finished copper thickness (mm). JLCPCB 4L inner 0.5 oz finishes at 0.0152."),
        layer: { type: "string", enum: ["external", "internal"], default: "external" },
        length_mm: pos("Trace length for resistance / drop / loss"),
        ambient_c: n(null, { default: 25 }),
      },
    },
    run: traceWidth,
  },
  {
    name: "calc_impedance",
    description:
      "Characteristic impedance of a trace: microstrip (Hammerstad–Jensen with thickness correction, ≤1%), centred or offset stripline (Wheeler / IPC-2141A, ≈0.5–2%), grounded coplanar waveguide (conformal mapping, zero thickness), and edge-coupled differential pairs (IPC-2141 coupling estimate, ±5–10%). Give geometry directly, or a stackup preset from list_stackups plus a copper layer and the tool derives heights, εr and copper. Set target_ohm to solve for the trace width instead. Results exclude solder mask, which lowers outer-layer impedance by roughly 1–3 Ω.",
    inputSchema: {
      type: "object",
      properties: {
        structure: { type: "string", enum: ["microstrip", "stripline", "cpwg", "diff_microstrip", "diff_stripline"], description: "Transmission-line type" },
        stackup: { type: "string", description: "Preset id from list_stackups (e.g. JLC04161H-7628). Supplies h, t, εr." },
        layer: { type: "string", description: "Signal layer within the preset: top, inner1, inner2, …, bottom" },
        width_mm: pos("Trace width W"),
        target_ohm: pos("Solve for W giving this impedance (single-ended Z0, or Zdiff for diff structures)"),
        height_mm: pos("Dielectric height to the reference plane (microstrip/CPWG), or to the nearer plane (stripline)"),
        height2_mm: pos("Stripline only: dielectric height to the second plane. Omit for a centred stripline."),
        thickness_mm: n("Trace copper thickness", { minimum: 0 }),
        er: n("Relative permittivity", { exclusiveMinimum: 1 }),
        gap_mm: pos("CPWG: trace-to-coplanar-ground gap. Diff: edge-to-edge spacing of the pair."),
      },
      required: ["structure"],
    },
    run: impedance,
  },
  {
    name: "list_stackups",
    description:
      "List the stackup presets calc_impedance accepts: JLCPCB 4- and 6-layer impedance templates and a generic 2-layer board, with every copper and dielectric thickness and εr. To use a board's own stackup instead, read it with get_board_info and pass height_mm / er / thickness_mm to calc_impedance.",
    inputSchema: { type: "object", properties: {} },
    run: () => json({ source: STACKUP_SOURCE, stackups: STACKUPS.map(stackupJson) }),
  },
  {
    name: "calc_via",
    description:
      "Via electrical properties: barrel resistance, inductance (Goldfarb), current capacity (IPC-2221 external constant applied to the plated barrel), and how many vias in parallel carry a given current.",
    inputSchema: {
      type: "object",
      properties: {
        drill_mm: pos("Finished drill diameter (JLCPCB minimum 0.3 standard, 0.2 advanced — check current capabilities)"),
        plating_mm: pos("Barrel plating thickness. JLCPCB stackup data uses 0.018.", { default: 0.018 }),
        length_mm: pos("Barrel length (board thickness for a through via)", { default: 1.6 }),
        temp_rise_c: pos(null, { default: 10 }),
        current_a: pos("Current to carry — returns the number of vias needed"),
      },
      required: ["drill_mm"],
    },
    run: via,
  },
  {
    name: "calc_regulator_thermal",
    description:
      "Linear-regulator (LDO) power dissipation and junction temperature: Pd = (Vin−Vout)·Iout + Vin·Iq, Tj = Ta + Pd·θJA. θJA must come from the part's datasheet for the copper area you will actually provide. Flags dropout violations and returns the maximum safe current at the given θJA.",
    inputSchema: {
      type: "object",
      properties: {
        vin: pos(),
        vout: pos(),
        iout_a: n(null, { minimum: 0 }),
        iq_a: n("Quiescent/ground current", { minimum: 0, default: 0 }),
        theta_ja_c_per_w: pos("Junction-to-ambient thermal resistance from the datasheet"),
        ambient_c: n("Worst-case ambient, inside the enclosure", { default: 40 }),
        tj_max_c: n(null, { default: 125 }),
        dropout_v: n("Datasheet dropout at this current (optional)", { minimum: 0 }),
      },
      required: ["vin", "vout", "iout_a", "theta_ja_c_per_w"],
    },
    run: regulator,
  },
  {
    name: "calc_divider",
    description:
      "Pick standard-value resistors for a voltage divider or a regulator feedback network. Searches every pair in the chosen E-series and resistance range and returns the best pairs with their exact output and error. mode 'divider': Vout = Vin·Rbot/(Rtop+Rbot). mode 'feedback': Vout = Vref·(1 + Rtop/Rbot) — pass vref from the regulator datasheet.",
    inputSchema: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["divider", "feedback"] },
        vin: pos("divider mode: input voltage"),
        vref: pos("feedback mode: regulator reference/FB voltage"),
        vout: pos("Target output voltage"),
        series: { type: "string", enum: ["E12", "E24", "E48", "E96"], default: "E96" },
        r_min_ohm: pos(null, { default: 1000 }),
        r_max_ohm: pos(null, { default: 1000000 }),
        fixed_rbot_ohm: pos("Hold Rbot at this value (datasheets often specify it)"),
      },
      required: ["mode", "vout"],
    },
    run: divider,
  },
  {
    name: "calc_passive",
    description:
      "Small circuit calculators. kind 'led': series resistor R = (Vs−Vf)/If rounded up to E24, with actual current and resistor power. 'rc': solve any one of R, C, fc for an RC low/high-pass (fc = 1/2πRC) plus time constant. 'crystal': load capacitors C = 2·(CL − Cstray), rounded to E12. 'i2c': pull-up range from UM10204 — Rmin = (Vdd−VOL)/IOL, Rmax = tr/(0.8473·Cb) — and a recommended value. 'battery': runtime from capacity and average current.",
    inputSchema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["led", "rc", "crystal", "i2c", "battery"] },
        supply_v: pos("led: drive voltage; i2c: bus voltage"),
        vf_v: pos("led: forward voltage at If (datasheet)"),
        if_ma: pos("led: target current"),
        r_ohm: pos(),
        c_f: pos("rc: capacitance in farads (100nF = 1e-7)"),
        fc_hz: pos(),
        cl_pf: pos("crystal: specified load capacitance CL"),
        cstray_pf: n("crystal: PCB + pin stray capacitance (3–5 pF typical)", { minimum: 0, default: 4 }),
        bus_pf: pos("i2c: total bus capacitance"),
        i2c_mode: { type: "string", enum: ["standard", "fast", "fast_plus"], default: "fast" },
        capacity_mah: pos(),
        avg_current_ma: pos(),
        derating: pos("battery: usable fraction of rated capacity", { maximum: 1, default: 0.8 }),
      },
      required: ["kind"],
    },
    run: passive,
  },
  {
    name: "calc_buck",
    description:
      "Size a buck converter's inductor and capacitors from first principles (continuous conduction): L = Vout·(Vin_max−Vout)/(Vin_max·fsw·ΔIL), peak current, Cout for the ripple target, maximum output-capacitor ESR, and worst-case input RMS current. The regulator datasheet's recommended values take precedence — use this to check them or when the datasheet leaves the choice open.",
    inputSchema: {
      type: "object",
      properties: {
        vin_min: pos(),
        vin_max: pos(),
        vout: pos(),
        iout_a: pos(),
        fsw_hz: pos("Switching frequency"),
        ripple_ratio: pos("Inductor ripple ΔIL / Iout (0.2–0.4 typical)", { maximum: 1, default: 0.3 }),
        vout_ripple_mv: pos("Allowed output ripple (default 1% of Vout)"),
        efficiency: pos(null, { maximum: 1, default: 0.9 }),
      },
      required: ["vin_min", "vin_max", "vout", "iout_a", "fsw_hz"],
    },
    run: buck,
  },
];
