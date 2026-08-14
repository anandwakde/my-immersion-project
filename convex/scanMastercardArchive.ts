"use node";

import { action } from "./_generated/server";
import { api } from "./_generated/api";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

// Real, publicly-hosted Mastercard Cross-Border Services bulletin PDFs,
// discovered by rendering developer.mastercard.com's bulletin-announcements
// page (a JS app) in a real browser and reading off the actual PDF links.
// Limited to 2024+ bulletins not already in the system (the Oct 2024 one is
// already ingested via scan.ts's fallback path).
const ARCHIVE_URLS = [
  "https://static.developer.mastercard.com/content/cross-border-services/uploads/March%202024%20Bulletin.pdf",
  "https://static.developer.mastercard.com/content/cross-border-services/uploads/April%202024%20Bulletin.pdf",
  "https://static.developer.mastercard.com/content/cross-border-services/uploads/April%202024%20Bulletin%20No.%202.pdf",
  "https://static.developer.mastercard.com/content/cross-border-services/uploads/August%202024%20Bulletin.pdf",
  "https://static.developer.mastercard.com/content/cross-border-services/uploads/September%202024%20Bulletin.pdf",
  "https://static.developer.mastercard.com/content/cross-border-services/uploads/November%202024%20Bulletin.pdf",
  "https://static.developer.mastercard.com/content/cross-border-services/uploads/December%202024%20Bulletin.pdf",
  "https://static.developer.mastercard.com/content/cross-border-services/uploads/December%202024%20Bulletin%20No.%202.pdf",
  "https://static.developer.mastercard.com/content/cross-border-services/uploads/February%202025%20Bulletin.pdf",
  "https://static.developer.mastercard.com/content/cross-border-services/uploads/February%202025%20Bulletin%20No.%202.pdf",
  "https://static.developer.mastercard.com/content/cross-border-services/uploads/February%202025%20Bulletin%20No.%203.pdf",
];

type ScanResult =
  | { url: string; ok: true; title: string }
  | { url: string; skipped: string }
  | { url: string; error: string };

export const scanArchive = action({
  args: {},
  handler: async (ctx): Promise<ScanResult[]> => {
    const results: ScanResult[] = [];

    for (const url of ARCHIVE_URLS) {
      try {
        const existing: { title: string } | null = await ctx.runQuery(
          api.circulars.findBySourceUrl,
          { sourceUrl: url }
        );
        if (existing) {
          results.push({ url, skipped: `already exists as "${existing.title}"` });
          continue;
        }

        const res = await fetch(url);
        if (!res.ok) {
          results.push({ url, error: `fetch failed: ${res.status}` });
          continue;
        }
        const buffer = Buffer.from(await res.arrayBuffer());
        const parsed = await pdfParse(buffer);
        const rawText = parsed.text.trim();
        if (rawText.length < 100) {
          results.push({ url, error: "no readable text in PDF" });
          continue;
        }

        const fields: {
          title: string;
          scheme: string;
          urgency: string;
          deadline: string;
          deadlineDate: string | null;
          scope: string;
        } = await ctx.runAction(api.extract.extractFields, { rawText });

        await ctx.runAction(api.ingest.ingestCircular, {
          scheme: fields.scheme,
          title: fields.title,
          urgency: fields.urgency,
          deadline: fields.deadline,
          deadlineDate: fields.deadlineDate ?? null,
          scope: fields.scope,
          sourceUrl: url,
        });

        results.push({ url, ok: true, title: fields.title });
      } catch (err) {
        results.push({ url, error: err instanceof Error ? err.message : String(err) });
      }
    }

    return results;
  },
});
