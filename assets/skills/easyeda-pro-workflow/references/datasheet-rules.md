# Datasheet → design rules

Datasheets decide the design; templates and habits do not. For every IC and module:

1. Find the datasheet from the part's LCSC page or the maker's site (web search by MPN) and
   read the PDF itself.
2. Extract each requirement that the schematic or layout must satisfy. Typical sources:
   - **Typical application / reference schematic** — exact capacitor values, resistor values, pin straps
   - **Pin description table** — pins that must be tied high/low, left floating, or never left floating
   - **Absolute maximum and recommended operating conditions** — voltage limits, input range, ESD
   - **Layout guidelines** — loop placement, keep-outs, thermal pad vias, trace-length limits
   - **Thermal information** — θJA for the package and the copper area it assumes
3. Write each one down with its source, in the block's note line on the schematic
   (`add_schematic_text`) and in the review checklist, so later gates can check it — for example
   "AP2112K U2: 1 µF minimum ceramic on VIN and VOUT within 2 mm (datasheet p.1, Typical
   Application)".

4. Before Gate 2 exit, go through the list and confirm each is met; a rule that cannot be
   checked yet (a layout distance) stays open until its gate.

Rules that apply across the board — for example "ESD array within 5 mm of every external
connector" — are recorded the same way.

When datasheet and template disagree, the datasheet wins; note the difference to the user.
