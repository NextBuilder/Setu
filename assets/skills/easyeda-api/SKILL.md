---
name: easyeda-api
description: "EasyEDA Pro's extension API for run_script: every class, method signature and enum value, and how to write safe scripts for steps no SETU tool covers (rule configuration, pad edits, selections, special exports). Triggers on: \"run_script\", \"EasyEDA API\", \"eda.pcb_\", \"eda.sch_\", \"script EasyEDA\", or a SETU tool that failed with an API error."
---

# EasyEDA Pro API through run_script

`run_script` runs JavaScript inside the open EasyEDA Pro window, as the body of an async function
with the global `eda` object. Use it only when no SETU tool does the step.

## Rules

1. **Look it up, never guess.** Find the class in [the API reference](references/api-reference.md)
   (method names are listed lower-case; call them in camelCase as their signature shows) and
   every enum value in [enums](references/enums.md).
2. **Return a value.** `console.log` output is lost; `return` sends the result back. Return plain
   data: map API objects through their getters (`c.getState_Designator()`), or use
   `S.plain(x)`.
3. **No comments in the code** — EasyEDA may run it as one line.
4. **Await every promise**; most API methods are async.
5. **Units:** PCB coordinates and sizes are in mil (`S.mil(mm)` converts mm to mil, `S.mm(mil)`
   back). Schematic coordinates are EasyEDA's schematic units.
6. **Bring the right document to the front first:** `await S.pcb()` or `await S.sch()`.
7. **Read before you change**, change the smallest thing, then read it back and `view_design`.
8. **Back up first** (`backup_project`) before a script that changes many objects.
9. Many API methods are marked beta by EasyEDA. If one fails with valid arguments, it may be
   blocked by permissions or not implemented in this EasyEDA version — report it rather than
   trying variants blindly.

## Helpers SETU provides inside every script

| Helper | Does |
|---|---|
| `S.mil(mm)`, `S.mm(mil)` | Unit conversion |
| `S.layer('top')` | Layer id from a name: top, bottom, inner1..inner30, top_silk, bottom_silk, top_mask, bottom_mask, top_paste, bottom_paste, outline, multi, document, mechanical |
| `S.pcb()`, `S.sch()` | Open the PCB or the first schematic page if another document is in front |
| `S.plain(x)` | Copy to plain JSON |
| `S.pcbPart(c)`, `S.schPart(c)` | A component as plain data |
| `S.findPcb('U1')` | A PCB component by designator |

## Examples

Read the current DRC rule configuration:

```javascript
await S.pcb();
return S.plain(await eda.pcb_Drc.getCurrentRuleConfiguration());
```

Move every test point to the bottom layer:

```javascript
await S.pcb();
const tps = (await eda.pcb_PrimitiveComponent.getAll()).filter(c => /^TP\d+$/.test(c.getState_Designator()));
for (const c of tps) await eda.pcb_PrimitiveComponent.modify(c.getState_PrimitiveId(), { layer: S.layer('bottom') });
return tps.map(c => c.getState_Designator());
```

Net lengths of a USB pair:

```javascript
await S.pcb();
return { dp: S.mm(await eda.pcb_Net.getNetLength('USB_DP')), dm: S.mm(await eda.pcb_Net.getNetLength('USB_DM')) };
```

## Main modules

| Prefix | Domain |
|---|---|
| `dmt_` | Projects, boards, schematics, PCBs, editor tabs, teams, folders |
| `sch_` | Schematic: components, wires, text, nets, netlist, ERC, exports |
| `pcb_` | PCB: components, lines (tracks), vias, pads, pours, text, layers, nets, DRC rules, auto layout/routing, manufacture data |
| `lib_` | Library: devices, symbols, footprints, 3D models |
| `sys_` | System: files, dialogs, messages, storage, units |
