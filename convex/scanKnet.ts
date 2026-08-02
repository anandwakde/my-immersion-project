"use node";

import { action } from "./_generated/server";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

const CBK_EPAYMENT_CIRCULARS_URL =
  "https://www.cbk.gov.kw/en/images/epayment-chap2-152798_v120_tcm10-152798.pdf";

// This Central Bank of Kuwait PDF is a compendium of ~25 different circulars
// covering all e-payment providers, not just KNET. Only Circular No.
// (2/BS, IBS/546/2024) — the "Instant Payment" project circular that
// specifically names KNET (Kuwait's Shared Electronic Banking Services
// Company) — is relevant here, so isolate just that circular's body text
// rather than feeding the AI extractor the whole 66-page compendium. The
// marker string also appears earlier in the document's own table of
// contents, so search for the occurrence immediately followed by "THE
// GOVERNOR", which only appears in the real circular body.
function extractKnetCircular(fullText: string): string {
  const marker = "Circular No. (2/BS, IBS /546/2024)";
  let idx = -1;
  let startIdx = -1;
  while (true) {
    idx = fullText.indexOf(marker, idx + 1);
    if (idx === -1) break;
    if (fullText.slice(idx, idx + 300).includes("THE GOVERNOR")) {
      startIdx = idx;
      break;
    }
  }
  if (startIdx === -1) {
    throw new Error("Could not locate the KNET Instant Payment circular body in the CBK compendium");
  }

  const endIdx = fullText.indexOf("CHAPTER TWO", startIdx + 100);
  return fullText.slice(startIdx, endIdx !== -1 ? endIdx : startIdx + 2000);
}

export const scanKnet = action({
  args: {},
  handler: async () => {
    const res = await fetch(CBK_EPAYMENT_CIRCULARS_URL);
    if (!res.ok) {
      throw new Error(`CBK e-payment circulars fetch failed: ${res.status}`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const parsed = await pdfParse(buffer);
    const rawText = extractKnetCircular(parsed.text);

    return {
      source: "cbk-epayment-circulars",
      sourceUrl: CBK_EPAYMENT_CIRCULARS_URL,
      rawText,
    };
  },
});
