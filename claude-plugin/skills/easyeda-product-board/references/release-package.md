# Release package

A board is finished when someone else can build, use and repair it from the files alone. This
is the package CircuitDigest publishes with each open-hardware board, and what PCBCupid ships
in its docs — produce all of it at Gate 7.

## Folder layout

```
<project>/
├── README.md              overview, specs, pinout, power, how to use, how to build
├── hardware/
│   ├── <project>.epro      the EasyEDA Pro project (backup_project)
│   ├── schematic.pdf      every sheet, readable on paper
│   ├── production/        Gerbers + drill (zip), BOM, pick-and-place (CPL), assembly notes
│   ├── renders/           top, bottom and iso renders; the board in its enclosure
│   └── enclosure/         STEP and STL of the case
├── firmware/              pin map header and bring-up example
└── LICENSE                hardware licence (CERN-OHL-S/-P or CC BY-SA) and software licence
```

## README sections

1. **What it is** — one paragraph and a top render.
2. **Specifications** — a table: MCU, radio, supply range, battery and charge current, I/O
   count, interfaces, board size, mounting, operating temperature.
3. **Pinout** — a table whose names match the silkscreen exactly (Pin, Silkscreen, Function,
   Voltage), plus a pinout image.
4. **Power** — every way to power it, what it must never be connected to (for example "never
   more than 4.2 V on BAT"), and the current each rail can supply.
5. **Jumpers and options** — each solder jumper, its default and what changing it does.
6. **Getting started** — board package or toolchain, first upload, a blink or sensor example.
7. **Build it** — order the PCB (fab settings: layers, thickness, finish, colour), the BOM with
   LCSC numbers, assembly notes, programming and test steps.
8. **Revision history** — what changed in each version printed on the board.

## Fab order settings to record

Layers, thickness, finish (HASL lead-free or ENIG for fine pitch/edge contacts), mask and
silkscreen colour, copper weight, via treatment (tented, or plugged when vias sit in pads),
castellated holes or edge plating if used, panelisation, and the assembly side.

## Final checks before release

- `run_drc` and `export_manufacturing` with no warnings left open.
- `list_schematic_components`: every part in stock, no end-of-life parts, alternates for the critical
  ones.
- Gerbers opened in a viewer (the fab's online Gerber viewer) — silkscreen readable, nothing clipped,
  mask openings where they belong.
- Renders checked against the README pinout.
- The firmware pin map matches the schematic (`get_netlist`); the enclosure, designed from the
  STEP export, fits with the connectors reachable.
