"use node";

import { action } from "./_generated/server";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

// Central Bank of Oman hosts OmanNet's own Operating Rules as a public PDF —
// no partner-portal login, this is the genuine source.
const OMANNET_RULES_URL =
  "https://cbo.gov.om/sites/assets/Documents/English/Publications/PaymentSystems/Book1GeneralRules.pdf";

export const scanOmanNet = action({
  args: {},
  handler: async () => {
    const res = await fetch(OMANNET_RULES_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    if (!res.ok) {
      throw new Error(`OmanNet rules fetch failed: ${res.status}`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const parsed = await pdfParse(buffer);
    const rawText = parsed.text.slice(0, 20000).trim();

    return {
      source: "cbo-omannet-rules",
      sourceUrl: OMANNET_RULES_URL,
      rawText,
    };
  },
});
