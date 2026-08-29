"use node";

import { action } from "./_generated/server";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

// Wero's (the European Payments Initiative's wallet scheme) terms &
// conditions are hosted publicly by EPI itself — no login gate.
const WERO_TCS_URL = "https://static.weropay.eu/legal/v1/wero-tcs-en.pdf";

export const scanEpiWero = action({
  args: {},
  handler: async () => {
    const res = await fetch(WERO_TCS_URL);
    if (!res.ok) {
      throw new Error(`EPI / Wero terms fetch failed: ${res.status}`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const parsed = await pdfParse(buffer);
    const rawText = parsed.text.slice(0, 20000).trim();

    return {
      source: "epi-wero-tcs",
      sourceUrl: WERO_TCS_URL,
      rawText,
    };
  },
});
