import type { AgentTarget } from "../core/target.js";
import type { AgentName } from "../core/types.js";
import { claudeCodeTarget } from "./claude-code.js";
import { copilotTarget } from "./copilot.js";
import { opencodeTarget } from "./opencode.js";
import { piTarget } from "./pi.js";

const TARGETS: Record<AgentName, AgentTarget> = {
  "claude-code": claudeCodeTarget,
  pi: piTarget,
  opencode: opencodeTarget,
  copilot: copilotTarget,
};

export function targetFor(agent: AgentName): AgentTarget {
  return TARGETS[agent];
}

export { claudeCodeTarget, copilotTarget, opencodeTarget, piTarget };
