import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { allTools, VERSION } from "../server/mcp.mjs";
import { render } from "../scripts/tools-doc.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const PARAMS = new Set(["ignore_nets", "keep_existing", "manufacturer_part", "supplier_part", "in_bom", "in_pcb", "output_dir", "corner_radius_mm", "timeout_s", "schematic_uuid", "pcb_uuid", "no_nets", "dry_run", "mounting_holes", "ground_net", "width_mm", "height_mm"]);

test("TOOLS.md matches the server and the version matches package.json", () => {
  assert.equal(read(join(root, "docs/TOOLS.md")), render());
  assert.equal(JSON.parse(read(join(root, "package.json"))).version, VERSION);
});

test("skills mention only real tools and resolve their links", () => {
  const tools = new Set(allTools().map((t) => t.name));
  const problems = [];
  for (const f of walk(join(root, "assets")).filter((f) => f.endsWith(".md"))) {
    const text = read(f);
    text.split("`").forEach((part, i) => {
      if (i % 2 === 0) return;
      if (/^[a-z][a-z0-9_]*$/.test(part) && part.includes("_") && !part.endsWith("_") && !tools.has(part) && !PARAMS.has(part)) problems.push(`${f}: unknown tool \`${part}\``);
    });
    for (const m of text.matchAll(/\]\(([^)]+)\)/g)) {
      const t = m[1];
      if (!t.startsWith("http") && !t.startsWith("#") && t.endsWith(".md") && !existsSync(join(dirname(f), t))) problems.push(`${f}: broken link ${t}`);
    }
  }
  assert.deepEqual(problems, []);
});

test("every skill and reference is reachable and named for its folder", () => {
  const problems = [];
  const skills = join(root, "assets/skills");
  for (const name of readdirSync(skills)) {
    const skill = read(join(skills, name, "SKILL.md"));
    if (!skill.includes(`\nname: ${name}\n`)) problems.push(`${name}: front matter name differs`);
    const refs = join(skills, name, "references");
    if (existsSync(refs)) for (const r of readdirSync(refs)) if (!skill.includes(`references/${r}`)) problems.push(`${name}: references/${r} is not linked from SKILL.md`);
  }
  assert.deepEqual(problems, []);
});

test("agents preload skills that exist", () => {
  for (const f of readdirSync(join(root, "assets/agents"))) {
    const front = read(join(root, "assets/agents", f)).split("---")[1];
    const list = /skills:\n((?:  - .+\n)+)/.exec(front + "\n");
    for (const s of list ? list[1].trim().split("\n").map((l) => l.trim().replace(/^- /, "")) : []) assert.ok(existsSync(join(root, "assets/skills", s, "SKILL.md")), `${f}: no skill ${s}`);
  }
});
