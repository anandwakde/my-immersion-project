"use node";

import { action } from "./_generated/server";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

const UNIONPAY_EEA_IRF_URL = "https://www.unionpayintl.com/en/Pricing/pdf/EEA%20IRF.pdf";

export const scanUnionPay = action({
  args: {},
  handler: async () => {
    const res = await fetch(UNIONPAY_EEA_IRF_URL);
    if (!res.ok) {
      throw new Error(`UnionPay EEA IRF fetch failed: ${res.status}`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const parsed = await pdfParse(buffer);

    return {
      source: "unionpay-public-irf",
      sourceUrl: UNIONPAY_EEA_IRF_URL,
      rawText: parsed.text,
    };
  },
});
