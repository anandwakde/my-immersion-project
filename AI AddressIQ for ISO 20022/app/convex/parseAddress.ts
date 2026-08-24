import { action, env } from "./_generated/server";
import { v, ConvexError } from "convex/values";

const READY_CONFIDENCE_THRESHOLD = 75;
const MAX_INPUT_LENGTH = 1000;

export const parse = action({
  args: { rawAddress: v.string() },
  returns: v.object({
    floorUnit: v.union(v.string(), v.null()),
    buildingNumber: v.union(v.string(), v.null()),
    streetName: v.union(v.string(), v.null()),
    townName: v.union(v.string(), v.null()),
    postalCode: v.union(v.string(), v.null()),
    countryCode: v.union(v.string(), v.null()),
    countryName: v.union(v.string(), v.null()),
    confidence: v.number(),
    missingRequiredFields: v.array(v.string()),
    status: v.union(v.literal("ready"), v.literal("needs_review")),
  }),
  handler: async (_ctx, args) => {
    const rawAddress = args.rawAddress.trim();
    if (!rawAddress) {
      throw new ConvexError("Paste an address before submitting.");
    }
    if (rawAddress.length > MAX_INPUT_LENGTH) {
      throw new ConvexError(
        `That's too long (${rawAddress.length} characters). Paste a single address, not a full document — ${MAX_INPUT_LENGTH} characters max.`,
      );
    }

    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new ConvexError("OPENAI_API_KEY is not set on this deployment");
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You convert a raw, possibly hybrid or unstructured payment beneficiary address into ISO 20022 structured address fields. Respond with ONLY a JSON object with these exact keys: floorUnit, buildingNumber, streetName, townName, postalCode, countryCode (ISO 3166-1 alpha-2), countryName, confidence (an integer 0-100, your own honest estimate of how confident you are in this structuring). Use null for any field you cannot determine from the input. Do not invent data that is not present or clearly implied in the input.",
          },
          { role: "user", content: rawAddress },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new ConvexError(`AI parsing failed (${res.status}): ${text.slice(0, 300)}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new ConvexError("AI response did not include a result");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new ConvexError("AI response was not valid JSON");
    }

    const obj = parsed as Record<string, unknown>;
    const str = (val: unknown): string | null =>
      typeof val === "string" && val.trim() ? val.trim() : null;
    const num = (val: unknown): number => (typeof val === "number" ? val : 0);

    const structured = {
      floorUnit: str(obj.floorUnit),
      buildingNumber: str(obj.buildingNumber),
      streetName: str(obj.streetName),
      townName: str(obj.townName),
      postalCode: str(obj.postalCode),
      countryCode: str(obj.countryCode),
      countryName: str(obj.countryName),
      confidence: num(obj.confidence),
    };

    const nothingExtracted = [
      structured.floorUnit,
      structured.buildingNumber,
      structured.streetName,
      structured.townName,
      structured.postalCode,
      structured.countryCode,
      structured.countryName,
    ].every((field) => field === null);
    if (nothingExtracted) {
      throw new ConvexError(
        "Couldn't find an address in that text — check what you pasted.",
      );
    }

    const requiredFields: { key: keyof typeof structured; label: string }[] = [
      { key: "streetName", label: "Street Name" },
      { key: "townName", label: "Town Name" },
      { key: "countryCode", label: "Country" },
    ];
    const missingRequiredFields = requiredFields
      .filter(({ key }) => !structured[key])
      .map(({ label }) => label);

    const status: "ready" | "needs_review" =
      missingRequiredFields.length > 0 ||
      structured.confidence < READY_CONFIDENCE_THRESHOLD
        ? "needs_review"
        : "ready";

    return { ...structured, missingRequiredFields, status };
  },
});
