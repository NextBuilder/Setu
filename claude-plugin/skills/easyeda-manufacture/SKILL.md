---
name: easyeda-manufacture
description: "Manufacturing files from EasyEDA Pro through SETU: Gerbers and drills, BOM, pick-and-place, IPC-2581/ODB++/STEP, fab notes, and the checks before ordering — files that build at JLCPCB and PCBWay alike. Triggers on: \"send to fab\", \"order boards\", \"gerbers\", \"JLCPCB\", \"PCBWay\", \"manufacturing\", \"export for production\", \"pick and place\", \"assembly files\", \"BOM for fab\", \"production files\", in EasyEDA. Load before any export; the easyeda-manufacture-agent checks the package afterwards."
---

# Manufacturing Files from EasyEDA Pro

A package is ready only when every file agrees with the board and the schematic, and a fab
could build and assemble it without asking a question. Design to the limits that build at
both JLCPCB and PCBWay (easyeda-design-masters skill, `references/sourced-rules.md`, last
table); the files must not depend on one fab.

## 1. Before exporting

1. The **easyeda-pro-review-agent** has passed the layout with no open findings.
2. `run_erc` and `run_drc`: zero errors; pours rebuilt after the last copper change.
3. `list_schematic_components`: every fitted part has a value, a footprint and an LCSC (supplier)
   number; DNP parts are out of the BOM (`in_bom: false`), not just labelled.
4. `get_board_info`: layer count, outline size and stackup are what the order will say.
5. `save_project` and `backup_project` named with the revision (e.g. `MyBoard_v1.0`).

## 2. Export

`export_manufacturing` with `name` = board name and revision. Defaults write the Gerber zip
(with drills), the BOM (csv) and the pick-and-place file (csv, mm) into a new dated folder under
Documents/SETU. Add formats when needed:

| Format | When |
|---|---|
| `ipc2581`, `odb` | The fab or assembler asks for intelligent data |
| `step` | Enclosure design or a mechanical check |
| `pdf` | Assembly drawing for hand assembly or the documentation set |
| `netlist` | Bare-board electrical test (most fabs compare against the Gerbers anyway) |

`export_schematic` adds the schematic as SVG or PNG for the release documents.

## 3. Check the package

| Check | How |
|---|---|
| Every expected layer is in the Gerber zip (copper, mask, silk, paste, outline, drills) | [Gerber layers](references/gerber-layers.md); open the zip in a Gerber viewer (the fab's online viewer works) |
| Plated and non-plated holes, slots | Drill files present; mounting holes where intended |
| BOM lines = fitted parts | Count against `list_schematic_components` minus DNP |
| Pick-and-place = BOM | Every designator in both; bottom parts on the bottom side |
| Rotations | Polarised parts and ICs in the fab's assembly preview — fix the footprint's rotation in EasyEDA, not by editing the CSV |
| Silkscreen legible | `view_design`; 1.0 mm text minimum |

Then hand the folder to the **easyeda-manufacture-agent**; fix every finding and export again
until it reports READY TO ORDER.

## 4. Fab notes (for any fab)

State them in the order form or a README in the package: board thickness, copper weight
(outer/inner), surface finish (HASL lead-free or ENIG; ENIG for fine pitch and via-in-pad),
solder-mask and silkscreen colour, IPC-6012 Class 2, via treatment (tented; filled and capped
only if vias are in pads), controlled impedance only if specified, and the stackup. Do not use
fab-specific options that lock the order to one supplier.

## 5. Ordering

EasyEDA Pro can send the board straight to JLCPCB from its menu; that is convenient, but the
exported folder is the record of what was ordered and the files a second fab (PCBWay) would
use. For JLCPCB assembly, follow [JLCPCB order checks](references/jlcpcb-rules.md).
