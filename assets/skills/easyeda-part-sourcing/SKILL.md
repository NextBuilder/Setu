---
name: easyeda-part-sourcing
description: |
  Selecting parts that can actually be bought and assembled: JLCPCB/LCSC stock and part numbers,
  alternates, lifecycle and supply risk, and importing parts EasyEDA Pro's libraries do not have.
  Triggers on: "find a part", "LCSC", "JLCPCB part", "C-number", "in stock", "basic part",
  "extended part", "alternative part", "BOM cost", "import part", "missing footprint",
  "not in the EasyEDA library".
argument-hint: "[function or part number]"
---

# Part Sourcing

## Selection order

1. **Function and specs first**, from the datasheet: voltage, current, package, temperature.
2. **Availability**: look up live stock and price with `search_parts` and
   `get_parts_by_lcsc`. Never quote stock, price or Basic/Extended status from memory — they
   change daily; quote the lookup result with its date.
3. **Assembly cost**: JLCPCB charges extra per unique Extended part, so prefer Basic parts for
   passives and common ICs. Check the current fee on JLCPCB rather than assuming one.
4. **Second source**: for every active part, find an alternate with `search_parts`
   (same footprint and pinout) and note it in the BOM.
5. **Lifecycle**: avoid parts marked not-recommended, obsolete or with very low stock.

## Getting the part into EasyEDA Pro

1. Look the part up by its LCSC number with `get_parts_by_lcsc`, or by MPN and function with
   `search_parts`: EasyEDA's system library carries nearly every LCSC part with its symbol,
   footprint and 3D model.
2. A part that is not there is created in EasyEDA's library editors (easyeda-library skill).
3. **Accept every imported or custom part** against the datasheet before use: pin numbers,
   names and electrical types, footprint pad numbering and dimensions, pin 1 and orientation,
   3D model alignment — the easyeda-library skill's physical pin-map acceptance contract.
   User-contributed EasyEDA library data is sometimes wrong; prefer the system library.
4. Put the LCSC number and MPN on every symbol so the BOM is assembly-ready.

## Before ordering

Run `list_schematic_components`: every part needs an MPN and LCSC number, stock above the order
quantity, and no lifecycle warnings. Report anything single-sourced.
