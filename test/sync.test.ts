import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Sandbox, exists, makeSandbox, run } from "./helpers.js";

/**
 * `skillset sync` against a sandboxed HOME. The declarations it reads are the
 * repository's real `skillset.config.json`, so these tests also pin the
 * coverage invariant: every bundled skill must declare its installs, or sync
 * fails before touching anything.
 */
let sb: Sandbox;

beforeEach(async () => {
  sb = await makeSandbox("skillset-sync");
});

afterEach(async () => {
  await sb.cleanup();
});

const statePath = () => join(sb.home, ".skillset", "state.json");

async function readInstalls(): Promise<Array<{ skill: string; agent: string; mode: string }>> {
  if (!(await exists(statePath()))) return [];
  const raw = JSON.parse(await readFile(statePath(), "utf8"));
  return raw.installs as Array<{ skill: string; agent: string; mode: string }>;
}

/** A declared destination that is easy to reach and mutate. */
const piPrompt = () => join(sb.home, ".pi", "agent", "prompts", "sk-architect.md");
const piAuto = () => join(sb.home, ".pi", "agent", "skills", "architect", "SKILL.md");

describe("sync — fresh home", () => {
  it("--dry-run reports every declared install as missing and writes nothing", async () => {
    const out = run(["sync", "--dry-run"], sb.projectRoot, sb.env);

    expect(out.status).toBe(0);
    expect(out.stdout).toMatch(/missing/);
    expect(await exists(statePath())).toBe(false);
    expect(await exists(piPrompt())).toBe(false);
  });

  it("installs every declared install, then reports everything in-sync", async () => {
    const first = run(["sync"], sb.projectRoot, sb.env);
    expect(first.status).toBe(0);
    expect(first.stdout).toMatch(/15 written|written/);

    const installed = await readInstalls();
    expect(installed.length).toBeGreaterThanOrEqual(30);
    expect(await exists(piPrompt())).toBe(true);
    // The dual-mode set (ADR 0005): both pi artifacts for the same skill.
    expect(await exists(piAuto())).toBe(true);
    expect(
      installed
        .filter((i) => i.skill === "architect" && i.agent === "pi")
        .map((i) => i.mode)
        .sort(),
    ).toEqual(["auto", "slash"]);

    // Idempotence is the whole point: a second run changes nothing.
    const second = run(["sync"], sb.projectRoot, sb.env);
    expect(second.status).toBe(0);
    expect(second.stdout).toMatch(/in-sync/);
    expect(second.stdout).not.toMatch(/missing/);
    expect(second.stdout).not.toMatch(/drifted/);
  });
});

describe("sync — drift", () => {
  it("reports a config-substituted skill as in-sync, not drifted", async () => {
    // `confidence` carries `config:` placeholders in its frontmatter. Install
    // renders them; a classifier that compared the raw bundle would call the
    // result drifted and rewrite the placeholders back (found against the real
    // home, where this file is substituted).
    expect(
      run(["install", "confidence", "--agent", "pi", "--global"], sb.projectRoot, sb.env).status,
    ).toBe(0);

    const out = run(["sync", "--dry-run"], sb.projectRoot, sb.env);
    const line = out.stdout.split("\n").find((l) => l.includes("confidence → pi"));
    expect(line).toContain("in-sync");
  });

  it("adopts an unrecorded artifact that is byte-identical, without rewriting it", async () => {
    run(["sync"], sb.projectRoot, sb.env);
    const before = await readFile(piPrompt(), "utf8");

    // Simulate the state ADR 0005 describes: files on disk, no record.
    const state = JSON.parse(await readFile(statePath(), "utf8"));
    state.installs = state.installs.filter(
      (i: { skill: string; agent: string; mode: string }) =>
        !(i.skill === "architect" && i.agent === "pi" && i.mode === "slash"),
    );
    await writeFile(statePath(), JSON.stringify(state, null, 2), "utf8");

    const out = run(["sync"], sb.projectRoot, sb.env);
    expect(out.status).toBe(0);
    expect(out.stdout).toMatch(/adoptable/);
    expect(await readFile(piPrompt(), "utf8")).toBe(before);
    expect(
      (await readInstalls()).some(
        (i) => i.skill === "architect" && i.agent === "pi" && i.mode === "slash",
      ),
    ).toBe(true);
  });

  it("repairs an edited artifact and reports the prior content", async () => {
    run(["sync"], sb.projectRoot, sb.env);
    await writeFile(piPrompt(), "---\ndescription: hand edited\n---\n\ntampered\n", "utf8");

    const out = run(["sync"], sb.projectRoot, sb.env);
    expect(out.status).toBe(0);
    expect(out.stdout).toMatch(/drifted/);
    // The prior content is reported, not silently discarded.
    expect(out.stdout).toContain("hand edited");
    expect(await readFile(piPrompt(), "utf8")).toContain("# architect");
  });

  it("refuses a foreign file, exits non-zero, and leaves it untouched", async () => {
    run(["sync"], sb.projectRoot, sb.env);
    // Foreign means unrecorded *and* different: a recorded file that was edited
    // is ours and gets repaired, but a file we never wrote is not ours to touch.
    const state = JSON.parse(await readFile(statePath(), "utf8"));
    state.installs = state.installs.filter(
      (i: { skill: string; agent: string; mode: string }) =>
        !(i.skill === "architect" && i.agent === "pi" && i.mode === "slash"),
    );
    await writeFile(statePath(), JSON.stringify(state, null, 2), "utf8");
    await writeFile(piPrompt(), "someone else's file\n", "utf8");

    const out = run(["sync"], sb.projectRoot, sb.env);
    expect(out.status).toBe(1);
    expect(out.stdout).toMatch(/foreign/);
    expect(await readFile(piPrompt(), "utf8")).toBe("someone else's file\n");
  });
});

describe("sync — undeclared installs", () => {
  it("reports a recorded install the declarations do not mention, and prunes it on request", async () => {
    // opencode is declared only for ponytail, so this is a deliberate extra.
    expect(
      run(
        ["install", "caveman", "--agent", "opencode", "--mode", "slash", "--global"],
        sb.projectRoot,
        sb.env,
      ).status,
    ).toBe(0);

    const reported = run(["sync", "--dry-run"], sb.projectRoot, sb.env);
    expect(reported.stdout).toMatch(/undeclared/);
    const stillThere = await readInstalls();
    expect(stillThere.some((i) => i.skill === "caveman" && i.agent === "opencode")).toBe(true);

    const pruned = run(["sync", "--prune"], sb.projectRoot, sb.env);
    expect(pruned.status).toBe(0);
    expect(
      (await readInstalls()).some((i) => i.skill === "caveman" && i.agent === "opencode"),
    ).toBe(false);
  });
});
