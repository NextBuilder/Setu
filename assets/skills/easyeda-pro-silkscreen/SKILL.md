---
name: easyeda-pro-silkscreen
description: |
  Product-grade silkscreen like Arduino, Adafruit, SparkFun, Seeed Studio, Waveshare and DFRobot
  boards: one designator size, upright text beside each part and off copper, aligned rows,
  polarity and pin-1 marks, pin and interface labels on both sides, a product block and a
  bottom info block, within JLCPCB's printing limits. Triggers on: "silkscreen", "silk",
  "designators", "reference designators", "labels", "pin labels", "polarity marks", "pin 1",
  "logo", "product look", "clean board", "professional silkscreen", "like Waveshare",
  "like Arduino", "like Seeed", "like DFRobot", "like Adafruit", "like SparkFun". Load before
  add_board_text or any board text.
  Use it for boards designed in EasyEDA Pro with SETU.
argument-hint: "[board or style to match]"
---

# Professional Product Silkscreen

On a product board the silkscreen is the user interface: it says what the board is, which way
it goes, what every pin does and where every part sits — and nothing else. It is quiet, aligned,
one size per level, and never touches copper. This skill sets the rules; SETU places the text.

## The fast path

0. Before placement, decide each connector's caption (MOTOR A, PD IN, 5V OUT, LIGHT), and keep a
   2.6 mm strip free beside every connector while placing. Skipping this is why labels had to
   be redone on our Scribe board: once parts sit tight against the connectors there is no room
   left for them.
1. Read the parts and pads: `list_pcb_components` for positions and rotation,
   `get_component_pins` (side pcb) for pad numbers and nets of each connector.
2. Place the text with `add_board_text` — real EasyEDA text, never images for labels:
   - a pin label beside every pin of each single-row connector, lined up with the pins, the
     pin's net name shortened (MA_1A → 1A), one size for the whole row;
   - a bold upper-case caption above or beside each connector, button and LED (MOTOR A, PD IN,
     USER); where the top has no room, put the pin labels on the bottom behind the connector
     and keep the caption on top;
   - designators at one size (1.0 mm, the size every fab prints; 0.8 mm only for a
     PCBWay-only order), upright, beside their part, off pads, vias and other parts — move
     EasyEDA's own designator text by hand or hide it where there is no clean spot (the part
     stays in the BOM and assembly drawing);
   - the product block (name, version, date) on top and the brand/info line on the bottom
     (bottom text is mirrored automatically).
3. `run_drc`: no silkscreen-over-pad or silkscreen-clipped warnings.
4. Check every rule in the table below by eye.
5. `view_design` and read it like a customer would.

## The Next Builder house style

What Festix, Mini UPS V2 and Scribe settled on after several rounds — do this the first time:

| Element | Style |
|---|---|
| Connector caption | Bold upper-case word in a rounded frame beside the connector: MOTOR A, SERVO, LIGHT, PD IN, DC IN, OUT A, 5V OUT, MENU, LED, USER |
| Pin legend | One rounded strip per connector, a cell per pin divided by bars, aligned with the pins: `GND │ DIN │ 5V`, `2B │ 1B │ 2A │ 1A`; on the bottom when the top is full |
| Test points | A row of pads with a matching strip of net names (VM │ 5V │ 3V3 │ IO8 │ GND) and a TEST POINTS caption |
| Product badge | The name in a knockout block with the version as its own cell: SCRIBE **V1**, MINI UPS **V2**; vertical along a free edge if that is where the room is |
| Bottom block | Logo emblem + NEXT BUILDER wordmark │ product badge, and one line under it: what it is · REV · date |
| Designators | Hidden on the finished product (`references` of hide), kept tidy on bring-up boards |
| Polarity | "+" and "−" at every power input; pin-1 marks outside bodies |

The logo and wordmark are artwork: import them once with `add_board_text` from the brand's
SVG. Everything else is text and frames from `add_board_text`, so it stays
editable and `run_drc` can check it. Never print another company's brand on your
product except to name a module's maker in documentation.

## Printing limits (JLCPCB)

| | Minimum | Use |
|---|---|---|
| Text height | 1.0 mm (JLCPCB; PCBWay allows 0.8 mm) | 1.0 mm designators and pin labels, 1.2–2.5 mm product name |
| Stroke (line) width | 0.15 mm | height ÷ 6, never under 0.15 mm |
| Width-to-height ratio | 1:5 | 1:6 |
| Gap to pads / mask openings | 0.15 mm (trimmed by the fab inside this) | 0.2 mm or more |
| Gap to board edge | — | 0.3 mm or more |

