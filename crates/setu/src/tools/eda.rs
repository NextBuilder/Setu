use std::path::{Path, PathBuf};
use std::time::Duration;

use base64::Engine;
use serde_json::{json, Value};

use super::scripts::*;
use super::{Ctx, ToolDef};
use crate::mcp::protocol::CallToolResult;
use crate::tool;

#[derive(Clone, Copy)]
enum Output {
    Json,
    Files,
    Image,
}

pub fn script(body: &str, args: &Value) -> String {
    format!("{PRELUDE}\nconst A = {};\n{body}", args)
}

async fn run(
    ctx: &Ctx,
    body: &str,
    args: &Value,
    secs: u64,
    output: Output,
) -> anyhow::Result<CallToolResult> {
    let code = script(body, args);
    let value = match ctx.bridge.execute(&code, Duration::from_secs(secs)).await {
        Ok(v) => v,
        Err(e) => return Ok(CallToolResult::error(failure(&e.to_string()))),
    };
    Ok(match output {
        Output::Json => CallToolResult::json(&value),
        Output::Image => match value["base64"].as_str() {
            Some(data) => CallToolResult::image(
                data.to_string(),
                value["mime"].as_str().unwrap_or("image/png"),
                "EasyEDA Pro view",
            ),
            None => CallToolResult::error("EasyEDA returned no image"),
        },
        Output::Files => save_files(&value, args).await,
    })
}

fn failure(e: &str) -> String {
    if e.contains("No EasyEDA window") || e.contains("not connected") {
        format!("{e}\n\nTo connect: open EasyEDA Pro (desktop), install and enable the \"Run API Gateway\" extension (https://jlc-ext.com/item/oshwhub/run-api-gateway), allow it external interaction, and keep the project open. Then call setu_status.")
    } else {
        format!("EasyEDA reported: {e}")
    }
}

fn civil_date(secs: u64) -> String {
    let days = (secs / 86_400) as i64;
    let rem = secs % 86_400;
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = yoe + era * 400 + i64::from(m <= 2);
    format!(
        "{y:04}-{m:02}-{d:02}_{:02}{:02}",
        rem / 3600,
        rem % 3600 / 60
    )
}

fn default_dir(args: &Value) -> PathBuf {
    let base = dirs::document_dir()
        .or_else(dirs::home_dir)
        .unwrap_or_else(|| PathBuf::from("."));
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let name = args["name"].as_str().unwrap_or("board");
    base.join("SETU")
        .join(format!("{name}_{}", civil_date(secs)))
}

fn safe_name(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || "-_. ".contains(c) {
                c
            } else {
                '_'
            }
        })
        .collect();
    let trimmed = cleaned.trim_matches(|c| c == '.' || c == ' ');
    if trimmed.is_empty() {
        "file".into()
    } else {
        trimmed.into()
    }
}

async fn save_files(value: &Value, args: &Value) -> CallToolResult {
    let dir = args["output_dir"]
        .as_str()
        .map(PathBuf::from)
        .unwrap_or_else(|| default_dir(args));
    if let Err(e) = tokio::fs::create_dir_all(&dir).await {
        return CallToolResult::error(format!("Cannot create {}: {e}", dir.display()));
    }
    let mut written = Vec::new();
    for f in value["files"].as_array().into_iter().flatten() {
        let name = safe_name(f["name"].as_str().unwrap_or("file"));
        let Some(data) = f["base64"].as_str() else {
            continue;
        };
        let bytes = match base64::engine::general_purpose::STANDARD.decode(data) {
            Ok(b) => b,
            Err(e) => return CallToolResult::error(format!("{name}: bad data from EasyEDA ({e})")),
        };
        let path = unique(&dir, &name);
        if let Err(e) = tokio::fs::write(&path, &bytes).await {
            return CallToolResult::error(format!("Cannot write {}: {e}", path.display()));
        }
        written.push(json!({"file": path.display().to_string(), "bytes": bytes.len()}));
    }
    CallToolResult::json(&json!({"folder": dir.display().to_string(), "files": written}))
}

fn unique(dir: &Path, name: &str) -> PathBuf {
    let first = dir.join(name);
    if !first.exists() {
        return first;
    }
    let (stem, ext) = match name.rsplit_once('.') {
        Some((s, e)) => (s.to_string(), format!(".{e}")),
        None => (name.to_string(), String::new()),
    };
    (2..)
        .map(|n| dir.join(format!("{stem}-{n}{ext}")))
        .find(|p| !p.exists())
        .unwrap_or(first)
}

