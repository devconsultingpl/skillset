import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Sandbox, makeSandbox, run } from "./helpers.js";

let sb: Sandbox;

beforeEach(async () => {
  sb = await makeSandbox("skillset-track");
});

afterEach(async () => {
  await sb.cleanup();
});

describe("cli — track / status", () => {
  it("reports no active skills before anything is tracked", () => {
    const out = run(["status"], sb.projectRoot, sb.env);
    expect(out.status).toBe(0);
    expect(out.stdout.trim()).toBe("skills: (none)");
  });

  it("tracks a skill on (default) and lists it via the project-scoped key", () => {
    expect(run(["track", "builder"], sb.projectRoot, sb.env).status).toBe(0);
    const out = run(["status"], sb.projectRoot, sb.env);
    expect(out.stdout.trim()).toBe("skills: builder");
  });

  it("turns a skill off again", () => {
    run(["track", "builder", "on"], sb.projectRoot, sb.env);
    run(["track", "caveman", "on"], sb.projectRoot, sb.env);
    run(["track", "builder", "off"], sb.projectRoot, sb.env);
    const out = run(["status"], sb.projectRoot, sb.env);
    expect(out.stdout.trim()).toBe("skills: caveman");
  });

  it("sorts the active set for stable output", () => {
    run(["track", "caveman", "on"], sb.projectRoot, sb.env);
    run(["track", "architect", "on"], sb.projectRoot, sb.env);
    const out = run(["status"], sb.projectRoot, sb.env);
    expect(out.stdout.trim()).toBe("skills: architect caveman");
  });

  it("honors CLAUDE_CODE_SESSION_ID as a fallback when no --session is given", () => {
    const envWithId = { ...sb.env, CLAUDE_CODE_SESSION_ID: "env-sess" };
    run(["track", "builder", "on"], sb.projectRoot, envWithId);
    // Read it back via the explicit session id matching the env var.
    expect(run(["status", "--session", "env-sess"], sb.projectRoot, sb.env).stdout.trim()).toBe(
      "skills: builder",
    );
    // And via the env fallback itself (no --session passed).
    expect(run(["status"], sb.projectRoot, envWithId).stdout.trim()).toBe("skills: builder");
  });

  it("keeps explicit --session ids independent", () => {
    run(["track", "builder", "on", "--session", "one"], sb.projectRoot, sb.env);
    run(["track", "caveman", "on", "--session", "two"], sb.projectRoot, sb.env);
    expect(run(["status", "--session", "one"], sb.projectRoot, sb.env).stdout.trim()).toBe(
      "skills: builder",
    );
    expect(run(["status", "--session", "two"], sb.projectRoot, sb.env).stdout.trim()).toBe(
      "skills: caveman",
    );
  });

  it("--known-only no-ops for a skill skillset hasn't installed", () => {
    run(["track", "builder", "on", "--known-only", "--session", "k"], sb.projectRoot, sb.env);
    // builder isn't installed in this sandbox → filtered out.
    expect(run(["status", "--session", "k"], sb.projectRoot, sb.env).stdout.trim()).toBe(
      "skills: (none)",
    );

    // Install builder, then the same track records it.
    run(
      ["install", "builder", "--agent", "claude-code", "--mode", "slash", "--local"],
      sb.projectRoot,
      sb.env,
    );
    run(["track", "builder", "on", "--known-only", "--session", "k"], sb.projectRoot, sb.env);
    expect(run(["status", "--session", "k"], sb.projectRoot, sb.env).stdout.trim()).toBe(
      "skills: builder",
    );
  });

  it("scan-prompt records installed /skills from a Copilot prompt payload, ignoring unknown", () => {
    run(
      ["install", "builder", "--agent", "claude-code", "--mode", "slash", "--local"],
      sb.projectRoot,
      sb.env,
    );
    const payload = JSON.stringify({
      sessionId: "CP",
      prompt: "use the /builder skill and /not-a-skill too",
    });
    run(["scan-prompt"], sb.projectRoot, sb.env, { input: payload });
    expect(run(["status", "--session", "CP"], sb.projectRoot, sb.env).stdout.trim()).toBe(
      "skills: builder",
    );
  });

  it("reset clears the whole active set for a session", () => {
    run(["track", "builder", "on", "--session", "R"], sb.projectRoot, sb.env);
    run(["track", "caveman", "on", "--session", "R"], sb.projectRoot, sb.env);
    expect(run(["status", "--session", "R"], sb.projectRoot, sb.env).stdout.trim()).toBe(
      "skills: builder caveman",
    );
    run(["reset", "--session", "R"], sb.projectRoot, sb.env);
    expect(run(["status", "--session", "R"], sb.projectRoot, sb.env).stdout.trim()).toBe(
      "skills: (none)",
    );
  });

  it("reset --stdin-json accepts both session_id (Claude) and sessionId (Copilot)", () => {
    run(["track", "builder", "on", "--session", "S1"], sb.projectRoot, sb.env);
    run(["reset", "--stdin-json"], sb.projectRoot, sb.env, {
      input: JSON.stringify({ session_id: "S1" }),
    });
    expect(run(["status", "--session", "S1"], sb.projectRoot, sb.env).stdout.trim()).toBe(
      "skills: (none)",
    );

    run(["track", "builder", "on", "--session", "S2"], sb.projectRoot, sb.env);
    run(["reset", "--stdin-json"], sb.projectRoot, sb.env, {
      input: JSON.stringify({ sessionId: "S2" }),
    });
    expect(run(["status", "--session", "S2"], sb.projectRoot, sb.env).stdout.trim()).toBe(
      "skills: (none)",
    );
  });

  it("reads session_id from a JSON statusline payload on stdin", () => {
    run(["track", "builder", "on", "--session", "sess-xyz"], sb.projectRoot, sb.env);
    const out = run(["status", "--stdin-json"], sb.projectRoot, {
      ...sb.env,
    });
    // No stdin provided here → falls back to project key, which is empty.
    expect(out.stdout.trim()).toBe("skills: (none)");

    const piped = run(["status", "--stdin-json"], sb.projectRoot, sb.env, {
      input: JSON.stringify({ session_id: "sess-xyz" }),
    });
    expect(piped.stdout.trim()).toBe("skills: builder");
  });
});
