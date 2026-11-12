const GROUND = /^(A|D|P|S|C)?GND\w*$|^VSS\w*$|^0V$|^EARTH$/i;
const POWER = /^(\+|-)?\d+V\d*\w*$|^\+|^V(CC|DD|BUS|IN|BAT|SYS|OUT|BUCK|LDO|IO|REF|USB|EXT|MAIN|PP)\w*$|^\d+V\d+$|^VCC|^VDD|^AVDD|^DVDD|^VBUS|^VBAT/i;
const MODULE = /ESP32|ESP8266|WROOM|WROVER|MINI-1|MODULE|NRF52.*MOD|BLE|WIFI|RFM|SX12|LORA|ANT/i;
const CRYSTAL = /XTAL|CRYSTAL|OSC|HC-?49|TCXO|^Y\d/i;

export const netKind = (net) => (!net ? "none" : GROUND.test(net) ? "ground" : POWER.test(net) ? "power" : "signal");

export function classify(p) {
  const ref = String(p.designator || "").toUpperCase();
  const prefix = (/^[A-Z]+/.exec(ref) || [""])[0];
  const fp = String(p.footprint || "");
  if (["H", "MH", "HOLE", "MTG"].includes(prefix)) return "hole";
  if (["FID", "FD", "MARK"].includes(prefix)) return "fiducial";
  if ((MODULE.test(fp) || MODULE.test(p.name || "")) && ["U", "M", "MOD", "ANT", "AE"].includes(prefix)) return "module";
  return classifyPrefix(prefix, fp);
}

function classifyPrefix(prefix, fp) {
  if (["J", "P", "CN", "CON", "USB", "XS", "XP", "JP", "BT", "BAT"].includes(prefix)) return "connector";
  if (["SW", "S", "K", "BTN", "KEY"].includes(prefix)) return "switch";
  if (["U", "IC", "Q", "T", "M", "MOD", "AR"].includes(prefix)) return "active";
  if (prefix === "Y" || (prefix === "X" && CRYSTAL.test(fp))) return "crystal";
  if (prefix === "X") return "connector";
  if (["C", "CE", "CP"].includes(prefix)) return "cap";
  if (["R", "RN", "RV", "VR"].includes(prefix)) return "res";
  if (["L", "FB"].includes(prefix)) return "inductor";
  if (["D", "LED", "ZD", "TVS"].includes(prefix)) return "diode";
  if (prefix === "TP") return "testpoint";
  if (prefix === "F") return "fuse";
  return "other";
}

const ANCHOR = new Set(["active", "module", "connector", "switch"]);
const EDGE = new Set(["connector", "switch", "module"]);

function prepare(parts, clearance) {
  return parts.map((p) => {
    const b = p.bbox || { minX: p.x - 0.5, minY: p.y - 0.5, maxX: p.x + 0.5, maxY: p.y + 0.5 };
    const w = Math.max(b.maxX - b.minX, 0.2) + clearance;
    const h = Math.max(b.maxY - b.minY, 0.2) + clearance;
    const cx = (b.minX + b.maxX) / 2;
    const cy = (b.minY + b.maxY) / 2;
    const nets = [...new Set((p.pads || []).map((x) => x.net).filter(Boolean))];
    return { ...p, kind: classify(p), w, h, cx, cy, dx: cx - p.x, dy: cy - p.y, nets, placed: false, fixed: false };
  });
}

function netIndex(items) {
  const map = new Map();
  for (const it of items) for (const n of it.nets) (map.get(n) || map.set(n, []).get(n)).push(it);
  return map;
}

function weight(net, members) {
  const k = netKind(net);
  if (k === "ground" || members < 2) return 0;
  const base = k === "power" ? 0.25 : 1;
  return members > 8 ? (base * 4) / (members - 1) : base;
}

function overlaps(a, ax, ay, b) {
  return Math.abs(ax - b.cx) * 2 < a.w + b.w && Math.abs(ay - b.cy) * 2 < a.h + b.h;
}

