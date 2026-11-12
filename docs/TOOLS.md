# SETU tools

SETU's server registers **54 tools**. PCB positions and sizes are in millimetres;
schematic positions are EasyEDA's schematic units (copy them from the listing tools).

Every successful call that starts a design stage adds a `[setu]` line naming the skill to load,
and calls that end a stage (`run_erc`, `run_drc`, `auto_route`, `design_board`, `export_manufacturing`) name the
review agent to run next.

## Connection and project

| Tool | What it does |
|---|---|
| `setu_status` | Check the link to EasyEDA Pro: the bridge port, every connected EasyEDA window and which one is active, and the open project. Call it first in a session, and whenever a tool says EasyEDA is not connected. |
| `select_window` | Choose which EasyEDA Pro window SETU works in when several are open (window ids come from setu_status). |
| `get_project_info` | The open EasyEDA Pro project: boards, schematics and their pages, PCBs (with uuids for open_document) and the document in front. |
| `open_document` | Bring a schematic page or PCB to the front by its uuid (from get_project_info). Schematic and PCB tools also switch documents by themselves. |
| `save_project` | Save the schematic and the PCB in EasyEDA Pro. Save after every finished step. |
| `backup_project` | Download the whole project as an .epro file into a dated folder (default Documents/SETU) before a large change, so it can be restored by importing it. |

## Parts

| Tool | What it does |
|---|---|
| `search_parts` | Search EasyEDA's part library (LCSC/JLCPCB parts with symbol and footprint) by keyword or part number. Returns uuid and library_uuid for place_schematic_component, footprint name and properties such as the LCSC number and stock. |
| `get_parts_by_lcsc` | Look up exact LCSC part numbers (C25804, ...) in EasyEDA's library. |

## Schematic

