import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  type ActiveState,
  activeFilePath,
  addSkill,
  projectKey,
  readActive,
  removeSkill,
  resolveSessionKey,
  toggle,
  track,
  writeActive,
} from "./active.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "skillset-active-"));
  // resolveSessionKey honors CLAUDE_CODE_SESSION_ID as a fallback. When the
  // unit tests run inside Claude Code, the live session id would leak into the
  // project-key-fallback assertions below — drop it before every test. Tests
  // that exercise the env path set it themselves.
  // biome-ignore lint: process.env coerces `undefined` to the string "undefined"; the key must truly be absent.
  delete process.env.CLAUDE_CODE_SESSION_ID;
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const at = new Date("2026-05-29T00:00:00.000Z");

describe("active state helpers", () => {
  const empty: ActiveState = { active: [], updatedAt: "" };

  it("adds a skill and stamps updatedAt", () => {
    const s = addSkill(empty, "builder", at);
    expect(s.active).toEqual(["builder"]);
    expect(s.updatedAt).toBe(at.toISOString());
  });

  it("add is idempotent — no duplicates", () => {
    let s = addSkill(empty, "builder", at);
    s = addSkill(s, "builder", at);
    expect(s.active).toEqual(["builder"]);
  });

  it("removes a skill", () => {
    let s = addSkill(addSkill(empty, "builder", at), "caveman", at);
    s = removeSkill(s, "builder", at);
    expect(s.active).toEqual(["caveman"]);
  });

  it("toggle on/off routes to add/remove", () => {
    let s = toggle(empty, "caveman", true, at);
    expect(s.active).toEqual(["caveman"]);
    s = toggle(s, "caveman", false, at);
    expect(s.active).toEqual([]);
  });
});

describe("session keys", () => {
  it("uses explicit session id when present", () => {
    expect(resolveSessionKey("abc-123", "/proj")).toBe("abc-123");
  });

  it("falls back to a stable project key", () => {
    const a = resolveSessionKey(undefined, "/proj");
    const b = resolveSessionKey("   ", "/proj");
    expect(a).toBe(b);
    expect(a).toMatch(/^project-[0-9a-f]{16}$/);
  });

  it("uses the harness-supplied key when no explicit id is given", () => {
    // The core is *told* the key: which environment variable carries it is the
    // harness's business, so the caller asks its bridge (slice 2e). The bridge
    // that reads the variable is asserted in src/bridges/claude-code/index.test.ts.
    expect(resolveSessionKey(undefined, "/proj", "env-sess")).toBe("env-sess");
    // Explicit --session still wins.
    expect(resolveSessionKey("explicit", "/proj", "env-sess")).toBe("explicit");
    // An empty or absent harness key falls through to the project key.
    expect(resolveSessionKey(undefined, "/proj", "  ")).toMatch(/^project-/);
  });

  it("project key differs per root", () => {
    expect(projectKey("/a")).not.toBe(projectKey("/b"));
  });

  it("sanitizes unsafe keys so they cannot escape the base dir", () => {
    const p = activeFilePath("../../etc/passwd", dir);
    // The file must sit directly inside the base dir — no separators survive.
    expect(dirname(p)).toBe(dir);
  });
});

describe("readActive / writeActive", () => {
  it("returns empty state when file missing", async () => {
    expect(await readActive("nope", dir)).toEqual({ active: [], updatedAt: "" });
  });

  it("round-trips through disk", async () => {
    const state: ActiveState = { active: ["builder", "caveman"], updatedAt: at.toISOString() };
    await writeActive("sess", state, dir);
    expect(await readActive("sess", dir)).toEqual(state);
  });

  it("writes pretty-printed json with trailing newline", async () => {
    await writeActive("sess", { active: ["builder"], updatedAt: at.toISOString() }, dir);
    const raw = await readFile(activeFilePath("sess", dir), "utf8");
    expect(raw.endsWith("\n")).toBe(true);
    expect(raw).toContain('  "active"');
  });

  it("tolerates malformed active arrays", async () => {
    await writeActive("sess", { active: ["ok", 123 as unknown as string], updatedAt: "" }, dir);
    const read = await readActive("sess", dir);
    expect(read.active).toEqual(["ok"]);
  });
});

describe("track", () => {
  it("turns a skill on then off, persisting each step", async () => {
    let s = await track("sess", "builder", true, dir);
    expect(s.active).toEqual(["builder"]);
    s = await track("sess", "caveman", true, dir);
    expect(s.active).toEqual(["builder", "caveman"]);
    s = await track("sess", "builder", false, dir);
    expect(s.active).toEqual(["caveman"]);
    expect(await readActive("sess", dir)).toEqual(s);
  });

  it("keeps sessions independent", async () => {
    await track("one", "builder", true, dir);
    await track("two", "caveman", true, dir);
    expect((await readActive("one", dir)).active).toEqual(["builder"]);
    expect((await readActive("two", dir)).active).toEqual(["caveman"]);
  });
});
