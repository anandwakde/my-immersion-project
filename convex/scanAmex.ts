"use node";

import { action } from "./_generated/server";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

const AMEX_MERCHANT_REGS_URL =
  "https://www.americanexpress.com/content/dam/amex/us/merchant/international-regulations/International-Regs-October-2024-vEN.pdf";

// The document is ~130 pages; only the Summary of Changes table at the very
// front (before the Table of Contents kicks in) is relevant circular
// content, so extract just that instead of feeding the whole rulebook to
// the AI extractor.
function extractSummaryOfChanges(fullText: string): string {
  const endIdx = fullText.indexOf("Table of Contents");
  if (endIdx === -1) {
    throw new Error("Could not locate the Table of Contents marker in the Amex Merchant Regulations PDF");
  }
  return fullText.slice(0, endIdx);
}

export const scanAmex = action({
  args: {},
  handler: async () => {
    const res = await fetch(AMEX_MERCHANT_REGS_URL);
    if (!res.ok) {
      throw new Error(`Amex merchant regulations fetch failed: ${res.status}`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const parsed = await pdfParse(buffer);
    const rawText = extractSummaryOfChanges(parsed.text);

    return {
      source: "amex-public-merchant-regulations",
      sourceUrl: AMEX_MERCHANT_REGS_URL,
      rawText,
    };
  },
});
