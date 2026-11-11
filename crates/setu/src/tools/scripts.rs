pub const PRELUDE: &str = r#"
const S = {};
S.mil = v => v / 0.0254;
S.mm = v => Math.round(v * 0.0254 * 1000) / 1000;
S.E = globalThis.EPCB_LayerId || {};
S.LAYERS = { top: 'TOP', bottom: 'BOTTOM', top_silk: 'TOP_SILKSCREEN', bottom_silk: 'BOTTOM_SILKSCREEN', top_mask: 'TOP_SOLDER_MASK', bottom_mask: 'BOTTOM_SOLDER_MASK', top_paste: 'TOP_PASTE_MASK', bottom_paste: 'BOTTOM_PASTE_MASK', top_assembly: 'TOP_ASSEMBLY', bottom_assembly: 'BOTTOM_ASSEMBLY', outline: 'BOARD_OUTLINE', multi: 'MULTI', document: 'DOCUMENT', mechanical: 'MECHANICAL' };
S.FIXED = { TOP: 1, BOTTOM: 2, TOP_SILKSCREEN: 3, BOTTOM_SILKSCREEN: 4, TOP_SOLDER_MASK: 5, BOTTOM_SOLDER_MASK: 6, TOP_PASTE_MASK: 7, BOTTOM_PASTE_MASK: 8, TOP_ASSEMBLY: 9, BOTTOM_ASSEMBLY: 10, BOARD_OUTLINE: 11, MULTI: 12, DOCUMENT: 13, MECHANICAL: 14 };
S.layer = name => {
  const n = String(name).toLowerCase();
  const inner = /^inner_?(\d+)$/.exec(n);
  if (inner) return S.E['INNER_' + inner[1]] ?? 14 + Number(inner[1]);
  const key = S.LAYERS[n];
  if (!key) throw new Error('Unknown layer "' + name + '". Use top, bottom, inner1..inner30, top_silk, bottom_silk, outline, multi, document or mechanical.');
  return S.E[key] ?? S.FIXED[key];
};
S.layerName = id => {
  for (const k of Object.keys(S.E)) if (S.E[k] === id) return k.toLowerCase();
  for (const k of Object.keys(S.FIXED)) if (S.FIXED[k] === id) return k.toLowerCase();
  return id;
};
S.doc = async () => eda.dmt_SelectControl.getCurrentDocumentInfo();
S.pcb = async () => {
  const d = await S.doc();
  if (d && d.documentType === 3) return d;
  const all = await eda.dmt_Pcb.getAllPcbsInfo();
  if (!all || !all.length) throw new Error('This project has no PCB yet. Create one in EasyEDA Pro, then run import_changes_to_pcb.');
  await eda.dmt_EditorControl.openDocument(all[0].uuid);
  return S.doc();
};
S.sch = async () => {
  const d = await S.doc();
  if (d && d.documentType === 1) return d;
  const pages = await eda.dmt_Schematic.getAllSchematicPagesInfo();
  if (!pages || !pages.length) throw new Error('This project has no schematic page yet. Create one in EasyEDA Pro first.');
  await eda.dmt_EditorControl.openDocument(pages[0].uuid);
  return S.doc();
};
S.b64 = async blob => {
  const u = new Uint8Array(await blob.arrayBuffer());
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const out = [];
  for (let i = 0; i < u.length; i += 3) {
    const n = (u[i] << 16) | ((u[i + 1] || 0) << 8) | (u[i + 2] || 0);
    out.push(c[(n >> 18) & 63] + c[(n >> 12) & 63] + (i + 1 < u.length ? c[(n >> 6) & 63] : '=') + (i + 2 < u.length ? c[n & 63] : '='));
  }
  return out.join('');
};
S.file = async (f, fallback) => {
  if (!f) throw new Error('EasyEDA returned no file for ' + fallback);
  return { name: f.name || fallback, size: f.size, base64: await S.b64(f) };
};
S.plain = v => JSON.parse(JSON.stringify(v ?? null));
S.pcbPart = c => ({ id: c.getState_PrimitiveId(), designator: c.getState_Designator(), name: c.getState_Name(), x: S.mm(c.getState_X()), y: S.mm(c.getState_Y()), rotation: c.getState_Rotation(), layer: S.layerName(c.getState_Layer()), footprint: (c.getState_Footprint() || {}).name, supplierId: c.getState_SupplierId(), manufacturerId: c.getState_ManufacturerId(), locked: c.getState_PrimitiveLock() });
S.schPart = c => ({ id: c.getState_PrimitiveId(), type: c.getState_ComponentType(), designator: c.getState_Designator(), name: c.getState_Name(), net: c.getState_Net(), x: c.getState_X(), y: c.getState_Y(), rotation: c.getState_Rotation(), mirror: c.getState_Mirror(), footprint: (c.getState_Footprint() || {}).name, supplierId: c.getState_SupplierId(), manufacturerId: c.getState_ManufacturerId(), inBom: c.getState_AddIntoBom(), inPcb: c.getState_AddIntoPcb() });
S.findPcb = async designator => {
  const all = await eda.pcb_PrimitiveComponent.getAll();
  const c = all.find(p => p.getState_Designator() === designator);
  if (!c) throw new Error('No component ' + designator + ' on the PCB');
  return c;
};
S.findSch = async ref => {
  if (ref.id) return eda.sch_PrimitiveComponent.get(ref.id);
  const all = await eda.sch_PrimitiveComponent.getAll(undefined, true);
  const c = all.find(p => p.getState_Designator() === ref.designator);
  if (!c) throw new Error('No component ' + ref.designator + ' in the schematic');
  return c;
};
S.device = async a => {
  if (a.lcsc) {
    const d = await eda.lib_Device.getByLcscIds(a.lcsc);
    if (!d) throw new Error('EasyEDA has no device for LCSC part ' + a.lcsc);
    return d;
  }
  if (a.uuid && a.library_uuid) return { libraryUuid: a.library_uuid, uuid: a.uuid };
  throw new Error('Pass lcsc, or uuid with library_uuid (from search_parts).');
};
"#;

