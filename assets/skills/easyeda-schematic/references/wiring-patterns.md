# Common Wiring Patterns

## Pattern 1: Decoupling Capacitor
```
        +3V3 (power symbol)
         |
    ┌────┤
    │    C1 100nF
    │    │
    │    GND (power symbol)
    │
    U1 VCC pin
```
**Tools**: `place_schematic_component` (cap) → `add_net_flags` (+3V3 above cap) → `add_net_flags` (GND below cap) → `add_wires` (cap pin 1 to IC VCC)

## Pattern 2: Pull-up Resistor
```
    +3V3
     |
     R1 4.7k
     |
     ├──── net label "SDA"
     |
    IC pin
```
**Tools**: `place_schematic_component` (R, value 4.7k) → `add_net_flags` (+3V3) → `add_wires` (resistor pin 2, net "SDA")

## Pattern 3: Voltage Divider
```
    VIN ──── R1 ──┬── R2 ──── GND
                  |
              net label "FB"
```
**Tools**: Place R1 and R2 → `add_wires` (R1 pin 2 to R2 pin 1) → `add_wires` at junction → `add_wires` on R1 pin 1 (input) → `add_net_flags` GND on R2 pin 2

## Pattern 4: LED with Current Limiting Resistor
```
    GPIO_OUT ──── R1 330Ω ──── D1 LED ──── GND
```
**Tools**: Place R1 (330) and D1 (LED) → `add_wires` (R1 pin 2 to the D1 anode) → `add_wires` (R1 pin 1, net "GPIO_OUT") → `add_net_flags` (GND on the D1 cathode)

> LED pin numbers differ between EasyEDA library parts: some use 1 = cathode, others
> 1 = anode. Read the pin names with `get_component_pins` before wiring any polarised part;
> current flows anode → cathode, so the resistor feeds the anode and the cathode goes to
> ground. Diode and transistor numbering varies the same way.

## Pattern 5: Crystal Oscillator
```
         ┌── C1 ──┐
    OSC_IN ──┤     ├── GND
         │  XTAL  │
    OSC_OUT ─┤     ├── GND
         └── C2 ──┘
```
**Tools**: Place crystal + 2 load caps → `add_wires` (XTAL pin 1 to C1 pin 1) → `add_wires` (XTAL pin 2 to C2 pin 1) → `add_net_flags` GND on C1 pin 2 and C2 pin 2 → `add_wires` (XTAL pin 1, "OSC_IN") → `add_wires` (XTAL pin 2, "OSC_OUT")

## Pattern 6: USB Type-C Power Sink (5V only)
```
    VBUS ────────── +5V
    CC1 ──── R 5.1k ──── GND
    CC2 ──── R 5.1k ──── GND
    GND ─────────── GND
    D+ ──────────── USB_DP
    D- ──────────── USB_DM
```
**Tools**: place the USB-C receptacle (`search_parts` "USB-C 16P", a JLCPCB basic part) → two 5.1 kΩ to GND on CC1 and CC2 (`add_wires`, `add_net_flags`) → VBUS through the input protection to the 5 V rail.

## Wiring decision guide

| Scenario | Tool |
|---|---|
| Two pins in one block | `add_wires` with points from `get_component_pins` |
| Pin to a named signal | `add_wires` stub with `net` set |
| Pin to a power rail | `add_net_flags` (power or ground) |
| Signal leaving the page or the board | `add_net_flags` port_in / port_out / port_bi |

## Spacing

- Keep the existing grid; copy positions from `list_schematic_components`.
- Leave at least two grid steps between symbol bodies and room above each block for its title.
- Flags sit directly on the pin end or on a short stub from it.
- Wire ends land exactly on pin ends; EasyEDA adds the junction dot at a T.
