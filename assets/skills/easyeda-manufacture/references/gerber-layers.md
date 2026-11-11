# Gerber Layer Mapping

## Common Gerber File Extensions

EasyEDA Pro writes Protel-style extensions inside one Gerber zip. Accept files by their
plotted layer and content, not by suffix alone.

| EasyEDA Pro Layer | Gerber Extension | Purpose |
|-------------|-----------------|---------|
| `Top` | `.gtl` | Front copper |
| `Bottom` | `.gbl` | Back copper |
| `Inner1` | `.g2` | Inner layer 1 |
| `Inner2` | `.g3` | Inner layer 2 |
| `Top Solder Mask` | `.gts` | Front solder mask |
| `Bottom Solder Mask` | `.gbs` | Back solder mask |
| `Top Silkscreen` | `.gto` | Front silkscreen |
| `Bottom Silkscreen` | `.gbo` | Back silkscreen |
| `Top Paste Mask` | `.gtp` | Front paste (stencil) |
| `Bottom Paste Mask` | `.gbp` | Back paste (stencil) |
| `Board Outline` | `.gm1` | Board outline |

## Drill Files

| File | Extension | Purpose |
|------|-----------|---------|
| Plated through-holes | `.DRL` (PTH) | Component holes + vias |
| Non-plated holes | `.DRL` (NPTH) | Mounting holes, slots |

## What `export_manufacturing` writes

`export_manufacturing` asks EasyEDA for its standard Gerber package (all enabled layers, drills
and the drill table, as the Gerber dialog would), the BOM and the pick-and-place file, and
writes them into a new dated folder. EasyEDA decides the layer set from the board's layers;
check it against the stackup every time.

## Verification Checklist

Before uploading Gerbers:

1. Re-run `run_drc` on the saved board and resolve every result.
2. Confirm each requested artifact is a regular, non-empty file from the fresh
   invocation.
3. Reconcile every expected copper, mask, silkscreen, paste, and outline layer
   with the accepted manifest.
4. Open Gerbers and drills in a viewer and inspect registration, outline,
   apertures, mask, paste, silkscreen, holes, and slots.
5. Compare the viewer and upload preview with the selected fabricator's current
   order contract.

Any missing, stale, empty, or unexplained artifact makes the package `INCOMPLETE`.