pub const PROJECT_INFO: &str = r#"
const p = await eda.dmt_Project.getCurrentProjectInfo();
const pages = await eda.dmt_Schematic.getAllSchematicPagesInfo();
return {
  project: S.plain(p),
  boards: S.plain(await eda.dmt_Board.getAllBoardsInfo()),
  schematics: S.plain(await eda.dmt_Schematic.getAllSchematicsInfo()),
  schematicPages: (pages || []).map(x => ({ uuid: x.uuid, name: x.name, schematic: x.parentSchematicUuid })),
  pcbs: S.plain(await eda.dmt_Pcb.getAllPcbsInfo()),
  currentDocument: S.plain(await S.doc())
};
"#;

pub const OPEN_DOCUMENT: &str = r#"
const tab = await eda.dmt_EditorControl.openDocument(A.uuid);
if (!tab) throw new Error('EasyEDA could not open document ' + A.uuid);
return { tabId: tab, document: S.plain(await S.doc()) };
"#;

pub const SAVE: &str = r#"
const done = {};
if (A.target !== 'pcb') { await S.sch(); done.schematic = await eda.sch_Document.save(); }
if (A.target !== 'schematic') { const all = await eda.dmt_Pcb.getAllPcbsInfo(); if (all && all.length) { await S.pcb(); done.pcb = await eda.pcb_Document.save(); } }
return done;
"#;

pub const SEARCH_PARTS: &str = r#"
const r = await eda.lib_Device.search(A.query, undefined, undefined, undefined, A.limit ?? 10, A.page ?? 1);
return (r || []).map(d => ({ uuid: d.uuid, library_uuid: d.libraryUuid, name: d.name, description: d.description, footprint: d.footprintName || (d.footprint || {}).name, symbol: d.symbolName || (d.symbol || {}).name, properties: d.otherProperty }));
"#;

