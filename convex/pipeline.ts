import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";

// Duplicated from scan.ts (a "use node" file) rather than imported, to avoid
// pulling its Node-only dependencies (pdf-parse) into this module's bundle.
const KNOWN_SOURCE_URL =
  "https://static.developer.mastercard.com/content/fld-fraud-submission/uploads/instructions.pdf";

export const runMastercardPipeline = action({
  args: {},
  handler: async (ctx): Promise<unknown> => {
    try {
      const scanResult: { rawText: string; sourceUrl: string } = await ctx.runAction(
        api.scan.scanMastercard,
        {}
      );
      const fields: {
        title: string;
        scheme: string;
        urgency: string;
        deadline: string;
        deadlineDate: string | null;
        scope: string;
      } = await ctx.runAction(api.extract.extractFields, { rawText: scanResult.rawText });

      await ctx.runMutation(internal.circulars.create, {
        scheme: fields.scheme,
        title: fields.title,
        urgency: fields.urgency,
        deadline: fields.deadline,
        deadlineDate: fields.deadlineDate ?? null,
        scope: fields.scope,
        sourceUrl: scanResult.sourceUrl,
      });

      return fields;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await ctx.runMutation(internal.circulars.createFailedAttempt, {
        sourceUrl: KNOWN_SOURCE_URL,
        errorMessage,
      });
      return { failed: true, errorMessage };
    }
  },
});

const KNOWN_MADA_SOURCE_URL =
  "https://rulebook.sama.gov.sa/en/rules-dealing-e-commerce-payment-service-and-support-providers";

export const runMadaPipeline = action({
  args: {},
  handler: async (ctx): Promise<unknown> => {
    try {
      const scanResult: { rawText: string; sourceUrl: string } = await ctx.runAction(
        api.scanMada.scanMada,
        {}
      );
      const fields: {
        title: string;
        scheme: string;
        urgency: string;
        deadline: string;
        deadlineDate: string | null;
        scope: string;
      } = await ctx.runAction(api.extract.extractFields, { rawText: scanResult.rawText });

      // This scanner specifically monitors Mada-relevant circulars. SAMA (the
      // regulator) is who issues them, but the extractor reads the document's
      // own letterhead and returns "SAMA" as the scheme — accurate to the
      // text, but not what this product means by "scheme." Since this
      // pipeline's whole purpose is the Mada feed, and the circular is
      // substantively about Mada's own compliance/technical requirements,
      // override to "Mada" here rather than trust the generic extraction.
      await ctx.runMutation(internal.circulars.create, {
        scheme: "Mada",
        title: fields.title,
        urgency: fields.urgency,
        deadline: fields.deadline,
        deadlineDate: fields.deadlineDate ?? null,
        scope: fields.scope,
        sourceUrl: scanResult.sourceUrl,
      });

      return { ...fields, scheme: "Mada" };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await ctx.runMutation(internal.circulars.createFailedAttempt, {
        sourceUrl: KNOWN_MADA_SOURCE_URL,
        errorMessage,
      });
      return { failed: true, errorMessage };
    }
  },
});
