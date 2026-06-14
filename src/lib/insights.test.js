import { describe, it, expect } from "vitest";
import { generateInsights, insightsHeadline } from "./insights";

const find = (insights, id) => insights.find(i => i.id === id);

describe("generateInsights", () => {
  it("returns a baseline insight when nothing is set up", () => {
    const insights = generateInsights({ income: 0 });
    expect(insights).toHaveLength(1);
    expect(insights[0].id).toBe("start");
  });

  it("flags a strong savings rate as good", () => {
    const i = find(generateInsights({ income: 2000, spendPct: 60 }), "savings");
    expect(i.severity).toBe("good");
  });

  it("flags a low savings rate as an action", () => {
    const i = find(generateInsights({ income: 2000, spendPct: 95 }), "savings");
    expect(i.severity).toBe("action");
  });

  it("rewards a solid emergency fund", () => {
    const i = find(generateInsights({ income: 2000, spendPct: 50, assets: [{ amount: 12000 }] }), "emergency");
    expect(i.severity).toBe("good");
  });

  it("warns on a thin emergency fund", () => {
    const i = find(generateInsights({ income: 2000, spendPct: 50, assets: [{ amount: 500 }] }), "emergency");
    expect(i.severity).toBe("action");
  });

  it("flags debt larger than assets", () => {
    const i = find(generateInsights({ income: 2000, assets: [{ amount: 1000 }], liabilities: [{ amount: 5000 }] }), "debt");
    expect(i.severity).toBe("action");
  });

  it("flags heavy subscription load", () => {
    const i = find(generateInsights({ income: 1000, subs: [{ amount: 150, cycle: "monthly" }] }), "subs");
    expect(i.severity).toBe("action");
  });

  it("warns when everything is in one investment", () => {
    const i = find(generateInsights({ income: 2000, investBuckets: [{ label: "VUAA", pct: 100 }] }), "diversification");
    expect(i.severity).toBe("watch");
  });

  it("rewards a diversified plan", () => {
    const i = find(generateInsights({ income: 2000, investBuckets: [{ pct: 40 }, { pct: 30 }, { pct: 30 }] }), "diversification");
    expect(i.severity).toBe("good");
  });

  it("celebrates a reached goal", () => {
    const i = find(generateInsights({ income: 2000, goals: [{ name: "Car", target: 1000, saved: 1000 }] }), "goals");
    expect(i.severity).toBe("good");
  });

  it("detects a growing net worth", () => {
    const i = find(generateInsights({ income: 2000, nwHistory: [{ value: 100 }, { value: 500 }] }), "trend");
    expect(i.severity).toBe("good");
  });
});

describe("insightsHeadline", () => {
  it("is upbeat when there are no actions", () => {
    expect(insightsHeadline([{ severity: "good" }])).toMatch(/good shape/i);
  });
  it("counts actions when several need attention", () => {
    const h = insightsHeadline([{ severity: "action" }, { severity: "action" }, { severity: "action" }]);
    expect(h).toMatch(/3/);
  });
});