pub const PARTS_BY_LCSC: &str = r#"
const r = await eda.lib_Device.getByLcscIds(A.lcsc, undefined, true);
return (r || []).map(d => ({ uuid: d.uuid, library_uuid: d.libraryUuid, name: d.name, description: d.description, footprint: d.footprintName || (d.footprint || {}).name, properties: d.otherProperty }));
"#;

pub const LIST_SCH_COMPONENTS: &str = r#"
await S.sch();
const all = await eda.sch_PrimitiveComponent.getAll(undefined, A.all_pages !== false);
return all.filter(c => A.include_flags || c.getState_ComponentType() === 'part').map(S.schPart);
"#;

pub const PINS: &str = r#"
if (A.side === 'pcb') {
  await S.pcb();
  const c = await S.findPcb(A.designator);
  return { designator: A.designator, pads: c.getState_Pads() || [] };
}
await S.sch();
const c = await S.findSch({ designator: A.designator, id: A.id });
const pins = await eda.sch_PrimitiveComponent.getAllPinsByPrimitiveId(c.getState_PrimitiveId());
return { designator: c.getState_Designator(), pins: (pins || []).map(p => ({ id: p.getState_PrimitiveId(), number: p.getState_PinNumber(), name: p.getState_PinName(), x: p.getState_X(), y: p.getState_Y(), rotation: p.getState_Rotation(), noConnect: p.getState_NoConnected() })) };
"#;

pub const PLACE_SCH_COMPONENT: &str = r#"
await S.sch();
const dev = await S.device(A);
const c = await eda.sch_PrimitiveComponent.create(dev, A.x, A.y, A.sub_part, A.rotation ?? 0, !!A.mirror, A.add_to_bom !== false, A.add_to_pcb !== false);
if (!c) throw new Error('EasyEDA did not place the part');
if (A.designator) {
  const m = await eda.sch_PrimitiveComponent.modify(c.getState_PrimitiveId(), { designator: A.designator });
  return S.schPart(m || c);
}
return S.schPart(c);
"#;

pub const MODIFY_SCH_COMPONENT: &str = r#"
await S.sch();
const c = await S.findSch({ designator: A.designator, id: A.id });
const p = {};
for (const k of ['x', 'y', 'rotation', 'mirror', 'name', 'manufacturer', 'supplier']) if (A[k] !== undefined) p[k] = A[k];
if (A.new_designator !== undefined) p.designator = A.new_designator;
if (A.manufacturer_part !== undefined) p.manufacturerId = A.manufacturer_part;
if (A.supplier_part !== undefined) p.supplierId = A.supplier_part;
if (A.in_bom !== undefined) p.addIntoBom = A.in_bom;
if (A.in_pcb !== undefined) p.addIntoPcb = A.in_pcb;
if (A.properties) p.otherProperty = Object.assign({}, c.getState_OtherProperty() || {}, A.properties);
const m = await eda.sch_PrimitiveComponent.modify(c.getState_PrimitiveId(), p);
if (!m) throw new Error('EasyEDA refused the change');
return S.schPart(m);
"#;

pub const ADD_WIRE: &str = r#"
await S.sch();
const made = [];
for (const path of A.wires) {
  const w = await eda.sch_PrimitiveWire.create(path.points.flat(), path.net);
  if (!w) throw new Error('EasyEDA did not draw the wire ' + JSON.stringify(path.points));
  made.push(w.getState_PrimitiveId());
}
return { wires: made };
"#;

