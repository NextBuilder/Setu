---
name: easyeda-library
description: "Library parts in EasyEDA Pro through SETU: finding LCSC devices with a symbol, footprint and 3D model, checking a footprint against its datasheet, and what to do when a part is missing or wrong. Triggers on: \"find a part\", \"missing footprint\", \"custom component\", \"new symbol\", \"new footprint\", \"pin numbering\", \"pad layout\", \"3D model\", in EasyEDA."
---

# EasyEDA Pro Library

In EasyEDA Pro a **device** joins a symbol, a footprint, a 3D model and the supplier data (LCSC
number, manufacturer part). Most parts already exist in the system library through LCSC; the
job is to choose the right one and to prove its footprint is correct.

## 1. Find the device

1. `get_parts_by_lcsc` when the C-number is known — the most exact match.
2. `search_parts` by maker part number first ("TPS563200DDCR"), then by function and package.
3. From the results take the uuid and library_uuid for `place_schematic_component`, and note
   the footprint name.

Prefer devices from the system library that carry an LCSC number and a 3D model. A user-made
device with no supplier data needs an LCSC number added before assembly.

## 2. Prove the footprint

A footprint from any library is trusted only after this check:

| Check | Against |
|---|---|
| Package name and size (0402/0603, SOT-23-5/-6, QFN 4×4) | The datasheet's package drawing |
| Pad count, pitch, pad size | The datasheet's recommended land pattern |
| Pin 1 and pin numbering | The datasheet pinout; `get_component_pins` (schematic) and side pcb (pads) must agree |
| Exposed pad present and connected | The datasheet (usually GND); it needs vias in the layout |
| Polarity mark | Diodes, LEDs, electrolytics, ICs |
| 3D model fits | `view_design` after placement |

If any row fails, choose another device or fix the footprint in EasyEDA's footprint editor —
never route around a wrong footprint.

## 3. A part that does not exist yet

SETU v0.1 does not draw symbols or footprints. When a part is missing:

1. Search again with the maker part number and the LCSC number; EasyEDA's library is large.
2. If it truly is missing, the user creates it in EasyEDA Pro (Library → New Device / Symbol /
   Footprint), drawing the footprint from the datasheet's land pattern, or imports it from the
   maker's ECAD model.
3. Then place it with `search_parts` / `place_schematic_component` and check it with the table
   above.

## 4. Pin numbering traps

- Diodes and LEDs: some library parts number the cathode 1, others the anode — read the pin
  names, never assume.
- Transistors in SOT-23: B/E/C order differs between makers.
- Connectors: pin 1 on the symbol must be pin 1 on the footprint and on the mating cable.
- Multi-unit parts (dual op-amps): place every unit, power the shared supply pins once.
