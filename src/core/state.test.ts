import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readState, removeInstall, upsertInstall, writeState } from "./state.js";
import type { InstallRecord } from "./types.js";

let dir: string;
let file: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "skillset-state-"));
  file = join(dir, "state.json");
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const record = (overrides: Partial<InstallRecord> = {}): InstallRecord => ({
  skill: "confidence",
  version: "0.1.0",
  agent: "claude-code",
  scope: "global",
  mode: "slash",
  location: "/some/path",
  files: ["SKILL.md"],
  installedAt: "2026-05-18T00:00:00.000Z",
  ...overrides,
});

describe("state", () => {
  it("returns empty state when file missing", async () => {
    const s = await readState(file);
    expect(s).toEqual({ version: 1, installs: [] });
  });

  it("round-trips through disk", async () => {
    const before = upsertInstall({ version: 1, installs: [] }, record());
    await writeState(before, file);
    const after = await readState(file);
    expect(after).toEqual(before);
  });

  it("upsert replaces existing entry with same key", async () => {
    let s = upsertInstall({ version: 1, installs: [] }, record());
    s = upsertInstall(s, record({ mode: "always" }));
    expect(s.installs).toHaveLength(1);
    expect(s.installs[0]!.mode).toBe("always");
  });

  it("upsert keeps distinct scopes/agents separate", async () => {
    let s = upsertInstall({ version: 1, installs: [] }, record());
    s = upsertInstall(s, record({ scope: "local", projectPath: "/p" }));
    s = upsertInstall(s, record({ agent: "pi" }));
    expect(s.installs).toHaveLength(3);
  });

  it("removeInstall removes the matching record only", () => {
    let s: { version: 1; installs: InstallRecord[] } = { version: 1, installs: [] };
    s = upsertInstall(s, record());
    s = upsertInstall(s, record({ agent: "pi" }));
    s = removeInstall(s, { skill: "confidence", agent: "pi", scope: "global" });
    expect(s.installs).toHaveLength(1);
    expect(s.installs[0]!.agent).toBe("claude-code");
  });

  it("writes pretty-printed json with trailing newline", async () => {
    await writeState(upsertInstall({ version: 1, installs: [] }, record()), file);
    const raw = await readFile(file, "utf8");
    expect(raw.endsWith("\n")).toBe(true);
    expect(raw).toContain('  "version": 1');
  });
});
