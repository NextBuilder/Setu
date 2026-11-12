import { Bridge } from "./bridge.mjs";
import { Server, serveStdio, allTools, VERSION } from "./mcp.mjs";

const arg = process.argv[2];

if (arg === "--version" || arg === "-V") console.log(`setu ${VERSION}`);
else if (arg === "--list-tools") for (const t of allTools()) console.log(t.name);
else if (arg === "--help" || arg === "-h")
  console.log(`setu ${VERSION}\n\nNext Builder's private design toolkit.\n\n  node setu.mjs            run the MCP server on stdio\n  node setu.mjs bridge     run only the bridge until Ctrl+C\n  node setu.mjs --version  print the version`);
else if (arg === "bridge") {
  const b = new Bridge();
  await b.start();
  b.server?.ref();
  console.log(JSON.stringify(await b.status()));
} else {
  const bridge = new Bridge();
  const rl = serveStdio(new Server({ bridge }));
  rl.on("close", async () => {
    await rl.drain();
    bridge.stop();
    process.exit(0);
  });
  bridge.start().catch(() => {});
}
