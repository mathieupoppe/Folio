import { describe, it, expect } from "vitest";
import {
  calcGrowth,
  growthRows,
  sumAmount,
  subsMonthly,
  computeHealth,
  healthBandLabel,
  healthBand,
  milestoneProgress,
  clampNumber,
  dueSubscriptionCharges,
  debtPayoff,
  spendByCategory,
} from "./finance";

describe("spendByCategory", () => {
  const entries = [
    { type: "withdrawal", date: "2026-06-03", amount: 40, cat: "food" },
    { type: "withdrawal", date: "2026-06-10", amount: 12, cat: "food" },
    { type: "withdrawal", date: "2026-06-15", amount: 30, cat: "fun" },
    { type: "withdrawal", date: "2026-06-20", amount: 5 }, // uncategorized
    { type: "deposit",    date: "2026-06-04", amount: 99, cat: "food" }, // deposits ignored
    { type: "withdrawal", date: "2026-05-30", amount: 77, cat: "food" }, // other month ignored
  ];
  it("sums withdrawals per category for the month", () => {
    const r = spendByCategory(entries, "2026-06");
    expect(r.food).toBe(52);
    expect(r.fun).toBe(30);
    expect(r.__none).toBe(5);
  });
  it("returns empty for a month with no spend", () => {
    expect(spendByCategory(entries, "2026-01")).toEqual({});
  });
  it("handles empty/undefined input", () => {
    expect(spendByCategory(undefined, "2026-06")).toEqual({});
  });
});

describe("calcGrowth", () => {
  it("returns one row per year", () => {
    expect(calcGrowth(1000, 100, 5, 10)).toHaveLength(5);
  });
  it("grows with positive rate and contributions", () => {
    const rows = calcGrowth(1000, 100, 10, 10);
    expect(rows[rows.length - 1].balance).toBeGreaterThan(1000 + 100 * 12 * 10);
  });
  it("with zero rate equals principal plus contributions", () => {
    const rows = calcGrowth(1000, 100, 1, 0);
    expect(Math.round(rows[0].balance)).toBe(1000 + 100 * 12);
  });
  it("never goes negative", () => {
    expect(calcGrowth(0, 0, 3, 0).every(r => r.balance >= 0)).toBe(true);
  });
});

describe("growthRows", () => {
  it("yearly view returns years rows", () => {
    expect(growthRows(1000, 100, 4, 8, "year")).toHaveLength(4);
  });
  it("monthly view returns years*12 rows", () => {
    expect(growthRows(1000, 100, 2, 8, "month")).toHaveLength(24);
  });
});

describe("sumAmount", () => {
  it("sums amounts and tolerates missing/empty", () => {
    expect(sumAmount([{ amount: 10 }, { amount: 5 }, {}])).toBe(15);
    expect(sumAmount(null)).toBe(0);
  });
});

describe("subsMonthly", () => {
  it("normalizes yearly to monthly", () => {
    expect(subsMonthly([{ amount: 120, cycle: "yearly" }])).toBe(10);
    expect(subsMonthly([{ amount: 9, cycle: "monthly" }])).toBe(9);
  });
});

