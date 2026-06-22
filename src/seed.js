// ─────────────────────────────────────────────────────────────────────────────
// Phase 5 — seed content. Curated finance posts that ship inside the app so a
// brand-new user (with zero follows) still opens to a feed that feels alive.
// This is the cold-start fix: "an empty feed feels dead."
//
// These are CLIENT-SIDE curated constants, not DB rows — every user sees the
// same starter feed, nothing to host or moderate, and the whole set can be
// deleted in one file once real creators are onboarded. Likes/saves on seed
// posts are local-only (they don't persist), same as the old shell behaviour.
//
// Style: monochrome (see folio design direction). `media.trend` = "up" | "down"
// is the ONLY thing that introduces colour (green/red), for finance stats.
// ─────────────────────────────────────────────────────────────────────────────

// ── Seed creators (read-only profiles you can tap into) ───────────────────────
export const SEED_CREATORS = [
  { id: "fire_finn",    handle: "fire_finn",    name: "Finn — FIRE journey",   initial: "F", followers: 18400, bio: "Index funds + a 45% savings rate. Documenting the slow road to financial independence by 40." },
  { id: "marketmia",    handle: "marketmia",    name: "Mia Okafor",            initial: "M", followers: 9220,  bio: "Ex-banker explaining money in plain language. Budgets, ETFs, and the psychology behind both." },
  { id: "dividend.dan", handle: "dividend.dan", name: "Dan Reyes",             initial: "D", followers: 25100, bio: "Living off dividends one share at a time. Patience compounds." },
  { id: "saver.sara",   handle: "saver.sara",   name: "Sara L.",               initial: "S", followers: 6740,  bio: "Paid off €31k of debt on an average salary. Small leaks sink big ships." },
  { id: "indexqueen",   handle: "indexqueen",   name: "Priya — Index Queen",   initial: "I", followers: 31800, bio: "Boring is beautiful. Buy the whole market, touch grass, repeat." },
  { id: "cryptokai",    handle: "cryptokai",    name: "Kai",                   initial: "K", followers: 12600, bio: "Risk-managed crypto + macro. Position sizing over hype. Not financial advice." },
  { id: "frugal.fox",   handle: "frugal.fox",   name: "Robin Fox",             initial: "R", followers: 4380,  bio: "Spend on what you love, cut the rest hard. Frugal ≠ cheap." },
  { id: "wealth.wren",  handle: "wealth.wren",  name: "Wren A.",               initial: "W", followers: 15900, bio: "Behavioural finance nerd. Your habits matter more than your returns." },
];

const byHandle = Object.fromEntries(SEED_CREATORS.map(c => [c.id, c]));

// Helper to keep posts terse to author.
const P = (id, author, time, kind, tag, media, caption, likes, comments) =>
  ({ id: "seed-" + id, authorId: author, author, handle: "@" + author, initial: byHandle[author]?.initial || "?", time, kind, tag, media, caption, likes, comments });

