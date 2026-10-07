import { describe, expect, it } from "vitest";
import { compose, renderFrontmatter } from "./frontmatter.js";

describe("renderFrontmatter", () => {
  it("renders strings, numbers, booleans, arrays", () => {
    const out = renderFrontmatter({
      name: "confidence",
      description: "drives planning",
      timeout: 30,
      enabled: true,
      "allowed-tools": ["Read", "Grep"],
    });
    expect(out).toContain("name: confidence");
    expect(out).toContain("description: drives planning");
    expect(out).toContain("timeout: 30");
    expect(out).toContain("enabled: true");
    expect(out).toContain("allowed-tools: [Read, Grep]");
    expect(out.startsWith("---\n")).toBe(true);
    expect(out.endsWith("---\n")).toBe(true);
  });

  it("skips null/undefined", () => {
    const out = renderFrontmatter({ name: "x", missing: null, also: undefined });
    expect(out).toContain("name: x");
    expect(out).not.toContain("missing");
    expect(out).not.toContain("also");
  });

  it("quotes strings containing special YAML chars", () => {
    const out = renderFrontmatter({ note: "with: colon" });
    expect(out).toContain('note: "with: colon"');
  });

  it("renders a nested mapping, with the arrays and scalars inside it", () => {
    const out = renderFrontmatter({
      name: "code-review",
      contract: {
        produces: {
          kind: "produces",
          data: { type: "object", required: ["blockers_count"] },
        },
      },
    });

    expect(out).toBe(
      [
        "---",
        "name: code-review",
        "contract:",
        "  produces:",
        "    kind: produces",
        "    data:",
        "      type: object",
        "      required: [blockers_count]",
        "---",
        "",
      ].join("\n"),
    );
  });

  it("renders an empty mapping as {}, not as null", () => {
    expect(renderFrontmatter({ contract: {} })).toContain("contract: {}");
  });

  it("refuses an array of mappings rather than guessing at YAML", () => {
    expect(() => renderFrontmatter({ bad: [{ a: 1 }] })).toThrow(
      /unsupported value type for frontmatter key bad/,
    );
  });
});

describe("compose", () => {
  it("joins frontmatter and body with a blank line", () => {
    const out = compose({ name: "x" }, "body line\n");
    expect(out).toBe("---\nname: x\n---\n\nbody line\n");
  });
});
