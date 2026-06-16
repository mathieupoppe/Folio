// Streaks + achievements — pure, unit-tested. Feeds the Stats screen.

// Consecutive days (ending today, or yesterday if not yet opened today) the user
// has opened the app. `days` is an array of "YYYY-MM-DD" strings.
export function currentStreak(days = [], today = new Date()) {
  if (!days.length) return 0;
  const set = new Set(days);
  const key = d => d.toISOString().slice(0, 10);
  const cursor = new Date(today);
  if (!set.has(key(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!set.has(key(cursor))) return 0; // streak broken (missed today + yesterday)
  }
  let streak = 0;
  while (set.has(key(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1); }
  return streak;
}

// Each test() runs against a flat snapshot (see computeAchievements caller).
export const ACHIEVEMENTS = [
  { id: "first_log",   icon: "📝", title: "First step",    desc: "Logged your first transaction", test: s => s.transactions >= 1 },
  { id: "streak3",     icon: "🔥", title: "On a roll",     desc: "3-day check-in streak",         test: s => s.streak >= 3 },
  { id: "streak7",     icon: "⚡", title: "Locked in",     desc: "7-day check-in streak",         test: s => s.streak >= 7 },
  { id: "saver",       icon: "💪", title: "Saver",         desc: "20%+ savings rate",             test: s => s.savingsRate >= 20 },
  { id: "supersaver",  icon: "🚀", title: "Super saver",   desc: "40%+ savings rate",             test: s => s.savingsRate >= 40 },
  { id: "cushion",     icon: "🛡️", title: "Safety net",    desc: "3+ months emergency fund",      test: s => s.emergencyMonths >= 3 },
  { id: "investor",    icon: "📈", title: "Investor",      desc: "Tracking live holdings",        test: s => s.holdings >= 1 },
  { id: "diversified", icon: "🧺", title: "Diversified",   desc: "3+ assets in your plan",        test: s => s.diversifiedCount >= 3 },
  { id: "goal",        icon: "🎯", title: "Goal getter",   desc: "Reached a savings goal",        test: s => s.goalsReached >= 1 },
  { id: "nw1k",        icon: "🌱", title: "First €1k",      desc: "Net worth above 1,000",         test: s => s.netWorth >= 1000 },
  { id: "nw10k",       icon: "🌳", title: "Five figures",  desc: "Net worth above 10,000",        test: s => s.netWorth >= 10000 },
  { id: "healthy",     icon: "❤️", title: "Healthy",       desc: "Financial health 70+",          test: s => s.healthScore >= 70 },
];

export function computeAchievements(snapshot = {}) {
  return ACHIEVEMENTS.map(a => ({ id: a.id, icon: a.icon, title: a.title, desc: a.desc, earned: !!a.test(snapshot) }));
}
