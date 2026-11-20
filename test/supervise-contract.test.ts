/**
 * supervise-contract.test.ts — polices the artifacts the `supervise` body
 * promises, over a recorded 2-task run.
 *
 * The loop is an instruction body, so nothing here executes it. What a test can
 * hold still is the contract an enforcer downstream reads: the task-file schema,
 * one verdict per review round under flow's naming, exactly one terminal
 * artifact, and a verdict whose `status`/`blockers_count` are byte-identical to
 * `code-review`'s declared contract — because the same collector reads both.
 */
import { readFile, readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadBundledAgent, loadBundledSkill } from "../src/core/bundle.js";

const FIXTURE = join(import.meta.dirname, "fixtures", "supervise-run");
const TASKS_DIR = join(FIXTURE, ".flow", "tasks");
const VERDICTS_DIR = join(FIXTURE, ".flow", "artifacts", "verdicts");
const TERMINAL = ["READY-FOR-REVIEW.md", "BLOCKED.md"] as const;

interface TaskFile {
  id: string;
  title: string;
  write_set: string[];
  criteria: string[];
  deps: string[];
  state: string;
  rounds: number;
}

interface Verdict {
  task: string;
  status: string;
  blockers_count: number;
  feedback: string;
  rounds: number;
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function tasks(): Promise<TaskFile[]> {
  const names = (await readdir(TASKS_DIR)).filter((n) => n.endsWith(".json")).sort();
  return Promise.all(names.map((n) => readJson<TaskFile>(join(TASKS_DIR, n))));
}

async function verdicts(): Promise<Array<{ name: string; verdict: Verdict }>> {
  const names = (await readdir(VERDICTS_DIR)).filter((n) => n.endsWith(".json")).sort();
  return Promise.all(
    names.map(async (name) => ({
      name,
      verdict: await readJson<Verdict>(join(VERDICTS_DIR, name)),
    })),
  );
}

describe("the supervise artifact contract", () => {
  it("writes one task file per task, in the schema the body declares", async () => {
    const files = await tasks();
    expect(files.map((t) => t.id)).toEqual(["task-1", "task-2"]);
    for (const task of files) {
      expect(Object.keys(task).sort(), task.id).toEqual([
        "criteria",
        "deps",
        "id",
        "rounds",
        "state",
        "title",
        "write_set",
      ]);
      expect(["pending", "in-progress", "done", "blocked"], task.id).toContain(task.state);
      expect(Number.isInteger(task.rounds), task.id).toBe(true);
      expect(task.write_set.length, task.id).toBeGreaterThan(0);
      expect(task.criteria.length, task.id).toBeGreaterThan(0);
    }
    expect(files.length).toBeLessThanOrEqual(32);
  });

  it("writes one verdict per review round, named <basename>__<task>__<round>.json", async () => {
    const files = await tasks();
    const written = await verdicts();
    const roundsSpent = files.reduce((sum, task) => sum + task.rounds, 0);
    expect(written).toHaveLength(roundsSpent);
    for (const { name, verdict } of written) {
      expect(name, "flow's collector splits on __ into basename, dimension, slug").toMatch(
        /^[^_/]+__task-\d+__\d+\.json$/,
      );
      const [, , round] = basename(name, ".json").split("__");
      expect(Number(round), name).toBe(verdict.rounds);
    }
  });

  it("keeps verdict status and blockers_count byte-identical to code-review's contract", async () => {
    const review = await loadBundledSkill("code-review");
    const declared = (
      review.frontmatter as unknown as {
        targets: {
          pi: { contract: { produces: { data: { properties: Record<string, unknown> } } } };
        };
      }
    ).targets.pi.contract.produces.data.properties;
    const written = await verdicts();
    expect(written.length).toBeGreaterThan(0);
    for (const { name, verdict } of written) {
      for (const key of ["status", "blockers_count"]) {
        expect(Object.keys(declared), `${name} declares ${key}`).toContain(key);
        expect(Object.keys(verdict), name).toContain(key);
      }
      expect(Number.isInteger(verdict.blockers_count), name).toBe(true);
      expect(verdict.blockers_count, name).toBeGreaterThanOrEqual(0);
      for (const blocker of verdict.feedback.split("\n").filter(Boolean)) {
        expect(blocker, `${name} carries file:line`).toMatch(/[\w./-]+:\d+/);
      }
    }
  });

  it("leaves exactly one terminal artifact, never both and never neither", async () => {
    const present = await Promise.all(
      TERMINAL.map(async (name) => {
        try {
          await readFile(join(FIXTURE, name), "utf8");
          return name;
        } catch {
          return null;
        }
      }),
    );
    expect(present.filter(Boolean)).toHaveLength(1);
  });

  it("does not abort the run when a task exhausts its rounds", async () => {
    const files = await tasks();
    const blocked = files.filter((task) => task.state === "blocked");
    expect(blocked.map((task) => task.id)).toEqual(["task-2"]);
    expect(blocked[0]?.rounds).toBe(2);
    expect(files.filter((task) => task.state === "done").map((task) => task.id)).toEqual([
      "task-1",
    ]);
    const last = (await verdicts()).find((v) => v.name.includes("task-2__2"));
    expect(last?.verdict.blockers_count).toBeGreaterThan(0);
  });
});

describe("the review lenses the body dispatches", () => {
  const declaredProperties = (skill: Awaited<ReturnType<typeof loadBundledSkill>>) =>
    (
      skill.frontmatter as unknown as {
        targets?: {
          pi?: {
            contract?: { produces?: { data?: { required?: string[]; properties?: object } } };
          };
        };
      }
    ).targets?.pi?.contract?.produces?.data;

  it("every lens named in the body's step 4 declares code-review's contract keys", async () => {
    const body = await readFile(
      join(import.meta.dirname, "..", "src", "skills", "supervise", "SKILL.md"),
      "utf8",
    );
    const step4 = body.split("**4. Run-scope review")[1]?.split("**5. Report")[0] ?? "";
    const named = [...step4.matchAll(/`(code-review|appsec-review|declutter|convention)`/g)].map(
      (m) => m[1],
    );
    expect([...new Set(named)].sort()).toEqual([
      "appsec-review",
      "code-review",
      "convention",
      "declutter",
    ]);

    const reference = declaredProperties(await loadBundledSkill("code-review"));
    expect(Object.keys(reference?.properties ?? {}).sort()).toEqual(["blockers_count", "status"]);

    for (const lens of new Set(named)) {
      const data = declaredProperties(await loadBundledSkill(lens));
      expect(data, `${lens} declares a review contract`).toBeDefined();
      expect(Object.keys(data?.properties ?? {}).sort(), lens).toEqual(
        Object.keys(reference?.properties ?? {}).sort(),
      );
      expect(data?.required, lens).toEqual(reference?.required);
    }
  });

  it("caps declutter's blockers at zero, so bloat can never fail a run", async () => {
    const data = declaredProperties(await loadBundledSkill("declutter")) as {
      properties: { blockers_count: { maximum?: number } };
    };
    expect(data.properties.blockers_count.maximum).toBe(0);
  });
});

describe("the supervise dispatch prompt", () => {
  it("passes paths through four slots and no fifth", async () => {
    const body = await readFile(
      join(import.meta.dirname, "..", "src", "skills", "supervise", "SKILL.md"),
      "utf8",
    );
    const block = body.match(/```text\n([\s\S]*?)```/g)?.find((b) => b.includes("dispatch-prompt"));
    expect(block, "the body carries a fenced dispatch prompt").toBeDefined();
    const slots = [...(block ?? "").matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();
    expect(slots).toEqual(["artifacts", "criteria", "task", "write_set"]);
  });
});

describe("the supervise word budgets", () => {
  const words = (text: string): number => text.split(/\s+/).filter(Boolean).length;

  it("keeps the body under 1050 words, every agent under 300, every agent description under 15", async () => {
    const body = await readFile(
      join(import.meta.dirname, "..", "src", "skills", "supervise", "SKILL.md"),
      "utf8",
    );
    expect(words(body.replace(/^---[\s\S]*?\n---\n/, ""))).toBeLessThanOrEqual(1050);
    for (const name of ["task-planner", "task-builder", "task-reviewer", "doc-updater"]) {
      const agent = await loadBundledAgent(name);
      const raw = await readFile(
        join(import.meta.dirname, "..", "src", "agents", `${name}.md`),
        "utf8",
      );
      expect(words(raw.replace(/^---[\s\S]*?\n---\n/, "")), name).toBeLessThanOrEqual(300);
      expect(words(agent.frontmatter.description ?? ""), name).toBeLessThanOrEqual(15);
    }
  });
});
