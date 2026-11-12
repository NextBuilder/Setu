---
name: easyeda-pro-workflow
description: |
  SETU's gated, end-to-end professional PCB workflow in EasyEDA Pro: requirements → research and
  part selection → datasheet rules → schematic → board setup → placement → routing → independent
  review → manufacturing files and bring-up. Triggers on: "design a board", "design a PCB for",
  "make me a PCB", "from scratch", "full design", "professional PCB", "end to end",
  "ready to manufacture", "production ready", in EasyEDA. Load first for any new board; it
  names the skill and the review agent for every gate.
argument-hint: "[what the board must do]"
---

# SETU — Professional Design Workflow

Follow the easyeda skill's operating rules throughout. A board advances only through **gates**,
and each gate has checks that must return evidence. A gate whose check could not run is
**INCOMPLETE** — say so, never pass it.

Every gate carries the lessons of our own boards: read
[first time right](references/first-time-right.md) once per project and apply each rule at its
gate, so nothing is placed, labelled or reviewed twice.

Specialist skills carry the depth — load them when their topic comes up: easyeda-power-design,
easyeda-power-electronics (high current or voltage), easyeda-esp32, easyeda-mcu-design,
easyeda-high-speed-rf, easyeda-multilayer, easyeda-part-sourcing, easyeda-simulation,
easyeda-pro-layout, easyeda-pcb, easyeda-board-craft, easyeda-pro-silkscreen,
easyeda-product-board and easyeda-design-masters.

Two habits run through every gate:
- **Back up before every large change** (auto placement, autorouting, rework, deletions) with
  `backup_project`, and `save_project` after every finished step.
- **Requirements become checks.** Every rule the user states ("all I2C lines need pull-ups",
  "power traces at least 0.5 mm", "every part needs an LCSC number") and every datasheet rule is
  written into the review checklist for Gates 2, 5 and 6, and power widths go into net classes.

Ask the user only where the answer changes the design, and always offer suggested options.
Show a short plan and get approval after Gate 1; after that, work through the gates and report
at each one.

## Gate 0 — Requirements brief

Pin down, with suggested options for each:
- Function, inputs/outputs, interfaces (USB, I2C sensors, displays, motors, radios)
- Power source and budget (USB 5 V, Li-ion cell, adapter), runtime target, and the power budget
  per source against the sum of the outputs
- Board size or enclosure limit, connector positions, layer count (2 or 4)
- Fab and assembly house (JLCPCB by default; files stay neutral), quantity, cost target
- Environment: indoor/outdoor, temperature, enclosure
- Product decisions (easyeda-product-board skill, section 1): who assembles it, the form factor,
  silkscreen style (product or debug), the options a user may change by jumper
- Board size from the parts, not a guess: estimate the footprint area, aim for 45–60 % fill,
  and fix the outline before placement
- A caption for every connector, button and LED (MOTOR A, PD IN, USER) and the product name and
  version for the silkscreen

Write the brief back to the user before Gate 1.

## Gate 1 — Architecture, part selection, research

1. Block diagram in words: power tree, MCU, each interface.
2. Power budget: peak and average current per rail, then size each regulator. Every linear
   regulator gets `calc_regulator_thermal`; above its limit, use a buck (`calc_buck`).
3. Parts: `search_parts` / `get_parts_by_lcsc`, preferring JLCPCB basic parts in stock. Record
   MPN, LCSC number and stock for every active part — look them up, never quote from memory.
4. **Datasheet rules.** For every IC, read its datasheet (pin description, absolute maximum
   ratings, recommended conditions, typical application, layout guidelines) and write each
   requirement with its page into the design notes — see [datasheet rules](references/datasheet-rules.md).
5. **Calculate the risky parts** — filters, rail droop, regulator output filters, analog front
   ends (easyeda-simulation skill).

**Gate 1 exit:** brief, block diagram, power budget, part list with MPN/LCSC/stock, the
datasheet rules. Get the user's approval.

## Gate 2 — Schematic

Load the easyeda-schematic skill. A whole schematic can go to the
**easyeda-schematic-build-agent**.

