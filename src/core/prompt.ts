import { createInterface } from "node:readline";

export type Decision = "skip" | "overwrite" | "abort";

/** A function that poses a question and resolves with the raw typed line. */
export type Asker = (question: string) => Promise<string>;

/** True only when both stdin and stdout are TTYs — i.e. a human can answer. */
export function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

/** Readline-backed asker for real interactive runs. */
export const readlineAsker: Asker = (question) =>
  new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });

const PROMPT = "  [s]kip  [o]verwrite  [d]iff  [a]bort  (default: s): ";

/** A single-choice question's options. */
export interface ChoiceOption {
  key: string;
  label: string;
}

/** Pose a single-choice question. Empty input → `defaultKey`; unrecognized
 * input re-prompts. Injectable asker keeps the loop unit-testable. */
export async function askChoice(
  ask: Asker,
  question: string,
  options: ChoiceOption[],
  defaultKey: string,
): Promise<string> {
  const prompt = `${question} [${options.map((o) => o.key).join("/")}] (default: ${defaultKey}): `;
  for (;;) {
    const ans = (await ask(prompt)).trim().toLowerCase();
    if (ans === "") return defaultKey;
    const hit = options.find((o) => o.key === ans);
    if (hit) return hit.key;
  }
}

/**
 * Drive the per-install divergence prompt: skip / overwrite / diff / abort.
 * `d` calls `onDiff` and re-prompts; empty input defaults to skip; anything
 * unrecognized re-prompts. `ask` is injectable so callers can test the loop.
 */
export async function resolveDivergence(ask: Asker, onDiff: () => void): Promise<Decision> {
  for (;;) {
    const ans = (await ask(PROMPT)).trim().toLowerCase();
    if (ans === "" || ans === "s" || ans === "skip") return "skip";
    if (ans === "o" || ans === "overwrite") return "overwrite";
    if (ans === "a" || ans === "abort") return "abort";
    if (ans === "d" || ans === "diff") onDiff();
    // Anything else: re-prompt.
  }
}