function inside(it, x, y, board, margin) {
  const m = margin - 1e-6;
  return x - it.w / 2 >= board.minX + m && x + it.w / 2 <= board.maxX - m && y - it.h / 2 >= board.minY + m && y + it.h / 2 <= board.maxY - m;
}

export function hpwl(items, nets) {
  let total = 0;
  for (const [net, members] of nets) {
    const w = weight(net, members.length);
    if (!w) continue;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const m of members) {
      x0 = Math.min(x0, m.cx);
      x1 = Math.max(x1, m.cx);
      y0 = Math.min(y0, m.cy);
      y1 = Math.max(y1, m.cy);
    }
    total += (x1 - x0 + (y1 - y0)) * (netKind(net) === "power" ? 0.25 : 1);
  }
  return total;
}

function boardFor(items, opts, aspect = 1.4) {
  const area = items.filter((i) => i.kind !== "hole").reduce((s, i) => s + i.w * i.h, 0);
  const total = Math.max(area * 2.5 + (opts.reserve_mm2 ?? 0), 100);
  const side = opts.min_side_mm ?? 0;
  const widest = Math.max(Math.max(...items.map((i) => i.w), 5) + 4, side);
  const tallest = Math.max(Math.max(...items.map((i) => i.h), 5) + 4, side);
  const width = Math.ceil(Math.max(Math.sqrt(total * aspect), widest));
  const height = Math.ceil(Math.max(total / width, tallest));
  return { minX: 0, minY: 0, maxX: width, maxY: height };
}

function* spiral(x, y, step, maxR) {
  yield [x, y];
  for (let r = step; r <= maxR; r += step) {
    const n = Math.max(8, Math.round((2 * Math.PI * r) / step));
    for (let i = 0; i < n; i++) {
      const a = (2 * Math.PI * i) / n;
      yield [x + r * Math.cos(a), y + r * Math.sin(a)];
    }
  }
}