// ── Seed posts (curated, varied) ──────────────────────────────────────────────
export const SEED_POSTS = [
  P("01", "fire_finn", "2h", "milestone", "Milestone",
    { big: "€100k", sub: "net worth", trend: "up" },
    "Hit six figures at 26 🎉 Five years of boring index funds and a 45% savings rate. Slow is smooth, smooth is fast.", 1284, 96),
  P("02", "wealth.wren", "3h", "psychology", "Mindset",
    { big: "“", sub: "You don't rise to your goals.\nYou fall to your systems.”" },
    "Motivation gets you started. Systems keep you rich. Automate the boring stuff and let it run.", 2103, 141),
  P("03", "indexqueen", "5h", "tip", "Tip",
    { big: "1 fund", sub: "a whole-world index = ~9,000 companies" },
    "You don't need 14 ETFs. One global index fund owns a slice of nearly every public company on earth. Done.", 1890, 122),
  P("04", "saver.sara", "6h", "progress", "Progress",
    { big: "€0", sub: "debt remaining", trend: "up" },
    "37 months ago I owed €31,000. Today the balance is zero. Cried in the car. If I can, you can. 🖤", 3420, 287),
  P("05", "marketmia", "8h", "tip", "Budgeting",
    { big: "50 / 30 / 20", sub: "needs · wants · future-you" },
    "The simplest budget that actually sticks: half on needs, a third on wants, the rest to savings & debt. Adjust the ratio, keep the habit.", 740, 41),
  P("06", "dividend.dan", "10h", "milestone", "Dividends",
    { big: "€412", sub: "dividends this month", trend: "up" },
    "April dividends covered my entire grocery bill. Reinvesting every cent until it covers rent.", 1560, 88),
  P("07", "frugal.fox", "12h", "psychology", "Mindset",
    { big: "?", sub: "Does this cost\nmoney or buy time?" },
    "I stopped asking 'can I afford it' and started asking 'what is this actually buying me'. Changed everything.", 980, 64),
  P("08", "cryptokai", "14h", "tip", "Risk",
    { big: "2%", sub: "max risk per position" },
    "Rule that kept me in the game: never risk more than 2% of the portfolio on a single trade. Survival first, gains second.", 1120, 73),
  P("09", "fire_finn", "16h", "tip", "Tip",
    { big: "+1 day", sub: "of freedom per €30 saved" },
    "Reframe: at a 4% withdrawal rate, every €30/mo you cut from spending buys back roughly a full day of work — forever.", 1340, 79),
  P("10", "indexqueen", "18h", "psychology", "Mindset",
    { big: "0", sub: "times the market asked\nfor your opinion" },
    "Your portfolio doesn't care how you feel about the headlines. Keep buying. Keep ignoring.", 2670, 175),
  P("11", "saver.sara", "20h", "progress", "Progress",
    { big: "+18%", sub: "savings rate this year", trend: "up" },
    "Cancelled 3 subscriptions I forgot I had, meal-prepped Sundays, and that's it. Boring wins compound.", 671, 38),
  P("12", "marketmia", "22h", "tip", "Investing",
    { big: "€5/day", sub: "→ ~€190k in 30 yrs @ 7%" },
    "A coffee a day, invested instead, is a small fortune later. Not saying skip the coffee — just showing the number.", 1480, 102),
  P("13", "wealth.wren", "1d", "psychology", "Behaviour",
    { big: "24h", sub: "the rule that saves the most" },
    "The single best money hack isn't a budget app. It's waiting 24 hours before any non-essential purchase over €50.", 2240, 168),
  P("14", "dividend.dan", "1d", "tip", "Tip",
    { big: "DRIP", sub: "dividend reinvestment = autopilot" },
    "Turn on automatic dividend reinvestment and forget it exists. Compounding likes to be left alone.", 890, 47),
  P("15", "frugal.fox", "1d", "progress", "Progress",
    { big: "€240/mo", sub: "cut from fixed costs", trend: "up" },
    "Renegotiated insurance, switched phone plan, killed an unused gym. One afternoon, €2,880 a year. Highest hourly rate I've ever earned.", 1390, 91),
  P("16", "cryptokai", "1d", "psychology", "Mindset",
    { big: "−40%", sub: "and the plan didn't change", trend: "down" },
    "Watched a position drop 40% and did nothing, because the thesis hadn't changed. Discipline is a position too.", 760, 58),
  P("17", "fire_finn", "2d", "milestone", "Milestone",
    { big: "25x", sub: "annual expenses invested" },
    "Crossed 25x my yearly spending. By the classic 4% rule, work is now technically optional. Wild to type that.", 4100, 312),
  P("18", "indexqueen", "2d", "tip", "Tip",
    { big: "0.05%", sub: "vs 1.5% in fees" },
    "A 1.5% fund fee can quietly eat a third of your returns over 30 years. Check what you're paying. Then check again.", 1980, 134),
  P("19", "marketmia", "2d", "psychology", "Mindset",
    { big: "“", sub: "Spend like no one's\nwatching. Save like\neveryone is.”" },
    "Lifestyle creep is the silent FIRE killer. Give every raise a job before it gives itself one.", 1230, 86),
  P("20", "saver.sara", "3d", "tip", "Emergency fund",
    { big: "3–6 mo", sub: "of expenses in cash" },
    "Before investing a cent, I built a boring cash buffer. It's the reason one bad month never became one bad year.", 1040, 69),
  P("21", "wealth.wren", "3d", "tip", "Behaviour",
    { big: "Pay\nyourself\nfirst", sub: "automate on payday" },
    "Don't save what's left after spending. Spend what's left after saving. Move it the day you get paid, automatically.", 1670, 110),
  P("22", "dividend.dan", "4d", "milestone", "Dividends",
    { big: "€5,000", sub: "annual dividend income", trend: "up" },
    "Portfolio now throws off €5k/yr without me selling a thing. The snowball is finally rolling on its own.", 2890, 201),
  P("23", "frugal.fox", "5d", "psychology", "Mindset",
    { big: "≠", sub: "frugal is not cheap" },
    "Cheap optimises for price. Frugal optimises for value. I'll happily pay more for boots that last a decade.", 1180, 77),
  P("24", "cryptokai", "6d", "tip", "Macro",
    { big: "DCA", sub: "dollar-cost average, ignore timing" },
    "Stop trying to time the bottom. Buy a fixed amount on a fixed day and let averaging do the work. Boring beats clever.", 1340, 95),
];

// Stories row derived from the creators (plus the user's own "your story" slot,
// which the Feed adds itself).
export const SEED_STORIES = SEED_CREATORS.map(c => ({ id: c.id, name: c.handle, initial: c.initial }));

export const postsByCreator = (creatorId) => SEED_POSTS.filter(p => p.authorId === creatorId);
export const creatorById = (id) => byHandle[id];
