import type { Bridge, BridgeLookup } from "../core/bridge.js";
import type { BridgeName } from "../core/types.js";
import { claudeCodeBridge } from "./claude-code/index.js";
import { copilotBridge } from "./copilot/index.js";
import { opencodeBridge } from "./opencode/index.js";
import { piBridge } from "./pi/index.js";

/**
 * The registry — the one place in this repository that names a harness.
 *
 * Everything else reaches a harness through the `Bridge` contract: the core
 * never imports this file (slice 2e), and it is the composition root — the CLI
 * and the commands — that resolves a name here and passes the bridge down.
 *
 * Adding a harness means adding its module under `src/bridges/<name>/` and one
 * line below. Nothing else in this repository needs to know it exists.
 */
const BRIDGES: readonly Bridge[] = [claudeCodeBridge, piBridge, opencodeBridge, copilotBridge];

/** Harness names, in the order the CLI lists them. */
export const BRIDGE_NAMES: readonly BridgeName[] = BRIDGES.map((bridge) => bridge.name);

/** Resolve a bridge, or undefined when the name is unknown. */
export const bridgeFor: BridgeLookup = (name) => BRIDGES.find((bridge) => bridge.name === name);

/** The session id any bridge can hand us through the environment, if one can.
 * First match wins; the core never names the variable. */
export function envSessionKey(): string | undefined {
  for (const bridge of BRIDGES) {
    const key = bridge.sessionKeyFromEnv?.();
    if (key) return key;
  }
  return undefined;
}

/** Resolve a bridge, or fail with the list of what does exist. */
export function requireBridge(name: BridgeName): Bridge {
  const bridge = bridgeFor(name);
  if (!bridge) {
    throw new Error(`unknown harness: ${name} (known: ${BRIDGE_NAMES.join(", ")})`);
  }
  return bridge;
}

export { claudeCodeBridge, copilotBridge, opencodeBridge, piBridge };
