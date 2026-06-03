// skillset pi extension — tracks slash-skill toggles per session and shows the
// active set in the footer. The `input` event exposes the raw typed text before
// template expansion, so `/sk-builder off` is detectable; the session id comes from
// `ctx.sessionManager.getSessionId()`.
//
// Installed and removed by `skillset`; local edits may be overwritten on
// `skillset update`.
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const TOGGLE = /^\/([a-z][a-z0-9-]*)\s*(on|off)?\s*$/i;

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

  // biome-ignore lint: see above.
  pi.on("session_start", async (_event: any, ctx: any) => {
    await refresh(ctx);
  });

  // Context summarized → the skill bodies are gone; clear the active set + footer.
  // biome-ignore lint: see above.
  pi.on("session_compact", async (_event: any, ctx: any) => {
    await reset(ctx);
    await refresh(ctx);
  });

  // Session ending (/new, /resume, /fork, exit) → purge its active set.
  // biome-ignore lint: see above.
  pi.on("session_shutdown", async (_event: any, ctx: any) => {
    await reset(ctx);
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
