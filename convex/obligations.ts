"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

async function tryFetchSourceText(sourceUrl: string): Promise<string | null> {
  try {
    const res = await fetch(sourceUrl);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("pdf") || sourceUrl.toLowerCase().endsWith(".pdf")) {
      const buffer = Buffer.from(await res.arrayBuffer());
      const parsed = await pdfParse(buffer);
      return parsed.text.slice(0, 20000);
    }
    return null;
  } catch {
    return null;
  }
}

const OBLIGATIONS_PROMPT = (
  circular: { scheme: string; title: string; urgency: string; scope: string; deadline: string },
  sourceText: string | null,
) => `You are a payments compliance analyst. Extract the SPECIFIC, actionable obligations a company must complete for the circular below — not a restatement of urgency/deadline/scope, but the actual work required (e.g. "Update MCC mapping tables to include new acceptor business codes by the effective date", not just "comply with revised standards").

CIRCULAR:
- Scheme: ${circular.scheme}
- Title: ${circular.title}
- Stated audience/scope: ${circular.scope}
- Urgency: ${circular.urgency}
- Deadline: ${circular.deadline}

${sourceText ? `FULL DOCUMENT TEXT:\n"""\n${sourceText}\n"""` : "Only the summary fields above are available — no full document text was retrievable. Infer the most likely concrete obligation(s) implied by the title and scope, and be conservative: prefer one well-reasoned obligation over several speculative ones."}

Return ONLY a JSON object with exactly this field:
- "obligations": an array of 1-4 short strings, each a specific, actionable obligation. Each string should be concrete enough that someone could turn it directly into a task with an owner and a due date.

Return ONLY the JSON object, no other text, no markdown formatting.`;

export const extractObligations = action({
  args: { userId: v.id("users"), circularId: v.id("circulars") },
  handler: async (ctx, args) => {
    const circular: {
      scheme: string;
      title: string;
      urgency: string;
      scope: string;
      deadline: string;
      deadlineDate: string | null;
      sourceUrl: string;
    } | null = await ctx.runQuery(internal.circulars.getById, { circularId: args.circularId });
    if (!circular) {
      throw new Error("Circular not found");
    }
    const verdict = await ctx.runQuery(internal.relevance.getVerdict, {
      userId: args.userId,
      circularId: args.circularId,
    });
    if (verdict?.appliesToCompany !== true) {
      throw new Error("Check relevance first — obligations are only extracted for circulars that apply to you.");
    }

    const sourceText = await tryFetchSourceText(circular.sourceUrl);

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set on this deployment");
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: OBLIGATIONS_PROMPT(circular, sourceText) }],
        response_format: { type: "json_object" },
        temperature: 0,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI request failed: ${res.status} ${errText}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("OpenAI response had no content");
    }

    const parsed = JSON.parse(content);
    const descriptions: string[] = Array.isArray(parsed.obligations)
      ? parsed.obligations.filter((o: unknown) => typeof o === "string" && o.trim()).map((o: string) => o.trim())
      : [];
    if (descriptions.length === 0) {
      throw new Error("AI returned no obligations");
    }

    await ctx.runMutation(internal.obligationsData.replaceForCircular, {
      userId: args.userId,
      circularId: args.circularId,
      descriptions,
      defaultDueDate: circular.deadlineDate,
    });

    return { count: descriptions.length };
  },
});

const FINANCIAL_IMPACT_PROMPT = (
  circular: { scheme: string; title: string; urgency: string; scope: string; deadline: string },
  sourceText: string | null,
) => `You are a payments compliance analyst estimating the FINANCIAL impact of a scheme circular on a company. Quantify where the document gives you a real basis to — a fee change, a new charge, a cost avoidance from acting before a deadline, or an efficiency/cost-reduction opportunity.

CIRCULAR:
- Scheme: ${circular.scheme}
- Title: ${circular.title}
- Stated audience/scope: ${circular.scope}
- Urgency: ${circular.urgency}
- Deadline: ${circular.deadline}

${sourceText ? `FULL DOCUMENT TEXT:\n"""\n${sourceText}\n"""` : "Only the summary fields above are available — no full document text was retrievable."}

Rules:
- If the document states or clearly implies a real number (a fee amount, a percentage, a specific charge), use it and cite it plainly (e.g. "May increase annual scheme fees by $180,000" or "Opting out before the deadline avoids a new per-transaction service charge").
- If there is genuinely no basis to quantify anything (no fee, charge, or cost-relevant detail in the document), say so plainly: "No quantifiable financial impact identified from this document."
- Never invent a specific number that isn't grounded in the document. A directional, non-numeric statement is better than a fabricated figure.
- Keep it to ONE short sentence.

Return ONLY a JSON object with exactly this field:
- "summary": the one-sentence financial impact statement.

Return ONLY the JSON object, no other text, no markdown formatting.`;

export const estimateFinancialImpact = action({
  args: { userId: v.id("users"), circularId: v.id("circulars") },
  handler: async (ctx, args) => {
    const circular: {
      scheme: string;
      title: string;
      urgency: string;
      scope: string;
      deadline: string;
      sourceUrl: string;
    } | null = await ctx.runQuery(internal.circulars.getById, { circularId: args.circularId });
    if (!circular) {
      throw new Error("Circular not found");
    }
    const verdict = await ctx.runQuery(internal.relevance.getVerdict, {
      userId: args.userId,
      circularId: args.circularId,
    });
    if (verdict?.appliesToCompany !== true) {
      throw new Error("Check relevance first — financial impact is only estimated for circulars that apply to you.");
    }

    const sourceText = await tryFetchSourceText(circular.sourceUrl);

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set on this deployment");
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: FINANCIAL_IMPACT_PROMPT(circular, sourceText) }],
        response_format: { type: "json_object" },
        temperature: 0,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI request failed: ${res.status} ${errText}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("OpenAI response had no content");
    }

    const parsed = JSON.parse(content);
    const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";
    if (!summary) {
      throw new Error("AI returned no financial impact summary");
    }

    await ctx.runMutation(internal.obligationsData.setFinancialImpact, {
      userId: args.userId,
      circularId: args.circularId,
      summary,
    });

    return { summary };
  },
});
