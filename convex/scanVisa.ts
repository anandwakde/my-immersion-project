"use node";

import { action } from "./_generated/server";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

const VISA_RULES_URL = "https://usa.visa.com/dam/VCOM/download/about-visa/visa-rules-public.pdf";

// This public PDF is Visa's full global rulebook (~900 pages). Only the
// "Summary of Changes" section — recent rule changes across every region,
// including CEMEA — is relevant circular content, so extract just that
// section rather than feeding the whole rulebook to the AI extractor. The
// section appears twice (once in the table of contents, once as the real
// body); the real body is the one followed by "This section provides an
// overview", so search for that specifically.
function extractSummaryOfChanges(fullText: string): string {
  const startMarker = "Summary of Changes since the";
  let idx = -1;
  let startIdx = -1;
  while (true) {
    idx = fullText.indexOf(startMarker, idx + 1);
    if (idx === -1) break;
    if (fullText.slice(idx, idx + 400).includes("This section provides an overview")) {
      startIdx = idx;
      break;
    }
  }
  if (startIdx === -1) {
    throw new Error("Could not locate the Summary of Changes body section in the Visa Rules PDF");
  }

  let endIdx = -1;
  let searchFrom = startIdx + 3000;
  while (true) {
    searchFrom = fullText.indexOf("The Visa Rules", searchFrom + 1);
    if (searchFrom === -1) break;
    if (fullText.slice(searchFrom - 30, searchFrom).includes("Introduction")) {
      endIdx = searchFrom;
      break;
    }
  }

  return fullText.slice(startIdx, endIdx !== -1 ? endIdx : startIdx + 40000);
}

export const scanVisa = action({
  args: {},
  handler: async () => {
    const res = await fetch(VISA_RULES_URL);
    if (!res.ok) {
      throw new Error(`Visa rules fetch failed: ${res.status}`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const parsed = await pdfParse(buffer);
    const rawText = extractSummaryOfChanges(parsed.text);

    return {
      source: "visa-public-rules",
      sourceUrl: VISA_RULES_URL,
      rawText,
    };
  },
});
