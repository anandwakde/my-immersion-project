"use node";

import { action } from "./_generated/server";
import { api } from "./_generated/api";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

// Visa's own "VisaNet Business Enhancements Global Technical Letter and
// Implementation Guide" (published twice a year, bundles all of Visa's
// circulars/mandates for that period) is gated behind Visa Online — no
// public URL exists for it (confirmed: several plausible direct-guess URLs
// on visa.com all 404, and every real mention found says access is via
// Visa Online or "contact your Visa representative").
//
// DECTA, a payment processor, publishes real, public release notes each
// cycle that substantively summarize the actual GTLIG content — specific
// mandatory changes, real dates — for their own customers. This is a
// legitimate real source, but it is DECTA's characterization of Visa's
// document, not the primary source itself, so every circular from this
// scanner is labeled "(via DECTA — third-party summary)" in its title so
// that's never mistaken for Visa's own publication.
const ARCHIVE_URLS = [
  "https://acquiring.decta.com/pdf/CS_2024_SpringReleaseNotes.pdf",
  "https://acquiring.decta.com/pdf/CS_2024_AutumnReleaseNotes.pdf",
  "https://acquiring.decta.com/pdf/CS_2025_SpringReleaseNotes.pdf",
  "https://acquiring.decta.com/pdf/CS_2025_AutumnReleaseNotes.pdf",
  "https://acquiring.decta.com/pdf/CS_2026_SpringReleaseNotes.pdf",
];

const SCOPE_INSTRUCTION =
  'NOTE: This document covers Visa, Mastercard, and UnionPay changes together in one release-notes document from a third-party payment processor (DECTA), summarizing official card scheme changes for their own customers. Only extract information about a VISA-specific change; completely ignore any Mastercard or UnionPay sections. IMPORTANT: near the top of this document there is a general reference like "...Global Technical Letter and Implementation Guide, Effective: [date]" — that is the publication/reference date of the whole parent document, NOT the effective date of any specific change. Each individual numbered change item (e.g. 1.1, 2.1) states its OWN effective timing in its own paragraph (e.g. "Effective with the October 2026 release...") — use THAT item-specific date, never the parent document reference date.\n\n';

type ScanResult =
  | { url: string; ok: true; title: string }
  | { url: string; skipped: string }
  | { url: string; error: string };

export const scanVisaDecta = action({
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
          urgency: string;
          deadline: string;
          deadlineDate: string | null;
          scope: string;
        } = await ctx.runAction(api.extract.extractFields, {
          rawText: SCOPE_INSTRUCTION + rawText,
        });

        const title = `${fields.title} (via DECTA — third-party summary)`;

        await ctx.runAction(api.ingest.ingestCircular, {
          scheme: "Visa",
          title,
          urgency: fields.urgency,
          deadline: fields.deadline,
          deadlineDate: fields.deadlineDate ?? null,
          scope: fields.scope,
          sourceUrl: url,
        });

        results.push({ url, ok: true, title });
      } catch (err) {
        results.push({ url, error: err instanceof Error ? err.message : String(err) });
      }
    }

    return results;
  },
});