pub const ADD_NET_FLAG: &str = r#"
await S.sch();
const kinds = { power: 'Power', ground: 'Ground', analog_ground: 'AnalogGround', protect_ground: 'ProtectGround' };
const made = [];
for (const f of A.flags) {
  let c;
  if (f.kind === 'port_in' || f.kind === 'port_out' || f.kind === 'port_bi') {
    c = await eda.sch_PrimitiveComponent.createNetPort(f.kind.slice(5).toUpperCase(), f.net, f.x, f.y, f.rotation ?? 0, false);
  } else {
    const k = kinds[f.kind];
    if (!k) throw new Error('Unknown flag kind ' + f.kind);
    c = await eda.sch_PrimitiveComponent.createNetFlag(k, f.net, f.x, f.y, f.rotation ?? 0, false);
  }
  if (!c) throw new Error('EasyEDA did not place the ' + f.kind + ' flag for ' + f.net);
  made.push(S.schPart(c));
}
return made;
"#;

pub const DELETE_SCH: &str = r#"
await S.sch();
const kinds = [eda.sch_PrimitiveComponent, eda.sch_PrimitiveWire, eda.sch_PrimitiveText, eda.sch_PrimitiveBus];
let deleted = 0;
for (const id of A.ids) {
  for (const k of kinds) {
    if (k && await k.get(id)) { if (await k.delete(id)) deleted++; break; }
  }
}
return { deleted, requested: A.ids.length };
"#;

pub const RUN_ERC: &str = r#"
await S.sch();
const r = await eda.sch_Drc.check(A.strict !== false, false, true);
const list = (r || []).map(e => ({ type: e.type, rule: e.rule, net: e.net, message: e.message || e.msg, primitives: (e.primitives || []).map(p => p.primitiveId || p.id || p.designator || p) }));
return { errors: list.filter(e => e.type !== 'warn').length, warnings: list.filter(e => e.type === 'warn').length, items: list.slice(0, A.limit ?? 200) };
"#;

pub const LIST_NETS: &str = r#"
if (A.side === 'pcb') {
  await S.pcb();
  const nets = await eda.pcb_Net.getAllNets();
  return (nets || []).map(n => ({ net: n.net, length_mm: n.length == null ? null : S.mm(n.length) }));
}
await S.sch();
return S.plain(await eda.sch_Net.getAllNets());
"#;

pub const NETLIST: &str = r#"
if (A.side === 'pcb') { await S.pcb(); return await eda.pcb_Net.getNetlist(); }
await S.sch();
return await eda.sch_Netlist.getNetlist();
"#;

pub const IMPORT_CHANGES: &str = r#"
await S.pcb();
const ok = await eda.pcb_Document.importChanges();
return { imported: ok, components: (await eda.pcb_PrimitiveComponent.getAll()).length };
"#;

pub const BOARD_INFO: &str = r#"
await S.pcb();
const outline = S.layer('outline');
const ids = [];
for (const k of [eda.pcb_PrimitiveLine, eda.pcb_PrimitivePolyline, eda.pcb_PrimitiveArc]) {
  try { ids.push(...(await k.getAllPrimitiveId(undefined, outline)) || []); } catch (e) {}
}
const box = ids.length ? await eda.pcb_Primitive.getPrimitivesBBox(ids) : undefined;
const layers = await eda.pcb_Layer.getAllLayers();
const copper = (layers || []).filter(l => { const n = S.layerName(l.layerId ?? l.id); return n === 'top' || n === 'bottom' || /^inner_\d+$/.test(String(n)); });
const parts = await eda.pcb_PrimitiveComponent.getAll();
return {
  outline: box ? { min_x: S.mm(box.minX), min_y: S.mm(box.minY), max_x: S.mm(box.maxX), max_y: S.mm(box.maxY), width_mm: S.mm(box.maxX - box.minX), height_mm: S.mm(box.maxY - box.minY) } : null,
  copper_layers: copper.length || null,
  layers: S.plain(copper),
  stackup: await eda.pcb_Layer.getCurrentPhysicalStackingConfigurationName(),
  rules: await eda.pcb_Drc.getCurrentRuleConfigurationName(),
  components: parts.length,
  top: parts.filter(p => S.layerName(p.getState_Layer()) === 'top').length,
  bottom: parts.filter(p => S.layerName(p.getState_Layer()) === 'bottom').length,
  nets: ((await eda.pcb_Net.getAllNetsName()) || []).length
};
"#;