1. Draw block by block, presentable from the start: numbered titled blocks with a note line,
   power flags at power pins, short wires inside a block, net names only between blocks. Option
   links (0 Ω) are DNP unless chosen.
2. Every IC: decoupling as its datasheet states, unused pins handled as its datasheet states.
3. Checks — all must be clean or explicitly justified:
   - `run_erc`: 0 errors
   - `get_netlist`: no single-pin nets, no rails joined, every connector pin on its net
   - `list_schematic_components`: every part has value, footprint and LCSC number
4. **Gate 2 review:** hand the schematic to the **easyeda-design-review-agent** (schematic
   scope). Fix every finding, then review again. No board work starts on a schematic with open
   findings.

## Gate 3 — Board setup

Load the easyeda-pcb and easyeda-pro-layout skills. A whole layout (Gates 3–5) can go to the
**easyeda-layout-agent**, which owns the board until it hands back a self-checked result.

1. `import_changes_to_pcb`, then `list_pcb_components`: every part arrived.
2. `add_board_outline` (size from Gate 0, rounded corners), `add_mounting_holes`,
   `set_copper_layers`.
3. Stackup: for impedance-critical nets choose a preset (`list_stackups`) and solve widths with
   `calc_impedance` — USB 2.0 is a 90 Ω differential pair, RF feeds 50 Ω.
4. Rules and net classes: power widths from `calc_trace_width`; start from 0.2 mm clearance,
   0.25 mm signal, 0.5 mm power, 0.3/0.6 mm vias; `create_net_class`,
   `create_differential_pair`; read back with `get_design_rules`.
5. Agree the style with the user — form factor, connector standard, mask colour —
   (easyeda-board-craft skill).

## Gate 4 — Placement

Follow the easyeda-pro-layout floor plan and placement order: fixed mechanical parts
(connectors at their edges, buttons, mounting holes) → RF module with its antenna over the edge
→ MCU → power stage with its input loop tight → decoupling beside the pins it serves →
everything else grouped by function, sensors away from heat. Keep a 2.6 mm lane free beside
every connector for its labels. `smart_place` follows this order and `audit_layout` checks it;
`auto_place` is only a draft.

**Gate 4 exit:** `run_drc` shows no overlapping parts, every switching IC has its loop
capacitors at its pins, and `view_design` reviewed against the layout review finds nothing open.

## Gate 5 — Routing and silkscreen

1. By hand first: power input loop and regulator loops (short, wide), RF feed, crystal, USB and
   other pairs (`add_track`, `add_vias`).
2. Ground: `add_copper_pour` on the reference layer(s), ground vias at every ground pad and
   along RF and board edges.
3. Remaining signals with `auto_route` (keep_existing true) — review the result, never accept
   it unseen.
4. Silkscreen with `add_board_text`: captions, pin labels, designators, the product block
   (easyeda-pro-silkscreen skill).
5. `run_drc`: 0 violations and 0 unrouted connections; `list_nets` lengths for matched groups.

## Gate 6 — Independent review

A design must not grade itself. Delegate to the **easyeda-pro-review-agent** (fresh context),
then check its report against the [expert checklist](references/expert-checklist.md) and
`view_design`. Fix every finding, then re-run the Gate 2, 5 and 6 checks.

## Gate 7 — Manufacturing and bring-up

1. Load the easyeda-manufacture skill. `run_drc`, then `export_manufacturing`
   (manufacturer-neutral: it must build at JLCPCB and PCBWay). Hand the package to the
   **easyeda-manufacture-agent**; fix every finding and export again until it reports READY TO
   ORDER.
2. Optional enclosure: `export_manufacturing` with `step` for the CAD tool.
3. Write the [bring-up plan](references/bringup-plan.md) for the first boards.
4. The release package — README with specs and a pin table matching the silkscreen, schematic
   (`export_schematic`), production files, renders (easyeda-product-board skill).

## Final report

One table: each gate, its checks, the evidence (counts, verdicts), and status
PASS / FAIL / INCOMPLETE, followed by the easyeda-product-board scorecard. The board is "ready
to order" only when every gate is PASS. Recommend a small first batch (5 boards) and the
bring-up plan before volume.
