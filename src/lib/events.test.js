import { describe, it, expect } from "vitest";
import { detectEvents, eventToSnap } from "./events";

const keys = evs => evs.map(e => e.key);

describe("detectEvents", () => {
  it("returns nothing for an empty profile", () => {
    expect(detectEvents({})).toEqual([]);
  });

  it("celebrates the highest net-worth milestone crossed", () => {
    const evs = detectEvents({ netWorth: 120000 });
    expect(keys(evs)).toContain("nw-milestone-100000");
    expect(keys(evs)).not.toContain("nw-milestone-50000");
  });

  it("does not fire a milestone below the first threshold", () => {
    expect(keys(detectEvents({ netWorth: 500 }))).not.toContain("nw-milestone-1000");
  });

  it("detects a monthly climb of at least 2%", () => {
    const evs = detectEvents({ nwHistory: [{ date: "2026-05-01", value: 10000 }, { date: "2026-06-01", value: 11000 }] });
    const up = evs.find(e => e.type === "progress" && e.key.startsWith("nw-up"));
    expect(up).toBeTruthy();
    expect(up.big).toBe("+10%");
  });

  it("ignores a flat or falling month", () => {
    const evs = detectEvents({ nwHistory: [{ date: "2026-05-01", value: 10000 }, { date: "2026-06-01", value: 10000 }] });
    expect(evs.find(e => e.key.startsWith("nw-up"))).toBeFalsy();
  });

  it("flags an elite savings rate", () => {
    expect(keys(detectEvents({ savingsRate: 42 })).some(k => k.startsWith("savings-strong"))).toBe(true);
  });

  it("marks a reached goal", () => {
    const evs = detectEvents({ goals: [{ name: "Car", target: 5000, saved: 5200 }] });
    expect(keys(evs)).toContain("goal-done-Car");
  });

  it("does not mark an unreached goal", () => {
    const evs = detectEvents({ goals: [{ name: "Car", target: 5000, saved: 1000 }] });
    expect(keys(evs)).not.toContain("goal-done-Car");
  });

  it("rewards a full emergency fund", () => {
    expect(keys(detectEvents({ emergencyMonths: 7 }))).toContain("ef-6");
  });

  it("only emits the highest streak reached", () => {
    const hist = Array.from({ length: 40 }, (_, i) => ({ date: "d" + i, value: 100 }));
    const evs = detectEvents({ nwHistory: hist });
    const streaks = keys(evs).filter(k => k.startsWith("streak-"));
    expect(streaks).toEqual(["streak-30"]);
  });

  it("event keys are stable for dedup", () => {
    const a = keys(detectEvents({ netWorth: 100000 }));
    const b = keys(detectEvents({ netWorth: 100000 }));
    expect(a).toEqual(b);
  });

  it("eventToSnap produces a renderable media snapshot", () => {
    const [e] = detectEvents({ netWorth: 100000 });
    const snap = eventToSnap(e);
    expect(snap.media.big).toBe("€100k");
    expect(snap.caption).toContain("100k");
  });
});