pub const LIST_PCB_COMPONENTS: &str = r#"
await S.pcb();
const all = await eda.pcb_PrimitiveComponent.getAll(A.layer ? S.layer(A.layer) : undefined);
return all.map(S.pcbPart);
"#;

pub const SET_PLACEMENTS: &str = r#"
await S.pcb();
const all = await eda.pcb_PrimitiveComponent.getAll();
const byRef = new Map(all.map(c => [c.getState_Designator(), c]));
const moved = [], missing = [];
for (const p of A.placements) {
  const c = byRef.get(p.designator);
  if (!c) { missing.push(p.designator); continue; }
  const q = {};
  if (p.x !== undefined) q.x = S.mil(p.x);
  if (p.y !== undefined) q.y = S.mil(p.y);
  if (p.rotation !== undefined) q.rotation = p.rotation;
  if (p.layer !== undefined) q.layer = S.layer(p.layer);
  if (p.locked !== undefined) q.primitiveLock = p.locked;
  const m = await eda.pcb_PrimitiveComponent.modify(c.getState_PrimitiveId(), q);
  if (!m) throw new Error('EasyEDA refused to move ' + p.designator);
  moved.push(S.pcbPart(m));
}
return { moved, missing };
"#;

pub const ADD_TRACK: &str = r#"
await S.pcb();
const layer = S.layer(A.layer);
const ids = [];
for (let i = 1; i < A.points.length; i++) {
  const [x1, y1] = A.points[i - 1], [x2, y2] = A.points[i];
  const t = await eda.pcb_PrimitiveLine.create(A.net ?? '', layer, S.mil(x1), S.mil(y1), S.mil(x2), S.mil(y2), S.mil(A.width_mm ?? 0.25), false);
  if (!t) throw new Error('EasyEDA did not draw segment ' + i);
  ids.push(t.getState_PrimitiveId());
}
return { segments: ids };
"#;

pub const ADD_VIA: &str = r#"
await S.pcb();
const ids = [];
for (const v of A.vias) {
  const p = await eda.pcb_PrimitiveVia.create(v.net ?? A.net ?? '', S.mil(v.x), S.mil(v.y), S.mil(v.drill_mm ?? A.drill_mm ?? 0.3), S.mil(v.diameter_mm ?? A.diameter_mm ?? 0.6));
  if (!p) throw new Error('EasyEDA did not place the via at ' + v.x + ', ' + v.y);
  ids.push(p.getState_PrimitiveId());
}
return { vias: ids };
"#;

pub const ADD_POUR: &str = r#"
await S.pcb();
let pts = A.points;
if (!pts) {
  const outline = S.layer('outline');
  const ids = [];
  for (const k of [eda.pcb_PrimitiveLine, eda.pcb_PrimitivePolyline, eda.pcb_PrimitiveArc]) {
    try { ids.push(...(await k.getAllPrimitiveId(undefined, outline)) || []); } catch (e) {}
  }
  const b = ids.length ? await eda.pcb_Primitive.getPrimitivesBBox(ids) : undefined;
  if (!b) throw new Error('No board outline found; pass points for the pour.');
  const i = S.mil(A.inset_mm ?? 0.3);
  pts = [[b.minX + i, b.minY + i], [b.maxX - i, b.minY + i], [b.maxX - i, b.maxY - i], [b.minX + i, b.maxY - i]].map(([x, y]) => [S.mm(x), S.mm(y)]);
}
const src = [S.mil(pts[0][0]), S.mil(pts[0][1]), 'L'];
for (const [x, y] of pts.slice(1)) src.push(S.mil(x), S.mil(y));
const poly = eda.pcb_MathPolygon.createPolygon(src);
if (!poly) throw new Error('Invalid pour outline');
const p = await eda.pcb_PrimitivePour.create(A.net, S.layer(A.layer), poly, undefined, true, A.name ?? (A.net + '_' + A.layer), A.priority ?? 1, S.mil(0.25), false);
if (!p) throw new Error('EasyEDA did not create the pour');
return { pour: p.getState_PrimitiveId(), points_mm: pts };
"#;

