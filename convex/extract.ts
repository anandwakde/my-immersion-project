import { action } from "./_generated/server";
import { v } from "convex/values";

const EXTRACTION_PROMPT = (rawText: string) => `You are extracting structured compliance fields from a real payment scheme circular/bulletin. Read the text below and return ONLY a JSON object with these exact fields:
- "title": a short descriptive title for this circular, taken from or closely based on the document's own heading
- "scheme": the card scheme/network this is from (e.g. "Mastercard", "Visa")
- "urgency": one of "mandatory", "optional", or "informational"
- "deadline": the date(s) customers need to be aware of, formatted as "D MMM YYYY" using a 3-letter abbreviated month (e.g. "4 Feb 2025"), or "N/A" if truly no date is stated anywhere. Do not include any surrounding sentence, label, or note text (e.g. not "Note: services will be updated on 4th Feb 2025" — just "4 Feb 2025"). If the document states a date RANGE (a start and an end, e.g. a freeze window or blackout period), report the FULL range as "D MMM YYYY - D MMM YYYY" (e.g. "18 Dec 2024 - 6 Jan 2025") — never just one end of it.
- "deadlineDate": normalized "YYYY-MM-DD" for the single date that matters most for sorting/tracking — the deadline itself, or (if "deadline" is a range) the end of the range. Null only if "deadline" is "N/A".
- "scope": who this applies to, in a short phrase, taken from the document's own stated audience

Determine "urgency" and "deadline" independently — a date existing does not by itself imply "mandatory", and "informational" does not by itself mean there's no date to report. Handle them in this order:

1. First, "urgency": check whether the document states its own classification directly (a field literally labeled "Action Indicator", "Category", or similar — such as "No Action", "Action Required", "Mandatory", "For Your Information"). If so, that stated classification wins, full stop — use it even if the surrounding text sounds urgent or restrictive, and even if a specific date is mentioned nearby. Only when the document does NOT state its own classification should you infer from tone: restrictive-sounding language (e.g. "changes are discouraged") does not by itself mean "mandatory" — infer "mandatory" only when the document requires the customer to take an action, and "informational" when it explicitly says no action is required.

2. Separately, "deadline": if the document states ANY date the customer should know — a compliance deadline, an effective date, or a window/freeze/blackout period — report it, regardless of what urgency you picked in step 1. An "informational"/"No Action" bulletin can absolutely still have a real, reportable date (e.g. a freeze period customers should mark on their calendar even though no action is required from them). Only use "N/A" when the document truly contains no date anywhere.

If the text is a "Summary of Changes" or "Notification of Changes" style table listing multiple distinct rule changes, each with its own effective date, you MUST pick exactly ONE specific change from the table and report on it individually. Never summarize the section as a whole, never use the section's own umbrella heading (e.g. "Summary of Changes since...") as "title" — use that one change's own specific subject/title instead — and never default to "deadline": "N/A" or "urgency": "informational" just because multiple items exist alongside it. Pick the change with the nearest or most significant effective date. Then apply steps 1-2 to that one specific change only: if it carries its own explicit Action Indicator/Category-style label, use that; otherwise, since a specific "Effective" date on a rule change means customers must comply by then, classify it as "mandatory" unless the document states otherwise for that item.

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