async fn status(ctx: &Ctx) -> anyhow::Result<CallToolResult> {
    let mut status = ctx.bridge.status().await;
    let project = ctx
        .bridge
        .execute(&script(PROJECT_INFO, &json!({})), Duration::from_secs(10))
        .await;
    match project {
        Ok(p) => status["project"] = p,
        Err(e) => status["connection"] = json!(failure(&e.to_string())),
    }
    Ok(CallToolResult::json(&status))
}

async fn select(ctx: &Ctx, args: &Value) -> anyhow::Result<CallToolResult> {
    let id = args["window_id"].as_str().unwrap_or_default();
    Ok(match ctx.bridge.select(id).await {
        Ok(()) => CallToolResult::text(format!("Active EasyEDA window: {id}")),
        Err(e) => CallToolResult::error(e.to_string()),
    })
}

async fn run_script(ctx: &Ctx, args: &Value) -> anyhow::Result<CallToolResult> {
    let code = args["code"].as_str().unwrap_or_default();
    let secs = args["timeout_s"].as_u64().unwrap_or(60).min(900);
    run(ctx, code, &json!({}), secs, Output::Json).await
}

macro_rules! eda_tool {
    ($name:expr, $desc:expr, $schema:expr, $body:expr, $secs:expr, $out:expr) => {
        tool!($name, $desc, $schema, |args, ctx| run(
            ctx, $body, args, $secs, $out
        ))
    };
}

fn obj(props: Value, required: &[&str]) -> Value {
    json!({"type": "object", "properties": props, "required": required})
}

fn point() -> Value {
    json!({"type": "array", "items": {"type": "number"}, "minItems": 2, "maxItems": 2})
}

fn layer(desc: &str) -> Value {
    json!({"type": "string", "description": desc})
}

