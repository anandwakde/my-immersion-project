import { action, env } from "./_generated/server";
import { v, ConvexError } from "convex/values";

const READY_CONFIDENCE_THRESHOLD = 75;
const MAX_INPUT_LENGTH = 1000;

const FIELD_KEYS = [
  "floorUnit",
  "buildingNumber",
  "streetName",
  "townName",
  "postalCode",
  "countryCode",
  "countryName",
] as const;

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
    addressFormat: v.union(
      v.literal("structured"),
      v.literal("hybrid"),
      v.literal("unstructured"),
    ),
    fieldIssues: v.record(v.string(), v.string()),
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
            content: `You analyze a raw payment beneficiary address for ISO 20022 CBPR+ readiness.

First classify the RAW INPUT's address format as exactly one of:
- "structured": every component already arrives as its own clearly separated field (street, building number, town, postal code, country all distinct).
- "hybrid": Town Name and Country are clearly identifiable on their own, but the rest (building, floor, street, landmarks) is combined into one or two free-text lines.
- "unstructured": the whole address is one free-text blob with no clearly separable components at all.

Then extract these ISO 20022 fields: floorUnit, buildingNumber, streetName, townName, postalCode, countryCode (ISO 3166-1 alpha-2), countryName.
For each field, give your best real value if you can determine or reasonably infer it from context — do not leave a field null when a reasonable inference is possible from the text. Only use null when the input truly gives no basis to infer that field.

Also return "fieldIssues": an object whose keys are ONLY the field names above that have a problem (missing, ambiguous, or inferred rather than explicit), each mapped to a short (under 15 words) explanation of the problem and what would resolve it. Omit keys for fields with no issue.

Also return "confidence": an integer 0-100, your honest confidence in the overall structuring.

Respond with ONLY a JSON object with keys: addressFormat, floorUnit, buildingNumber, streetName, townName, postalCode, countryCode, countryName, confidence, fieldIssues.`,
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

    const nothingExtracted = FIELD_KEYS.every(
      (key) => structured[key] === null,
    );
    if (nothingExtracted) {
      throw new ConvexError(
        "Couldn't find an address in that text — check what you pasted.",
      );
    }

    const rawFieldIssues =
      obj.fieldIssues && typeof obj.fieldIssues === "object"
        ? (obj.fieldIssues as Record<string, unknown>)
        : {};
    const fieldIssues: Record<string, string> = {};
    for (const key of FIELD_KEYS) {
      const issue = rawFieldIssues[key];
      if (typeof issue === "string" && issue.trim()) {
        fieldIssues[key] = issue.trim();
      }
    }

    const addressFormatRaw = str(obj.addressFormat);
    const addressFormat: "structured" | "hybrid" | "unstructured" =
      addressFormatRaw === "structured" || addressFormatRaw === "hybrid"
        ? addressFormatRaw
        : "unstructured";

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
      Object.keys(fieldIssues).length > 0 ||
      structured.confidence < READY_CONFIDENCE_THRESHOLD
        ? "needs_review"
        : "ready";

    return {
      ...structured,
      missingRequiredFields,
      status,
      addressFormat,
      fieldIssues,
    };
  },
});
