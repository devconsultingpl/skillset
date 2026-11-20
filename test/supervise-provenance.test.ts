/**
 * supervise-provenance.test.ts — the block `--finalize --provenance <file>` renders.
 *
 * Provenance is a reporting channel, so the failure modes are the contract: an
 * absent value must print `unknown` rather than dropping a line, a count above
 * the cap must print as it arrived, and an unreadable file must still leave an
 * artifact behind. The expected artifacts here are hand-authored — they pin the
 * contract, not a writer; the same posture as the recorded run in
 * `supervise-run`, replaceable the first time a real `--finalize` run exists.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const FIXTURE = join(import.meta.dirname, "fixtures", "supervise-finalize");
const RUN_LINE = /^Run: .+ · workflow: .+ · image: .+$/m;
const CORRECTIONS_LINE = /^Final corrections: .+, accepted at round .+$/m;

interface Case {
  readonly name: string;
  readonly artifact: string;
  readonly runs: string;
  readonly corrections: string;
}

const CASES: readonly Case[] = [
  {
    name: "valid provenance — every fact rendered as handed over",
    artifact: "READY-FOR-REVIEW.md",
    runs: "Run: 2026-11-20_11-29-20-e175 · workflow: deliver · image: 60600cf0a8b3d50f",
    corrections: "Final corrections: 1 round, accepted at round 1",
  },
  {
    name: "missing run_id and rounds above the cap — unknown and 5, printed as-is",
    artifact: "cases/partial/READY-FOR-REVIEW.md",
    runs: "Run: unknown · workflow: deliver · image: 60600cf0a8b3d50f",
    corrections: "Final corrections: 5 rounds, accepted at round 2",
  },
  {
    name: "malformed JSON — every line unknown, artifact still written",
    artifact: "cases/malformed/READY-FOR-REVIEW.md",
    runs: "Run: unknown · workflow: unknown · image: unknown",
    corrections: "Final corrections: unknown, accepted at round unknown",
  },
  {
    name: "accepted_round null — none, not unknown",
    artifact: "cases/blocked/BLOCKED.md",
    runs: "Run: 2026-11-20_11-29-20-e175 · workflow: deliver · image: unknown",
    corrections: "Final corrections: 2 rounds, accepted at round none",
  },
];

async function body(rel: string): Promise<string> {
  return readFile(join(FIXTURE, rel), "utf8");
}

describe("--finalize provenance block", () => {
  for (const tc of CASES) {
    it(tc.name, async () => {
      const artifact = await body(tc.artifact);
      expect(artifact).toMatch(RUN_LINE);
      expect(artifact).toMatch(CORRECTIONS_LINE);
      expect(artifact).toContain(`${tc.runs}\n`);
      expect(artifact).toContain(`${tc.corrections}\n`);
    });
  }

  it("every case prints both lines, and both sit between the title and the first table", async () => {
    for (const tc of CASES) {
      const artifact = await body(tc.artifact);
      const lines = artifact.split("\n");
      const title = lines.findIndex((line) => line.startsWith("# "));
      const run = lines.findIndex((line) => line.startsWith("Run: "));
      const corrections = lines.findIndex((line) => line.startsWith("Final corrections: "));
      const firstTable = lines.findIndex((line) => line.startsWith("| "));
      expect(title, tc.artifact).toBe(0);
      expect(run, tc.artifact).toBeGreaterThan(title);
      expect(corrections, tc.artifact).toBe(run + 1);
      if (firstTable !== -1) {
        expect(firstTable, tc.artifact).toBeGreaterThan(corrections);
      }
    }
  });

  it("never clamps and never decides: five rounds prints verbatim and the artifact is still READY", async () => {
    const partial = await body("cases/partial/READY-FOR-REVIEW.md");
    expect(partial).toContain("Final corrections: 5 rounds");
    expect(partial.startsWith("# READY FOR REVIEW")).toBe(true);
    const blocked = await body("cases/blocked/BLOCKED.md");
    expect(blocked.startsWith("# BLOCKED")).toBe(true);
  });
});

describe("the body names no host", () => {
  it("carries no devbox variable, run directory or audit-file path", async () => {
    const skill = await readFile(
      join(import.meta.dirname, "..", "src", "skills", "supervise", "SKILL.md"),
      "utf8",
    );
    expect(skill).not.toMatch(/devbox/i);
    expect(skill).not.toMatch(/DEVBOX_/);
    expect(skill).not.toMatch(/workflows\/runs/);
    expect(skill).not.toMatch(/\.jsonl/);
  });
});
