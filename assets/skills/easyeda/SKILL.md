---
name: easyeda
description: "Mandatory operating rules for ANY task in EasyEDA Pro (嘉立创EDA专业版) through SETU. Load first when the user mentions EasyEDA, EasyEDA Pro, LCEDA, an .epro project, or a schematic or PCB they keep in EasyEDA. Covers the connection, units, safe editing, the tool map, and which skill and review agent own each design stage."
---

# SETU — Operating Rules for EasyEDA Pro

SETU drives the EasyEDA Pro desktop app while it is open. Every change goes through SETU tools,
which call EasyEDA's own API inside the running editor, so the project stays valid and the user
sees each change appear live.

## 1. Connect first

Call `setu_status` at the start of every session.

| Status says | Do this |
|---|---|
| A window is listed and a project is shown | Ready. If several windows, ask which one and call `select_window` |
| "No EasyEDA window is connected" | Ask the user to open EasyEDA Pro (desktop), install and enable the **Run API Gateway** extension (jlc-ext.com/item/oshwhub/run-api-gateway), allow it external interaction, and open the project. Then check again |
| Ports in use | Another bridge already runs; SETU shares it automatically. If it still fails, ask the user to close other EasyEDA bridges |

Never guess a project's contents: read it with `get_project_info`,
`list_schematic_components`, `list_pcb_components` and `get_board_info`.

## 2. The rules that protect the user's work

1. **Never edit .epro / .eprj files or EasyEDA document source as text.** Only SETU tools (or
   `run_script` through EasyEDA's API) change a design.
2. **Back up before anything large** — auto placement, autorouting, deleting many items,
   restructuring a schematic: `backup_project` writes a dated .epro the user can import back.
3. **Save after every finished step** with `save_project`. EasyEDA does not save on its own.
4. **Read before you write.** Get pin positions with `get_component_pins` before drawing wires;
   get footprint positions with `list_pcb_components` before moving parts.
5. **Look at the result.** After placement, routing or silkscreen, call `view_design` and judge
   the picture, not only the tool's return value.
6. **Report evidence**: ERC and DRC counts, the files written, what was checked — never
   "should be fine".

## 3. Units and coordinates

| Where | Unit |
|---|---|
| PCB tools (positions, widths, drills, text size) | millimetres, in the board's data coordinates as `list_pcb_components` reports them |
| Schematic tools (positions, wire points) | EasyEDA's schematic units — copy from `list_schematic_components` and `get_component_pins`, keep new parts on the same grid spacing as existing ones |
| `run_script` | raw EasyEDA units: PCB in mil (`S.mil(mm)` converts), schematic native |

## 4. Tool map

| Task | Tools |
|---|---|
| Project | `setu_status`, `select_window`, `get_project_info`, `open_document`, `save_project`, `backup_project` |
| Parts | `search_parts`, `get_parts_by_lcsc` (LCSC numbers → EasyEDA devices with symbol and footprint) |
| Schematic | `place_schematic_component`, `modify_schematic_component`, `get_component_pins`, `add_wires`, `add_net_flags`, `add_schematic_text`, `delete_schematic_items`, `list_schematic_components`, `list_nets`, `get_netlist`, `run_erc`, `export_schematic` |
| Board setup | `import_changes_to_pcb`, `add_board_outline`, `add_mounting_holes`, `set_copper_layers`, `get_design_rules`, `create_net_class`, `create_differential_pair`, `get_board_info` |
| Placement | `list_pcb_components`, `set_component_placements`, `auto_place` (draft only) |
| Routing | `add_track`, `add_vias`, `add_copper_pour`, `auto_route`, `delete_pcb_items`, `list_nets` |
| Silkscreen | `add_board_text` |
| Checks | `run_erc`, `run_drc`, `get_netlist`, `view_design` |
| Files | `export_manufacturing`, `export_schematic`, `backup_project` |
| Engineering | `calc_trace_width`, `calc_via`, `calc_impedance`, `list_stackups`, `calc_buck`, `calc_regulator_thermal`, `calc_divider`, `calc_passive` |
| Anything else | `run_script` with the easyeda-api skill |

EasyEDA's API is still marked beta by its makers. If a tool fails with an API error, read the
easyeda-api skill and do the step with `run_script`; never fall back to editing files.

## 5. Stages: skill first, review agent last

Every stage runs the same loop, and it is not optional:

1. **Before** the first tool call of a stage, load its skill and follow it.
2. **When** the stage is complete, hand it to its review agent. It has a fresh context and did
   not do the work, so the work is not grading itself.
3. **Fix** every finding the way the skill says — the real fix, never an exception in the rules,
   a workaround or a note — then send it back for review. Move on only when the review is clean.

| Stage | Load this skill first | Then this agent reviews it |
|---|---|---|
| New board, end to end | easyeda-pro-workflow | each stage's agent below |
| Requirements, parts, power tree | easyeda-part-sourcing, easyeda-power-design, easyeda-mcu-design or easyeda-esp32 | — (checked in the schematic review) |
| Schematic | easyeda-schematic | `easyeda-design-review-agent` (schematic scope) |
| Board setup, placement, routing | easyeda-pro-layout and easyeda-pcb, plus easyeda-multilayer, easyeda-high-speed-rf or easyeda-power-electronics when they apply | `easyeda-pro-review-agent` |
| Silkscreen and product look | easyeda-pro-silkscreen, easyeda-board-craft | `easyeda-pro-review-agent` |
| Manufacturing files | easyeda-manufacture | `easyeda-manufacture-agent` |
| Library parts | easyeda-library | — |
| Simulation | easyeda-simulation | — |

Delegating the work itself:

- A complete multi-block schematic build or rework → `easyeda-schematic-build-agent`.
- A complete layout (setup, placement, routing, pours, silkscreen) → `easyeda-layout-agent`.
- One design owner at a time: the agent owns every change for its task until it hands back a
  saved, self-checked result. Review agents never change the design; their findings return to
  the owner.
- Small, bounded edits stay in the conversation with the stage's skill loaded.

In Claude the names carry the plugin prefix (`setu:easyeda-pro-layout`,
`setu:easyeda-pro-review-agent`). SETU tool results add a short `[setu]` line when a stage
starts or ends — act on it.

## 6. What SETU does not do (yet)

- Draw new symbols or footprints: create them in EasyEDA's library editors (easyeda-library
  skill) and then place them with SETU.
- Read datasheets for you: open the part's datasheet (LCSC page or the maker's site) with web
  tools and cite the page you used.
- Simulate inside SETU: use EasyEDA's built-in simulation or the easyeda-simulation skill's
  hand calculations and `calc_*` tools.

## 7. Refusing direct edits

If asked to "just edit the file", explain that EasyEDA projects are databases of linked
objects, that a text edit can corrupt the project, and do the change with SETU tools instead.
