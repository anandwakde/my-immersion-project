"use node";

import { action } from "./_generated/server";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

const MASTERCARD_PARTNER_PORTAL_URL = "https://connect.mastercard.com/";
const FALLBACK_CIRCULAR_URL =
  "https://static.developer.mastercard.com/content/fld-fraud-submission/uploads/instructions.pdf";

export const scanMastercard = action({
  args: {},
  handler: async () => {
    let portalAttempt: { attempted: string; failed: boolean; reason: string };

    try {
      const portalRes = await fetch(MASTERCARD_PARTNER_PORTAL_URL, { redirect: "follow" });
      const contentType = portalRes.headers.get("content-type") || "";
      if (!contentType.includes("pdf")) {
        throw new Error(
          `Portal returned ${portalRes.status} with content-type "${contentType}" — not a circular. This is the real authenticated Mastercard Connect portal; it requires a login we don't have.`
        );
      }
      portalAttempt = { attempted: MASTERCARD_PARTNER_PORTAL_URL, failed: false, reason: "" };
    } catch (err) {
      portalAttempt = {
        attempted: MASTERCARD_PARTNER_PORTAL_URL,
        failed: true,
        reason: err instanceof Error ? err.message : String(err),
      };
    }

    const fallbackRes = await fetch(FALLBACK_CIRCULAR_URL);
    if (!fallbackRes.ok) {
      throw new Error(`Fallback circular fetch failed: ${fallbackRes.status}`);
    }
    const buffer = Buffer.from(await fallbackRes.arrayBuffer());
    const parsed = await pdfParse(buffer);

    return {
      portalAttempt,
      source: "open-web-fallback",
      sourceUrl: FALLBACK_CIRCULAR_URL,
      pageCount: parsed.numpages,
      rawText: parsed.text,
    };
  },
});