pub const ADD_BOARD_TEXT: &str = r#"
await S.pcb();
const E = globalThis.EPCB_PrimitiveStringAlignMode || {};
const align = { center: E.CENTER ?? 5, left: E.LEFT_MIDDLE ?? 2, right: E.RIGHT_MIDDLE ?? 8 }[A.align ?? 'center'];
const made = [];
for (const t of A.texts) {
  const layer = S.layer(t.layer ?? A.layer ?? 'top_silk');
  const bottom = String(t.layer ?? A.layer ?? 'top_silk').startsWith('bottom');
  const size = t.size_mm ?? A.size_mm ?? 1.0;
  const s = await eda.pcb_PrimitiveString.create(layer, S.mil(t.x), S.mil(t.y), t.text, t.font ?? A.font ?? 'default', S.mil(size), S.mil(t.stroke_mm ?? Math.max(0.15, size / 6)), align, t.rotation ?? 0, false, 0, bottom, false);
  if (!s) throw new Error('EasyEDA did not place "' + t.text + '"');
  made.push(s.getState_PrimitiveId());
}
return { texts: made };
"#;

pub const DELETE_PCB: &str = r#"
await S.pcb();
const kinds = [eda.pcb_PrimitiveLine, eda.pcb_PrimitiveVia, eda.pcb_PrimitiveArc, eda.pcb_PrimitivePolyline, eda.pcb_PrimitivePour, eda.pcb_PrimitiveFill, eda.pcb_PrimitiveString, eda.pcb_PrimitiveRegion, eda.pcb_PrimitiveComponent];
let deleted = 0;
const ids = [...(A.ids || [])];
if (A.net) {
  ids.push(...((await eda.pcb_PrimitiveLine.getAllPrimitiveId(A.net)) || []));
  ids.push(...((await eda.pcb_PrimitiveVia.getAllPrimitiveId(A.net)) || []));
  try { ids.push(...((await eda.pcb_PrimitiveArc.getAllPrimitiveId(A.net)) || [])); } catch (e) {}
}
for (const id of ids) {
  for (const k of kinds) {
    if (k && await k.get(id)) { if (await k.delete(id)) deleted++; break; }
  }
}
return { deleted, requested: ids.length };
"#;

pub const RUN_DRC: &str = r#"
await S.pcb();
const r = await eda.pcb_Drc.check(A.strict !== false, false, true);
const flat = [];
const walk = (v, path) => {
  if (Array.isArray(v)) { v.forEach(x => walk(x, path)); return; }
  if (v && typeof v === 'object' && (v.errorType || v.rule || v.type || v.message)) { flat.push(Object.assign({ group: path }, S.plain(v))); return; }
  if (v && typeof v === 'object') for (const k of Object.keys(v)) walk(v[k], path ? path + '/' + k : k);
};
walk(r, '');
return { violations: flat.length, items: flat.slice(0, A.limit ?? 200) };
"#;

pub const AUTO_ROUTE: &str = r#"
await S.pcb();
const M = globalThis.EPCB_AutoRoutingExistingPrimitiveMode || {};
const O = globalThis.EPCB_AutoRoutingOptimization || {};
const props = { existingPrimitiveMode: A.keep_existing === false ? (M.REMOVE ?? 'remove') : (M.KEEP ?? 'keep'), optimization: A.priority === 'speed' ? (O.FASTER ?? 0) : (O.COMPLETION ?? 1) };
if (A.nets) props.RoutingNets = A.nets;
if (A.ignore_nets) props.ignoreNets = A.ignore_nets;
if (A.layers) props.layers = A.layers.map(S.layer);
return S.plain(await eda.pcb_Document.autoRouting(props));
"#;

pub const AUTO_PLACE: &str = r#"
await S.pcb();
return S.plain(await eda.pcb_Document.autoLayout());
"#;

