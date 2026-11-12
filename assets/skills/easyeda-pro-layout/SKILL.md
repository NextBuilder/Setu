---
name: easyeda-pro-layout
description: |
  Fast, professional placement and routing the way experienced layout engineers do it: floor
  plan, placement by function and signal flow, routing order, return paths and ground planes,
  current-sized power copper, via strategy, 2-layer and 4-layer playbooks, autorouter cleanup
  and a layout review. Triggers on: "route like a pro", "professional routing", "clean
  routing", "placement", "floor plan", "ground plane", "return path", "2-layer board",
  "4-layer board", "autoroute", "noise", "EMI", "power routing", "high current",
  "layout review", "make the layout better". Load before the first board-setup, placement or
  routing call (auto_place, auto_route); when the layout is done, the easyeda-pro-review-agent
  reviews it.
argument-hint: "[board or block to lay out]"
---

# Professional Layout and Routing

Good layout is decided before the first track: **placement is 80 % of routing.** This skill
is the method; easyeda-pcb has the tool mechanics, easyeda-high-speed-rf has interface-specific
numbers, and easyeda-board-craft has the finishing style.

## The fast path in EasyEDA Pro

1. `backup_project`, then place connectors, mounting parts and the antenna side by hand with
   `set_component_placements`; lock them.
2. `smart_place` for the rest (it follows the order below), or place by hand. Either way,
   check with `audit_layout` and `view_design` and correct every block: each IC with its decoupling at its pins,
   switching loops tight, the rest beside what it connects to, rows aligned, a 2.6 mm lane free
   beside every connector for its labels.
3. Route by hand the nets no autorouter should decide: power loops, RF feed, crystal, USB and
   other pairs (`add_track`, `add_vias`, widths from `calc_trace_width` and `calc_impedance`).
4. `auto_route` with `keep_existing: true` for the remaining signals; review every net it drew.
5. `add_copper_pour` (ground), ground vias, `rebuild_pours`, then `add_board_text` for the silkscreen
   (easyeda-pro-silkscreen skill).
6. `run_drc` until zero violations, and `view_design` against the
   [layout review](references/layout-review.md) until nothing is open.

Use the manual method below for every critical net and whenever the automatic draft looks
wrong.

## The one physical idea

Every signal is a loop: current goes out on the trace and **returns on the copper directly
beneath it** (at high frequency) or along the lowest-resistance path (at DC). Noise, EMI,
crosstalk and ground bounce all come from loops that are large or interrupted. So:

- Every fast or noisy signal needs an unbroken reference plane right under it.
- A slot, split or line of vias in that plane forces the return around it — a bigger loop.
- When a signal changes layer, its return must change layer too: put a ground via within
  about 1 mm of every signal via on a fast net.
- Small hot loops (switching regulator input, gate drives, crystals) are made small by
  placement, not by routing.

## 1. Floor plan (before placing any part)

1. Fix the mechanics: outline, mounting holes, connectors at their edges, buttons, displays,
   antenna keep-outs (easyeda-board-craft for style, the module datasheet for keep-outs).
2. Draw the zones: power input → regulation → MCU/logic → interfaces → outputs, flowing in one
   direction across the board. Keep noisy zones (switchers, motor/LED drivers, relays) away
   from quiet ones (ADC inputs, sensors, crystals, RF).
3. Decide the layer plan now — see the [2-layer and 4-layer playbook](references/layer-playbook.md).
4. Snapshot (`backup_project`) so the floor plan can be restored.

## 2. Placement order

The product grammar our best boards share (Mini UPS V2, Festix): size the board from the parts
(courtyards fill 45–60 % of it), connectors in straight rows on the edges with a label lane
inside each row, every IC with its own passives as a tight block, identical channels as exact
copies of one block, test points in one aligned row, and no courtyard overlaps — ever.

1. Connectors and mechanical parts (fixed by the floor plan).
2. The main IC/module, oriented so its pins face the parts they talk to.
3. **Critical loops first**, each as tight as the datasheet layout example:
   switching regulator (input cap → switch → inductor → output cap, all on one side, one
   ground point), crystal (beside the pins, load caps beside the crystal), USB (connector →
   ESD → series parts → MCU in a straight line).
4. Decoupling: one cap per power pin, on the same side, between the pin and the via to the
   plane, with the smallest value closest. Use `set_component_placements` with the capacitor
   references you assign.
5. Everything else grouped by function, close to what it connects to; pull-ups beside their
   bus, LEDs at the edge.
6. Batch moves with `set_component_placements` (one undo step), then `view_design`:
   no hard failures, no courtyard overlaps.

