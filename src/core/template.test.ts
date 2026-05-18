import { describe, expect, it } from "vitest";
import { applyConfig } from "./template.js";

describe("applyConfig", () => {
  it("substitutes known keys", () => {
    expect(applyConfig("a={{a}} b={{b}}", { a: 1, b: "x" })).toBe("a=1 b=x");
  });
  it("leaves unknown placeholders intact", () => {
    expect(applyConfig("{{x}} {{y}}", { x: 1 })).toBe("1 {{y}}");
  });
  it("noop without config", () => {
    expect(applyConfig("{{x}}")).toBe("{{x}}");
  });
});
