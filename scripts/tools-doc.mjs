import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { allTools } from "../server/mcp.mjs";

const SECTIONS = [
  ["Connection and project", ["setu_status", "select_window", "get_project_info", "open_document", "save_project", "backup_project"]],
  ["Parts", ["search_parts", "get_parts_by_lcsc"]],
  ["Schematic", ["list_schematic_components", "get_component_pins", "place_schematic_component", "modify_schematic_component", "add_wires", "add_net_flags", "add_schematic_text", "delete_schematic_items", "run_erc", "list_nets", "get_netlist", "export_schematic"]],
  ["Board setup", ["import_changes_to_pcb", "link_pcb_to_schematic", "get_board_info", "add_board_outline", "add_mounting_holes", "set_copper_layers", "get_design_rules", "set_design_rules", "create_net_class", "create_differential_pair"]],
  ["Whole-board layout", ["design_board", "smart_place", "audit_layout"]],
  ["Placement and routing", ["list_pcb_components", "set_component_placements", "auto_place", "add_track", "add_vias", "add_copper_pour", "rebuild_pours", "auto_route", "delete_pcb_items"]],
  ["Silkscreen, checks and files", ["add_board_text", "run_drc", "view_design", "export_manufacturing"]],
  ["Engineering calculators", ["calc_trace_width", "calc_via", "calc_impedance", "list_stackups", "calc_buck", "calc_regulator_thermal", "calc_divider", "calc_passive"]],
  ["Scripting", ["run_script"]],
];

export function render() {
  const tools = new Map(allTools().map((t) => [t.name, t]));
  const listed = SECTIONS.flatMap(([, n]) => n);
  const missing = [...tools.keys()].filter((n) => !listed.includes(n));
  const unknown = listed.filter((n) => !tools.has(n));
  if (missing.length || unknown.length) throw new Error(`tools-doc sections out of date: missing ${missing} unknown ${unknown}`);
  const out = [
    "# SETU tools",
    "",
    `SETU's server registers **${tools.size} tools**. PCB positions and sizes are in millimetres;`,
    "schematic positions are EasyEDA's schematic units (copy them from the listing tools).",
    "",
    "Every successful call that starts a design stage adds a `[setu]` line naming the skill to load,",
    "and calls that end a stage (`run_erc`, `run_drc`, `auto_route`, `design_board`, `export_manufacturing`) name the",
    "review agent to run next.",
  ];
  for (const [title, names] of SECTIONS) {
    out.push("", `## ${title}`, "", "| Tool | What it does |", "|---|---|");
    for (const n of names) out.push(`| \`${n}\` | ${tools.get(n).description.replace(/\|/g, "/")} |`);
  }
  return out.join("\n") + "\n";
}

const path = fileURLToPath(new URL("../docs/TOOLS.md", import.meta.url));
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === "--check") {
    if (readFileSync(path, "utf8").replace(/\r\n/g, "\n") !== render()) {
      console.error("docs/TOOLS.md is out of date: run node scripts/tools-doc.mjs");
      process.exit(1);
    }
  } else writeFileSync(path, render());
}
