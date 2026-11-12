import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Server, allTools } from "../server/mcp.mjs";
import { Bridge } from "../server/bridge.mjs";
import { script, safeName, stamp } from "../server/tools/eda.mjs";
import { ADD_TRACK } from "../server/tools/scripts.mjs";

const server = () => new Server({ bridge: new Bridge(1, 1) });
const entry = fileURLToPath(new URL("../server/setu.mjs", import.meta.url));

test("initializes with the stage guide", async () => {
  const r = await server().handle({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } });
  assert.equal(r.result.serverInfo.name, "setu");
  assert.match(r.result.instructions, /easyeda-pro-review-agent/);
  assert.match(r.result.instructions, /design_board/);
});

test("lists tools and runs a calculator offline with its stage note", async () => {
  const s = server();
  const names = (await s.handle({ jsonrpc: "2.0", id: 2, method: "tools/list" })).result.tools.map((t) => t.name);
  for (const n of ["export_manufacturing", "calc_trace_width", "smart_place", "design_board", "audit_layout"]) assert.ok(names.includes(n), n);
  const r = await s.call("calc_trace_width", { current_a: 2 });
  assert.equal(r.isError, false);
  assert.ok(r.content.some((c) => c.text.includes("easyeda-power-design")));
});

test("refuses missing arguments and unknown tools, ignores notifications", async () => {
  const s = server();
  assert.ok((await s.call("add_track", { net: "GND" })).isError);
  assert.ok((await s.call("nope", {})).isError);
  assert.equal(await s.handle({ jsonrpc: "2.0", method: "notifications/initialized" }), null);
});

test("tools have unique names and object schemas; scripts carry the prelude and no comments", () => {
  const names = allTools().map((t) => t.name);
  assert.equal(new Set(names).size, names.length);
  for (const t of allTools()) assert.equal(t.inputSchema.type, "object", t.name);
  const s = script(ADD_TRACK, { net: "GND", points: [[0, 0], [1, 1]] });
  assert.ok(s.startsWith("\nconst S = {};"));
  assert.ok(s.includes('const A = {"net":"GND"'));
  assert.ok(!s.includes("//"));
});

test("file names stay inside their folder and folders are dated", () => {
  assert.equal(safeName("../../evil.zip"), "_.._evil.zip");
  assert.equal(safeName("board-gerber.zip"), "board-gerber.zip");
  assert.match(stamp(new Date(2026, 10, 12, 7, 5)), /^2026-11-12_0705$/);
});

test("the entry point answers over stdio", () => {
  const out = spawnSync(process.execPath, [entry], { input: '{"jsonrpc":"2.0","id":1,"method":"tools/list"}\n', encoding: "utf8", timeout: 10000 });
  const reply = JSON.parse(out.stdout.trim().split("\n")[0]);
  assert.ok(reply.result.tools.length > 40);
  assert.equal(spawnSync(process.execPath, [entry, "--version"], { encoding: "utf8" }).stdout.trim().split(" ")[0], "setu");
});
