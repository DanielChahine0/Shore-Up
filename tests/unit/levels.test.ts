import { describe, expect, it } from "vitest";
import { cleanupsToNextLevel, levelFor } from "@/lib/achievements/config";

describe("levels", () => {
  it("follows the cleanup thresholds", () => {
    expect(levelFor(0).name).toBe("Newcomer");
    expect(levelFor(1).name).toBe("Beachcomber");
    expect(levelFor(4).name).toBe("Beachcomber");
    expect(levelFor(5).name).toBe("Steward");
    expect(levelFor(14).name).toBe("Steward");
    expect(levelFor(15).name).toBe("Guardian");
  });

  it("says how far the next level is", () => {
    expect(cleanupsToNextLevel(0)).toEqual({ name: "Beachcomber", remaining: 1 });
    expect(cleanupsToNextLevel(7)).toEqual({ name: "Guardian", remaining: 8 });
    expect(cleanupsToNextLevel(20)).toBeNull();
  });
});
