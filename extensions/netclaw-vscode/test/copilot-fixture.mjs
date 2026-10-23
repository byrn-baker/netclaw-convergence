import { realHud } from "./real-hud-fixture.mjs";
import fs from "node:fs";
import path from "node:path";
const f = await realHud();
const workspace = path.join(f.root, "copilot-workspace");
fs.mkdirSync(workspace);
fs.writeFileSync(
  path.join(workspace, "README.md"),
  "# NetClaw extension acceptance\nSynthetic isolated installation. No production credentials or network devices.\n",
);
console.log(
  JSON.stringify({
    url: f.url,
    installationId: f.installationId,
    workspace,
    root: f.root,
  }),
);
const stop = async () => {
  await f.close();
  process.exit();
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
