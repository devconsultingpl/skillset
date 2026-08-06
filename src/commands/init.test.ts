import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { fileExists } from "../core/fs.js";
import { init } from "./init.js";

let scratch: string | undefined;

async function makeMonorepo(): Promise<string> {
  scratch = await mkdtemp(join(tmpdir(), "init-test-"));
  await mkdir(join(scratch, "apps", "web"), { recursive: true });
  await mkdir(join(scratch, "apps", "api"), { recursive: true });
  await writeFile(join(scratch, "package.json"), '{"workspaces": ["apps/*"]}');
  await writeFile(join(scratch, "apps", "web", "package.json"), "{}");
  await writeFile(join(scratch, "apps", "api", "package.json"), "{}");
  return scratch;
}

async function makePlain(): Promise<string> {
  scratch = await mkdtemp(join(tmpdir(), "init-test-"));
  await writeFile(join(scratch, "package.json"), "{}");
  return scratch;
}

afterEach(async () => {
  if (scratch) await rm(scratch, { recursive: true, force: true });
  scratch = undefined;
});

describe("init convention — plain project", () => {
  it("scaffolds root docs tree", async () => {
    const root = await makePlain();
    await init({ skill: "convention", projectRoot: root, interactive: false });
    expect(await fileExists(join(root, "docs", "goals.md"))).toBe(true);
    expect(await fileExists(join(root, "docs", "conventions.md"))).toBe(true);
    expect(await fileExists(join(root, "docs", "plans", ".gitkeep"))).toBe(true);
    expect(await fileExists(join(root, "docs", "decisions", "0001-example.md"))).toBe(true);
  });

  it("is idempotent — existing files untouched", async () => {
    const root = await makePlain();
    await init({ skill: "convention", projectRoot: root, interactive: false });
    await writeFile(join(root, "docs", "goals.md"), "MY GOALS\n");
    await init({ skill: "convention", projectRoot: root, interactive: false });
    expect(await readFile(join(root, "docs", "goals.md"), "utf8")).toBe("MY GOALS\n");
  });
});

describe("init convention — monorepo", () => {
  it("non-interactive default: root + every app", async () => {
    const root = await makeMonorepo();
    await init({ skill: "convention", projectRoot: root, interactive: false });
    expect(await fileExists(join(root, "docs", "goals.md"))).toBe(true);
    expect(await fileExists(join(root, "apps", "web", "docs", "goals.md"))).toBe(true);
    expect(await fileExists(join(root, "apps", "api", "docs", "goals.md"))).toBe(true);
  });

  it("interactive choice a: root + every app", async () => {
    const root = await makeMonorepo();
    await init({ skill: "convention", projectRoot: root, interactive: true, ask: async () => "a" });
    expect(await fileExists(join(root, "docs", "goals.md"))).toBe(true);
    expect(await fileExists(join(root, "apps", "web", "docs", "goals.md"))).toBe(true);
  });

  it("interactive choice r: root only", async () => {
    const root = await makeMonorepo();
    await init({ skill: "convention", projectRoot: root, interactive: true, ask: async () => "r" });
    expect(await fileExists(join(root, "docs", "goals.md"))).toBe(true);
    expect(await fileExists(join(root, "apps", "web", "docs", "goals.md"))).toBe(false);
  });

  it("interactive choice o: apps only, no root", async () => {
    const root = await makeMonorepo();
    await init({ skill: "convention", projectRoot: root, interactive: true, ask: async () => "o" });
    expect(await fileExists(join(root, "docs", "goals.md"))).toBe(false);
    expect(await fileExists(join(root, "apps", "web", "docs", "goals.md"))).toBe(true);
    expect(await fileExists(join(root, "apps", "api", "docs", "goals.md"))).toBe(true);
  });

  it("noApps: root only, no per-app docs", async () => {
    const root = await makeMonorepo();
    await init({ skill: "convention", projectRoot: root, noApps: true, interactive: true });
    expect(await fileExists(join(root, "docs", "goals.md"))).toBe(true);
    expect(await fileExists(join(root, "apps", "web", "docs", "goals.md"))).toBe(false);
  });

  it("yes: never prompts even when interactive — default every app + root", async () => {
    const root = await makeMonorepo();
    await init({
      skill: "convention",
      projectRoot: root,
      interactive: true,
      yes: true,
      ask: async () => {
        throw new Error("ask must not be called with --yes");
      },
    });
    expect(await fileExists(join(root, "docs", "goals.md"))).toBe(true);
    expect(await fileExists(join(root, "apps", "web", "docs", "goals.md"))).toBe(true);
    expect(await fileExists(join(root, "apps", "api", "docs", "goals.md"))).toBe(true);
  });

  it("idempotent across apps — re-run leaves per-app docs untouched", async () => {
    const root = await makeMonorepo();
    await init({ skill: "convention", projectRoot: root, interactive: false });
    await writeFile(join(root, "apps", "web", "docs", "goals.md"), "WEB GOALS\n");
    await init({ skill: "convention", projectRoot: root, interactive: false });
    expect(await readFile(join(root, "apps", "web", "docs", "goals.md"), "utf8")).toBe(
      "WEB GOALS\n",
    );
  });

  it("never creates or edits .flow", async () => {
    const root = await makePlain();
    await mkdir(join(root, ".flow", "guidance"), { recursive: true });
    await writeFile(join(root, ".flow", "guidance", "architecture.md"), "# existing");
    await init({ skill: "convention", projectRoot: root, interactive: false });
    expect(await fileExists(join(root, ".flow", "guidance", "architecture.md"))).toBe(true);
    expect(await readFile(join(root, ".flow", "guidance", "architecture.md"), "utf8")).toBe(
      "# existing",
    );
  });

  it("rejects a skill without templates", async () => {
    const root = await makePlain();
    await expect(init({ skill: "nope", projectRoot: root })).rejects.toThrow(
      'skill "nope" has no templates to init',
    );
  });
});
