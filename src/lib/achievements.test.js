import { describe, it, expect } from "vitest";
import { currentStreak, computeAchievements } from "./achievements";

describe("currentStreak", () => {
  const today = new Date("2026-06-16T12:00:00Z");
  it("is 0 with no days", () => {
    expect(currentStreak([], today)).toBe(0);
  });
  it("counts consecutive days ending today", () => {
    expect(currentStreak(["2026-06-14", "2026-06-15", "2026-06-16"], today)).toBe(3);
  });
  it("still counts if opened yesterday but not yet today", () => {
    expect(currentStreak(["2026-06-14", "2026-06-15"], today)).toBe(2);
  });
  it("breaks when a day is missed", () => {
    expect(currentStreak(["2026-06-10", "2026-06-11"], today)).toBe(0);
  });
});

describe("computeAchievements", () => {
  it("returns one entry per achievement with an earned flag", () => {
    const all = computeAchievements({});
    expect(all.length).toBeGreaterThanOrEqual(10);
    expect(all.every(a => typeof a.earned === "boolean")).toBe(true);
  });
  it("earns the right badges from a snapshot", () => {
    const a = computeAchievements({ transactions: 5, streak: 8, savingsRate: 45, netWorth: 12000, healthScore: 80 });
    const got = id => a.find(x => x.id === id).earned;
    expect(got("first_log")).toBe(true);
    expect(got("streak7")).toBe(true);
    expect(got("supersaver")).toBe(true);
    expect(got("nw10k")).toBe(true);
    expect(got("healthy")).toBe(true);
    expect(got("cushion")).toBe(false);
  });
});
