import { mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
mkdirSync(`${root}dist`, { recursive: true });
execFileSync(
  "zip",
  ["-q", "-r", "-FS", `${root}dist/swarmkeeper-web.zip`, "."],
  { cwd: `${root}web` },
);
console.log("Static deployment archive: dist/swarmkeeper-web.zip");
