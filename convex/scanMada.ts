import { action } from "./_generated/server";

const MADA_CIRCULAR_URL =
  "https://rulebook.sama.gov.sa/en/rules-dealing-e-commerce-payment-service-and-support-providers";

// Unlike Visa/Mastercard, SAMA's Rulebook is the real, official, publicly
// readable source for Mada-relevant circulars — there is no separate
// authenticated partner portal gating this content, so there's no portal
// attempt to make here; this IS the genuine source, fetched directly.
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

export const scanMada = action({
  args: {},
  handler: async () => {
    const res = await fetch(MADA_CIRCULAR_URL);
    if (!res.ok) {
      throw new Error(`Mada circular fetch failed: ${res.status}`);
    }
    const html = await res.text();
    const rawText = htmlToText(html);

    return {
      source: "sama-rulebook-public",
      sourceUrl: MADA_CIRCULAR_URL,
      rawText,
    };
  },
});
