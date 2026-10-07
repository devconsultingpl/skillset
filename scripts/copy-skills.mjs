import { constants } from "node:fs";
import { access, cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

async function copyTree(dir, label) {
  const src = resolve(here, "..", "src", dir);
  const dst = resolve(here, "..", "dist", dir);
  try {
    await access(src, constants.F_OK);
  } catch {
    console.log(`no src/${dir} yet — skipping`);
    return;
  }
  await rm(dst, { recursive: true, force: true });
  await mkdir(dst, { recursive: true });
  await cp(src, dst, { recursive: true });
  console.log(`copied ${label} → ${dst}`);
}

await copyTree("skills", "skills");
await copyTree("agents", "agents");
