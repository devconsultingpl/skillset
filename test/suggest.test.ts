import { realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Sandbox, exists, makeSandbox, run } from "./helpers.js";

let sb: Sandbox;

beforeEach(async () => {
  sb = await makeSandbox("skillset-suggest");
});

afterEach(async () => {
  await sb.cleanup();
});

const queue = () => join(sb.home, ".skillset", "suggestions.jsonl");

const entries = async () =>
  (await readFile(queue(), "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));

describe("suggest", () => {
  it("creates the queue and records the message with the invoking project", async () => {
    const out = run(["suggest", "the review needs a fixture"], sb.projectRoot, sb.env);
    expect(out.status).toBe(0);

    const written = await entries();
    expect(written).toHaveLength(1);
    const [entry] = written;
    expect(entry.suggestion).toBe("the review needs a fixture");
    expect(entry.cwd).toBe(realpathSync(sb.projectRoot));
    expect(entry.at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(entry).not.toHaveProperty("session");
  });

  it("appends rather than rewrites, and joins unquoted words", async () => {
    run(["suggest", "first"], sb.projectRoot, sb.env);
    expect(run(["suggest", "second", "one"], sb.projectRoot, sb.env).status).toBe(0);

    const written = await entries();
    expect(written.map((e) => e.suggestion)).toEqual(["first", "second one"]);
  });

  it("records the session key when the environment carries one", async () => {
    const out = run(["suggest", "with a session"], sb.projectRoot, {
      ...sb.env,
      CLAUDE_CODE_SESSION_ID: "sess-123",
    });
    expect(out.status).toBe(0);
    const [entry] = await entries();
    expect(entry.session).toBe("sess-123");
  });

  it("refuses a whitespace-only message and writes nothing", async () => {
    const out = run(["suggest", "   "], sb.projectRoot, sb.env);
    expect(out.status).toBe(1);
    expect(out.stderr).toMatch(/suggest: nothing to record/);
    expect(await exists(queue())).toBe(false);
  });
});
