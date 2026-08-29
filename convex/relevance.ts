import { action, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";

const RELEVANCE_PROMPT = (circular: {
  scheme: string;
  title: string;
  urgency: string;
  scope: string;
  deadline: string;
}, profile: {
  legalEntityName: string;
  customerType: string;
  countries: string[];
  schemes: string[];
}) => `You are a payments compliance analyst. Decide whether the payment scheme circular below actually applies to this specific company — not whether it's important in general.

COMPANY PROFILE:
- Legal entity: ${profile.legalEntityName}
- Customer type: ${profile.customerType}
- Countries of operation: ${profile.countries.join(", ") || "none specified"}
- Schemes participated in: ${profile.schemes.join(", ") || "none specified"}

CIRCULAR:
- Scheme: ${circular.scheme}
- Title: ${circular.title}
- Stated audience/scope: ${circular.scope}
- Urgency as classified by the scheme: ${circular.urgency}
- Deadline: ${circular.deadline}

Rules:
- If the circular's scheme is not one the company participates in, it does not apply — say so plainly.
- If the circular's stated audience/scope clearly excludes this company's customer type (e.g. it only addresses issuers, and the company is an acquirer), it does not apply.
- If the audience/scope is region- or country-specific and excludes all of the company's countries of operation, it does not apply.
- Otherwise, if the scheme matches and nothing in the scope excludes this company's type or countries, it applies.
- Judge only from the information given — do not assume facts not stated.

Return ONLY a JSON object with exactly these fields:
- "applies": true or false
- "reason": one or two plain-English sentences explaining the verdict, written directly to the company (e.g. "This applies to you because...' or "This doesn't apply to you because...").

Return ONLY the JSON object, no other text, no markdown formatting.`;

export const checkRelevance = action({
  args: { userId: v.id("users"), circularId: v.id("circulars") },
  handler: async (ctx, args) => {
    const circular: {
      scheme: string;
      title: string;
      urgency: string;
      scope: string;
      deadline: string;
    } | null = await ctx.runQuery(internal.circulars.getById, { circularId: args.circularId });
    if (!circular) {
      throw new Error("Circular not found");
    }

    const profile: {
      legalEntityName: string;
      customerType: string;
      countries: string[];
      schemes: string[];
    } | null = await ctx.runQuery(api.companyProfile.get, { userId: args.userId });
    if (!profile) {
      throw new Error("Set up your company profile first.");
    }

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
        messages: [{ role: "user", content: RELEVANCE_PROMPT(circular, profile) }],
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
    const applies = parsed.applies === true;
    const reason = typeof parsed.reason === "string" ? parsed.reason.trim() : "";
    if (!reason) {
      throw new Error("AI relevance check returned no reason");
    }

    await ctx.runMutation(internal.relevance.setVerdict, {
      userId: args.userId,
      circularId: args.circularId,
      appliesToCompany: applies,
      applicabilityReason: reason,
    });

    return { applies, reason };
  },
});

export const getVerdict = internalQuery({
  args: { userId: v.id("users"), circularId: v.id("circulars") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("circularVerdicts")
      .withIndex("by_user_and_circular", (q) =>
        q.eq("userId", args.userId).eq("circularId", args.circularId)
      )
      .unique();
  },
});

export const setVerdict = internalMutation({
  args: {
    userId: v.id("users"),
    circularId: v.id("circulars"),
    appliesToCompany: v.boolean(),
    applicabilityReason: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("circularVerdicts")
      .withIndex("by_user_and_circular", (q) =>
        q.eq("userId", args.userId).eq("circularId", args.circularId)
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        appliesToCompany: args.appliesToCompany,
        applicabilityReason: args.applicabilityReason,
        checkedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("circularVerdicts", {
        userId: args.userId,
        circularId: args.circularId,
        appliesToCompany: args.appliesToCompany,
        applicabilityReason: args.applicabilityReason,
        checkedAt: Date.now(),
      });
    }
  },
});
