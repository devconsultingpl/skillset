import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listBundledAgents, loadBundledAgent } from "../../core/bundle.js";
import { agentFieldSupport, classifyInstall } from "../../core/declarations.js";
import { fileExists } from "../../core/fs.js";
import { parseAgent } from "../../core/parse.js";
import { AGENT_BRIDGE_NAMES, bridgeFor, claudeCodeBridge } from "../index.js";
import { agentPath } from "./paths.js";

const AGENT_SRC = `---
name: widget-auditor
description: "Audits widgets; emits rows."
targets:
  claude-code:
    tools: Read, Grep, Glob
---

You audit widgets. Emit rows.
`;

const REAL_AGENT = "diff-auditor";
const PI_TOOL_NAME = /^(tools):.*(\bread\b|\bgrep\b|\bfind\b|\bls\b|\bbash\b|ext:)/m;

let projectRoot: string;

beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), "skillset-cc-agents-"));
});
afterEach(async () => {
  await rm(projectRoot, { recursive: true, force: true });
});

const local = { scope: "local" as const };

describe("claude-code bridge — the agent half", () => {
  it("declares the capability and the fields its loader reads, requiring tools", () => {
    expect(claudeCodeBridge.agents).toBeDefined();
    expect(AGENT_BRIDGE_NAMES).toEqual(["claude-code", "pi"]);
    expect(bridgeFor("claude-code")?.agents).toBe(claudeCodeBridge.agents);

    for (const field of ["name", "description", "tools", "disallowedTools", "model"]) {
      expect(claudeCodeBridge.agents!.expresses).toContain(field);
    }
    expect(claudeCodeBridge.agents!.required).toEqual(["tools"]);
  });

  it("installs one file at .claude/agents/<name>.md, named after the agent", async () => {
    const record = await claudeCodeBridge.agents!.install({
      agent: parseAgent(AGENT_SRC),
      projectRoot,
      ...local,
    });
    expect(record.kind).toBe("agent");
    expect(record.mode).toBe("auto");
    expect(record.version).toBe("");
    expect(record.agent).toBe("claude-code");
    expect(record.location).toBe(join(projectRoot, ".claude", "agents"));
    expect(record.files).toEqual(["widget-auditor.md"]);

    const written = await readFile(
      join(projectRoot, ".claude", "agents", "widget-auditor.md"),
      "utf8",
    );
    expect(written).toContain("name: widget-auditor");
    expect(written).toContain('tools: "Read, Grep, Glob"');
    expect(written).not.toContain("targets:");
    expect(written).toContain("You audit widgets.");
  });

  it("writes the whole roster with claude-code's own tool names, and no pi name", async () => {
    const names = await listBundledAgents();
    expect(names).toHaveLength(15);

    for (const name of names) {
      const record = await claudeCodeBridge.agents!.install({
        agent: await loadBundledAgent(name),
        projectRoot,
        ...local,
      });
      const written = await readFile(join(record.location, record.files[0] ?? ""), "utf8");
      expect(written, `${name} name`).toContain(`name: ${name}`);
      expect(written, `${name} description`).toMatch(/^description: .+$/m);
      expect(written, `${name} tools`).toMatch(/^tools: .+$/m);
      expect(written, `${name} pi tool name`).not.toMatch(PI_TOOL_NAME);
    }

    const web = await readFile(
      agentPath({ name: "web-search-researcher", ...local, projectRoot }),
      "utf8",
    );
    expect(web).toContain('tools: "Read, Grep, Glob, WebSearch, WebFetch"');
    const locator = await readFile(
      agentPath({ name: "artifacts-locator", ...local, projectRoot }),
      "utf8",
    );
    expect(locator).toContain('tools: "Grep, Glob"');
  });

  it("uninstalls the file and never the shared directory", async () => {
    const a = await claudeCodeBridge.agents!.install({
      agent: parseAgent(AGENT_SRC),
      projectRoot,
      ...local,
    });
    const b = await claudeCodeBridge.agents!.install({
      agent: parseAgent(AGENT_SRC.replace("widget-auditor", "widget-verifier")),
      projectRoot,
      ...local,
    });
    await claudeCodeBridge.agents!.uninstall(a);
    expect(await fileExists(agentPath({ name: "widget-auditor", ...local, projectRoot }))).toBe(
      false,
    );
    expect(await fileExists(agentPath({ name: "widget-verifier", ...local, projectRoot }))).toBe(
      true,
    );
    await claudeCodeBridge.agents!.uninstall(b);
    expect(await fileExists(join(projectRoot, ".claude", "agents"))).toBe(true);
  });

  it("previews the artifact it would write", async () => {
    const agent = await loadBundledAgent(REAL_AGENT);
    const record = await claudeCodeBridge.agents!.install({ agent, projectRoot, ...local });
    const { current, next } = await claudeCodeBridge.agents!.preview(
      { agent, projectRoot, ...local },
      record,
    );
    expect(current).toBe(next);

    await writeFile(join(record.location, record.files[0] ?? ""), "edited\n");
    const after = await claudeCodeBridge.agents!.preview({ agent, projectRoot, ...local }, record);
    expect(after.current).toBe("edited\n");
  });
});

