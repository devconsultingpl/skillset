// Runs during `npm install` (and `npm install -g .`) so a fresh clone builds
// itself. Skips during CI when devDeps haven't installed yet, and skips when
// `tsc` isn't on PATH (e.g. consumers installing from a published tarball).
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const tsc = resolve(root, "node_modules", ".bin", process.platform === "win32" ? "tsc.cmd" : "tsc");

if (!existsSync(tsc)) {
  // Either we're being installed as a dependency (no devDeps) or this is a
  // partial install. Either way, nothing to build.
  process.exit(0);
}

const r = spawnSync("npm", ["run", "build"], { stdio: "inherit", cwd: root, shell: true });
process.exit(r.status ?? 0);
