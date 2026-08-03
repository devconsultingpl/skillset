import { constants } from "node:fs";
import { access, cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "..", "src", "skills");
const dst = resolve(here, "..", "dist", "skills");

try {
  await access(src, constants.F_OK);
} catch {
  console.log("no src/skills yet — skipping");
  process.exit(0);
}

// Wipe first — a plain copy leaves deleted skills behind, and a stale skill in
// dist is a skill the CLI still lists and installs.
await rm(dst, { recursive: true, force: true });
await mkdir(dst, { recursive: true });
await cp(src, dst, { recursive: true });
console.log(`copied skills → ${dst}`);
