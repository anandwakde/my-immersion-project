"use node";

import { action } from "./_generated/server";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

// Uzcard hosts its own payment system rules PDF publicly on its own API
// subdomain — no login gate.
const UZCARD_RULES_URL =
  "https://api.uzcard.uz/wp-content/uploads/2024/10/ENG_Pravila_PC_UZCARD.pdf";

export const scanUzcard = action({
  args: {},
  handler: async () => {
    const res = await fetch(UZCARD_RULES_URL);
    if (!res.ok) {
      throw new Error(`Uzcard rules fetch failed: ${res.status}`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const parsed = await pdfParse(buffer);
    const rawText = parsed.text.slice(0, 20000).trim();

    return {
      source: "uzcard-rules",
      sourceUrl: UZCARD_RULES_URL,
      rawText,
    };
  },
});
