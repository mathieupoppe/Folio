// Folio AI coach. Takes the signed-in user's financial snapshot and returns a
// short, personalized analysis from Claude. The ANTHROPIC_API_KEY lives only as
// a Supabase secret — it never reaches the browser.
//
// Deploy:
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   supabase functions deploy advisor
//
// Single Claude call (analysis = single-call use case), claude-opus-4-8 with
// adaptive thinking and structured JSON output so the client can render it.
import Anthropic from "npm:@anthropic-ai/sdk@0.69.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// Schema the model must fill — keeps the response renderable and predictable.
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    headline: { type: "string", description: "One warm, specific sentence summarizing their situation." },
    insights: {
      type: "array",
      description: "3 to 5 concrete observations, most important first.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string", description: "Short label, 2-5 words." },
          detail: { type: "string", description: "1-2 sentences of plain-language explanation and advice." },
          severity: { type: "string", enum: ["good", "watch", "action"] },
        },
        required: ["title", "detail", "severity"],
      },
    },
    nextStep: { type: "string", description: "The single most valuable thing to do next, phrased as a friendly nudge." },
  },
  required: ["headline", "insights", "nextStep"],
};

const SYSTEM = `You are Folio's financial coach: warm, encouraging, and concrete. You analyze a user's personal-finance snapshot and give them a short, honest read on where they stand.

Rules:
- Be specific to THEIR numbers. Reference real figures from the snapshot.
- Plain language. No jargon, no lectures, no generic platitudes.
- Be honest about risks, but never alarmist or shaming.
- You are not a licensed financial advisor; give general educational guidance, not regulated investment, tax, or legal advice. Do not recommend specific securities to buy or sell.
- Currency: amounts are in the user's chosen currency; refer to them with the provided symbol.
- Keep each detail to 1-2 sentences. Pick the 3-5 highest-impact points only.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    // 1. Require a valid Supabase session — protects the API key from anonymous abuse.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (supabaseUrl && anonKey) {
      const supa = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: { user }, error } = await supa.auth.getUser();
      if (error || !user) return json({ error: "Invalid session" }, 401);
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "not_configured", message: "ANTHROPIC_API_KEY is not set on the server yet." }, 503);

    const body = await req.json().catch(() => ({}));
    const anthropic = new Anthropic({ apiKey });

    // ── CHAT MODE: conversational Q&A grounded in the user's snapshot ──
    if (Array.isArray(body?.messages)) {
      const snap = body.snapshot ?? {};
      const cur = typeof snap?.currency === "string" ? snap.currency : "EUR";
      // Sanitize history: only role/text, cap length, must start with a user turn.
      const history = body.messages
        .filter((m: { role?: string; content?: unknown }) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
        .slice(-16)
        .map((m: { role: string; content: string }) => ({ role: m.role, content: m.content.slice(0, 4000) }));
      while (history.length && history[0].role !== "user") history.shift();
      if (!history.length) return json({ error: "bad_request", message: "No message to answer." }, 400);

      const chatSystem = `${SYSTEM}

You're now in a back-and-forth chat with the user. Answer their questions directly and conversationally — short, warm, and specific to their numbers. Use plain language; a sentence or two is usually enough unless they ask for depth. If something isn't in their data, say so briefly. Currency: ${cur}.

Here is the user's current financial snapshot (JSON) for context:
${JSON.stringify(snap, null, 2)}`;

      const chat = await anthropic.messages.create({
        model: "claude-opus-4-8",
        max_tokens: 1200,
        thinking: { type: "adaptive" },
        system: chatSystem,
        messages: history,
      });
      const replyBlock = chat.content.find((b: { type: string }) => b.type === "text") as { text?: string } | undefined;
      return json({ reply: replyBlock?.text ?? "Sorry, I didn't catch that — try again?" });
    }

    // ── ANALYSIS MODE (default): structured one-shot read ──
    const snapshot = body;
    const currency = typeof snapshot?.currency === "string" ? snapshot.currency : "EUR";
    const message = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 4000,
      thinking: { type: "adaptive" },
      system: SYSTEM,
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
      messages: [
        {
          role: "user",
          content: `Currency: ${currency}. Here is my financial snapshot as JSON. Analyze it and respond using the required format.\n\n${JSON.stringify(snapshot, null, 2)}`,
        },
      ],
    });

    // Pull the text block and parse the structured JSON.
    const textBlock = message.content.find((b: { type: string }) => b.type === "text") as { text?: string } | undefined;
    const raw = textBlock?.text ?? "{}";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return json({ error: "parse_error", message: "The coach returned an unexpected format. Please try again." }, 502);
    }

    return json({ result: parsed });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: "advisor_failed", message: msg }, 500);
  }
});
