import { action } from "./_generated/server";
import { v } from "convex/values";

const EXTRACTION_PROMPT = (rawText: string) => `You are extracting structured compliance fields from a real payment scheme circular/bulletin. Read the text below and return ONLY a JSON object with these exact fields:
- "title": a short descriptive title for this circular, taken from or closely based on the document's own heading
- "scheme": the card scheme/network this is from (e.g. "Mastercard", "Visa")
- "urgency": one of "mandatory", "optional", or "informational"
- "deadline": ONLY the date or date range itself that customers need to be aware of (e.g. "4 Feb 2025" or "18 Dec 2024 - 6 Jan 2025"), or "N/A" if none stated. Do not include any surrounding sentence, label, or note text (e.g. not "Note: services will be updated on 4th Feb 2025" — just "4 Feb 2025").
- "deadlineDate": the single most relevant compliance date from "deadline", normalized to strict "YYYY-MM-DD" format, or null if there is no real date (e.g. urgency is informational, or no date is stated). If "deadline" is a range, use the date that marks when the requirement must be met (usually the end of the range).
- "scope": who this applies to, in a short phrase, taken from the document's own stated audience

For "urgency": the document often states its own classification directly (for example a field literally labeled "Action Indicator", "Category", or similar — such as "No Action", "Action Required", "Mandatory", "For Your Information"). If the document states this explicitly, use that stated classification rather than inferring urgency from the general tone of the text. Restrictive-sounding language (e.g. "changes are discouraged" or "not required to validate") does not by itself mean "mandatory" — only classify as "mandatory" if the document explicitly requires the customer to take an action, and "informational" if the document explicitly says no action is required.

Circular text:
"""
${rawText}
"""

Return ONLY the JSON object, no other text, no markdown formatting.`;

const VALID_URGENCIES = ["mandatory", "optional", "informational"];

export const extractFields = action({
  args: { rawText: v.string() },
  handler: async (_ctx, args) => {
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
        messages: [{ role: "user", content: EXTRACTION_PROMPT(args.rawText) }],
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
    const urgency =
      typeof parsed.urgency === "string" ? parsed.urgency.trim().toLowerCase() : "";
    if (!VALID_URGENCIES.includes(urgency)) {
      throw new Error(
        `AI extraction returned an unrecognized urgency value: ${JSON.stringify(parsed.urgency)}`
      );
    }

    return { ...parsed, urgency };
  },
});
