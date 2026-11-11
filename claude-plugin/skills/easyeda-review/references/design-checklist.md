# Pre-Fabrication Design Checklist

## Schematic Review

### Power
- [ ] Every IC has decoupling cap (100nF minimum, close to VCC/GND pins)
- [ ] Bulk capacitor on each power rail (10µF–100µF at entry point)
- [ ] Power indicator LED (optional but recommended for debug)
- [ ] Reverse polarity protection on external power input
- [ ] Voltage regulator output cap per datasheet recommendation
- [ ] Every rail has a source (regulator output or connector) and one consistent flag name

### Signal Integrity
- [ ] I2C lines have pull-up resistors (4.7k for 100kHz, 2.2k for 400kHz)
- [ ] SPI chip select lines have pull-ups (prevent floating during boot)
- [ ] Reset pins have RC filter (100nF + 10k pull-up)
- [ ] Unused op-amp inputs tied to known state
- [ ] Crystal load caps match crystal specification
- [ ] ADC reference has dedicated decoupling

### Protection
- [ ] ESD protection on external-facing interfaces (USB, Ethernet, GPIO headers)
- [ ] TVS diodes on power inputs (if external power)
- [ ] Current limiting resistors on LEDs
- [ ] Gate resistors on MOSFET drivers (prevent ringing)

### Connectivity
- [ ] No unconnected pins (except NC pins marked with no-connect)
- [ ] No floating inputs on logic ICs
- [ ] All nets have at least 2 connections (no single-pin nets)
- [ ] No shorted nets (distinct nets accidentally merged)

## PCB Review

### Mechanical
- [ ] Board outline is closed (no gaps)
- [ ] Mounting holes placed and correct diameter
- [ ] Connector positions accessible from enclosure
- [ ] Keep-out zones around antennas/RF sections
- [ ] Board dimensions match enclosure

### Routing
- [ ] No unrouted nets (ratsnest clear)
- [ ] Power traces adequately sized for current
- [ ] Differential pairs length-matched (USB, Ethernet)
- [ ] No acute angles on traces (acid traps)
- [ ] Via-in-pad only where needed (adds cost)
- [ ] Ground pour on back (or both sides)

### DFM (Design for Manufacturing)
- [ ] All traces/spaces meet fab house minimums
- [ ] All holes meet minimum drill size
- [ ] Annular rings adequate
- [ ] Silkscreen not overlapping pads
- [ ] Component courtyard no overlaps
- [ ] Thermal relief on ground pour connections
- [ ] Fiducial markers (for assembly, 3 minimum)

### Assembly
- [ ] All components have correct footprints
- [ ] Polarity markings visible (caps, diodes, ICs)
- [ ] Reference designators readable
- [ ] Component values on silkscreen (or fab layer)
- [ ] Test points accessible for debug

## Using SETU for review

| Check | Tool |
|-------|------|
| ERC violations, unconnected pins | `run_erc` |
| Shorted rails, single-pin nets, every connector pin's net | `get_netlist` |
| Values, footprints, LCSC numbers, DNP | `list_schematic_components` |
| DRC: clearance, unrouted, widths, holes | `run_drc` |
| Placement, decoupling distance, silkscreen | `view_design`, `list_pcb_components` |
| Board size, layers, stackup | `get_board_info` |
| Rules and net classes | `get_design_rules` |