describe("computeHealth", () => {
  const base = { spendPct: 70, spendMoney: 1000, totalAssets: 6000, totalLiab: 0, investBuckets: [{ pct: 50 }, { pct: 50 }] };
  it("score is between 0 and 100", () => {
    const { score } = computeHealth(base);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
  it("returns four pillars", () => {
    expect(computeHealth(base).pillars).toHaveLength(4);
  });
  it("lower spending raises savings pillar", () => {
    const low = computeHealth({ ...base, spendPct: 40 }).pillars.find(p => p.key === "savings").score;
    const high = computeHealth({ ...base, spendPct: 90 }).pillars.find(p => p.key === "savings").score;
    expect(low).toBeGreaterThan(high);
  });
  it("debt pillar is full with no liabilities", () => {
    expect(computeHealth(base).pillars.find(p => p.key === "debt").score).toBe(25);
  });
});

describe("healthBandLabel", () => {
  it("maps scores to bands", () => {
    expect(healthBandLabel(85)).toBe("Excellent");
    expect(healthBandLabel(65)).toBe("Healthy");
    expect(healthBandLabel(45)).toBe("Okay");
    expect(healthBandLabel(10)).toBe("Needs work");
  });
});

describe("healthBand", () => {
  const ok = { key: "emergency", score: 20 };
  const empty = { key: "emergency", score: 0 };
  it("is Healthy with a good score and a real cushion", () => {
    expect(healthBand(68, [ok])).toEqual({ label: "Healthy", tone: "good" });
  });
  it("caps a high score to Okay/watch when the emergency fund is empty", () => {
    expect(healthBand(68, [empty])).toEqual({ label: "Okay", tone: "watch" });
  });
  it("caps Excellent too when there is no safety net", () => {
    expect(healthBand(85, [empty]).tone).toBe("watch");
  });
  it("low scores stay Needs work regardless", () => {
    expect(healthBand(30, [ok])).toEqual({ label: "Needs work", tone: "bad" });
  });
});

describe("milestoneProgress", () => {
  it("finds the next milestone above net worth", () => {
    expect(milestoneProgress(3000).next).toBe(5000);
  });
  it("caps at 100% past the top milestone", () => {
    expect(milestoneProgress(2_000_000).pct).toBe(100);
  });
});

describe("dueSubscriptionCharges", () => {
  const today = new Date(2026, 5, 14); // 2026-06-14
  it("flags a monthly sub whose bill day has passed", () => {
    const due = dueSubscriptionCharges([{ id: "s1", name: "Netflix", amount: 10, cycle: "monthly", day: 5 }], [], today);
    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({ subId: "s1", amount: 10, date: "2026-06-05", period: "2026-06" });
  });
  it("ignores subs whose bill day is still in the future", () => {
    expect(dueSubscriptionCharges([{ id: "s1", name: "X", amount: 5, cycle: "monthly", day: 25 }], [], today)).toHaveLength(0);
  });
  it("skips charges already logged for the period", () => {
    const subs = [{ id: "s1", name: "X", amount: 5, cycle: "monthly", day: 1 }];
    const entries = [{ subId: "s1", period: "2026-06" }];
    expect(dueSubscriptionCharges(subs, entries, today)).toHaveLength(0);
  });
  it("skips yearly subscriptions", () => {
    expect(dueSubscriptionCharges([{ id: "s1", name: "X", amount: 99, cycle: "yearly", day: 1 }], [], today)).toHaveLength(0);
  });
});

describe("debtPayoff", () => {
  const debts = [
    { id: "a", name: "Card", balance: 2000, apr: 22, min: 50 },
    { id: "b", name: "Loan", balance: 5000, apr: 6, min: 100 },
  ];
  it("clears all debts in finite time with adequate budget", () => {
    const r = debtPayoff(debts, 400, "avalanche");
    expect(r.feasible).toBe(true);
    expect(r.months).toBeGreaterThan(0);
    expect(r.payoffOrder).toHaveLength(2);
  });
  it("avalanche costs no more interest than snowball", () => {
    const av = debtPayoff(debts, 400, "avalanche");
    const sn = debtPayoff(debts, 400, "snowball");
    expect(av.totalInterest).toBeLessThanOrEqual(sn.totalInterest);
  });
  it("snowball clears the smallest balance first", () => {
    const r = debtPayoff(debts, 400, "snowball");
    expect(r.payoffOrder[0].id).toBe("a"); // Card (2000) before Loan (5000)
  });
  it("is infeasible when the budget can't cover minimums", () => {
    expect(debtPayoff(debts, 100).feasible).toBe(false);
  });
  it("handles no debts", () => {
    expect(debtPayoff([], 200).months).toBe(0);
  });
});

describe("clampNumber", () => {
  it("clamps within range", () => {
    expect(clampNumber(150, { min: 0, max: 100 })).toBe(100);
    expect(clampNumber(-5, { min: 0, max: 100 })).toBe(0);
  });
  it("returns fallback for non-numbers", () => {
    expect(clampNumber("abc", { fallback: 7 })).toBe(7);
  });
});
