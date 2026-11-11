---
name: easyeda-review
description: "Design review of an EasyEDA Pro project through SETU: ERC, DRC, netlist analysis, part data, layout and silkscreen by eye, against the expert checklist, with findings ranked and fixed properly. Triggers on: \"review my design\", \"check for errors\", \"audit\", \"DRC\", \"ERC\", \"find problems\", \"is this ready\", \"validate\", \"check my schematic\", \"check my PCB\", \"what's wrong\", \"pre-fab review\", in EasyEDA. Load at the end of every stage, with that stage's review agent."
---

# EasyEDA Pro Design Review

A review produces evidence, not reassurance: every finding names the part or net, what is wrong,
why it matters, and the fix. A check that could not run is INCOMPLETE, never a pass.

## 1. Who reviews what

| Stage finished | Reviewer | Scope |
|---|---|---|
| Schematic | `easyeda-design-review-agent` | Schematic scope: ERC, rails, values against datasheets, part data, presentation |
| Layout and silkscreen | `easyeda-pro-review-agent` | Independent review of the board it did not design |
| Manufacturing files | `easyeda-manufacture-agent` | Files against the board, BOM against the schematic |

The person or agent who did the work never signs off their own stage.

## 2. Schematic review

1. `run_erc` — read every error and warning; group by root cause ([error taxonomy](references/error-taxonomy.md)).
2. `get_netlist` — for each net: a source and at least one load; no single-pin nets; no two
   rails joined (two regulator outputs, or two 0 Ω option links fitted on one net).
3. Every IC: supply pins on the right rails, decoupling as its datasheet states, every unused
   pin handled as the datasheet states, every value around it from the datasheet's table for
   the chosen mode (cite the page).
4. Power: regulator dissipation (`calc_regulator_thermal`), inductor saturation current ≥ the
   converter's current limit (`calc_buck`), fuse breaking capacity ≥ the source's short-circuit
   current, a power budget per source.
5. `list_schematic_components` — values, footprints, LCSC numbers, DNP out of the BOM.
6. Presentation: numbered titled blocks, power flags at power pins, labels only between blocks
   (`view_design` view schematic).

## 3. Layout review

1. `run_drc` — zero violations, or each one explained and agreed.
2. `get_board_info` and `get_design_rules` — layers, stackup and rules match the fab.
3. `view_design` — placement by function, connectors on edges, switching loops tight,
   decoupling at the pins, crystals close, antennas clear, no parts overlapping, silkscreen
   legible and off pads.
4. `list_pcb_components` — every part placed and on the intended side; polarity and pin-1 marks
   visible.
5. Power copper widths against `calc_trace_width`; via counts against `calc_via`.
6. The [design checklist](references/design-checklist.md) and the easyeda-pro-workflow skill's
   `references/expert-checklist.md`, item by item.

## 4. Report

A table of findings ranked blocker / major / minor: location (designator, net or area), what is
wrong, the evidence (tool output or the picture), and the fix. Then a verdict: PASS only with
no blocker or major finding and no INCOMPLETE check.

## 5. Fixing findings

Fix the cause, not the symptom: move the part, change the value, reroute the net. Never hide a
finding by widening a rule, excluding an error or adding a note. After the fixes, the same
reviewer checks again.
