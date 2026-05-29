// skillset opencode plugin — records which slash command is active (per project)
// so `/skillset-status` can report it. `command.execute.before` fires per slash
// invocation with the command name + arguments, which is more reliable than
// parsing prompt text. Writes are project-scoped (no session id is exposed to a
// command's shell block, so reader and writer agree on the project key).
//
// Installed and removed by `skillset`; local edits may be overwritten on
// `skillset update`.
export const SkillsetPlugin = async ({ $ }) => ({
  "command.execute.before": async (input) => {
    const name = input && input.command;
    if (!name || name === "skillset-status") return;
    const state = String((input && input.arguments) || "").trim().split(/\s+/)[0] || "on";
    await $`skillset track ${name} ${state} --known-only`.quiet().nothrow();
  },
  // Clear the (project-scoped) active set when a session is compacted — the
  // summarized context no longer carries the skill bodies.
  event: async ({ event }) => {
    if (event && event.type === "session.compacted") {
      await $`skillset reset`.quiet().nothrow();
    }
  },
});
