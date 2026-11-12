import { createInterface } from "node:readline";
import { Guide, INSTRUCTIONS } from "./guide.mjs";
import { fail } from "./tools/result.mjs";
import { tools as edaTools } from "./tools/eda.mjs";
import { tools as engineeringTools } from "./tools/engineering.mjs";

export const VERSION = "0.2.0";
export const allTools = () => [...edaTools, ...engineeringTools];

export class Server {
  constructor(ctx) {
    this.ctx = ctx;
    this.tools = new Map(allTools().map((t) => [t.name, t]));
    this.guide = new Guide();
  }

  async call(name, args) {
    const def = this.tools.get(name);
    if (!def) return fail(`Unknown tool: ${name}`);
    const missing = (def.inputSchema.required || []).find((k) => args[k] === undefined || args[k] === null);
    if (missing) return fail(`Missing required argument '${missing}' for ${name}`);
    let result;
    try {
      result = await def.run(args, this.ctx);
    } catch (e) {
      result = fail(e?.message ?? String(e));
    }
    if (!result.isError) {
      const note = this.guide.note(name);
      if (note) result.content.push({ type: "text", text: note });
    }
    return result;
  }

  async handle(msg) {
    if (msg.id === undefined || msg.id === null) return null;
    const ok = (result) => ({ jsonrpc: "2.0", id: msg.id, result });
    switch (msg.method) {
      case "initialize":
        return ok({
          protocolVersion: msg.params?.protocolVersion ?? "2025-06-18",
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "setu", title: "Setu", version: VERSION },
          instructions: INSTRUCTIONS,
        });
      case "ping":
        return ok({});
      case "tools/list":
        return ok({ tools: [...this.tools.values()].map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
      case "tools/call":
        return ok(await this.call(String(msg.params?.name ?? ""), msg.params?.arguments ?? {}));
      case "resources/list":
        return ok({ resources: [] });
      case "prompts/list":
        return ok({ prompts: [] });
      default:
        return { jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: `Method not found: ${msg.method}` } };
    }
  }
}

export function serveStdio(server, input = process.stdin, output = process.stdout) {
  const write = (v) => output.write(JSON.stringify(v) + "\n");
  const rl = createInterface({ input });
  const pending = new Set();
  rl.on("line", (line) => {
    if (!line.trim()) return;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch (e) {
      return write({ jsonrpc: "2.0", id: null, error: { code: -32700, message: e.message } });
    }
    const job = server.handle(msg).then((reply) => reply && write(reply)).catch(() => {});
    pending.add(job);
    job.finally(() => pending.delete(job));
  });
  rl.drain = () => Promise.allSettled([...pending]).then(() => new Promise((r) => output.write("", r)));
  return rl;
}
