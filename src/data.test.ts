import { describe, expect, it } from "vitest";
import { INITIAL_TOOLS, SEED_PROJECTS } from "./data";

describe("LTW Hub catalog", () => {
  it("uses unique tool identifiers", () => {
    const ids = INITIAL_TOOLS.map((tool) => tool.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps project progress within display bounds", () => {
    for (const project of SEED_PROJECTS) {
      expect(project.progress).toBeGreaterThanOrEqual(0);
      expect(project.progress).toBeLessThanOrEqual(100);
    }
  });
});