Text under the minimum prints as a blur; text closer than 0.15 mm to a pad is cut away by the
fab, leaving broken labels. Use EasyEDA's default stroke font — it is what the fab expects.

## Three levels, one size each

| Level | What | Size |
|---|---|---|
| Product | Name, version ("v1.0"), logo, URL, date, OSHW mark | 1.2–2.5 mm |
| Function | Pin labels (5V, 3V3, GND, SDA, SCL, TX, RX, D0…), connector, button and LED names, "+"/"−" at power inputs, jumper labels | 0.8–1.2 mm |
| Reference | R1, C3, U2 — one size for the whole board | 0.8–1.0 mm |

Never mix sizes inside a level. A board with three designator sizes looks hand-made.

## Reference designators

- Beside the part, never under its body, never on a pad, via or test point.
- Upright: reads left to right, or bottom to top. Never upside down, never at odd angles.
- Rows and columns of identical parts (resistor arrays, LED strings, decoupling rows) put
  every designator on the same side, at the same offset.
- One convention for the board: above wide parts, left of tall parts.
- On dense boards hide designators rather than squeeze them; the assembly drawing (Top Assembly) and
  the BOM still carry them. Never shrink below 0.8 mm to make them fit.
- Finished products often hide every designator and print function captions instead (every
  PCBCupid product board does — easyeda-product-board, section 6); use `references` of hide for
  that style, tidy for development and repair-friendly boards.

## Polarity and pin 1 — must survive assembly

Each mark must stay visible after the part is soldered — outside the body, not under it.

| Part | Mark |
|---|---|
| ICs, modules | Pin-1 dot or chamfer outside the body corner |
| Diodes, LEDs | Cathode bar or "K"/triangle beside the cathode pad, consistent direction within a group |
| Electrolytic and tantalum caps | "+" beside the positive pad |
| Connectors | Pin-1 mark; power inputs get "+" and "−" (or VIN/GND) |
| Batteries | "+" and "−" at both terminals, and the cell type |
| Switches, jumpers | Function (RESET, BOOT) and the default position or "cut to disable" |

EasyEDA's library footprints already carry most of these on their silkscreen. Check each one in
the top render; add a mark with `add_board_text` where a footprint has none.

## Pins and interfaces — the brand look

- Every connector pin labelled, on both sides of a breakout or module (the user sees the
  bottom when it sits in a breadboard). `add_board_text` does this from the net names, so name
  your nets the way the label should read: 3V3, 5V, GND, SDA, SCL, TX, RX.
- Group headers by function with a short caption — Arduino boards print POWER, ANALOG IN and
  DIGITAL (PWM~), with "~" marking PWM pins; do the same for your own groups.
- Interfaces named where they leave the board: USB, I2C, UART, the Grove or Qwiic port.
- Inverted (knockout) labels — white box, text cut out — are EasyEDA's text "Reverse" (inverted) option.
  `add_board_text` prints the product name this way by default (set knockout_title off for plain
  text); use knockout for section titles too ("LORA", "RS485"), not for every label.
- Function captions name what a block does: "FIXED 5V BUCK 2A", "RGB INDICATOR", "USB PORT",
  "+ SOLAR −", "INPUT 12V-24V", and the setting beside each jumper ("0.5 A" / "1.0 A",
  "LR = HIGH [R-CH]"). Add them with `add_board_text` at the function-level size.
- See [brand styles](references/brand-styles.md) for what each maker brand does.

## Product block and bottom side

- Top: product name and version together, in a clear area near an edge; the logo
  (`add_board_text`) beside it, never across copper features.
- Bottom (mirrored): brand or URL, date or revision code, the OSHW mark if the design is open,
  and a short pin table if the top is too dense for labels.
- Regulatory marks (CE, FCC, UKCA) only when the product is actually certified.

## Clean-up rules

- Nothing on pads, in via holes or in mask openings; nothing across the board edge.
- Nothing under parts — it is invisible after assembly and lifts parts on reflow.
- No lines between the two pads of a small passive.
- Keep silkscreen off fast traces and RF lines.
- Delete stray library text (duplicate values, "REF**", user notes) from Top Silkscreen.

## Review checklist

- [ ] One designator size, upright, beside each part, none on copper, rows consistent
- [ ] Every connector has its caption badge and a pin strip (top or bottom); power inputs "+"/"−"
- [ ] Polarity and pin-1 marks visible after assembly on every polar part
- [ ] Name, version and logo on top; brand/URL/date on the bottom
- [ ] `run_drc` clean of silkscreen warnings; `view_design` reads like a product
- [ ] Top and bottom renders read like a finished product
