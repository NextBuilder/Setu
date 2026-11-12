export const INSTRUCTIONS = `SETU connects you to EasyEDA Pro. It works stage by stage, and every stage follows the same loop:
1. Before the first tool call of a stage, load that stage's skill and follow it.
2. When the stage is complete, hand it to its review agent, which has a fresh context.
3. Fix every finding the professional way (the skill's method, not a workaround), then review again. Move on only when the review is clean.

Stage → skill → review agent:
- Any EasyEDA task → easyeda (operating rules) → —
- A new board, end to end → easyeda-pro-workflow → each stage's agent below
- Requirements and parts → easyeda-part-sourcing, easyeda-power-design, easyeda-mcu-design or easyeda-esp32 → —
- Schematic → easyeda-schematic → easyeda-design-review-agent (schematic scope)
- Placement and routing → easyeda-pro-layout, plus easyeda-multilayer, easyeda-high-speed-rf or easyeda-power-electronics when they apply → easyeda-pro-review-agent
- Silkscreen and product look → easyeda-pro-silkscreen, easyeda-board-craft → easyeda-pro-review-agent
- Manufacturing files → easyeda-manufacture → easyeda-manufacture-agent
- Anything no tool covers → easyeda-api (run_script)

Fast path for a reviewed schematic: design_board lays out the whole board in one call (outline, smart_place, pours, autoroute, DRC, audit_layout); then fix what its report lists and hand the board to the easyeda-pro-review-agent. smart_place and audit_layout also work on their own.

A whole schematic can be delegated to easyeda-schematic-build-agent and a whole layout to easyeda-layout-agent. In Claude the names carry the plugin prefix (setu:easyeda-schematic, setu:easyeda-pro-review-agent). Start a session with setu_status. Tool results add a short [setu] line when a stage starts or ends; act on it.`;

const SCHEMATIC = { name: "schematic", skill: "easyeda-schematic" };
const LAYOUT = { name: "placement and routing", skill: "easyeda-pro-layout" };
const SILKSCREEN = { name: "silkscreen", skill: "easyeda-pro-silkscreen" };
const PARTS = { name: "part selection", skill: "easyeda-part-sourcing" };
const POWER = { name: "power design", skill: "easyeda-power-design" };
const HIGH_SPEED = { name: "high-speed and RF", skill: "easyeda-high-speed-rf" };
const MANUFACTURE = { name: "manufacturing", skill: "easyeda-manufacture" };
const SCRIPT = { name: "scripting", skill: "easyeda-api" };

const STAGES = {
  place_schematic_component: SCHEMATIC,
  modify_schematic_component: SCHEMATIC,
  add_wires: SCHEMATIC,
  add_net_flags: SCHEMATIC,
  delete_schematic_items: SCHEMATIC,
  import_changes_to_pcb: LAYOUT,
  set_component_placements: LAYOUT,
  smart_place: LAYOUT,
  design_board: LAYOUT,
  auto_place: LAYOUT,
  add_track: LAYOUT,
  add_vias: LAYOUT,
  add_copper_pour: LAYOUT,
  add_board_outline: LAYOUT,
  add_mounting_holes: LAYOUT,
  auto_route: LAYOUT,
  set_copper_layers: LAYOUT,
  create_net_class: LAYOUT,
  set_design_rules: LAYOUT,
  add_board_text: SILKSCREEN,
  search_parts: PARTS,
  get_parts_by_lcsc: PARTS,
  calc_buck: POWER,
  calc_regulator_thermal: POWER,
  calc_trace_width: POWER,
  calc_impedance: HIGH_SPEED,
  create_differential_pair: HIGH_SPEED,
  export_manufacturing: MANUFACTURE,
  run_script: SCRIPT,
};

const MILESTONES = {
  run_erc: "When ERC is clean and every block is drawn, the schematic stage is complete: run the easyeda-design-review-agent on it (schematic scope), fix every finding, and review again before any layout work.",
  import_changes_to_pcb: "The board now follows the schematic. If the schematic changed since its last clean review by the easyeda-design-review-agent, run that review first.",
  smart_place: "Placement applied: check it with view_design and audit_layout, fix what they show, then route power and sensitive nets by hand before auto_route.",
  auto_place: "Auto placement is only a draft: review it with view_design and audit_layout against the easyeda-pro-layout placement order and fix every part by hand before routing.",
  auto_route: "Routing applied: run rebuild_pours, run_drc and view_design. When copper and silkscreen are finished, run the easyeda-pro-review-agent, fix every finding, and review again.",
  design_board: "Board laid out: look at it with view_design, fix every DRC item and audit finding in the report, do the silkscreen pass, then run the easyeda-pro-review-agent and fix every finding.",
  run_drc: "When DRC is clean and the layout is finished, run the easyeda-pro-review-agent before any manufacturing files; fix every finding and review again.",
  export_manufacturing: "Files exported: run the easyeda-manufacture-agent to check them against the board before ordering; fix every finding and export again.",
};

export class Guide {
  constructor() {
    this.started = new Set();
  }

  note(tool) {
    const lines = [];
    const s = STAGES[tool];
    if (s && !this.started.has(s.skill)) {
      this.started.add(s.skill);
      lines.push(`[setu] ${s.name} stage: load the ${s.skill} skill now if it is not loaded, and follow it for every step of this stage.`);
    }
    if (MILESTONES[tool]) lines.push(`[setu] ${MILESTONES[tool]} (A review agent running this check itself ignores this line.)`);
    return lines.length ? lines.join("\n") : null;
  }
}
