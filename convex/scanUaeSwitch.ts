import { action } from "./_generated/server";

// The UAE Central Bank's own public Rulebook page covers UAESWITCH/card
// scheme rules directly — no partner-portal login, this is the genuine
// source, same reasoning as the Mada/SAMA rulebook scanner.
const UAESWITCH_RULEBOOK_URL =
  "https://rulebook.centralbank.ae/en/rulebook/retail-payment-services-and-card-schemes-regulation";

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export const scanUaeSwitch = action({
  args: {},
  handler: async () => {
    const res = await fetch(UAESWITCH_RULEBOOK_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    if (!res.ok) {
      throw new Error(`UAESWITCH rulebook fetch failed: ${res.status}`);
    }
    const html = await res.text();
    const rawText = htmlToText(html).slice(0, 20000);

    return {
      source: "cbuae-rulebook-public",
      sourceUrl: UAESWITCH_RULEBOOK_URL,
      rawText,
    };
  },
});
