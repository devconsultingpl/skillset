// skillset pi extension — tracks slash-skill toggles per session and shows the
// active set in the footer. The `input` event exposes the raw typed text before
// template expansion, so `/sk-builder off` is detectable; the session id comes from
// `ctx.sessionManager.getSessionId()`.
//
// Also registers `/sk-start <skill> [skill...]` — a one-keystroke session-start
// ritual: activates the named skills (tracked on) and injects their bodies as a
// single user message, because pi expands only the *first* `/command` per submit.
//
// Re-checked against pi 0.84.2: `pi.sendUserMessage(..., { expandPromptTemplates: true })`
// still expands only the leading command (`_expandSkillCommand` handles a single
// `/skill:`; `expandPromptTemplate` matches one leading `/template`). Splitting into
// N single-command messages would cost N model turns, and each expanded template
// re-introduces its own ingest line — so emit-and-inject in one message stays.
// Accepts skill names (`ponytail`) or `/sk-*` slugs (`sk-ponytail`); bodies come
// from `skillset emit`, so installed-but-unbundled skills are reported as missing.
//
// Installed and removed by `skillset`; local edits may be overwritten on
// `skillset update`.
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const TOGGLE = /^\/([a-z][a-z0-9-]*)\s*(on|off)?\s*$/i;

/** The ingest rule shipped in posture skill bodies. `/sk-start` strips it from
 * each body and sends it once — but only when at least one injected skill
 * carried it (posture skills), so task-skill sets stay lean. */
const INGEST_LINE =
  "> **Ingest signal:** pasted skill body = activation. Acknowledge in one line. No tool calls, no restatement, no analysis.";

/** Drop the ingest line (any wording under the same marker) from a body and
 * report whether one was found. */
function stripIngest(body: string): { body: string; had: boolean } {
  const kept: string[] = [];
  let had = false;
  for (const l of body.split("\n")) {
    if (/^>\s*\*{0,2}ingest signal:\*{0,2}/i.test(l.trim())) had = true;
    else kept.push(l);
  }
  return { body: kept.join("\n").trim(), had };
}

/** Normalize a user-typed token to a bare slug/name: strip a leading `/`. */
function bareSkill(token: string): string {
  return token.startsWith("/") ? token.slice(1) : token;
}

/** Fetch a skill's rendered body via `skillset emit`. Accepts the skill name
 * (emit's input) or the `sk-` slug. Returns null when unknown. */
async function emitBody(pi: ExtensionAPI, token: string): Promise<string | null> {
  const candidates = new Set([token, token.replace(/^sk-/, "")]);
  for (const name of candidates) {
    const res = await pi.exec("skillset", ["emit", name]).catch(() => null);
    if (!res) continue;
    try {
      const parsed = JSON.parse(res.stdout.trim()) as { additionalContext?: unknown };
      if (typeof parsed.additionalContext === "string" && parsed.additionalContext.trim()) {
        return parsed.additionalContext.trim();
      }
    } catch {
      // not JSON we understand — fall through to the next candidate
    }
  }
  return null;
}

export default function (pi: ExtensionAPI) {
  // biome-ignore lint: pi's context type is provided at runtime, not at our build.
  const sessionId = (ctx: any): string => ctx?.sessionManager?.getSessionId?.() ?? "";

  // biome-ignore lint: see above.
  const refresh = async (ctx: any): Promise<void> => {
    const res = await pi.exec("skillset", ["status", "--session", sessionId(ctx)]).catch(() => null);
    const line = ((res && res.stdout) || "").trim();
    ctx.ui.setStatus("skillset", line && !line.includes("(none)") ? line : undefined);
  };

  // biome-ignore lint: see above.
  const reset = async (ctx: any): Promise<void> => {
    await pi.exec("skillset", ["reset", "--session", sessionId(ctx)]).catch(() => {});
  };

  pi.registerCommand("sk-start", {
    description:
      "Activate skills for this session: inject their bodies in one message — e.g. /sk-start ponytail builder caveman",
    // biome-ignore lint: see above.
    handler: async (args: string, ctx: any) => {
      const names = (args || "").trim().split(/\s+/).filter(Boolean);
      if (names.length === 0) {
        await ctx.ui.notify("usage: /sk-start <skill> [skill...] — e.g. /sk-start ponytail builder", "info");
        return;
      }
      const bodies: string[] = [];
      const missing: string[] = [];
      let ingest = false;
      for (const token of names) {
        const slug = bareSkill(token);
        await pi
          .exec("skillset", ["track", slug, "on", "--session", sessionId(ctx), "--known-only"])
          .catch(() => {});
        const body = await emitBody(pi, slug);
        if (body) {
          const stripped = stripIngest(body);
          if (stripped.had) ingest = true;
          bodies.push(stripped.body);
        } else missing.push(slug);
      }
      if (bodies.length > 0) {
        const parts = ingest ? [INGEST_LINE, ...bodies] : bodies;
        await pi.sendUserMessage(parts.join("\n\n"));
      }
      if (missing.length > 0) {
        await ctx.ui.notify(`not installed: ${missing.join(", ")}`, "info");
      }
      await refresh(ctx);
    },
  });

  // biome-ignore lint: see above.
  pi.on("session_start", async (_event: any, ctx: any) => {
    await refresh(ctx);
  });

  // Context summarized → the skill bodies are gone; clear the active set + footer.
  // (No reset on session_shutdown: /reload, /resume, and /fork keep the transcript,
  // so the bodies — and the tracked set — stay valid. New sessions get a fresh id.)
  // biome-ignore lint: see above.
  pi.on("session_compact", async (_event: any, ctx: any) => {
    await reset(ctx);
    await refresh(ctx);
  });

  // biome-ignore lint: see above.
  pi.on("input", async (event: any, ctx: any) => {
    if (event && event.source === "interactive") {
      const m = TOGGLE.exec(String((event && event.text) || "").trim());
      if (m && m[1] !== "sk-status") {
        const state = (m[2] || "on").toLowerCase();
        await pi
          .exec("skillset", ["track", m[1], state, "--session", sessionId(ctx), "--known-only"])
          .catch(() => {});
      }
    }
    await refresh(ctx);
  });
}
