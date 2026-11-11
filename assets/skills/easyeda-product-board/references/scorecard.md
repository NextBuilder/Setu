# Product scorecard

"Better than a professional" has to be measured. Run every line, record the evidence, and
report the scorecard with the final design. A line that could not run is INCOMPLETE, never a
pass.

| # | Check | Tool | Target | Studied boards |
|---|---|---|---|---|
| 1 | Design rule check | `run_drc` (pours rebuilt) | 0 errors, 0 unconnected items | all 15 complete |
| 2 | Electrical rule check | `run_erc` | 0 errors | — |
| 3 | Layout review | `view_design` against the easyeda-pro-layout layout review | nothing open | — |
| 4 | Looks review | `view_design` against the easyeda-board-craft looks review | nothing open | — |
| 5 | Return vias on fast nets | `view_design`, layout review | none missing | 10 of 15 missed some |
| 6 | Decoupling distance | `view_design`, `list_pcb_components` distances | every capacitor within 3 mm | 7 of 15 had some further |
| 7 | Power track widths | `calc_trace_width` per rail, `run_drc` | every rail sized for its current | 9 of 15 had long thin rails |
| 8 | Differential pairs | `list_nets` lengths | coupled, skew within target | — |
| 9 | Silkscreen | `run_drc` silkscreen warnings, `view_design` | no text on copper, none under 1.0 mm, every connector pin labelled | 11 of 15 had unlabelled pins |
| 10 | Placement | `view_design` | every block in the placement order of easyeda-pro-layout | — |
| 11 | Your rules | the review checklist | every rule met | — |
| 12 | Independent review | easyeda-pro-review-agent (Gate 6) | no blocking findings | — |
| 13 | Manufacturing | `run_drc` | no warnings left open | — |
| 14 | BOM | `list_schematic_components`, the fab's quote | every part in stock; cost within the brief | — |
| 15 | Release package | the release-package checklist | complete | — |

Report it as a table with the measured value beside each target, the overall verdict
(SHIP / FIX FIRST), and the three changes that would raise the lowest scores.
