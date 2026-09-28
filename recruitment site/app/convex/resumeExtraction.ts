"use node";

import { ConvexError } from "convex/values";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";

// Shared by both the Netlink-format PDF converter and the resume parser
// (Milestone 2) — both need the same "get clean, complete text out of a
// résumé file" logic, so it lives here once instead of twice.

async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

// mammoth's text/HTML conversion only reads the document body — it silently
// ignores Word headers and footers. Many resume templates put the
// candidate's name (and title/contact line) in the header, which meant the
// AI never saw it and had to guess (producing wrong initials). Word stores
// headers as separate XML parts inside the .docx zip, so read them directly.
async function extractDocxHeaderText(buffer: Buffer): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const parts: string[] = [];
    for (const name of Object.keys(zip.files)) {
      if (!/^word\/header\d*\.xml$/.test(name)) continue;
      const xml = await zip.files[name]!.async("string");
      const text = [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
        .map((m) => m[1])
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (text) parts.push(text);
    }
    return parts.join("\n");
  } catch {
    return "";
  }
}

// mammoth's plain extractRawText() flattens Word tables into bare
// sequential lines with no row/column markers at all, which is why table
// content (e.g. a two-column "skill: tools" table, or a work-history table)
// was coming out as loose prose or bullets instead of a table. Its HTML
// conversion *does* preserve <table>/<tr>/<td> structure, so this walks
// that HTML and re-serializes it as plain text with explicit [TABLE]...
// [/TABLE] markers (pipe-separated cells) the AI prompt can recognize and
// preserve as an actual table, plus an @HEADING@ marker for paragraphs
// using a real Word heading style (a much more reliable section-boundary
// signal than guessing from capitalization).
function htmlToStructuredText(html: string): string {
  const doc = new DOMParser().parseFromString(`<root>${html}</root>`, "text/xml");
  const root = doc.documentElement;
  const lines: string[] = [];

  function textOf(node: Element): string {
    return (node.textContent ?? "").replace(/\s+/g, " ").trim();
  }

  // A table cell can itself contain several Word paragraphs (e.g. a resume
  // template that lays out "Client: X" / "Project: Y" / a long description
  // as separate paragraphs inside one cell). Collapsing that straight to
  // plain text with textOf() destroys the paragraph boundaries and turns it
  // into an unreadable run-on blob — which made the AI re-derive its own
  // (wrong) column structure from it and silently drop the parts that
  // didn't fit, rather than preserving the cell as-is. " ~ " marks a
  // paragraph break *within* one cell, distinct from the " | " that
  // separates cells, so the AI can tell the two apart.
  function cellText(node: Element): string {
    const paragraphs = node.getElementsByTagName("p");
    if (paragraphs.length > 1) {
      return Array.from({ length: paragraphs.length })
        .map((_, i) => textOf(paragraphs[i]!))
        .filter(Boolean)
        .join(" ~ ");
    }
    return textOf(node);
  }

  function walk(node: Element) {
    for (let i = 0; i < node.childNodes.length; i++) {
      const child = node.childNodes[i] as unknown as Element;
      if (child.nodeType !== 1) continue; // element nodes only
      const tag = child.tagName?.toLowerCase();
      if (tag === "table") {
        const rows = child.getElementsByTagName("tr");
        const cellRows: string[][] = [];
        for (let r = 0; r < rows.length; r++) {
          const cells = Array.from(rows[r]!.childNodes).filter(
            (n): n is Element =>
              (n as unknown as Element).nodeType === 1 &&
              /^t[dh]$/.test((n as unknown as Element).tagName?.toLowerCase() ?? ""),
          );
          cellRows.push(cells.map((c) => cellText(c)));
        }
        // Some resume templates use a table purely for page layout — e.g.
        // one row per job with a short metadata cell next to a cell that's
        // actually a full description-plus-bullets paragraph. Asking the AI
        // to preserve a >250-char cell as ONE table cell string proved
        // unreliable in practice: it tends to re-split that content into
        // extra spurious columns instead, mangling it. A real data table
        // (skills, work history, credits) has short, uniform cells, so a
        // long cell is a reliable signal this is a layout table — fall back
        // to plain flowing lines instead, which the AI already handles
        // correctly (it's how every non-tabular experience section in this
        // same resume gets its entries and bullets right).
        const isLayoutTable = cellRows.some((row) => row.some((cell) => cell.length > 250));
        if (isLayoutTable) {
          // Mark each row's first cell as an @ENTRY@ block — the same
          // reliable, unambiguous marker used for real headings — so this
          // reads exactly like the other (unmarked-table) experience
          // sections in the resume that the AI already reproduces
          // faithfully, instead of a repeated label/value pattern it might
          // otherwise mistake for tabular data and try to compress.
          for (const row of cellRows) {
            if (row.length === 0) continue;
            const [firstCell, ...restCells] = row;
            const firstParagraphs = firstCell!.split(" ~ ").filter(Boolean);
            if (firstParagraphs.length) lines.push("@ENTRY@ " + firstParagraphs.join(" · "));
            for (const cell of restCells) {
              for (const paragraph of cell.split(" ~ ")) {
                if (paragraph) lines.push(paragraph);
              }
            }
            lines.push("");
          }
        } else {
          // State the exact shape up front — the model has been observed
          // mis-reading a table like "Domain | Temenos Transact (T24)" /
          // "Database | SQL, Oracle" / ... (7 rows, each a label-then-value
          // pair) as if the 7 labels were column headers for one wide row
          // instead, producing an absurdly wide, badly cut-off table. Since
          // the actual row/column count is already known here, state it
          // explicitly so the model has something concrete to check itself
          // against rather than inferring shape from repetition.
          const colCount = Math.max(1, ...cellRows.map((r) => r.length));
          lines.push(`[TABLE ${cellRows.length} ROWS x ${colCount} COLUMNS]`);
          for (const row of cellRows) lines.push(row.join(" | "));
          lines.push("[/TABLE]");
        }
      } else if (tag === "ul" || tag === "ol") {
        const items = child.getElementsByTagName("li");
        for (let li = 0; li < items.length; li++) {
          const t = textOf(items[li]!);
          if (t) lines.push("- " + t);
        }
      } else if (tag && /^h[1-6]$/.test(tag)) {
        const t = textOf(child);
        if (t) lines.push("@HEADING@ " + t);
      } else if (tag === "p") {
        const t = textOf(child);
        if (t) lines.push(t);
      } else {
        walk(child);
      }
    }
  }
  walk(root as unknown as Element);
  return lines.join("\n");
}

