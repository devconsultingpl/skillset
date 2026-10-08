import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Sandbox, exists, makeSandbox, run } from "./helpers.js";

let sb: Sandbox;

beforeEach(async () => {
  sb = await makeSandbox("skillset-agents-kind");
});
afterEach(async () => {
  await sb.cleanup();
});

const statePath = () => join(sb.home, ".skillset", "state.json");
const agentFile = (name: string) => join(sb.home, ".pi", "agent", "agents", `${name}.md`);

async function installs(): Promise<
  Array<{ skill: string; kind?: string; mode: string; agent: string }>
> {
  if (!(await exists(statePath()))) return [];
  const raw = JSON.parse(await readFile(statePath(), "utf8"));
  return raw.installs as Array<{ skill: string; kind?: string; mode: string; agent: string }>;
}

describe("agents as an artifact kind", () => {
  it("installs one agent for pi, and records it as an agent in auto mode", async () => {
    const out = run(
      ["install", "diff-auditor", "--agent", "pi", "--global"],
      sb.projectRoot,
      sb.env,
    );
    expect(out.status).toBe(0);
    expect(out.stdout).toMatch(/installed diff-auditor → pi/);
    expect(await exists(agentFile("diff-auditor"))).toBe(true);

    const recorded = (await installs()).filter((i) => i.skill === "diff-auditor");
    expect(recorded).toHaveLength(1);
    expect(recorded[0]?.kind).toBe("agent");
    expect(recorded[0]?.mode).toBe("auto");
  });

  it("sync installs the whole roster, then reports it in-sync and writes nothing", async () => {
    const first = run(["sync"], sb.projectRoot, sb.env);
    expect(first.status).toBe(0);
    expect(first.stdout).toMatch(/missing/);
    expect(first.stdout).not.toMatch(/foreign/);

    const agentRecords = (await installs()).filter((i) => i.kind === "agent");
    expect(agentRecords.filter((i) => i.agent === "pi")).toHaveLength(15);
    expect(agentRecords.filter((i) => i.agent === "claude-code")).toHaveLength(15);

    const second = run(["sync"], sb.projectRoot, sb.env);
    expect(second.status).toBe(0);
    expect(second.stdout).toMatch(/in-sync/);
    expect(second.stdout).not.toMatch(/missing/);
    expect(second.stdout).not.toMatch(/drifted/);

    const third = run(["sync", "--dry-run"], sb.projectRoot, sb.env);
    expect(third.status).toBe(0);
    expect(third.stdout).toMatch(/checked in-sync 62/);
  });

  it("keeps `undeclared` and `in-sync` honest across the kinds", async () => {
    run(["install", "diff-auditor", "--agent", "pi", "--global"], sb.projectRoot, sb.env);
    run(
      ["install", "architect", "--agent", "pi", "--global", "--mode", "slash"],
      sb.projectRoot,
      sb.env,
    );
    const kinds = (await installs()).map((i) => `${i.skill}:${i.kind ?? "skill"}`);
    expect(kinds).toContain("diff-auditor:agent");
    expect(kinds).toContain("architect:skill");
  });

  it("refuses a destination it did not write, and names the way through", async () => {
    await mkdir(dirname(agentFile("diff-auditor")), { recursive: true });
    await writeFile(
      agentFile("diff-auditor"),
      "---\nname: diff-auditor\n---\nsomebody else wrote this\n",
    );
    const out = run(
      ["install", "diff-auditor", "--agent", "pi", "--global"],
      sb.projectRoot,
      sb.env,
    );
    expect(out.status).toBe(1);
    expect(out.stderr).toMatch(/refusing/);
    expect(out.stderr).toMatch(/--force to replace/);
    expect(await readFile(agentFile("diff-auditor"), "utf8")).toContain("somebody else wrote this");
  });

  it("adopts it when the install is deliberate", async () => {
    await mkdir(dirname(agentFile("diff-auditor")), { recursive: true });
    await writeFile(
      agentFile("diff-auditor"),
      "---\nname: diff-auditor\n---\nsomebody else wrote this\n",
    );
    const out = run(
      ["install", "diff-auditor", "--agent", "pi", "--global", "--force"],
      sb.projectRoot,
      sb.env,
    );
    expect(out.status).toBe(0);
    expect(await readFile(agentFile("diff-auditor"), "utf8")).toContain("evidence-only rows");
    expect(await readFile(agentFile("diff-auditor"), "utf8")).not.toContain(
      "somebody else wrote this",
    );
  });

  it("uninstalls the file and leaves every other agent on disk", async () => {
    run(["sync"], sb.projectRoot, sb.env);
    const out = run(["uninstall", "diff-auditor"], sb.projectRoot, sb.env);
    expect(out.status).toBe(0);
    expect(await exists(agentFile("diff-auditor"))).toBe(false);
    expect(await exists(agentFile("claim-verifier"))).toBe(true);
    expect((await installs()).filter((i) => i.skill === "diff-auditor")).toHaveLength(0);
  });

  it("refuses `--mode` on an agent: one delivery shape, no choice to make", async () => {
    const out = run(
      ["install", "diff-auditor", "--agent", "pi", "--global", "--mode", "slash"],
      sb.projectRoot,
      sb.env,
    );
    expect(out.status).toBe(1);
    expect(out.stderr).toMatch(/one delivery shape/);
    expect(await exists(agentFile("diff-auditor"))).toBe(false);
  });

  it("refuses a declaration for a harness with no agent renderer, writing nothing", async () => {
    const configPath = join(sb.projectRoot, "scratch.config.json");
    await writeFile(
      configPath,
      JSON.stringify({
        version: 1,
        agents: { "diff-auditor": [{ agent: "opencode" }] },
        installs: {},
      }),
    );
    const out = run(["sync", "--dry-run"], sb.projectRoot, {
      ...sb.env,
      SKILLSET_CONFIG: configPath,
    });
    expect(out.status).toBe(2);
    expect(out.stderr).toMatch(/cannot install agent definitions/);
    expect(out.stderr).toMatch(/harnesses that can: claude-code, pi/);
    expect(await exists(agentFile("diff-auditor"))).toBe(false);
    expect(await exists(join(sb.home, ".claude", "agents"))).toBe(false);
    expect(await exists(join(sb.home, ".config", "opencode"))).toBe(false);
  });

  it("refuses a claude-code agent destination it did not write, and adopts it on request", async () => {
    const path = join(sb.home, ".claude", "agents", "diff-auditor.md");
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, "---\nname: diff-auditor\n---\nsomebody else wrote this\n");

    const out = run(
      ["install", "diff-auditor", "--agent", "claude-code", "--global"],
      sb.projectRoot,
      sb.env,
    );
    expect(out.status).toBe(1);
    expect(out.stderr).toMatch(/refusing/);
    expect(await readFile(path, "utf8")).toContain("somebody else wrote this");

    const forced = run(
      ["install", "diff-auditor", "--agent", "claude-code", "--global", "--force"],
      sb.projectRoot,
      sb.env,
    );
    expect(forced.status).toBe(0);
    expect(await readFile(path, "utf8")).toContain("evidence-only rows");
  });

  it("reports an agent declaration with no bundled definition", async () => {
    const configPath = join(sb.projectRoot, "scratch2.config.json");
    await writeFile(
      configPath,
      JSON.stringify({ version: 1, agents: { "no-such-agent": [{ agent: "pi" }] }, installs: {} }),
    );
    const out = run(["sync", "--dry-run"], sb.projectRoot, {
      ...sb.env,
      SKILLSET_CONFIG: configPath,
    });
    expect(out.status).toBe(2);
    expect(out.stderr).toMatch(/no-such-agent: declared but not present in src\/agents\//);
  });
});
