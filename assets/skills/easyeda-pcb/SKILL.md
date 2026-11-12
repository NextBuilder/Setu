---
name: easyeda-pcb
description: "PCB mechanics in EasyEDA Pro through SETU: importing the schematic, board outline, mounting holes, layer count, design rules and net classes, moving footprints, tracks, vias, copper pours, text, autorouting, DRC and checking the result by eye. Triggers on: \"layout the board\", \"route traces\", \"PCB\", \"place footprints\", \"copper pour\", \"board outline\", \"track width\", \"via\", \"design rules\", in EasyEDA. Use it with easyeda-pro-layout, which says where things go; this skill says how to do each step."
---

# EasyEDA Pro PCB Mechanics

easyeda-pro-layout decides *what* a professional layout looks like. This skill is the *how*
with SETU tools. All PCB positions and sizes are in mm.

## 1. Bring the schematic across

1. The schematic has passed its review (easyeda-design-review-agent).
2. `import_changes_to_pcb` — every part arrives on the PCB with its nets. If the project has no
   PCB yet, ask the user to create one (Design → or the project panel), then import.
3. `list_pcb_components` — every schematic part is on the board, none extra.
4. `backup_project` before the first large change.

## 2. Board setup

| Step | Tool | Notes |
|---|---|---|
| Outline | `add_board_outline` | Size from the parts and the enclosure; 2–3 mm corner radius for a product look |
| Holes | `add_mounting_holes` | M3 = 3.2 mm drill; ≥ 3 mm from parts and copper of other nets |
| Layers | `set_copper_layers` | 2 for simple boards; 4 when a full ground plane, USB/RF or dense routing needs it |
| Stackup | `list_stackups`, `get_board_info` | Choose a fab stackup before impedance work |
| Rules | `get_design_rules`, `set_design_rules` | Read the rule set, then patch only the keys you read; defaults that build at any fab: 0.15 mm track/gap, 0.3/0.6 mm via. A via rule whose minimum hole is larger than its minimum diameter (common after a KiCad import) fails every via |
| Net classes | `create_net_class` | POWER (wide), HIGH_CURRENT, USB (pair) — widths from `calc_trace_width` |
| Pairs | `create_differential_pair` | USB D+/D−, Ethernet, LVDS |

## 3. Placement

- `set_component_placements` moves, rotates, flips (layer top/bottom) and locks many parts in
  one call. Place connectors first, then each IC with its passives, then the rest.
- `smart_place` places the whole board in one call: connectors and switches on edges, wireless
  modules on an edge, ICs where the schematic put them, decoupling and crystals at their IC, the
  rest beside what it connects to. `keep` and locked parts stay put; `dry_run` shows the plan.
- `audit_layout` scores the placement (off-board, edge clearance, overlaps, edge parts,
  decoupling distance, crystals) and lists each fix. Run it after every placement change.
- `design_board` chains the whole layout: outline, holes, `smart_place`, ground pours,
  autoroute, `rebuild_pours`, DRC, audit. Its report lists what is left to fix by hand.
- EasyEDA's own `auto_place` is a draft only: review it with `view_design` and fix it by hand.
- Lock connectors, mounting parts and finished blocks (`locked: true`) so later steps cannot
  move them.
- After placement: `view_design`, and `run_drc` for overlaps and clearance before any copper.

## 4. Routing

1. **By hand first**: power paths, switching loops, crystals, USB and other pairs, sensitive
   analog. `add_track` takes a polyline of points in mm on one layer with a width;
   `add_vias` changes layers.
2. **Pours**: `add_copper_pour` for GND (both layers on 2-layer boards) and for wide power
   areas; without points it covers the outline. Add ground vias near every ground pad and along
   the edges.
3. **Autoroute the rest**: `auto_route` with `keep_existing: true` so the hand-routed nets stay;
   pass `ignore_nets` for nets that must stay hand-routed.
4. **Clean up**: `delete_pcb_items` with a net rips up a bad route; re-route it by hand.
5. `run_drc` until zero violations, and `view_design` to judge the routing by eye.

## 5. Silkscreen and text

`add_board_text` places text on top_silk or bottom_silk (mirrored automatically), 1.0 mm high
or more so every fab prints it. The easyeda-pro-silkscreen skill decides what to write and
where.

## 6. Done when

- `run_drc`: zero violations; every rule matches the fab you will use.
- `get_board_info`: the layer count, outline size and part counts are what the brief says.
- `list_nets` with side pcb: every net routed (no unrouted connections in DRC).
- `view_design`: the board looks finished.
- `save_project`, then the **easyeda-pro-review-agent** reviews the layout.

References: [design rules](references/design-rules.md),
[trace, via and impedance sizing](references/trace-width-table.md).
