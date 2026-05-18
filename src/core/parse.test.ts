import { describe, expect, it } from "vitest";
import { parseSkill } from "./parse.js";

describe("parseSkill", () => {
  it("parses required fields and body", () => {
    const src = `---
name: example
version: "0.1.0"
description: a sample skill
---

# Body

content here.
`;
    const out = parseSkill(src);
    expect(out.frontmatter.name).toBe("example");
    expect(out.frontmatter.version).toBe("0.1.0");
    expect(out.frontmatter.description).toBe("a sample skill");
    expect(out.body.startsWith("# Body")).toBe(true);
  });

  it("preserves config and target overrides", () => {
    const src = `---
name: example
version: "0.1.0"
description: with config
config:
  start: 98
  resume: 95
targets:
  claude-code:
    allowed-tools: [Read, Grep]
---
body`;
    const out = parseSkill(src);
    expect(out.frontmatter.config).toEqual({ start: 98, resume: 95 });
    expect(out.frontmatter.targets?.["claude-code"]).toEqual({
      "allowed-tools": ["Read", "Grep"],
    });
  });

  it("rejects missing required fields", () => {
    expect(() => parseSkill("---\nname: x\n---\nbody")).toThrow(/version/);
  });
});
