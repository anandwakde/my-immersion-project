"use node";

import { action } from "./_generated/server";
import { api } from "./_generated/api";
import ExcelJS from "exceljs";

// Unlike every other scanner, this is a real, public, monthly-updated
// Mastercard-maintained spreadsheet (not a PDF) that already has its own
// structured Action Indicator (Mandated/Optional/Informational) and
// Effective Date columns — no AI extraction needed, the ground truth is
// already there. Full announcement text still lives behind Mastercard
// Connect login, but this index itself is openly hosted.
const SEND_ANNOUNCEMENTS_URL =
  "https://static.developer.mastercard.com/content/mastercard-send/uploads/Announcements_Spreadsheet.xlsx";
const SHEET_NAME = "Send Announcements";
const MAX_ROWS = 10;

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatDate(d: Date): string {
  return `${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function normalizeUrgency(actionIndicator: string): string {
  const v = actionIndicator.trim().toLowerCase();
  if (v === "mandated") return "mandatory";
  if (v === "optional") return "optional";
  return "informational";
}

type ScanResult =
  | { title: string; ok: true }
  | { title: string; skipped: string }
  | { title: string; error: string };

export const scanSendAnnouncements = action({
  args: {},
  handler: async (ctx): Promise<ScanResult[]> => {
    const res = await fetch(SEND_ANNOUNCEMENTS_URL);
    if (!res.ok) {
      throw new Error(`Mastercard Send announcements fetch failed: ${res.status}`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.getWorksheet(SHEET_NAME);
    if (!sheet) {
      throw new Error(`Could not find the "${SHEET_NAME}" sheet in the announcements spreadsheet`);
    }

    // Row 1 is the merged section header, row 2 is the real column header,
    // real data starts at row 3. Columns (1-indexed): A=Region, B=Number,
    // C=Title, D=Summary, E=Use Case, F=MIP Category, G=MIP Impact,
    // H=API Impact, I=Action Indicator, J=Publication Date, K=Effective Date.
    const results: ScanResult[] = [];
    let processed = 0;

    for (let rowNumber = 3; rowNumber <= sheet.rowCount && processed < MAX_ROWS; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      // The Title column is a hyperlink cell in the source spreadsheet
      // ({ text, hyperlink }), not a plain string — .text handles that.
      const title = row.getCell(3).text.trim();
      if (!title) continue;

      const effectiveRaw = row.getCell(11).value;
      const effectiveDate = effectiveRaw instanceof Date ? effectiveRaw : null;
      if (!effectiveDate) continue;

      processed++;
      const sourceUrl = `${SEND_ANNOUNCEMENTS_URL}#${String(row.getCell(2).value ?? rowNumber)}`;

      try {
        const existing: { title: string } | null = await ctx.runQuery(
          api.circulars.findBySourceUrl,
          { sourceUrl }
        );
        if (existing) {
          results.push({ title, skipped: "already exists" });
          continue;
        }

        const region = String(row.getCell(1).value ?? "Global").trim();
        const actionIndicator = String(row.getCell(9).value ?? "").trim();

        await ctx.runAction(api.ingest.ingestCircular, {
          scheme: "Mastercard",
          title,
          urgency: normalizeUrgency(actionIndicator),
          deadline: formatDate(effectiveDate),
          deadlineDate: toIsoDate(effectiveDate),
          scope: region,
          sourceUrl,
        });

        results.push({ title, ok: true });
      } catch (err) {
        results.push({ title, error: err instanceof Error ? err.message : String(err) });
      }
    }

    return results;
  },
});
