import { describe, it, expect } from "vitest";
import { detectPackageManager } from "./detect";

describe("detectPackageManager", () => {
  it("returns npm for this repository", () => {
    const pm = detectPackageManager();
    expect(pm).toBe("npm");
  });
});

