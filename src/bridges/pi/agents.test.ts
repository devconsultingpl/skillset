import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Bridge } from "../../core/bridge.js";
import { listBundledAgents, loadBundledAgent } from "../../core/bundle.js";
import { agentFieldSupport, classifyInstall } from "../../core/declarations.js";
import { fileExists } from "../../core/fs.js";
import { parseAgent } from "../../core/parse.js";
import { matchInstall } from "../../core/state.js";
import type { SkillsetState } from "../../core/types.js";
import {
  AGENT_BRIDGE_NAMES,
  BRIDGE_NAMES,
  bridgeFor,
  claudeCodeBridge,
  copilotBridge,
  opencodeBridge,
  piBridge,
} from "../index.js";
import { agentPath } from "./paths.js";

const AGENT_SRC = `---
name: widget-auditor
description: "Audits widgets; emits rows."
targets:
  pi:
    tools: read, grep
---

You audit widgets. Emit rows.
`;

const REAL_AGENT = "diff-auditor";

let projectRoot: string;

beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), "skillset-agents-"));
});
afterEach(async () => {
  await rm(projectRoot, { recursive: true, force: true });
});

const local = { scope: "local" as const };

describe("agent parsing", () => {
  it("requires a name and a description, and does not require a version", () => {
    const parsed = parseAgent(AGENT_SRC);
    expect(parsed.frontmatter.name).toBe("widget-auditor");
    expect(parsed.body).toContain("You audit widgets.");
    expect(parsed.frontmatter).not.toHaveProperty("version");
  });

  it("rejects an agent with no description", () => {
    expect(() => parseAgent("---\nname: x\n---\nbody\n")).toThrow(/description/);
  });

  it("every bundled agent parses, and none declares a version", async () => {
    const names = await listBundledAgents();
    expect(names.length).toBe(15);
    for (const name of names) {
      const agent = await loadBundledAgent(name);
      expect(agent.frontmatter.name).toBe(name);
      expect(agent.frontmatter.description.length).toBeGreaterThan(0);
      expect(agent.body.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("pi bridge — the agent half", () => {
  it("declares the capability, and the registry knows which bridges do", () => {
    expect(piBridge.agents).toBeDefined();
    expect(AGENT_BRIDGE_NAMES).toEqual(["pi"]);
    for (const bridge of [claudeCodeBridge, copilotBridge, opencodeBridge]) {
      expect(bridge.agents).toBeUndefined();
    }
  });

  it("installs one file at .pi/agents/<name>.md, named after the agent", async () => {
    const record = await piBridge.agents!.install({
      agent: parseAgent(AGENT_SRC),
      projectRoot,
      ...local,
    });
    expect(record.kind).toBe("agent");
    expect(record.mode).toBe("auto");
    expect(record.version).toBe("");
    expect(record.location).toBe(join(projectRoot, ".pi", "agents"));
    expect(record.files).toEqual(["widget-auditor.md"]);

    const written = await readFile(join(projectRoot, ".pi", "agents", "widget-auditor.md"), "utf8");
    expect(written).toContain("name: widget-auditor");
    expect(written).toContain("tools:");
    expect(written).not.toContain("targets:");
    expect(written).toContain("You audit widgets.");
  });

  it("renders the moved roster's tools through targets.pi, unchanged in value", async () => {
    const agent = await loadBundledAgent(REAL_AGENT);
    const { next } = await piBridge.agents!.preview(
      { agent, projectRoot, ...local },
      await piBridge.agents!.install({ agent, projectRoot, ...local }),
    );
    expect(next).not.toMatch(/^(isolated|skills|extensions):/m);
    expect(next).toContain("tools:");
    expect(next).toContain("read, grep, find, ls");
  });

  it("uninstalls the file and never the shared directory", async () => {
    const a = await piBridge.agents!.install({
      agent: parseAgent(AGENT_SRC),
      projectRoot,
      ...local,
    });
    const b = await piBridge.agents!.install({
      agent: parseAgent(AGENT_SRC.replace("widget-auditor", "widget-verifier")),
      projectRoot,
      ...local,
    });
    await piBridge.agents!.uninstall(a);
    expect(await fileExists(agentPath({ name: "widget-auditor", ...local, projectRoot }))).toBe(
      false,
    );
    expect(await fileExists(agentPath({ name: "widget-verifier", ...local, projectRoot }))).toBe(
      true,
    );
    await piBridge.agents!.uninstall(b);
    expect(await fileExists(join(projectRoot, ".pi", "agents"))).toBe(true);
  });
});

describe("agent capability report", () => {
  it("warns for a field pi does not read on an agent, naming it", () => {
    const agent = parseAgent(
      AGENT_SRC.replace("    tools: read, grep", "    tools: read\n    worktree: true"),
    );
    const { warnings, errors } = agentFieldSupport(agent, piBridge);
    expect(errors).toEqual([]);
    expect(warnings.join("\n")).toMatch(/worktree/);
    expect(warnings.join("\n")).toMatch(/does not read/);
  });

  it("warns for a field declared at the top level, where no renderer forwards it", () => {
    const agent = parseAgent(AGENT_SRC.replace("targets:", "isolation: true\ntargets:"));
    const { warnings } = agentFieldSupport(agent, piBridge);
    expect(warnings.join("\n")).toMatch(/`isolation` is declared at the top level/);
    expect(warnings.join("\n")).toMatch(/put it under `targets.pi`/);
  });

  it("errors — writes nothing — when a required field has no renderer", () => {
    const agent = parseAgent(AGENT_SRC);
    const { errors } = agentFieldSupport(agent, piBridge, ["worktree"]);
    expect(errors.join("\n")).toMatch(/required field `worktree` has no renderer/);
  });

  it("errors when the harness has no agent capability at all", () => {
    const agent = parseAgent(AGENT_SRC);
    const { errors } = agentFieldSupport(agent, claudeCodeBridge);
    expect(errors.join("\n")).toMatch(/cannot install agent definitions/);
  });

  it("accepts the ten fields pi's subagent loader parses", () => {
    const overrides = [
      "display_name",
      "description",
      "tools",
      "model",
      "thinking",
      "max_turns",
      "prompt_mode",
      "inherit_context",
      "run_in_background",
      "enabled",
    ];
    expect([...piBridge.agents!.expresses].sort()).toEqual([...overrides].sort());
    for (const dead of ["isolated", "skills", "extensions"]) {
      expect(piBridge.agents!.expresses).not.toContain(dead);
    }
  });
});

describe("the kind in the state and the classifier", () => {
  it("treats a record with no kind as a skill, so an old state file still reads", () => {
    const old = {
      skill: "widget-auditor",
      agent: "pi",
      scope: "local" as const,
      mode: "auto" as const,
      projectPath: projectRoot,
    };
    const agentDeclaration = { ...old, kind: "agent" as const };
    const skillDeclaration = { ...old };
    expect(matchInstall(old, skillDeclaration)).toBe(true);
    expect(matchInstall(old, agentDeclaration)).toBe(false);
    expect(matchInstall({ ...old, kind: "agent" }, agentDeclaration)).toBe(true);
  });

  it("classifies an unrecorded destination whose bytes match the render as adoptable", async () => {
    const agent = await loadBundledAgent(REAL_AGENT);
    const record = await piBridge.agents!.install({ agent, projectRoot, ...local });
    const state: SkillsetState = { version: 1, installs: [] };
    const item = await classifyInstall(
      {
        skill: REAL_AGENT,
        kind: "agent",
        agent: "pi",
        mode: "auto",
        scope: "local",
        projectPath: projectRoot,
      },
      state,
      piBridge,
    );
    expect(item.status).toBe("adoptable");
    expect(item.path).toBe(record.files[0] ? join(record.location, record.files[0]) : null);
  });

  it("classifies a destination somebody else wrote as foreign, and shows what it holds", async () => {
    const path = agentPath({ name: REAL_AGENT, ...local, projectRoot });
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, "---\nname: diff-auditor\n---\nnot ours\n");
    const item = await classifyInstall(
      {
        skill: REAL_AGENT,
        kind: "agent",
        agent: "pi",
        mode: "auto",
        scope: "local",
        projectPath: projectRoot,
      },
      { version: 1, installs: [] },
      piBridge,
    );
    expect(item.status).toBe("foreign");
    expect(item.currentBytes).toContain("not ours");
    expect(item.nextBytes).toContain("You are a specialist at auditing a patch");
  });

  it("repairs a recorded agent whose bytes moved locally as drifted", async () => {
    const agent = await loadBundledAgent(REAL_AGENT);
    const record = await piBridge.agents!.install({ agent, projectRoot, ...local });
    const path = join(record.location, record.files[0] ?? "");
    await writeFile(path, "---\nname: diff-auditor\n---\nedited locally\n");
    const item = await classifyInstall(
      {
        skill: REAL_AGENT,
        kind: "agent",
        agent: "pi",
        mode: "auto",
        scope: "local",
        projectPath: projectRoot,
      },
      { version: 1, installs: [record] },
      piBridge,
    );
    expect(item.status).toBe("drifted");
    expect(item.currentBytes).toContain("edited locally");
  });

  it("has no agent capability to ask for on a bridge that lacks one", () => {
    const withoutAgents: Bridge = claudeCodeBridge;
    expect(withoutAgents.name).toBe("claude-code");
    expect(bridgeFor("claude-code")?.agents).toBeUndefined();
    expect(BRIDGE_NAMES).toContain("claude-code");
  });
});
