"use node";

import { action } from "./_generated/server";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

const AMEX_MERCHANT_REGS_URL =
  "https://www.americanexpress.com/content/dam/amex/us/merchant/international-regulations/International-Regs-October-2024-vEN.pdf";

// The document is ~130 pages. The front-matter "Summary of Changes" table
// only lists chapter/section descriptions with no per-item date, but the
// "Notification of Changes" section further in has a real per-item
// "Effective Date | Subject | Description of change" table — that's the
// substantive, dated circular content, so extract that instead. The
// heading recurs once per chapter; use the first occurrence (skipping the
// table-of-contents mention), confirmed by the "Notification of Current
// Changes" subheading that immediately follows it in the real body.
function extractNotificationOfChanges(fullText: string): string {
  const marker = "Notification of Changes";
  let idx = -1;
  let startIdx = -1;
  while (true) {
    idx = fullText.indexOf(marker, idx + 1);
    if (idx === -1) break;
    if (fullText.slice(idx, idx + 250).includes("Notification of Current Changes")) {
      startIdx = idx;
      break;
    }
  }
  if (startIdx === -1) {
    throw new Error("Could not locate the Notification of Changes body section in the Amex Merchant Regulations PDF");
  }

  const endIdx = fullText.indexOf("This chapter represents current and future changes", startIdx);
  return fullText.slice(startIdx, endIdx !== -1 ? endIdx : startIdx + 2000);
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
    const rawText = extractNotificationOfChanges(parsed.text);

    return {
      source: "amex-public-merchant-regulations",
      sourceUrl: AMEX_MERCHANT_REGS_URL,
      rawText,
    };
  },
});
