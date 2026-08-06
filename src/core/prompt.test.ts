import { describe, expect, it } from "vitest";
import { askChoice, type Asker } from "./prompt.js";

const makeAsker = (answers: string[]): Asker => {
  let i = 0;
  return async () => answers[Math.min(i++, answers.length - 1)] ?? "";
};

describe("askChoice", () => {
  const options = [
    { key: "a", label: "every app + root" },
    { key: "r", label: "root only" },
    { key: "o", label: "apps only" },
  ];

  it("returns the default on empty input", async () => {
    expect(await askChoice(makeAsker([""]), "Q?", options, "a")).toBe("a");
  });

  it("returns the chosen key", async () => {
    expect(await askChoice(makeAsker(["r"]), "Q?", options, "a")).toBe("r");
  });

  it("case-insensitive match", async () => {
    expect(await askChoice(makeAsker(["O"]), "Q?", options, "a")).toBe("o");
  });

  it("re-prompts on unrecognized input", async () => {
    expect(await askChoice(makeAsker(["x", "r"]), "Q?", options, "a")).toBe("r");
  });
});
