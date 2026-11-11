---
name: easyeda-schematic
description: "Schematic design in EasyEDA Pro through SETU: choosing LCSC parts, placing symbols, wiring exactly to pins, power flags, net names and ports, block titles, values and part numbers, DNP, ERC. Triggers on: \"design a circuit\", \"add a component\", \"wire up\", \"connect pins\", \"build schematic\", \"place resistor\", \"place IC\", \"schematic\", \"net label\", \"power rail\", in EasyEDA. Load before the first schematic edit; when the schematic is done, the easyeda-design-review-agent reviews it."
---

# EasyEDA Pro Schematic Design

## Presentation: draw it like a product the first time

A schematic is read by the reviewer, the assembler and the user who debugs the board. Redrawing
one later costs more than drawing it right once.

- Split the page into numbered, titled blocks in signal-flow order, left to right:
  "1 │ POWER INPUT — USB-C 5 V", "2 │ 3V3 LDO", "3 │ MCU", "4 │ MOTOR A" (`add_schematic_text`,
  bold).
- Under each title, one note line with the key values: output voltage, current limit, I²C
  address, and the datasheet page behind them.
- Inside a block, connect parts with short wires; draw each IC with its passives as in the
  datasheet's typical-application figure.
- Power and ground flags at every power pin (`add_net_flags`: +3V3, +5V, VBAT, GND); never a
  bare net name for a rail.
- Net names only for signals that leave a block, named by function (MOTOR_A_IN1, I2C_SDA).
- Identical channels are copies: draw one, then repeat it with the same spacing so Motor A and
  Motor B match.
- Option links (0 Ω, solder jumpers) are DNP by default with a note saying when to fit them.

## 1. Choose real parts

Every part should be an orderable LCSC/JLCPCB part, so the BOM and assembly work without a
second pass.

1. `search_parts` by function and package ("100nF 0402 X7R", "AMS1117-3.3", "ESP32-S3-WROOM-1"),
   or `get_parts_by_lcsc` when the user names C-numbers.
2. Prefer JLCPCB **basic** parts for passives and common parts (no extra loading fee); check
   the stock in the returned properties. The easyeda-part-sourcing skill has the rules.
3. Check the footprint name against the package you designed for (0402 vs 0603, SOT-23-5 vs
   SOT-23-6, QFN size). A wrong footprint is the most expensive schematic mistake.
4. Read the part's datasheet (LCSC page or maker's site) for the pinout, the recommended
   circuit and every value around it. Note the page.

## 2. Place

- `place_schematic_component` with the LCSC number (or uuid + library_uuid from
  `search_parts`), position and rotation. Give the designator if the block numbering needs it.
- Read existing positions with `list_schematic_components` and keep the same grid and spacing;
  leave room for wires and the block title.
- Rotation: 0, 90, 180, 270. Resistors and capacitors vertical between a rail and ground,
  horizontal in a signal path.
- Set the value and part numbers with `modify_schematic_component` (`name` is the value shown,
  `supplier_part` the LCSC number, `manufacturer_part` the maker's part number).

## 3. Wire

| Connection | How |
|---|---|
| Pin to pin in one block | `add_wires`: a polyline from pin to pin, coordinates from `get_component_pins` |
| Pin to a power rail | `add_net_flags` kind power or ground at the pin end, or a short wire to the flag |
| Signal leaving the block | a short wire stub from the pin with `net` set to the signal name |
| Signal to another page or an off-board connector | `add_net_flags` kind port_in / port_out / port_bi |
| Unused pin | handle as the datasheet says (tie, pull, or leave open); EasyEDA's ERC flags a pin that is neither connected nor marked |

Rules for clean wiring:

- Every wire ends exactly on a pin end from `get_component_pins`. A wire that stops near a pin
  is not connected; ERC and `get_netlist` show it.
- Horizontal and vertical segments only; no wire through a symbol body; no four-way junctions.
- Wires with the same `net` name are the same net across the schematic — name deliberately.
- After each block, check its nets with `get_netlist` before drawing the next one.

## 4. Values, numbers and DNP

- Every part has a value (`name`), a footprint and an LCSC number. A part without an LCSC
  number cannot be assembled by JLCPCB.
- Designators are unique and ordered by block (R1… in block 1, R10… in block 2 is fine).
- DNP (fitted on the board, not assembled): `in_bom: false`, value "DNP" in the note line. Never
  write "DNP" into a free text field while the part stays in the BOM.
- Mechanical-only parts (logos, mounting holes) do not belong in the schematic.

## 5. Check

1. `run_erc` — zero errors; every warning understood and explained.
2. `get_netlist` — every IC power pin on its rail, no net with a single pin (a typo), no two
   rails shorted, every connector pin on the intended net.
3. `list_schematic_components` — no part without a value, footprint or LCSC number.
4. `view_design` with view schematic — the page reads block by block.
5. `save_project`.

Then hand the schematic to the **easyeda-design-review-agent** (schematic scope); fix every
finding and review again before any PCB work. Run `import_changes_to_pcb` only after that.

Patterns for common circuits: [wiring patterns](references/wiring-patterns.md).
