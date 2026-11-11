---
name: easyeda-simulation
description: |
  Simulating circuits before building them: filters, dividers, RC/LC timing, regulator output
  filters, rail droop under load steps, op-amp stages and nonlinear circuits with real models,
  with SETU's calculators, EasyEDA Pro's built-in ngspice simulator or LTspice. Triggers on: "simulate", "SPICE", "ngspice", "frequency response",
  "Bode", "transient", "ripple", "droop", "filter design", "will this work", "time constant".
argument-hint: "[circuit and question]"
---

# Circuit Simulation

## Pick the engine

- **Hand calculation first** — `calc_passive` (RC/LC corners, crystal load capacitors),
  `calc_divider`, `calc_buck`, `calc_regulator_thermal`, `calc_trace_width`. Most board
  questions (filter corners, divider loading, LC resonance, RC delays) have closed forms; show
  the formula and the numbers.
- **EasyEDA Pro's built-in simulator** (ngspice) — for transient and AC behaviour and anything
  nonlinear: draw the circuit as a simulation schematic in EasyEDA (parts with simulation
  models), run it there, and read the plots. The user runs it from EasyEDA's Simulation menu;
  SETU prepares the circuit and reads the numbers back with the user.
- **LTspice** with the maker's models — switching regulators and parts whose vendor model only
  exists for LTspice. The recipes below are plain SPICE netlists that paste into either.

## Model what matters

Ideal parts hide the problems you are trying to find. Add, as R/L/C:
- capacitor ESR (series R) and, for fast edges, ESL (series L)
- effective capacitance after DC-bias derating (often 30–70% below nominal for small ceramics)
- regulator output resistance and trace resistance (from `calc_trace_width` with a length)
- source impedance of whatever drives an ADC or a filter

## Recipes

See [simulation recipes](references/recipes.md) for ready netlists: RC low-pass, LC output
filter, rail droop under a radio burst, divider into an ADC, ideal non-inverting amplifier.

## Reading results

- AC: the −3 dB frequency, peaking (resonance) and phase. More than ~3 dB of peaking in an LC
  filter means it needs damping.
- Transient: final value, ripple over the last part of the run, rise times, overshoot, and the
  minimum value during a load step (droop) — compare with the downstream part's minimum supply.

Report the netlist you simulated alongside the numbers, so the assumptions are visible.