export function place(parts, opts = {}) {
  const clearance = opts.clearance_mm ?? 0.6;
  const margin = opts.edge_margin_mm ?? 0.8;
  const keep = new Set(opts.keep || []);
  const items = prepare(parts, clearance);
  const nets = netIndex(items);
  const board = opts.board || boardFor(items, opts);
  const bw = board.maxX - board.minX;
  const bh = board.maxY - board.minY;
  const step = Math.max(0.5, Math.min(bw, bh) / 80);
  const maxR = Math.hypot(bw, bh);
  const placed = [];
  const notes = [];

  for (const it of items) {
    if (it.locked || keep.has(it.designator) || it.kind === "hole" || it.kind === "fiducial") {
      it.fixed = it.placed = true;
      placed.push(it);
    }
  }

  for (const o of opts.obstacles || []) placed.push({ designator: "hole", kind: "hole", w: o.d + clearance, h: o.d + clearance, cx: o.x, cy: o.y, nets: [], fixed: true, placed: true });

  const free = (it, x, y) => inside(it, x, y, board, margin) && !placed.some((o) => o !== it && overlaps(it, x, y, o));
  const neighbours = (it) => {
    const out = [];
    for (const n of it.nets) {
      const w = weight(n, nets.get(n).length);
      if (w) for (const m of nets.get(n)) if (m !== it) out.push([m, w]);
    }
    return out;
  };
  const cost = (it, x, y) => {
    let c = 0;
    for (const [m, w] of neighbours(it)) if (m.placed) c += w * (Math.abs(m.cx - x) + Math.abs(m.cy - y));
    return c;
  };
  const commit = (it, x, y) => {
    it.cx = x;
    it.cy = y;
    it.placed = true;
    placed.push(it);
  };
  const seek = (it, x, y, pick = 60, pull = 0.15) => {
    let best = null;
    let seen = 0;
    for (const [px, py] of spiral(x, y, step, maxR)) {
      if (!free(it, px, py)) continue;
      const c = cost(it, px, py) + pull * (Math.abs(px - x) + Math.abs(py - y));
      if (!best || c < best[2]) best = [px, py, c];
      if (++seen >= pick) break;
    }
    return best;
  };

  const movable = items.filter((i) => !i.fixed);
  const src = movable.length ? movable : items;
  const sx0 = Math.min(...src.map((i) => i.cx));
  const sx1 = Math.max(...src.map((i) => i.cx));
  const sy0 = Math.min(...src.map((i) => i.cy));
  const sy1 = Math.max(...src.map((i) => i.cy));
  const map = (it) => [
    board.minX + margin + it.w / 2 + ((it.cx - sx0) / Math.max(sx1 - sx0, 1e-6)) * Math.max(bw - 2 * margin - it.w, 0),
    board.minY + margin + it.h / 2 + ((it.cy - sy0) / Math.max(sy1 - sy0, 1e-6)) * Math.max(bh - 2 * margin - it.h, 0),
  ];

  const edgeParts = movable.filter((i) => EDGE.has(i.kind)).sort((a, b) => b.w * b.h - a.w * a.h);
  for (const it of edgeParts) {
    const [mx, my] = map(it);
    const d = { left: mx - board.minX, right: board.maxX - mx, bottom: my - board.minY, top: board.maxY - my };
    const order = Object.keys(d).sort((a, b) => d[a] - d[b]);
    if (it.kind === "module") order.sort((a, b) => (a === "top" ? -1 : b === "top" ? 1 : 0));
    let done = null;
    for (const edge of order) {
      const vertical = edge === "left" || edge === "right";
      const fixedCoord = edge === "left" ? board.minX + margin + it.w / 2 : edge === "right" ? board.maxX - margin - it.w / 2 : edge === "bottom" ? board.minY + margin + it.h / 2 : board.maxY - margin - it.h / 2;
      const along = vertical ? my : mx;
      const lo = vertical ? board.minY + margin + it.h / 2 : board.minX + margin + it.w / 2;
      const hi = vertical ? board.maxY - margin - it.h / 2 : board.maxX - margin - it.w / 2;
      for (let k = 0; k <= 4 * maxR / step && !done; k++) {
        const off = Math.ceil(k / 2) * step * (k % 2 ? 1 : -1);
        const a = Math.min(Math.max(along + off, lo), hi);
        const [x, y] = vertical ? [fixedCoord, a] : [a, fixedCoord];
        if (free(it, x, y)) done = [x, y, edge];
        if (Math.abs(off) > hi - lo + step) break;
      }
      if (done) break;
    }
    if (done) {
      commit(it, done[0], done[1]);
      it.edge = done[2];
    }
  }

  const owner = new Map();
  const anchors = movable.filter((i) => ANCHOR.has(i.kind) && !i.placed).sort((a, b) => b.nets.length - a.nets.length || b.w * b.h - a.w * a.h);
  const allAnchors = items.filter((i) => ANCHOR.has(i.kind));
  const load = new Map();
  for (const it of items) {
    if (ANCHOR.has(it.kind) || it.fixed) continue;
    let best = null;
    for (const a of allAnchors) {
      let s = 0;
      for (const n of it.nets) {
        if (!a.nets.includes(n)) continue;
        const k = netKind(n);
        s += k === "signal" ? 1 : k === "power" ? (it.kind === "cap" ? 0.8 : 0.3) : 0;
      }
      if (!s) continue;
      s -= 0.05 * (load.get(a) || 0);
      if (!best || s > best[1]) best = [a, s];
    }
    if (best) {
      owner.set(it, best[0]);
      load.set(best[0], (load.get(best[0]) || 0) + 1);
    }
  }

  for (const a of anchors) {
    const [mx, my] = map(a);
    const spot = seek(a, mx, my, 40);
    if (spot) commit(a, spot[0], spot[1]);
  }

  const members = (a) => items.filter((i) => owner.get(i) === a && !i.placed);
  const rank = (it, a) => {
    const k = it.kind === "cap" && it.nets.some((n) => netKind(n) === "ground") && it.nets.some((n) => netKind(n) === "power") ? 0 : it.kind === "crystal" ? 1 : 2;
    return k * 100 - it.nets.filter((n) => a.nets.includes(n)).length;
  };
  for (const a of items.filter((i) => ANCHOR.has(i.kind) && i.placed)) {
    for (const it of members(a).sort((x, y) => rank(x, a) - rank(y, a))) {
      const spot = seek(it, a.cx, a.cy, 80, rank(it, a) < 200 ? 3 : 0.15);
      if (spot) commit(it, spot[0], spot[1]);
    }
  }

  for (const it of movable.filter((i) => !i.placed)) {
    const linked = neighbours(it).filter(([m]) => m.placed);
    const [x, y] = linked.length ? [linked.reduce((s, [m]) => s + m.cx, 0) / linked.length, linked.reduce((s, [m]) => s + m.cy, 0) / linked.length] : map(it);
    const spot = seek(it, x, y, 60);
    if (spot) commit(it, spot[0], spot[1]);
  }

  const before = hpwl(items, nets);
  for (let pass = 0; pass < (opts.passes ?? 3); pass++) {
    let improved = 0;
    for (const it of movable.filter((i) => i.placed && !EDGE.has(i.kind) && !(owner.get(i) && rank(i, owner.get(i)) < 200))) {
      const linked = neighbours(it);
      if (!linked.length) continue;
      const tw = linked.reduce((s, [, w]) => s + w, 0);
      const tx = linked.reduce((s, [m, w]) => s + m.cx * w, 0) / tw;
      const ty = linked.reduce((s, [m, w]) => s + m.cy * w, 0) / tw;
      const here = cost(it, it.cx, it.cy);
      const i = placed.indexOf(it);
      placed.splice(i, 1);
      const spot = seek(it, tx, ty, 30);
      if (spot && cost(it, spot[0], spot[1]) < here - 0.05) {
        it.cx = spot[0];
        it.cy = spot[1];
        improved++;
      }
      placed.push(it);
    }
    if (!improved) break;
  }

  const unplaced = movable.filter((i) => !i.placed).map((i) => i.designator);
  if (unplaced.length) notes.push(`No room for ${unplaced.join(", ")}: enlarge the board or move parts to the bottom side.`);
  const r = (v) => Math.round(v * 1000) / 1000;
  return {
    board: { min_x: r(board.minX), min_y: r(board.minY), max_x: r(board.maxX), max_y: r(board.maxY), width_mm: r(bw), height_mm: r(bh), suggested: !opts.board },
    placements: movable.filter((i) => i.placed).map((i) => ({ designator: i.designator, x: r(i.cx - i.dx), y: r(i.cy - i.dy), kind: i.kind, ...(i.edge ? { edge: i.edge } : {}), ...(owner.get(i) ? { near: owner.get(i).designator } : {}) })),
    fixed: items.filter((i) => i.fixed).map((i) => i.designator),
    unplaced,
    wirelength_mm: { after_first_pass: r(before), final: r(hpwl(items, nets)) },
    notes,
  };
}