pub fn tools() -> Vec<ToolDef> {
    use Output::*;
    vec![
        tool!(
            "setu_status",
            "Check the link to EasyEDA Pro: the bridge port, every connected EasyEDA window and which one is active, and the open project. Call it first in a session, and whenever a tool says EasyEDA is not connected.",
            obj(json!({}), &[]),
            |_args, ctx| status(ctx)
        ),
        tool!(
            "select_window",
            "Choose which EasyEDA Pro window SETU works in when several are open (window ids come from setu_status).",
            obj(json!({"window_id": {"type": "string"}}), &["window_id"]),
            |args, ctx| select(ctx, args)
        ),
        eda_tool!(
            "get_project_info",
            "The open EasyEDA Pro project: boards, schematics and their pages, PCBs (with uuids for open_document) and the document in front.",
            obj(json!({}), &[]),
            PROJECT_INFO, 20, Json
        ),
        eda_tool!(
            "open_document",
            "Bring a schematic page or PCB to the front by its uuid (from get_project_info). Schematic and PCB tools also switch documents by themselves.",
            obj(json!({"uuid": {"type": "string"}}), &["uuid"]),
            OPEN_DOCUMENT, 20, Json
        ),
        eda_tool!(
            "save_project",
            "Save the schematic and the PCB in EasyEDA Pro. Save after every finished step.",
            obj(json!({"target": {"type": "string", "enum": ["all", "schematic", "pcb"], "default": "all"}}), &[]),
            SAVE, 30, Json
        ),
        eda_tool!(
            "backup_project",
            "Download the whole project as an .epro file into a dated folder (default Documents/SETU) before a large change, so it can be restored by importing it.",
            obj(json!({"name": {"type": "string"}, "output_dir": {"type": "string"}}), &[]),
            PROJECT_BACKUP, 120, Files
        ),
        eda_tool!(
            "search_parts",
            "Search EasyEDA's part library (LCSC/JLCPCB parts with symbol and footprint) by keyword or part number. Returns uuid and library_uuid for place_schematic_component, footprint name and properties such as the LCSC number and stock.",
            obj(json!({"query": {"type": "string"}, "limit": {"type": "integer", "default": 10, "maximum": 50}, "page": {"type": "integer", "default": 1}}), &["query"]),
            SEARCH_PARTS, 30, Json
        ),
        eda_tool!(
            "get_parts_by_lcsc",
            "Look up exact LCSC part numbers (C25804, ...) in EasyEDA's library.",
            obj(json!({"lcsc": {"type": "array", "items": {"type": "string"}}}), &["lcsc"]),
            PARTS_BY_LCSC, 30, Json
        ),
        eda_tool!(
            "list_schematic_components",
            "Every part in the schematic with id, designator, value, position (schematic units), rotation, footprint and LCSC number. include_flags adds power/ground flags and net ports.",
            obj(json!({"all_pages": {"type": "boolean", "default": true}, "include_flags": {"type": "boolean", "default": false}}), &[]),
            LIST_SCH_COMPONENTS, 30, Json
        ),
        eda_tool!(
            "get_component_pins",
            "Pins of a part: in the schematic (number, name, position — use these to draw wires exactly to pins) or on the PCB (pad numbers and nets).",
            obj(json!({"designator": {"type": "string"}, "id": {"type": "string"}, "side": {"type": "string", "enum": ["schematic", "pcb"], "default": "schematic"}}), &[]),
            PINS, 30, Json
        ),
        eda_tool!(
            "place_schematic_component",
            "Place a part from EasyEDA's library in the schematic, by LCSC number or by uuid + library_uuid from search_parts. x/y in schematic units (read existing positions with list_schematic_components). Optionally set its designator.",
            obj(json!({
                "lcsc": {"type": "string"}, "uuid": {"type": "string"}, "library_uuid": {"type": "string"},
                "x": {"type": "number"}, "y": {"type": "number"}, "rotation": {"type": "number", "default": 0},
                "mirror": {"type": "boolean", "default": false}, "designator": {"type": "string"}, "sub_part": {"type": "string"},
                "add_to_bom": {"type": "boolean", "default": true}, "add_to_pcb": {"type": "boolean", "default": true}
            }), &["x", "y"]),
            PLACE_SCH_COMPONENT, 30, Json
        ),
        eda_tool!(
            "modify_schematic_component",
            "Move, rotate, mirror or re-annotate a schematic part, or set its value, manufacturer and supplier part numbers, BOM/PCB inclusion (DNP = in_bom false) and other properties.",
            obj(json!({
                "designator": {"type": "string"}, "id": {"type": "string"}, "x": {"type": "number"}, "y": {"type": "number"},
                "rotation": {"type": "number"}, "mirror": {"type": "boolean"}, "new_designator": {"type": "string"},
                "name": {"type": "string", "description": "Value / name shown on the symbol"}, "manufacturer": {"type": "string"},
                "manufacturer_part": {"type": "string"}, "supplier": {"type": "string"}, "supplier_part": {"type": "string"},
                "in_bom": {"type": "boolean"}, "in_pcb": {"type": "boolean"}, "properties": {"type": "object"}
            }), &[]),
            MODIFY_SCH_COMPONENT, 30, Json
        ),
        eda_tool!(
            "add_wires",
            "Draw schematic wires. Each wire is a polyline of [x, y] points in schematic units, ending exactly on pin positions from get_component_pins. Give a net name to label the wire.",
            obj(json!({"wires": {"type": "array", "items": {"type": "object", "properties": {"points": {"type": "array", "items": point(), "minItems": 2}, "net": {"type": "string"}}, "required": ["points"]}}}), &["wires"]),
            ADD_WIRE, 60, Json
        ),
        eda_tool!(
            "add_net_flags",
            "Place power/ground symbols and net ports in the schematic: kind power, ground, analog_ground, protect_ground, port_in, port_out or port_bi, with the net name (e.g. +3V3, GND).",
            obj(json!({"flags": {"type": "array", "items": {"type": "object", "properties": {
                "kind": {"type": "string", "enum": ["power", "ground", "analog_ground", "protect_ground", "port_in", "port_out", "port_bi"]},
                "net": {"type": "string"}, "x": {"type": "number"}, "y": {"type": "number"}, "rotation": {"type": "number", "default": 0}
            }, "required": ["kind", "net", "x", "y"]}}}), &["flags"]),
            ADD_NET_FLAG, 60, Json
        ),
        eda_tool!(
            "add_schematic_text",
            "Place text in the schematic: numbered block titles (\"1 │ POWER INPUT — USB-C 5 V\"), a note line with key values under each block, and design notes. Optional size, bold, color (#RRGGBB).",
            obj(json!({"texts": {"type": "array", "items": {"type": "object", "properties": {"text": {"type": "string"}, "x": {"type": "number"}, "y": {"type": "number"},
                "size": {"type": "number"}, "bold": {"type": "boolean"}, "color": {"type": "string"}, "rotation": {"type": "number"}}, "required": ["text", "x", "y"]}}}), &["texts"]),
            SCH_TEXT, 60, Json
        ),
        eda_tool!(
            "delete_schematic_items",
            "Delete schematic parts, wires, texts or buses by id.",
            obj(json!({"ids": {"type": "array", "items": {"type": "string"}}}), &["ids"]),
            DELETE_SCH, 60, Json
        ),
        eda_tool!(
            "run_erc",
            "EasyEDA's schematic check (ERC): every error and warning with its rule, net and parts. Fix every error before the PCB.",
            obj(json!({"strict": {"type": "boolean", "default": true}, "limit": {"type": "integer", "default": 200}}), &[]),
            RUN_ERC, 120, Json
        ),
        eda_tool!(
            "list_nets",
            "Nets of the schematic, or of the PCB with their routed length in mm.",
            obj(json!({"side": {"type": "string", "enum": ["schematic", "pcb"], "default": "schematic"}}), &[]),
            LIST_NETS, 30, Json
        ),
        eda_tool!(
            "get_netlist",
            "The full netlist text of the schematic or the PCB, for checking every connection.",
            obj(json!({"side": {"type": "string", "enum": ["schematic", "pcb"], "default": "schematic"}}), &[]),
            NETLIST, 60, Json
        ),
        eda_tool!(
            "import_changes_to_pcb",
            "Update the PCB from the schematic (EasyEDA's Import Changes): new parts, nets and footprints arrive on the board. Run it after every schematic change and before placing.",
            obj(json!({}), &[]),
            IMPORT_CHANGES, 120, Json
        ),
        eda_tool!(
            "get_board_info",
            "Board summary: outline size (mm), copper layer count, stackup, rule set, parts on each side and net count.",
            obj(json!({}), &[]),
            BOARD_INFO, 30, Json
        ),
        eda_tool!(
            "add_board_outline",
            "Draw the board outline as a rectangle in mm with optional rounded corners (replaces the existing outline unless replace is false). Size the board from its parts first; 2-3 mm corner radius looks finished.",
            obj(json!({"width_mm": {"type": "number", "exclusiveMinimum": 0}, "height_mm": {"type": "number", "exclusiveMinimum": 0},
                "x_mm": {"type": "number", "default": 0}, "y_mm": {"type": "number", "default": 0}, "corner_radius_mm": {"type": "number", "default": 0},
                "replace": {"type": "boolean", "default": true}}), &["width_mm", "height_mm"]),
            BOARD_OUTLINE, 60, Json
        ),
        eda_tool!(
            "add_mounting_holes",
            "Place mounting holes (mm): M3 = 3.2 mm drill with a 6 mm plated pad by default; set plated false for a bare hole, or a net (GND) to ground the pad.",
            obj(json!({"drill_mm": {"type": "number", "default": 3.2}, "pad_mm": {"type": "number", "default": 6}, "plated": {"type": "boolean", "default": true}, "net": {"type": "string"},
                "holes": {"type": "array", "items": {"type": "object", "properties": {"x": {"type": "number"}, "y": {"type": "number"}, "drill_mm": {"type": "number"}, "pad_mm": {"type": "number"}, "plated": {"type": "boolean"}, "net": {"type": "string"}}, "required": ["x", "y"]}}}), &["holes"]),
            MOUNTING_HOLES, 60, Json
        ),
        eda_tool!(
            "list_pcb_components",
            "Every footprint on the PCB: designator, position (mm), rotation, side, footprint, LCSC number and lock state.",
            obj(json!({"layer": layer("top or bottom; omit for both")}), &[]),
            LIST_PCB_COMPONENTS, 30, Json
        ),
        eda_tool!(
            "set_component_placements",
            "Move, rotate, flip (layer top/bottom) or lock many footprints in one call. Positions in mm in the board's coordinates from list_pcb_components.",
            obj(json!({"placements": {"type": "array", "items": {"type": "object", "properties": {
                "designator": {"type": "string"}, "x": {"type": "number"}, "y": {"type": "number"},
                "rotation": {"type": "number"}, "layer": {"type": "string", "enum": ["top", "bottom"]}, "locked": {"type": "boolean"}
            }, "required": ["designator"]}}}), &["placements"]),
            SET_PLACEMENTS, 120, Json
        ),
        eda_tool!(
            "add_track",
            "Route a copper track as a polyline of [x, y] points in mm on one layer, for one net. Size power widths with calc_trace_width first.",
            obj(json!({"net": {"type": "string"}, "layer": layer("top, bottom or inner1..inner30"), "points": {"type": "array", "items": point(), "minItems": 2}, "width_mm": {"type": "number", "default": 0.25}}), &["net", "layer", "points"]),
            ADD_TRACK, 60, Json
        ),
        eda_tool!(
            "add_vias",
            "Place vias (mm). Defaults 0.3 mm drill / 0.6 mm diameter, which every fab builds.",
            obj(json!({"net": {"type": "string"}, "drill_mm": {"type": "number", "default": 0.3}, "diameter_mm": {"type": "number", "default": 0.6},
                "vias": {"type": "array", "items": {"type": "object", "properties": {"x": {"type": "number"}, "y": {"type": "number"}, "net": {"type": "string"}, "drill_mm": {"type": "number"}, "diameter_mm": {"type": "number"}}, "required": ["x", "y"]}}}), &["vias"]),
            ADD_VIA, 60, Json
        ),
        eda_tool!(
            "add_copper_pour",
            "Add a copper pour (zone) for a net on a layer. Without points it covers the board outline, inset by inset_mm.",
            obj(json!({"net": {"type": "string"}, "layer": layer("top, bottom or inner1..inner30"), "points": {"type": "array", "items": point(), "minItems": 3},
                "inset_mm": {"type": "number", "default": 0.3}, "name": {"type": "string"}, "priority": {"type": "integer", "default": 1}}), &["net", "layer"]),
            ADD_POUR, 60, Json
        ),
        eda_tool!(
            "add_board_text",
            "Place silkscreen (or copper) text: labels, captions, product name, version. Size 1.0 mm is the smallest every fab prints; bottom-side text is mirrored automatically.",
            obj(json!({"layer": layer("top_silk (default), bottom_silk, top or bottom"), "size_mm": {"type": "number", "default": 1.0}, "align": {"type": "string", "enum": ["center", "left", "right"], "default": "center"}, "font": {"type": "string"},
                "texts": {"type": "array", "items": {"type": "object", "properties": {"text": {"type": "string"}, "x": {"type": "number"}, "y": {"type": "number"}, "layer": {"type": "string"}, "size_mm": {"type": "number"}, "stroke_mm": {"type": "number"}, "rotation": {"type": "number"}}, "required": ["text", "x", "y"]}}}), &["texts"]),
            ADD_BOARD_TEXT, 60, Json
        ),
        eda_tool!(
            "delete_pcb_items",
            "Delete PCB tracks, vias, pours, texts or footprints by id, or rip up every track and via of a net.",
            obj(json!({"ids": {"type": "array", "items": {"type": "string"}}, "net": {"type": "string"}}), &[]),
            DELETE_PCB, 120, Json
        ),
        eda_tool!(
            "auto_place",
            "EasyEDA's automatic placement. A first draft only: always review it against the layout skill (connectors on edges, loops tight, blocks together) and fix by hand with set_component_placements.",
            obj(json!({}), &[]),
            AUTO_PLACE, 300, Json
        ),
        eda_tool!(
            "auto_route",
            "EasyEDA's autorouter. Route power and sensitive nets by hand first, then route the rest here with keep_existing true. Optional: nets, ignore_nets, layers, priority completion|speed.",
            obj(json!({"nets": {"type": "array", "items": {"type": "string"}}, "ignore_nets": {"type": "array", "items": {"type": "string"}},
                "layers": {"type": "array", "items": {"type": "string"}}, "keep_existing": {"type": "boolean", "default": true},
                "priority": {"type": "string", "enum": ["completion", "speed"], "default": "completion"}}), &[]),
            AUTO_ROUTE, 900, Json
        ),
        eda_tool!(
            "run_drc",
            "EasyEDA's design rule check on the PCB: every violation (clearance, unrouted, width, hole...). A finished board has none.",
            obj(json!({"strict": {"type": "boolean", "default": true}, "limit": {"type": "integer", "default": 200}}), &[]),
            RUN_DRC, 300, Json
        ),
        eda_tool!(
            "set_copper_layers",
            "Set the PCB's copper layer count (2, 4, 6, ...).",
            obj(json!({"count": {"type": "integer", "minimum": 1, "maximum": 32}}), &["count"]),
            SET_COPPER_LAYERS, 30, Json
        ),
        eda_tool!(
            "get_design_rules",
            "The PCB's current rule set: clearances, track widths, via sizes, net classes, differential pairs and net rules. Change rules in EasyEDA's Design Rules dialog or with run_script.",
            obj(json!({}), &[]),
            DESIGN_RULES, 30, Json
        ),
        eda_tool!(
            "create_net_class",
            "Create a net class (or add nets to an existing one), e.g. POWER for wide tracks.",
            obj(json!({"name": {"type": "string"}, "nets": {"type": "array", "items": {"type": "string"}}}), &["name", "nets"]),
            NET_CLASS, 30, Json
        ),
        eda_tool!(
            "create_differential_pair",
            "Declare a differential pair (USB D+/D-, Ethernet, ...) so EasyEDA routes and checks it as a pair.",
            obj(json!({"name": {"type": "string"}, "positive": {"type": "string"}, "negative": {"type": "string"}}), &["name", "positive", "negative"]),
            DIFF_PAIR, 30, Json
        ),
        eda_tool!(
            "view_design",
            "Look at the design: a picture of the PCB (zoomed to the board) or the schematic as EasyEDA shows it now. Use it to review placement, routing and silkscreen with your own eyes.",
            obj(json!({"view": {"type": "string", "enum": ["pcb", "schematic", "current"], "default": "pcb"}}), &[]),
            SCREENSHOT, 60, Image
        ),
        eda_tool!(
            "export_manufacturing",
            "Write the manufacturing files into a dated folder (default Documents/SETU/<name>_<date>): gerber (zip with drills), bom (csv), pick_and_place (csv, mm), and optionally ipc2581, odb, step, netlist, pdf, dxf. The files are manufacturer-neutral.",
            obj(json!({"name": {"type": "string", "description": "File name prefix, e.g. the board name and revision"}, "output_dir": {"type": "string"},
                "formats": {"type": "array", "items": {"type": "string", "enum": ["gerber", "bom", "pick_and_place", "ipc2581", "odb", "step", "netlist", "pdf", "dxf"]}, "default": ["gerber", "bom", "pick_and_place"]}}), &[]),
            EXPORT_MANUFACTURING, 600, Files
        ),
        eda_tool!(
            "export_schematic",
            "Save the schematic as SVG or PNG into a dated folder for review or documentation.",
            obj(json!({"name": {"type": "string"}, "format": {"type": "string", "enum": ["svg", "png"], "default": "svg"}, "output_dir": {"type": "string"}}), &[]),
            EXPORT_SCHEMATIC, 120, Files
        ),
        tool!(
            "run_script",
            "Run JavaScript inside EasyEDA Pro for anything no other tool covers. The code runs as the body of an async function with the global eda API (see the easyeda-api skill); it must return a JSON value. Helpers: S.mil(mm), S.mm(mil), S.layer('top'), S.pcb(), S.sch(). No comments in the code. Read before you write: check the API reference instead of guessing names or enum values.",
            obj(json!({"code": {"type": "string"}, "timeout_s": {"type": "integer", "default": 60, "maximum": 900}}), &["code"]),
            |args, ctx| run_script(ctx, args)
        ),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scripts_carry_the_prelude_and_arguments() {
        let s = script(
            ADD_TRACK,
            &json!({"net": "GND", "points": [[0, 0], [1, 1]]}),
        );
        assert!(s.starts_with("\nconst S = {};"));
        assert!(s.contains("const A = {\"net\":\"GND\""));
        assert!(!s.contains("//"));
    }

    #[test]
    fn every_tool_has_an_object_schema_and_unique_name() {
        let all = super::super::all();
        let mut names: Vec<_> = all.iter().map(|t| t.name).collect();
        names.sort();
        let before = names.len();
        names.dedup();
        assert_eq!(before, names.len());
        for t in &all {
            assert_eq!(t.input_schema["type"], "object", "{}", t.name);
        }
    }

    #[test]
    fn dates_folders_like_a_calendar() {
        assert_eq!(civil_date(0), "1970-01-01_0000");
        assert_eq!(civil_date(1_762_870_000), "2025-11-11_1406");
    }

    #[test]
    fn file_names_cannot_escape_the_folder() {
        assert_eq!(safe_name("../../evil.zip"), "_.._evil.zip");
        assert_eq!(safe_name("board-gerber.zip"), "board-gerber.zip");
    }
}