export const ALLOWED_RESUME_CONTENT_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

// Extracts clean text from a résumé file (PDF or .docx), including the
// document header if the file has one (a .docx's name/title/contact line
// often lives there rather than in the body — see extractDocxHeaderText
// above), truncated to maxLength. Throws a ConvexError for an unsupported
// format or a file with no extractable text (e.g. a scanned image).
export async function extractResumeText(
  buffer: Buffer,
  contentType: string | null,
  maxLength: number,
): Promise<string> {
  let resumeText: string;
  let headerText = "";
  if (contentType === "application/pdf") {
    resumeText = await extractPdfText(buffer);
  } else if (
    contentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await mammoth.convertToHtml({ buffer });
    resumeText = htmlToStructuredText(result.value);
    headerText = await extractDocxHeaderText(buffer);
  } else {
    throw new ConvexError(
      "This resume format can't be processed — only PDF and Word (.docx) resumes are supported. Legacy .doc files aren't.",
    );
  }

  resumeText = resumeText.trim();
  if (resumeText.length < 40) {
    throw new ConvexError(
      "Couldn't read any text from this resume — it may be a scanned image. Try a text-based PDF or Word doc instead.",
    );
  }
  if (resumeText.length > maxLength) {
    resumeText = resumeText.slice(0, maxLength);
  }
  if (headerText) {
    resumeText =
      `[DOCUMENT HEADER — the resume's document header (name/title/contact line), which wouldn't otherwise appear in the body text below. Use it only to help identify the candidate; never copy its contact details into any output.]\n${headerText}\n[END DOCUMENT HEADER]\n\n` +
      resumeText;
  }
  return resumeText;
}
