import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { detectWorkspaceApps, readWorkspacePatterns } from "./workspaces.js";

let scratch: string | undefined;

async function makeTree(files: Record<string, string>): Promise<string> {
  scratch = await mkdtemp(join(tmpdir(), "ws-test-"));
  for (const [rel, content] of Object.entries(files)) {
    const p = join(scratch, rel);
    await mkdir(p.slice(0, p.lastIndexOf("/")), { recursive: true });
    await writeFile(p, content);
  }
  return scratch;
}

afterEach(async () => {
  if (scratch) await rm(scratch, { recursive: true, force: true });
  scratch = undefined;
});

describe("readWorkspacePatterns", () => {
  it("reads package.json workspaces array", async () => {
    const root = await makeTree({ "package.json": '{"workspaces": ["apps/*", "packages/*"]}' });
    expect(await readWorkspacePatterns(root)).toEqual(["apps/*", "packages/*"]);
  });

  it("reads package.json workspaces object (npm packages field)", async () => {
    const root = await makeTree({
      "package.json": '{"workspaces": {"packages": ["packages/*"]}}',
    });
    expect(await readWorkspacePatterns(root)).toEqual(["packages/*"]);
  });

  it("reads pnpm-workspace.yaml flat packages list", async () => {
    const root = await makeTree({
      "pnpm-workspace.yaml": "packages:\n  - 'apps/*'\n  - '!apps/legacy'\n  - 'shared/*'\n",
    });
    expect(await readWorkspacePatterns(root)).toEqual(["apps/*", "shared/*"]);
  });

  it("reads lerna.json packages", async () => {
    const root = await makeTree({ "lerna.json": '{"packages": ["packages/*", "!packages/old"]}' });
    expect(await readWorkspacePatterns(root)).toEqual(["packages/*"]);
  });

  it("package.json wins over pnpm-workspace.yaml", async () => {
    const root = await makeTree({
      "package.json": '{"workspaces": ["apps/*"]}',
      "pnpm-workspace.yaml": "packages:\n  - 'libs/*'\n",
    });
    expect(await readWorkspacePatterns(root)).toEqual(["apps/*"]);
  });
});

describe("detectWorkspaceApps", () => {
  it("plain project (root marker only) → no apps", async () => {
    const root = await makeTree({ "package.json": "{}" });
    expect(await detectWorkspaceApps(root)).toEqual([]);
  });

  it("empty project → no apps", async () => {
    const root = await makeTree({});
    expect(await detectWorkspaceApps(root)).toEqual([]);
  });

  it("fallback scan finds marker dirs at any depth, mixed languages", async () => {
    const root = await makeTree({
      "apps/web/package.json": "{}",
      "apps/api/package.json": "{}",
      "apps/java/pom.xml": "<project/>",
      "apps/clj/deps.edn": "{}",
      "apps/lisp/foo.asd": "(defsystem foo)",
      "apps/nested/deep/tool/build.gradle.kts": "",
      "services/svc/package.json": "{}",
      "README.md": "hello",
    });
    expect(await detectWorkspaceApps(root)).toEqual([
      "apps/api",
      "apps/clj",
      "apps/java",
      "apps/lisp",
      "apps/nested/deep/tool",
      "apps/web",
      "services/svc",
    ]);
  });

  it("excludes node_modules, build artifacts, hidden dirs, and .flow", async () => {
    const root = await makeTree({
      "node_modules/dep/package.json": "{}",
      "apps/web/package.json": "{}",
      "apps/web/node_modules/x/package.json": "{}",
      "apps/web/build/package.json": "{}",
      "target/package.json": "{}",
      "dist/package.json": "{}",
      ".hidden/pkg/package.json": "{}",
      ".flow/guidance/architecture.md": "# guidance",
    });
    expect(await detectWorkspaceApps(root)).toEqual(["apps/web"]);
  });

  it("workspace globs are authoritative (marker outside globs not an app)", async () => {
    const root = await makeTree({
      "package.json": '{"workspaces": ["apps/*"]}',
      "apps/web/package.json": "{}",
      "apps/api/package.json": "{}",
      "tools/script/package.json": "{}", // marker, but outside the declared globs
    });
    expect(await detectWorkspaceApps(root)).toEqual(["apps/api", "apps/web"]);
  });

  it("workspace glob ** matches nested dirs", async () => {
    const root = await makeTree({
      "package.json": '{"workspaces": ["packages/**"]}',
      "packages/lib/package.json": "{}",
      "packages/lib/inner/package.json": "{}",
      "apps/other/package.json": "{}",
    });
    expect(await detectWorkspaceApps(root)).toEqual(["packages/lib", "packages/lib/inner"]);
  });

  it("glob match without a marker is not an app", async () => {
    const root = await makeTree({
      "package.json": '{"workspaces": ["apps/*"]}',
      "apps/web/package.json": "{}",
    });
    await mkdir(join(root, "apps", "empty"), { recursive: true }); // no marker file
    expect(await detectWorkspaceApps(root)).toEqual(["apps/web"]);
  });
});
