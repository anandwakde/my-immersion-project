import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";

export const runMastercardPipeline = action({
  args: {},
  handler: async (ctx): Promise<unknown> => {
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
  },
});

export const runMadaPipeline = action({
  args: {},
  handler: async (ctx): Promise<unknown> => {
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
  },
});

export const runVisaPipeline = action({
  args: {},
  handler: async (ctx): Promise<unknown> => {
    const scanResult: { rawText: string; sourceUrl: string } = await ctx.runAction(
      api.scanVisa.scanVisa,
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
      scheme: "Visa",
      title: fields.title,
      urgency: fields.urgency,
      deadline: fields.deadline,
      deadlineDate: fields.deadlineDate ?? null,
      scope: fields.scope,
      sourceUrl: scanResult.sourceUrl,
    });

    return { ...fields, scheme: "Visa" };
  },
});

export const runAmexPipeline = action({
  args: {},
  handler: async (ctx): Promise<unknown> => {
    const scanResult: { rawText: string; sourceUrl: string } = await ctx.runAction(
      api.scanAmex.scanAmex,
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
      scheme: "American Express",
      title: fields.title,
      urgency: fields.urgency,
      deadline: fields.deadline,
      deadlineDate: fields.deadlineDate ?? null,
      scope: fields.scope,
      sourceUrl: scanResult.sourceUrl,
    });

    return { ...fields, scheme: "American Express" };
  },
});

export const runUnionPayPipeline = action({
  args: {},
  handler: async (ctx): Promise<unknown> => {
    const scanResult: { rawText: string; sourceUrl: string } = await ctx.runAction(
      api.scanUnionPay.scanUnionPay,
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
      scheme: "UnionPay",
      title: fields.title,
      urgency: fields.urgency,
      deadline: fields.deadline,
      deadlineDate: fields.deadlineDate ?? null,
      scope: fields.scope,
      sourceUrl: scanResult.sourceUrl,
    });

    return { ...fields, scheme: "UnionPay" };
  },
});

export const runKnetPipeline = action({
  args: {},
  handler: async (ctx): Promise<unknown> => {
    const scanResult: { rawText: string; sourceUrl: string } = await ctx.runAction(
      api.scanKnet.scanKnet,
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

    // This circular's own letterhead is the Central Bank of Kuwait (the
    // regulator issuing it), but the pipeline specifically monitors KNET —
    // the circular is substantively about linking to KNET's "Instant
    // Payment" service, so override to "KNET" rather than trust the
    // generic extraction, same reasoning as the Mada pipeline above.
    await ctx.runMutation(internal.circulars.create, {
      scheme: "KNET",
      title: fields.title,
      urgency: fields.urgency,
      deadline: fields.deadline,
      deadlineDate: fields.deadlineDate ?? null,
      scope: fields.scope,
      sourceUrl: scanResult.sourceUrl,
    });

    return { ...fields, scheme: "KNET" };
  },
});