describe("claude-code agent capability report", () => {
  it("accepts every bundled agent: each declares the tools this harness needs", async () => {
    for (const name of await listBundledAgents()) {
      const { warnings, errors } = agentFieldSupport(
        await loadBundledAgent(name),
        claudeCodeBridge,
      );
      expect(errors, `${name}`).toEqual([]);
      expect(warnings, `${name}`).toEqual([]);
    }
  });

  it("errors — writes nothing — when the required tools declaration is absent", () => {
    const agent = parseAgent(AGENT_SRC.replace(/targets:\n {2}claude-code:\n {4}tools: .+\n/, ""));
    const { warnings, errors } = agentFieldSupport(agent, claudeCodeBridge);
    expect(warnings).toEqual([]);
    expect(errors.join("\n")).toMatch(/required field `tools` is expressible but nothing declares/);
    expect(errors.join("\n")).toMatch(/resolves to every tool/);
    expect(errors.join("\n")).toMatch(/targets\.claude-code\.tools/);
  });

  it("errors for a required field the harness cannot express at all", () => {
    const { errors } = agentFieldSupport(parseAgent(AGENT_SRC), claudeCodeBridge, ["worktree"]);
    expect(errors.join("\n")).toMatch(/required field `worktree` has no renderer/);
  });

  it("warns for a field claude-code does not read on an agent, naming it", () => {
    const agent = parseAgent(
      AGENT_SRC.replace("    tools: Read", "    worktree: true\n    tools: Read"),
    );
    const { warnings, errors } = agentFieldSupport(agent, claudeCodeBridge);
    expect(errors).toEqual([]);
    expect(warnings.join("\n")).toMatch(/worktree/);
    expect(warnings.join("\n")).toMatch(/does not read/);
  });

  it("warns for a field declared at the top level, where no renderer forwards it", () => {
    const agent = parseAgent(AGENT_SRC.replace("targets:", "isolation: true\ntargets:"));
    const { warnings } = agentFieldSupport(agent, claudeCodeBridge);
    expect(warnings.join("\n")).toMatch(/`isolation` is declared at the top level/);
    expect(warnings.join("\n")).toMatch(/put it under `targets.claude-code`/);
  });
});

describe("the agent kind through claude-code's classifier", () => {
  it("classifies a destination somebody else wrote as foreign, and shows what it holds", async () => {
    const path = agentPath({ name: REAL_AGENT, ...local, projectRoot });
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, "---\nname: diff-auditor\n---\nnot ours\n");
    const item = await classifyInstall(
      {
        skill: REAL_AGENT,
        kind: "agent",
        agent: "claude-code",
        mode: "auto",
        scope: "local",
        projectPath: projectRoot,
      },
      { version: 1, installs: [] },
      claudeCodeBridge,
    );
    expect(item.status).toBe("foreign");
    expect(item.currentBytes).toContain("not ours");
    expect(item.nextBytes).toContain("You are a specialist at auditing a patch");
  });

  it("repairs a recorded agent whose bytes moved locally as drifted", async () => {
    const agent = await loadBundledAgent(REAL_AGENT);
    const record = await claudeCodeBridge.agents!.install({ agent, projectRoot, ...local });
    await writeFile(join(record.location, record.files[0] ?? ""), "edited locally\n");
    const item = await classifyInstall(
      {
        skill: REAL_AGENT,
        kind: "agent",
        agent: "claude-code",
        mode: "auto",
        scope: "local",
        projectPath: projectRoot,
      },
      { version: 1, installs: [record] },
      claudeCodeBridge,
    );
    expect(item.status).toBe("drifted");
    expect(item.currentBytes).toContain("edited locally");
  });
});