function gap(a, b) {
  const dx = Math.max(0, Math.abs(a.cx - b.cx) - (a.w + b.w) / 2);
  const dy = Math.max(0, Math.abs(a.cy - b.cy) - (a.h + b.h) / 2);
  return Math.hypot(dx, dy);
}

export function audit(parts, board, opts = {}) {
  const items = prepare(parts, 0);
  const nets = netIndex(items);
  const findings = [];
  const add = (severity, rule, refs, message, fix) => findings.push({ severity, rule, parts: refs, message, fix });
  const inset = opts.edge_clearance_mm ?? 0.3;
  if (!board) add("error", "outline", [], "The board has no outline.", "Draw one with add_board_outline (or design_board).");
  for (const it of items) {
    if (it.kind === "hole" || it.kind === "fiducial") continue;
    if (board) {
      const out = it.cx - it.w / 2 < board.minX + inset || it.cx + it.w / 2 > board.maxX - inset || it.cy - it.h / 2 < board.minY + inset || it.cy + it.h / 2 > board.maxY - inset;
      const away = it.cx + it.w / 2 < board.minX || it.cx - it.w / 2 > board.maxX || it.cy + it.h / 2 < board.minY || it.cy - it.h / 2 > board.maxY;
      if (away) add("error", "off_board", [it.designator], `${it.designator} is outside the board.`, "Place it with smart_place or set_component_placements.");
      else if (out && !(EDGE.has(it.kind) && opts.allow_overhang !== false)) add("warning", "edge_clearance", [it.designator], `${it.designator} is closer than ${inset} mm to the board edge.`, "Move it inwards.");
      if (EDGE.has(it.kind) && it.kind !== "switch" && !away) {
        const d = Math.min(it.cx - it.w / 2 - board.minX, board.maxX - it.cx - it.w / 2, it.cy - it.h / 2 - board.minY, board.maxY - it.cy - it.h / 2);
        if (d > 2) add(it.kind === "module" ? "error" : "warning", "edge_part", [it.designator], `${it.designator} (${it.kind}) sits ${d.toFixed(1)} mm from the nearest edge.`, it.kind === "module" ? "Put the module's antenna end at a board edge with no copper under it." : "Put connectors on an edge so cables plug in cleanly.");
      }
    }
  }
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      if (a.layer !== b.layer && a.layer && b.layer) continue;
      if (Math.abs(a.cx - b.cx) * 2 < a.w + b.w - 0.05 && Math.abs(a.cy - b.cy) * 2 < a.h + b.h - 0.05) add("error", "overlap", [a.designator, b.designator], `${a.designator} and ${b.designator} overlap.`, "Spread them apart.");
    }
  const ics = items.filter((i) => i.kind === "active" || i.kind === "module");
  const maxDecap = opts.decoupling_mm ?? 3;
  for (const c of items.filter((i) => i.kind === "cap")) {
    const pwr = c.nets.filter((n) => netKind(n) === "power");
    if (!pwr.length || !c.nets.some((n) => netKind(n) === "ground")) continue;
    const users = ics.filter((u) => u.nets.some((n) => pwr.includes(n)));
    if (!users.length) continue;
    const near = users.reduce((b, u) => (gap(c, u) < gap(c, b) ? u : b));
    const d = gap(c, near);
    if (d > maxDecap) add("warning", "decoupling", [c.designator, near.designator], `Decoupling cap ${c.designator} (${pwr.join(", ")}) is ${d.toFixed(1)} mm from ${near.designator}.`, `Move it within ${maxDecap} mm of ${near.designator}'s supply pin.`);
  }
  for (const y of items.filter((i) => i.kind === "crystal")) {
    const users = ics.filter((u) => u.nets.some((n) => y.nets.includes(n) && netKind(n) === "signal"));
    if (!users.length) continue;
    const d = Math.min(...users.map((u) => gap(y, u)));
    if (d > 5) add("warning", "crystal", [y.designator], `Crystal ${y.designator} is ${d.toFixed(1)} mm from its IC.`, "Keep crystals within 5 mm of the clock pins, with short equal traces.");
  }
  const wl = hpwl(items, nets);
  const score = Math.max(0, 100 - findings.reduce((s, f) => s + (f.severity === "error" ? 15 : 4), 0));
  return { score, errors: findings.filter((f) => f.severity === "error").length, warnings: findings.filter((f) => f.severity === "warning").length, wirelength_mm: Math.round(wl * 10) / 10, findings };
}
