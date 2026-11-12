import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import * as S from "./scripts.mjs";
import { json, fail, text, image } from "./result.mjs";
import { place, audit } from "./placer.mjs";

export const script = (body, args) => `${S.PRELUDE}\nconst A = ${JSON.stringify(args ?? {})};\n${body}`;

export function failure(e) {
  if (e.includes("No EasyEDA window") || e.includes("not connected"))
    return `${e}\n\nTo connect: open EasyEDA Pro (desktop), install and enable the "Run API Gateway" extension (https://jlc-ext.com/item/oshwhub/run-api-gateway), allow it external interaction, and keep the project open. Then call setu_status.`;
  return `EasyEDA reported: ${e}`;
}

const exec = (ctx, body, args, secs) => ctx.bridge.execute(script(body, args), secs * 1000);

async function run(ctx, body, args, secs, output) {
  let value;
  try {
    value = await exec(ctx, body, args, secs);
  } catch (e) {
    return fail(failure(e.message));
  }
  if (output === "image") return value?.base64 ? image(value.base64, value.mime || "image/png", "EasyEDA Pro view") : fail("EasyEDA returned no image");
  if (output === "files") return saveFiles(value, args);
  return json(value);
}

function documentsDir() {
  if (process.platform === "win32") {
    try {
      const out = execFileSync("reg", ["query", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders", "/v", "Personal"], { encoding: "utf8", windowsHide: true });
      const m = out.match(/Personal\s+REG_\w+\s+(.+)/);
      if (m) {
        const p = m[1].trim().replace(/%([^%]+)%/g, (_, v) => process.env[v] ?? `%${v}%`);
        if (existsSync(p)) return p;
      }
    } catch {}
  }
  const docs = join(homedir(), "Documents");
  return existsSync(docs) ? docs : homedir();
}

export function stamp(date = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}_${p(date.getHours())}${p(date.getMinutes())}`;
}

export function safeName(name) {
  const cleaned = String(name).replace(/[^\p{L}\p{N}\-_. ]/gu, "_").replace(/^[. ]+|[. ]+$/g, "");
  return cleaned || "file";
}

function saveFiles(value, args) {
  const dir = args.output_dir || join(documentsDir(), "SETU", `${safeName(args.name || "board")}_${stamp()}`);
  try {
    mkdirSync(dir, { recursive: true });
  } catch (e) {
    return fail(`Cannot create ${dir}: ${e.message}`);
  }
  const written = [];
  for (const f of value?.files || []) {
    if (!f?.base64) continue;
    const name = safeName(f.name || "file");
    const bytes = Buffer.from(f.base64, "base64");
    let path = join(dir, name);
    const dot = name.lastIndexOf(".");
    for (let n = 2; existsSync(path); n++) path = join(dir, dot > 0 ? `${name.slice(0, dot)}-${n}${name.slice(dot)}` : `${name}-${n}`);
    try {
      writeFileSync(path, bytes);
    } catch (e) {
      return fail(`Cannot write ${path}: ${e.message}`);
    }
    written.push({ file: path, bytes: bytes.length });
  }
  return json({ folder: dir, files: written });
}

async function status(ctx) {
  const st = await ctx.bridge.status();
  try {
    st.project = await exec(ctx, S.PROJECT_INFO, {}, 10);
  } catch (e) {
    st.connection = failure(e.message);
  }
  return json(st);
}

async function select(ctx, a) {
  try {
    await ctx.bridge.select(a.window_id);
    return text(`Active EasyEDA window: ${a.window_id}`);
  } catch (e) {
    return fail(e.message);
  }
}

const runScript = (ctx, a) => run(ctx, String(a.code ?? ""), {}, Math.min(Number(a.timeout_s) || 60, 900), "json");

const holeSpots = (b, inset, d) => [
  { x: b.minX + inset, y: b.minY + inset, d },
  { x: b.maxX - inset, y: b.minY + inset, d },
  { x: b.maxX - inset, y: b.maxY - inset, d },
  { x: b.minX + inset, y: b.maxY - inset, d },
];

async function smartPlace(ctx, a) {
  let data;
  try {
    data = await exec(ctx, S.READ_BOARD, {}, 120);
  } catch (e) {
    return fail(failure(e.message));
  }
  const parts = data.parts.filter((p) => !a.layer || p.layer === a.layer);
  if (!parts.length) return fail("The PCB has no footprints. Run import_changes_to_pcb first.");
  const plan = place(parts, { board: data.board || undefined, clearance_mm: a.clearance_mm, edge_margin_mm: a.edge_margin_mm, keep: a.keep });
  if (!data.board) plan.notes.push(`The board has no outline: draw ${plan.board.width_mm} × ${plan.board.height_mm} mm at (${plan.board.min_x}, ${plan.board.min_y}) with add_board_outline, then run smart_place again.`);
  if (a.dry_run || !data.board) return json({ applied: false, ...plan });
  try {
    await exec(ctx, S.SET_PLACEMENTS, { placements: plan.placements.map(({ designator, x, y }) => ({ designator, x, y })) }, 180);
  } catch (e) {
    return fail(failure(e.message));
  }
  return json({ applied: true, ...plan });
}

async function auditLayout(ctx, a) {
  let data;
  try {
    data = await exec(ctx, S.READ_BOARD, {}, 120);
  } catch (e) {
    return fail(failure(e.message));
  }
  return json({ board: data.board, components: data.parts.length, ...audit(data.parts, data.board, { decoupling_mm: a.decoupling_mm, edge_clearance_mm: a.edge_clearance_mm }) });
}

async function designBoard(ctx, a) {
  const steps = [];
  const step = async (name, body, args, secs) => {
    try {
      const out = await exec(ctx, body, args, secs);
      steps.push({ step: name, ok: true });
      return out;
    } catch (e) {
      steps.push({ step: name, ok: false, error: e.message });
      throw e;
    }
  };
  const report = (extra = {}) => json({ steps, ...extra });
  try {
    if (a.import !== false) await step("import changes from the schematic", S.IMPORT_CHANGES, {}, 120);
    if (a.layers) await step(`set ${a.layers} copper layers`, S.SET_COPPER_LAYERS, { count: a.layers }, 30);
    let data = await step("read the board", S.READ_BOARD, {}, 120);
    if (!data.parts.length) return fail("The PCB has no footprints after importing. Place the parts in the schematic first.");
    let board = data.board;
    if (!board || a.width_mm || a.replace_outline) {
      const pad = (a.hole_pad_mm ?? 6) + 1;
      const reserve = a.mounting_holes ? { reserve_mm2: 4 * pad * pad * 2, min_side_mm: 2 * (a.hole_inset_mm ?? 3.5) + pad + 8 } : {};
      const size = a.width_mm && a.height_mm ? { width_mm: a.width_mm, height_mm: a.height_mm } : place(data.parts, { clearance_mm: a.clearance_mm, ...reserve }).board;
      const x = a.x_mm ?? 0;
      const y = a.y_mm ?? 0;
      await step(`draw a ${size.width_mm} × ${size.height_mm} mm outline`, S.BOARD_OUTLINE, { x_mm: x, y_mm: y, width_mm: size.width_mm, height_mm: size.height_mm, corner_radius_mm: a.corner_radius_mm ?? 2, replace: true }, 60);
      board = { minX: x, minY: y, maxX: x + size.width_mm, maxY: y + size.height_mm };
    }
    const obstacles = [];
    if (a.mounting_holes) {
      const d = a.hole_pad_mm ?? 6;
      const spots = holeSpots(board, a.hole_inset_mm ?? 3.5, d);
      await step("place 4 corner mounting holes", S.MOUNTING_HOLES, { holes: spots.map(({ x, y }) => ({ x, y })), drill_mm: a.hole_drill_mm ?? 3.2, pad_mm: d, net: a.hole_net }, 60);
      obstacles.push(...spots);
    }
    const plan = place(data.parts, { board, clearance_mm: a.clearance_mm, keep: a.keep, obstacles });
    await step(`place ${plan.placements.length} parts`, S.SET_PLACEMENTS, { placements: plan.placements.map(({ designator, x, y }) => ({ designator, x, y })) }, 180);
    const ground = a.ground_net ?? "GND";
    if (a.pours !== false) {
      await step(`${ground} pour on top`, S.ADD_POUR, { net: ground, layer: "top", inset_mm: 0.5, name: `${ground}_TOP` }, 60);
      await step(`${ground} pour on bottom`, S.ADD_POUR, { net: ground, layer: "bottom", inset_mm: 0.5, name: `${ground}_BOTTOM` }, 60);
    }
    let routing = null;
    if (a.route !== false) {
      const ignore = a.pours !== false ? [ground] : undefined;
      routing = await step("autoroute", S.AUTO_ROUTE, { keep_existing: true, ignore_nets: ignore, priority: "completion" }, 900);
      if (a.pours !== false) await step("rebuild copper pours", S.REBUILD_POURS, {}, 120);
    }
    const drc = await step("design rule check", S.RUN_DRC, { strict: true, limit: 50 }, 300);
    data = await step("read the finished board", S.READ_BOARD, {}, 120);
    await step("save", S.SAVE, { target: "pcb" }, 30);
    return report({
      board: plan.board,
      placement: { placed: plan.placements.length, unplaced: plan.unplaced, wirelength_mm: plan.wirelength_mm, notes: plan.notes },
      routing,
      drc,
      layout_audit: audit(data.parts, data.board || board),
      next: "Look at the board with view_design, fix every DRC item and audit finding, then run the easyeda-pro-review-agent. Silkscreen still needs the easyeda-pro-silkscreen pass.",
    });
  } catch (e) {
    return { ...report({ stopped: failure(e.message) }), isError: true };
  }
}

const obj = (properties, required = []) => ({ type: "object", properties, required });
const point = { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2 };
const layer = (description) => ({ type: "string", description });
const str = { type: "string" };
const num = { type: "number" };
const bool = (d) => ({ type: "boolean", ...(d === undefined ? {} : { default: d }) });
const strings = { type: "array", items: str };
const eda = (name, description, inputSchema, body, secs, output = "json") => ({ name, description, inputSchema, run: (a, ctx) => run(ctx, body, a, secs, output) });

export const tools = [
  {
    name: "setu_status",
    description:
      "Check the link to EasyEDA Pro: the bridge port, every connected EasyEDA window and which one is active, and the open project. Call it first in a session, and whenever a tool says EasyEDA is not connected.",
    inputSchema: obj({}),
    run: (a, ctx) => status(ctx),
  },
  {
    name: "select_window",
    description: "Choose which EasyEDA Pro window SETU works in when several are open (window ids come from setu_status).",
    inputSchema: obj({ window_id: str }, ["window_id"]),
    run: (a, ctx) => select(ctx, a),
  },
  eda("get_project_info", "The open EasyEDA Pro project: boards, schematics and their pages, PCBs (with uuids for open_document) and the document in front.", obj({}), S.PROJECT_INFO, 20),
  eda("open_document", "Bring a schematic page or PCB to the front by its uuid (from get_project_info). Schematic and PCB tools also switch documents by themselves.", obj({ uuid: str }, ["uuid"]), S.OPEN_DOCUMENT, 20),
  eda("save_project", "Save the schematic and the PCB in EasyEDA Pro. Save after every finished step.", obj({ target: { type: "string", enum: ["all", "schematic", "pcb"], default: "all" } }), S.SAVE, 30),
  eda(
    "backup_project",
    "Download the whole project as an .epro file into a dated folder (default Documents/SETU) before a large change, so it can be restored by importing it.",
    obj({ name: str, output_dir: str }),
    S.PROJECT_BACKUP,
    120,
    "files",
  ),
  eda(
    "search_parts",
    "Search EasyEDA's part library (LCSC/JLCPCB parts with symbol and footprint) by keyword or part number. Returns uuid and library_uuid for place_schematic_component, footprint name and properties such as the LCSC number and stock.",
    obj({ query: str, limit: { type: "integer", default: 10, maximum: 50 }, page: { type: "integer", default: 1 } }, ["query"]),
    S.SEARCH_PARTS,
    30,
  ),
  eda("get_parts_by_lcsc", "Look up exact LCSC part numbers (C25804, ...) in EasyEDA's library.", obj({ lcsc: strings }, ["lcsc"]), S.PARTS_BY_LCSC, 30),
  eda(
    "list_schematic_components",
    "Every part in the schematic with id, designator, value, position (schematic units), rotation, footprint and LCSC number. include_flags adds power/ground flags and net ports.",
    obj({ all_pages: bool(true), include_flags: bool(false) }),
    S.LIST_SCH_COMPONENTS,
    30,
  ),
  eda(
    "get_component_pins",
    "Pins of a part: in the schematic (number, name, position — use these to draw wires exactly to pins) or on the PCB (pad numbers and nets).",
    obj({ designator: str, id: str, side: { type: "string", enum: ["schematic", "pcb"], default: "schematic" } }),
    S.PINS,
    30,
  ),
  eda(
    "place_schematic_component",
    "Place a part from EasyEDA's library in the schematic, by LCSC number or by uuid + library_uuid from search_parts. x/y in schematic units (read existing positions with list_schematic_components). Optionally set its designator.",
    obj(
      {
        lcsc: str,
        uuid: str,
        library_uuid: str,
        x: num,
        y: num,
        rotation: { type: "number", default: 0 },
        mirror: bool(false),
        designator: str,
        sub_part: str,
        add_to_bom: bool(true),
        add_to_pcb: bool(true),
      },
      ["x", "y"],
    ),
    S.PLACE_SCH_COMPONENT,
    30,
  ),
  eda(
    "modify_schematic_component",
    "Move, rotate, mirror or re-annotate a schematic part, or set its value, manufacturer and supplier part numbers, BOM/PCB inclusion (DNP = in_bom false) and other properties.",
    obj({
      designator: str,
      id: str,
      x: num,
      y: num,
      rotation: num,
      mirror: { type: "boolean" },
      new_designator: str,
      name: { type: "string", description: "Value / name shown on the symbol" },
      manufacturer: str,
      manufacturer_part: str,
      supplier: str,
      supplier_part: str,
      in_bom: { type: "boolean" },
      in_pcb: { type: "boolean" },
      properties: { type: "object" },
    }),
    S.MODIFY_SCH_COMPONENT,
    30,
  ),
  eda(
    "add_wires",
    "Draw schematic wires. Each wire is a polyline of [x, y] points in schematic units, ending exactly on pin positions from get_component_pins. Give a net name to label the wire.",
    obj({ wires: { type: "array", items: obj({ points: { type: "array", items: point, minItems: 2 }, net: str }, ["points"]) } }, ["wires"]),
    S.ADD_WIRE,
    60,
  ),
  eda(
    "add_net_flags",
    "Place power/ground symbols and net ports in the schematic: kind power, ground, analog_ground, protect_ground, port_in, port_out or port_bi, with the net name (e.g. +3V3, GND).",
    obj(
      {
        flags: {
          type: "array",
          items: obj(
            { kind: { type: "string", enum: ["power", "ground", "analog_ground", "protect_ground", "port_in", "port_out", "port_bi"] }, net: str, x: num, y: num, rotation: { type: "number", default: 0 } },
            ["kind", "net", "x", "y"],
          ),
        },
      },
      ["flags"],
    ),
    S.ADD_NET_FLAG,
    60,
  ),
  eda(
    "add_schematic_text",
    'Place text in the schematic: numbered block titles ("1 │ POWER INPUT — USB-C 5 V"), a note line with key values under each block, and design notes. Optional size, bold, color (#RRGGBB).',
    obj({ texts: { type: "array", items: obj({ text: str, x: num, y: num, size: num, bold: { type: "boolean" }, color: str, rotation: num }, ["text", "x", "y"]) } }, ["texts"]),
    S.SCH_TEXT,
    60,
  ),
  eda("delete_schematic_items", "Delete schematic parts, wires, texts or buses by id.", obj({ ids: strings }, ["ids"]), S.DELETE_SCH, 60),
  eda(
    "run_erc",
    "EasyEDA's schematic check (ERC): every error and warning with its rule, net and parts. Fix every error before the PCB.",
    obj({ strict: bool(true), limit: { type: "integer", default: 200 } }),
    S.RUN_ERC,
    120,
  ),
  eda("list_nets", "Nets of the schematic, or of the PCB with their routed length in mm.", obj({ side: { type: "string", enum: ["schematic", "pcb"], default: "schematic" } }), S.LIST_NETS, 30),
  eda("get_netlist", "The full netlist text of the schematic or the PCB, for checking every connection.", obj({ side: { type: "string", enum: ["schematic", "pcb"], default: "schematic" } }), S.NETLIST, 60),
  eda(
    "import_changes_to_pcb",
    "Update the PCB from the schematic (EasyEDA's Import Changes): new parts, nets and footprints arrive on the board. Run it after every schematic change and before placing.",
    obj({}),
    S.IMPORT_CHANGES,
    120,
  ),
  eda(
    "link_pcb_to_schematic",
    "Put a PCB and its schematic into one board so they share nets (needed after importing a PCB on its own, e.g. from KiCad: such a PCB has no nets, DRC passes without checking connections and Import Changes cannot reach it). Uuids come from get_project_info. Run import_changes_to_pcb afterwards.",
    obj({ schematic_uuid: str, pcb_uuid: str }, ["schematic_uuid", "pcb_uuid"]),
    S.LINK_BOARD,
    60,
  ),
  eda("get_board_info", "Board summary: outline size (mm), copper layer count, stackup, rule set, parts on each side and net count.", obj({}), S.BOARD_INFO, 30),
  eda(
    "add_board_outline",
    "Draw the board outline as a rectangle in mm with optional rounded corners (replaces the existing outline unless replace is false). Size the board from its parts first; 2-3 mm corner radius looks finished.",
    obj(
      {
        width_mm: { type: "number", exclusiveMinimum: 0 },
        height_mm: { type: "number", exclusiveMinimum: 0 },
        x_mm: { type: "number", default: 0 },
        y_mm: { type: "number", default: 0 },
        corner_radius_mm: { type: "number", default: 0 },
        replace: bool(true),
      },
      ["width_mm", "height_mm"],
    ),
    S.BOARD_OUTLINE,
    60,
  ),
  eda(
    "add_mounting_holes",
    "Place mounting holes (mm): M3 = 3.2 mm drill with a 6 mm plated pad by default; set plated false for a bare hole, or a net (GND) to ground the pad.",
    obj(
      {
        drill_mm: { type: "number", default: 3.2 },
        pad_mm: { type: "number", default: 6 },
        plated: bool(true),
        net: str,
        holes: { type: "array", items: obj({ x: num, y: num, drill_mm: num, pad_mm: num, plated: { type: "boolean" }, net: str }, ["x", "y"]) },
      },
      ["holes"],
    ),
    S.MOUNTING_HOLES,
    60,
  ),
  eda("list_pcb_components", "Every footprint on the PCB: designator, position (mm), rotation, side, footprint, LCSC number and lock state.", obj({ layer: layer("top or bottom; omit for both") }), S.LIST_PCB_COMPONENTS, 30),
  eda(
    "set_component_placements",
    "Move, rotate, flip (layer top/bottom) or lock many footprints in one call. Positions in mm in the board's coordinates from list_pcb_components.",
    obj(
      {
        placements: {
          type: "array",
          items: obj({ designator: str, x: num, y: num, rotation: num, layer: { type: "string", enum: ["top", "bottom"] }, locked: { type: "boolean" } }, ["designator"]),
        },
      },
      ["placements"],
    ),
    S.SET_PLACEMENTS,
    120,
  ),
  {
    name: "smart_place",
    description:
      "Professional placement in one call, computed by SETU (not EasyEDA's auto layout): connectors and switches on the nearest board edge, wireless modules on an edge, ICs where the schematic put them, decoupling caps and crystals packed next to the IC they serve, every other part beside what it connects to, then a wirelength-reducing pass. Locked parts and parts in keep stay put. Needs a board outline; without one it returns the board size to draw. dry_run returns the plan without moving anything.",
    inputSchema: obj({
      keep: { ...strings, description: "Designators that must not move" },
      clearance_mm: { type: "number", default: 0.6, description: "Gap between footprints" },
      edge_margin_mm: { type: "number", default: 0.8 },
      layer: { type: "string", enum: ["top", "bottom"], description: "Place only this side" },
      dry_run: bool(false),
    }),
    run: (a, ctx) => smartPlace(ctx, a),
  },
  {
    name: "audit_layout",
    description:
      "Check the placement like a senior layout reviewer: parts off the board or too close to its edge, overlapping footprints, connectors and wireless modules away from an edge, decoupling caps too far from their IC, crystals too far from their clock pins, and the total wirelength. Returns a score out of 100 and every finding with its fix.",
    inputSchema: obj({ decoupling_mm: { type: "number", default: 3 }, edge_clearance_mm: { type: "number", default: 0.3 } }),
    run: (a, ctx) => auditLayout(ctx, a),
  },
  {
    name: "design_board",
    description:
      "Lay out the whole board in one call: import the schematic, set the layer count, draw a rounded outline sized from the parts (or width_mm × height_mm), optional M3 corner holes, smart_place, ground pours on both sides, autoroute the rest, rebuild pours, DRC, audit_layout and save. Returns every step and what is left to fix. Route power and sensitive nets by hand afterwards where the report says so.",
    inputSchema: obj({
      width_mm: num,
      height_mm: num,
      x_mm: { type: "number", default: 0 },
      y_mm: { type: "number", default: 0 },
      corner_radius_mm: { type: "number", default: 2 },
      replace_outline: bool(false),
      layers: { type: "integer", enum: [2, 4, 6] },
      mounting_holes: bool(false),
      hole_drill_mm: { type: "number", default: 3.2 },
      hole_pad_mm: { type: "number", default: 6 },
      hole_inset_mm: { type: "number", default: 3.5 },
      hole_net: str,
      keep: strings,
      clearance_mm: { type: "number", default: 0.6 },
      ground_net: { type: "string", default: "GND" },
      pours: bool(true),
      route: bool(true),
      import: bool(true),
    }),
    run: (a, ctx) => designBoard(ctx, a),
  },
  eda(
    "add_track",
    "Route a copper track as a polyline of [x, y] points in mm on one layer, for one net. Size power widths with calc_trace_width first.",
    obj({ net: str, layer: layer("top, bottom or inner1..inner30"), points: { type: "array", items: point, minItems: 2 }, width_mm: { type: "number", default: 0.25 } }, ["net", "layer", "points"]),
    S.ADD_TRACK,
    60,
  ),
  eda(
    "add_vias",
    "Place vias (mm). Defaults 0.3 mm drill / 0.6 mm diameter, which every fab builds.",
    obj({ net: str, drill_mm: { type: "number", default: 0.3 }, diameter_mm: { type: "number", default: 0.6 }, vias: { type: "array", items: obj({ x: num, y: num, net: str, drill_mm: num, diameter_mm: num }, ["x", "y"]) } }, ["vias"]),
    S.ADD_VIA,
    60,
  ),
  eda(
    "add_copper_pour",
    "Add a copper pour (zone) for a net on a layer. Without points it covers the board outline, inset by inset_mm.",
    obj({ net: str, layer: layer("top, bottom or inner1..inner30"), points: { type: "array", items: point, minItems: 3 }, inset_mm: { type: "number", default: 0.3 }, name: str, priority: { type: "integer", default: 1 } }, ["net", "layer"]),
    S.ADD_POUR,
    60,
  ),
  eda("rebuild_pours", "Rebuild (refill) every copper pour after moving parts or routing, so pours follow the new copper and clear keep-outs.", obj({}), S.REBUILD_POURS, 120),
  eda(
    "add_board_text",
    "Place silkscreen (or copper) text: labels, captions, product name, version. Size 1.0 mm is the smallest every fab prints; bottom-side text is mirrored automatically.",
    obj(
      {
        layer: layer("top_silk (default), bottom_silk, top or bottom"),
        size_mm: { type: "number", default: 1.0 },
        align: { type: "string", enum: ["center", "left", "right"], default: "center" },
        font: str,
        texts: { type: "array", items: obj({ text: str, x: num, y: num, layer: str, size_mm: num, stroke_mm: num, rotation: num }, ["text", "x", "y"]) },
      },
      ["texts"],
    ),
    S.ADD_BOARD_TEXT,
    60,
  ),
  eda("delete_pcb_items", "Delete PCB tracks, vias, pours, texts or footprints by id, or rip up every track and via of a net.", obj({ ids: strings, net: str }), S.DELETE_PCB, 120),
  eda(
    "auto_place",
    "EasyEDA's own automatic placement. Prefer smart_place; if you use this, review it against the layout skill and fix by hand with set_component_placements.",
    obj({}),
    S.AUTO_PLACE,
    300,
  ),
  eda(
    "auto_route",
    "EasyEDA's autorouter. Route power and sensitive nets by hand first, then route the rest here with keep_existing true. Optional: nets, ignore_nets, layers, priority completion|speed.",
    obj({ nets: strings, ignore_nets: strings, layers: strings, keep_existing: bool(true), priority: { type: "string", enum: ["completion", "speed"], default: "completion" } }),
    S.AUTO_ROUTE,
    900,
  ),
  eda(
    "run_drc",
    "EasyEDA's design rule check on the PCB: every violation (clearance, unrouted, width, hole...). A finished board has none.",
    obj({ strict: bool(true), limit: { type: "integer", default: 200 } }),
    S.RUN_DRC,
    300,
  ),
  eda("set_copper_layers", "Set the PCB's copper layer count (2, 4, 6, ...).", obj({ count: { type: "integer", minimum: 1, maximum: 32 } }, ["count"]), S.SET_COPPER_LAYERS, 30),
  eda(
    "get_design_rules",
    "The PCB's current rule set: clearances, track widths, via sizes, net classes, differential pairs and net rules. Read it before set_design_rules.",
    obj({}),
    S.DESIGN_RULES,
    30,
  ),
  eda(
    "set_design_rules",
    "Change the current rule set: patch is merged into the configuration that get_design_rules returns (same keys and units), then written back. Change only the keys you read; check with run_drc afterwards.",
    obj({ patch: { type: "object" } }, ["patch"]),
    S.SET_RULES,
    30,
  ),
  eda("create_net_class", "Create a net class (or add nets to an existing one), e.g. POWER for wide tracks.", obj({ name: str, nets: strings }, ["name", "nets"]), S.NET_CLASS, 30),
  eda(
    "create_differential_pair",
    "Declare a differential pair (USB D+/D-, Ethernet, ...) so EasyEDA routes and checks it as a pair.",
    obj({ name: str, positive: str, negative: str }, ["name", "positive", "negative"]),
    S.DIFF_PAIR,
    30,
  ),
  eda(
    "view_design",
    "Look at the design: a picture of the PCB (zoomed to the board) or the schematic as EasyEDA shows it now. Use it to review placement, routing and silkscreen with your own eyes.",
    obj({ view: { type: "string", enum: ["pcb", "schematic", "current"], default: "pcb" } }),
    S.SCREENSHOT,
    60,
    "image",
  ),
  eda(
    "export_manufacturing",
    "Write the manufacturing files into a dated folder (default Documents/SETU/<name>_<date>): gerber (zip with drills), bom (csv), pick_and_place (csv, mm), and optionally ipc2581, odb, step, netlist, pdf, dxf. The files are manufacturer-neutral.",
    obj({
      name: { type: "string", description: "File name prefix, e.g. the board name and revision" },
      output_dir: str,
      formats: { type: "array", items: { type: "string", enum: ["gerber", "bom", "pick_and_place", "ipc2581", "odb", "step", "netlist", "pdf", "dxf"] }, default: ["gerber", "bom", "pick_and_place"] },
    }),
    S.EXPORT_MANUFACTURING,
    600,
    "files",
  ),
  eda(
    "export_schematic",
    "Save the schematic as SVG or PNG into a dated folder for review or documentation.",
    obj({ name: str, format: { type: "string", enum: ["svg", "png"], default: "svg" }, output_dir: str }),
    S.EXPORT_SCHEMATIC,
    120,
    "files",
  ),
  {
    name: "run_script",
    description:
      "Run JavaScript inside EasyEDA Pro for anything no other tool covers. The code runs as the body of an async function with the global eda API (see the easyeda-api skill); it must return a JSON value. Helpers: S.mil(mm), S.mm(mil), S.layer('top'), S.pcb(), S.sch(). No comments in the code. Read before you write: check the API reference instead of guessing names or enum values.",
    inputSchema: obj({ code: str, timeout_s: { type: "integer", default: 60, maximum: 900 } }, ["code"]),
    run: (a, ctx) => runScript(ctx, a),
  },
];