Ratsnest test: the airwires should look short and mostly untangled. If they cross wildly,
rotate or swap parts now — every crossing removed here saves two vias later.

## 3. Board rules before routing

- Set clearances and minimums for the fab (`get_design_rules`; JLCPCB-class default
  0.15 mm track and space, 0.3 mm via drill / 0.6 mm pad — prefer 0.2 mm and 0.4/0.8 mm where
  space allows, they are cheaper and more reliable).
- Net classes with `create_net_class`: power classes sized with
  `calc_trace_width` for their real current (external layer, 10 °C rise is a sensible
  default), signal default 0.2–0.25 mm, controlled-impedance classes from `calc_impedance`.
- Put the standard widths and via sizes in the dropdowns with `get_design_rules` so every
  track uses a planned width.

## 4. Routing order

1. **Power and high-current paths**, short and wide, with enough vias to carry the current
   (`calc_via` gives current per via; use several in parallel at every layer change).
2. **Critical signals**: differential pairs (declared with `create_differential_pair`, routed
   with EasyEDA's pair router), clocks, crystal,
   RF feed, analog inputs — shortest path, over solid ground, away from the board edge.
3. **Buses** as a group, parallel, equal spacing, turning together.
4. **General signals**, by hand or with the autorouter (section 5).
5. **Ground pours** last on each layer (`add_copper_pour`), then stitching vias.

Style rules that are also good engineering:
- 45° corners (or arcs); no acute angles that trap etchant.
- Leave pads straight out of the pad's long axis before turning; neck down only at the pad.
- Keep traces 3× their width from neighbours where crosstalk matters (the "3W" rule).
- Never route between the pads of a passive or under a crystal or inductor.
- No stubs on fast nets; route through test points rather than branching to them.
- Thermal reliefs on plane connections of hand-soldered and through-hole pads; solid
  connections for high-current pads.

Check every autorouted net against these rules — an autorouter does not know them all: 45°
bends, few corners, tracks entering pads on their centres, nothing between the pads of small
passives, and on 2-layer boards the bottom kept as a solid ground plane (restrict `auto_route`
to the top layer with `layers` where you can).

What still needs your eye after it runs:
- Parallel signals that should run as a bus (equal spacing, turning together): reroute them as
  a group with `add_track` if the router split them.
- Ground continuity: look at the bottom pour in `view_design`; a track that cuts it into
  islands gets moved to the top or replaced by a short jumper with stitching vias beside it.
- Teardrops: EasyEDA adds them to pads and vias from its Tools menu — do it last.

## 5. Autorouter, then clean up

An autorouter is fast and useful for the boring 60 %, never for the critical 40 %.

1. Route and lock power loops, RF, crystal nets and differential pairs by hand first.
2. `auto_route` is EasyEDA's built-in router; run it with `keep_existing: true` and
   `ignore_nets` for the hand-routed nets. For very dense boards, EasyEDA can also export a
   Specctra DSN for an external router and import the result (Route menu).
3. Review every autorouted net: remove detours and via pairs that a single-layer path could
   avoid (`list_nets`, `delete_pcb_items`, `add_track`), and restore ground-plane continuity
   on the reference layer.
4. `backup_project` before, `view_design` after, so the user sees what the autorouter did.

## 6. Finish

1. Ground pours on both outer layers of a 2-layer board, `add_copper_pour`.
2. Stitching vias every 5–10 mm across the pour and along the edges; a fence of vias along RF
   traces and the board perimeter on noisy boards.
3. Remove copper islands and thin slivers (raise the zone's minimum width or delete them).
4. Teardrops on pads and vias.
5. `run_drc` with a live-board sync and zone refill: 0 errors, 0 unconnected items.
6. Run the [layout review](references/layout-review.md) and fix what it finds.

## Speed habits

- Let EasyEDA do the bulk where it is safe: `auto_route` for ordinary signals after the
  critical nets are done; `smart_place` for placement, `auto_place` only as a draft.
- For a reviewed schematic and an ordinary board, `design_board` does outline, placement,
  pours, routing and checks in one call; then fix what its report lists.
- Batch: place with `set_component_placements`, read pads with `get_component_pins`, route
  pad-to-pad with `add_track`, rather than one move at a time.
- Read before you route: `get_component_pins` gives exact pad centres, so tracks start on the
  pad and DRC passes first time.
- `backup_project` at every gate; a bad experiment costs one restore, not an hour.
- Look (`view_design`) after placement and after routing; looking at the board
  catches what numbers miss.