pub const SET_COPPER_LAYERS: &str = r#"
await S.pcb();
return { ok: await eda.pcb_Layer.setTheNumberOfCopperLayers(A.count) };
"#;

pub const DESIGN_RULES: &str = r#"
await S.pcb();
return {
  configuration: await eda.pcb_Drc.getCurrentRuleConfigurationName(),
  rules: S.plain(await eda.pcb_Drc.getCurrentRuleConfiguration()),
  net_classes: S.plain(await eda.pcb_Drc.getAllNetClasses()),
  differential_pairs: S.plain(await eda.pcb_Drc.getAllDifferentialPairs()),
  net_rules: S.plain(await eda.pcb_Drc.getNetRules())
};
"#;

pub const NET_CLASS: &str = r#"
await S.pcb();
const existing = (await eda.pcb_Drc.getAllNetClasses()) || [];
if (existing.some(c => (c.name || c.netClassName) === A.name)) return { added: await eda.pcb_Drc.addNetToNetClass(A.name, A.nets) };
return { created: await eda.pcb_Drc.createNetClass(A.name, A.nets, null) };
"#;

pub const DIFF_PAIR: &str = r#"
await S.pcb();
return { created: await eda.pcb_Drc.createDifferentialPair(A.name, A.positive, A.negative) };
"#;

pub const SCREENSHOT: &str = r#"
const view = A.view ?? 'pcb';
if (view === 'pcb') { await S.pcb(); await eda.pcb_Document.zoomToBoardOutline(); }
if (view === 'schematic') { await S.sch(); await eda.dmt_EditorControl.zoomToAllPrimitives(); }
await new Promise(r => (typeof setTimeout === 'function' ? setTimeout(r, 600) : r()));
const d = await S.doc();
const img = await eda.dmt_EditorControl.getCurrentRenderedAreaImage(d && d.tabId);
if (!img) throw new Error('EasyEDA returned no image');
return { mime: img.type || 'image/png', base64: await S.b64(img) };
"#;

pub const EXPORT_MANUFACTURING: &str = r#"
await S.pcb();
const name = A.name || 'board';
const want = new Set(A.formats || ['gerber', 'bom', 'pick_and_place']);
const files = [];
if (want.has('gerber')) files.push(await S.file(await eda.pcb_ManufactureData.getGerberFile(name + '-gerber'), name + '-gerber.zip'));
if (want.has('bom')) files.push(await S.file(await eda.pcb_ManufactureData.getBomFile(name + '-bom', 'csv'), name + '-bom.csv'));
if (want.has('pick_and_place')) files.push(await S.file(await eda.pcb_ManufactureData.getPickAndPlaceFile(name + '-pick-and-place', 'csv', 'mm'), name + '-pick-and-place.csv'));
if (want.has('ipc2581')) files.push(await S.file(await eda.pcb_ManufactureData.getIpc2581CFile(name + '-ipc2581'), name + '-ipc2581.xml'));
if (want.has('odb')) files.push(await S.file(await eda.pcb_ManufactureData.getOpenDatabaseDoublePlusFile(name + '-odb'), name + '-odb.zip'));
if (want.has('step')) files.push(await S.file(await eda.pcb_ManufactureData.get3DFile(name, 'step'), name + '.step'));
if (want.has('netlist')) files.push(await S.file(await eda.pcb_ManufactureData.getNetlistFile(name + '-netlist'), name + '-netlist.enet'));
if (want.has('pdf')) files.push(await S.file(await eda.pcb_ManufactureData.getPdfFile(name), name + '.pdf'));
if (want.has('dxf')) files.push(await S.file(await eda.pcb_ManufactureData.getDxfFile(name), name + '.dxf'));
return { files };
"#;

pub const EXPORT_SCHEMATIC: &str = r#"
await S.sch();
const name = A.name || 'schematic';
const f = A.format === 'png' ? await eda.sch_ManufactureData.getPngFile(name) : await eda.sch_ManufactureData.getSvgFile(name);
return { files: [await S.file(f, name + '.' + (A.format === 'png' ? 'png' : 'svg'))] };
"#;