| Tool | What it does |
|---|---|
| `list_schematic_components` | Every part in the schematic with id, designator, value, position (schematic units), rotation, footprint and LCSC number. include_flags adds power/ground flags and net ports. |
| `get_component_pins` | Pins of a part: in the schematic (number, name, position — use these to draw wires exactly to pins) or on the PCB (pad numbers and nets). |
| `place_schematic_component` | Place a part from EasyEDA's library in the schematic, by LCSC number or by uuid + library_uuid from search_parts. x/y in schematic units (read existing positions with list_schematic_components). Optionally set its designator. |
| `modify_schematic_component` | Move, rotate, mirror or re-annotate a schematic part, or set its value, manufacturer and supplier part numbers, BOM/PCB inclusion (DNP = in_bom false) and other properties. |
| `add_wires` | Draw schematic wires. Each wire is a polyline of [x, y] points in schematic units, ending exactly on pin positions from get_component_pins. Give a net name to label the wire. |
| `add_net_flags` | Place power/ground symbols and net ports in the schematic: kind power, ground, analog_ground, protect_ground, port_in, port_out or port_bi, with the net name (e.g. +3V3, GND). |
| `add_schematic_text` | Place text in the schematic: numbered block titles ("1 │ POWER INPUT — USB-C 5 V"), a note line with key values under each block, and design notes. Optional size, bold, color (#RRGGBB). |
| `delete_schematic_items` | Delete schematic parts, wires, texts or buses by id. |
| `run_erc` | EasyEDA's schematic check (ERC): every error and warning with its rule, net and parts. Fix every error before the PCB. |
| `list_nets` | Nets of the schematic, or of the PCB with their routed length in mm. |
| `get_netlist` | The full netlist text of the schematic or the PCB, for checking every connection. |
| `export_schematic` | Save the schematic as SVG or PNG into a dated folder for review or documentation. |

## Board setup

| Tool | What it does |
|---|---|
| `import_changes_to_pcb` | Update the PCB from the schematic (EasyEDA's Import Changes): new parts, nets and footprints arrive on the board. Run it after every schematic change and before placing. |
| `get_board_info` | Board summary: outline size (mm), copper layer count, stackup, rule set, parts on each side and net count. |
| `add_board_outline` | Draw the board outline as a rectangle in mm with optional rounded corners (replaces the existing outline unless replace is false). Size the board from its parts first; 2-3 mm corner radius looks finished. |
| `add_mounting_holes` | Place mounting holes (mm): M3 = 3.2 mm drill with a 6 mm plated pad by default; set plated false for a bare hole, or a net (GND) to ground the pad. |
| `set_copper_layers` | Set the PCB's copper layer count (2, 4, 6, ...). |
| `get_design_rules` | The PCB's current rule set: clearances, track widths, via sizes, net classes, differential pairs and net rules. Read it before set_design_rules. |
| `set_design_rules` | Change the current rule set: patch is merged into the configuration that get_design_rules returns (same keys and units), then written back. Change only the keys you read; check with run_drc afterwards. |
| `create_net_class` | Create a net class (or add nets to an existing one), e.g. POWER for wide tracks. |
| `create_differential_pair` | Declare a differential pair (USB D+/D-, Ethernet, ...) so EasyEDA routes and checks it as a pair. |

## Whole-board layout

| Tool | What it does |
|---|---|
| `design_board` | Lay out the whole board in one call: import the schematic, set the layer count, draw a rounded outline sized from the parts (or width_mm × height_mm), optional M3 corner holes, smart_place, ground pours on both sides, autoroute the rest, rebuild pours, DRC, audit_layout and save. Returns every step and what is left to fix. Route power and sensitive nets by hand afterwards where the report says so. |
| `smart_place` | Professional placement in one call, computed by SETU (not EasyEDA's auto layout): connectors and switches on the nearest board edge, wireless modules on an edge, ICs where the schematic put them, decoupling caps and crystals packed next to the IC they serve, every other part beside what it connects to, then a wirelength-reducing pass. Locked parts and parts in keep stay put. Needs a board outline; without one it returns the board size to draw. dry_run returns the plan without moving anything. |
| `audit_layout` | Check the placement like a senior layout reviewer: parts off the board or too close to its edge, overlapping footprints, connectors and wireless modules away from an edge, decoupling caps too far from their IC, crystals too far from their clock pins, and the total wirelength. Returns a score out of 100 and every finding with its fix. |

## Placement and routing

| Tool | What it does |
|---|---|
| `list_pcb_components` | Every footprint on the PCB: designator, position (mm), rotation, side, footprint, LCSC number and lock state. |
| `set_component_placements` | Move, rotate, flip (layer top/bottom) or lock many footprints in one call. Positions in mm in the board's coordinates from list_pcb_components. |
| `auto_place` | EasyEDA's own automatic placement. Prefer smart_place; if you use this, review it against the layout skill and fix by hand with set_component_placements. |
| `add_track` | Route a copper track as a polyline of [x, y] points in mm on one layer, for one net. Size power widths with calc_trace_width first. |
| `add_vias` | Place vias (mm). Defaults 0.3 mm drill / 0.6 mm diameter, which every fab builds. |
| `add_copper_pour` | Add a copper pour (zone) for a net on a layer. Without points it covers the board outline, inset by inset_mm. |
| `rebuild_pours` | Rebuild (refill) every copper pour after moving parts or routing, so pours follow the new copper and clear keep-outs. |
| `auto_route` | EasyEDA's autorouter. Route power and sensitive nets by hand first, then route the rest here with keep_existing true. Optional: nets, ignore_nets, layers, priority completion/speed. |
| `delete_pcb_items` | Delete PCB tracks, vias, pours, texts or footprints by id, or rip up every track and via of a net. |

## Silkscreen, checks and files

| Tool | What it does |
|---|---|
| `add_board_text` | Place silkscreen (or copper) text: labels, captions, product name, version. Size 1.0 mm is the smallest every fab prints; bottom-side text is mirrored automatically. |
| `run_drc` | EasyEDA's design rule check on the PCB: every violation (clearance, unrouted, width, hole...). A finished board has none. |
| `view_design` | Look at the design: a picture of the PCB (zoomed to the board) or the schematic as EasyEDA shows it now. Use it to review placement, routing and silkscreen with your own eyes. |
| `export_manufacturing` | Write the manufacturing files into a dated folder (default Documents/SETU/<name>_<date>): gerber (zip with drills), bom (csv), pick_and_place (csv, mm), and optionally ipc2581, odb, step, netlist, pdf, dxf. The files are manufacturer-neutral. |

## Engineering calculators

| Tool | What it does |
|---|---|
| `calc_trace_width` | Size a copper trace for a current (IPC-2221 closed form). Returns the minimum width for the allowed temperature rise, plus resistance, voltage drop and power loss when a length is given. IPC-2221 is conservative for internal layers; IPC-2152 charts usually allow narrower internal traces. Also answers the reverse question: pass width_mm instead of current_a to get the safe current. |
| `calc_via` | Via electrical properties: barrel resistance, inductance (Goldfarb), current capacity (IPC-2221 external constant applied to the plated barrel), and how many vias in parallel carry a given current. |
| `calc_impedance` | Characteristic impedance of a trace: microstrip (Hammerstad–Jensen with thickness correction, ≤1%), centred or offset stripline (Wheeler / IPC-2141A, ≈0.5–2%), grounded coplanar waveguide (conformal mapping, zero thickness), and edge-coupled differential pairs (IPC-2141 coupling estimate, ±5–10%). Give geometry directly, or a stackup preset from list_stackups plus a copper layer and the tool derives heights, εr and copper. Set target_ohm to solve for the trace width instead. Results exclude solder mask, which lowers outer-layer impedance by roughly 1–3 Ω. |
| `list_stackups` | List the stackup presets calc_impedance accepts: JLCPCB 4- and 6-layer impedance templates and a generic 2-layer board, with every copper and dielectric thickness and εr. To use a board's own stackup instead, read it with get_board_info and pass height_mm / er / thickness_mm to calc_impedance. |
| `calc_buck` | Size a buck converter's inductor and capacitors from first principles (continuous conduction): L = Vout·(Vin_max−Vout)/(Vin_max·fsw·ΔIL), peak current, Cout for the ripple target, maximum output-capacitor ESR, and worst-case input RMS current. The regulator datasheet's recommended values take precedence — use this to check them or when the datasheet leaves the choice open. |
| `calc_regulator_thermal` | Linear-regulator (LDO) power dissipation and junction temperature: Pd = (Vin−Vout)·Iout + Vin·Iq, Tj = Ta + Pd·θJA. θJA must come from the part's datasheet for the copper area you will actually provide. Flags dropout violations and returns the maximum safe current at the given θJA. |
| `calc_divider` | Pick standard-value resistors for a voltage divider or a regulator feedback network. Searches every pair in the chosen E-series and resistance range and returns the best pairs with their exact output and error. mode 'divider': Vout = Vin·Rbot/(Rtop+Rbot). mode 'feedback': Vout = Vref·(1 + Rtop/Rbot) — pass vref from the regulator datasheet. |
| `calc_passive` | Small circuit calculators. kind 'led': series resistor R = (Vs−Vf)/If rounded up to E24, with actual current and resistor power. 'rc': solve any one of R, C, fc for an RC low/high-pass (fc = 1/2πRC) plus time constant. 'crystal': load capacitors C = 2·(CL − Cstray), rounded to E12. 'i2c': pull-up range from UM10204 — Rmin = (Vdd−VOL)/IOL, Rmax = tr/(0.8473·Cb) — and a recommended value. 'battery': runtime from capacity and average current. |

## Scripting

| Tool | What it does |
|---|---|
| `run_script` | Run JavaScript inside EasyEDA Pro for anything no other tool covers. The code runs as the body of an async function with the global eda API (see the easyeda-api skill); it must return a JSON value. Helpers: S.mil(mm), S.mm(mil), S.layer('top'), S.pcb(), S.sch(). No comments in the code. Read before you write: check the API reference instead of guessing names or enum values. |
