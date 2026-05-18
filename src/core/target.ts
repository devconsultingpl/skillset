import type { InstallRecord, Mode, ParsedSkill, Scope } from "./types.js";

export interface InstallContext {
  skill: ParsedSkill;
  scope: Scope;
  mode: Mode;
  projectRoot: string;
}

/**
 * Each agent implements this. `install` writes files and modifies anchor files
 * (with markers) to wire the chosen mode. `uninstall` removes only what was
 * recorded — never touches surrounding user content.
 */
export interface AgentTarget {
  readonly name: InstallRecord["agent"];
  /** Modes this agent supports. Installer rejects unsupported requests. */
  readonly supportedModes: readonly Mode[];
  install(ctx: InstallContext): Promise<InstallRecord>;
  uninstall(record: InstallRecord): Promise<void>;
}