pub const PROJECT_BACKUP: &str = r#"
const p = await eda.dmt_Project.getCurrentProjectInfo();
const name = (A.name || (p && (p.friendlyName || p.name)) || 'project').replace(/[^A-Za-z0-9 _.-]/g, '_');
const f = await eda.sys_FileManager.getProjectFile(name, undefined, 'epro');
return { files: [await S.file(f, name + '.epro')] };
"#;

pub const BOARD_OUTLINE: &str = r#"
await S.pcb();
const outline = S.layer('outline');
let removed = 0;
if (A.replace !== false) {
  for (const k of [eda.pcb_PrimitiveLine, eda.pcb_PrimitivePolyline, eda.pcb_PrimitiveArc]) {
    try { const ids = (await k.getAllPrimitiveId(undefined, outline)) || []; if (ids.length && await k.delete(ids)) removed += ids.length; } catch (e) {}
  }
}
const x = A.x_mm ?? 0, y = A.y_mm ?? 0, w = A.width_mm, h = A.height_mm;
const r = Math.min(A.corner_radius_mm ?? 0, w / 2, h / 2);
const pts = [];
const corner = (cx, cy, a0) => { for (let i = 0; i <= 8; i++) { const a = (a0 + i * 90 / 8) * Math.PI / 180; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } };
if (r > 0) { corner(x + w - r, y + r, 270); corner(x + w - r, y + h - r, 0); corner(x + r, y + h - r, 90); corner(x + r, y + r, 180); }
else pts.push([x, y], [x + w, y], [x + w, y + h], [x, y + h]);
const src = [S.mil(pts[0][0]), S.mil(pts[0][1]), 'L'];
for (const [px, py] of pts.slice(1)) src.push(S.mil(px), S.mil(py));
src.push(S.mil(pts[0][0]), S.mil(pts[0][1]));
const poly = eda.pcb_MathPolygon.createPolygon(src);
const p = await eda.pcb_PrimitivePolyline.create('', outline, poly, S.mil(0.1), false);
if (!p) throw new Error('EasyEDA did not draw the outline');
return { outline: p.getState_PrimitiveId(), width_mm: w, height_mm: h, corner_radius_mm: r, replaced: removed };
"#;

pub const MOUNTING_HOLES: &str = r#"
await S.pcb();
const SH = globalThis.EPCB_PrimitivePadShapeType || {};
const HT = globalThis.EPCB_PrimitivePadHoleType || {};
const made = [];
for (const hole of A.holes) {
  const drill = hole.drill_mm ?? A.drill_mm ?? 3.2;
  const plated = hole.plated ?? A.plated ?? true;
  const pad = plated ? (hole.pad_mm ?? A.pad_mm ?? 6) : drill;
  const p = await eda.pcb_PrimitivePad.create(S.layer('multi'), hole.number ?? '', S.mil(hole.x), S.mil(hole.y), 0, [SH.ELLIPSE ?? 'ELLIPSE', S.mil(pad), S.mil(pad)], hole.net ?? A.net ?? '', [HT.ROUND ?? 'ROUND', S.mil(drill)], 0, 0, 0, plated);
  if (!p) throw new Error('EasyEDA did not place the hole at ' + hole.x + ', ' + hole.y);
  made.push(p.getState_PrimitiveId());
}
return { holes: made };
"#;

pub const SCH_TEXT: &str = r#"
await S.sch();
const made = [];
for (const t of A.texts) {
  const p = await eda.sch_PrimitiveText.create(t.x, t.y, t.text, t.rotation ?? 0, t.color ?? null, null, t.size ?? null, !!t.bold, false, false);
  if (!p) throw new Error('EasyEDA did not place "' + t.text + '"');
  made.push(p.getState_PrimitiveId());
}
return { texts: made };
"#;
