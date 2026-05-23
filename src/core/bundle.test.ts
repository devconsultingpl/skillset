import { describe, expect, it } from "vitest";
import { listBundledSkills, loadBundledSkill } from "./bundle.js";

describe("bundled skills", () => {
  it("includes the known skills", async () => {
    const names = await listBundledSkills();
    expect(names).toContain("builder");
    expect(names).toContain("confidence");
    expect(names).toContain("convention");
  });

  // Generic validity gate — covers every bundled skill, current and future.
  // loadBundledSkill throws on missing required frontmatter; we add body + value checks.
  it("every bundled skill parses with required frontmatter and a non-empty body", async () => {
    for (const name of await listBundledSkills()) {
      const { frontmatter, body } = await loadBundledSkill(name);
      expect(frontmatter.name.length).toBeGreaterThan(0);
      expect(frontmatter.version.length).toBeGreaterThan(0);
      expect(frontmatter.description.length).toBeGreaterThan(0);
      expect(body.trim().length).toBeGreaterThan(0);
    }
  });
});
