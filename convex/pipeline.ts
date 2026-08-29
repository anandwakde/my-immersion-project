import { action } from "./_generated/server";
import { api } from "./_generated/api";

export const runMastercardPipeline = action({
  args: {},
  handler: async (ctx): Promise<unknown> => {
    const scanResult: { rawText: string; sourceUrl: string } = await ctx.runAction(
      api.scan.scanMastercard,
      {}
    );

    const existing: { title: string } | null = await ctx.runQuery(api.circulars.findBySourceUrl, {
      sourceUrl: scanResult.sourceUrl,
    });
    if (existing) {
      return { skipped: `already exists as "${existing.title}"` };
    }

    const fields: {
      title: string;
      scheme: string;
      urgency: string;
      deadline: string;
      deadlineDate: string | null;
      scope: string;
    } = await ctx.runAction(api.extract.extractFields, { rawText: scanResult.rawText });

    await ctx.runAction(api.ingest.ingestCircular, {
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

    const existing: { title: string } | null = await ctx.runQuery(api.circulars.findBySourceUrl, {
      sourceUrl: scanResult.sourceUrl,
    });
    if (existing) {
      return { skipped: `already exists as "${existing.title}"` };
    }

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
    await ctx.runAction(api.ingest.ingestCircular, {
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

    const existing: { title: string } | null = await ctx.runQuery(api.circulars.findBySourceUrl, {
      sourceUrl: scanResult.sourceUrl,
    });
    if (existing) {
      return { skipped: `already exists as "${existing.title}"` };
    }

    const fields: {
      title: string;
      scheme: string;
      urgency: string;
      deadline: string;
      deadlineDate: string | null;
      scope: string;
    } = await ctx.runAction(api.extract.extractFields, { rawText: scanResult.rawText });

    await ctx.runAction(api.ingest.ingestCircular, {
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

    const existing: { title: string } | null = await ctx.runQuery(api.circulars.findBySourceUrl, {
      sourceUrl: scanResult.sourceUrl,
    });
    if (existing) {
      return { skipped: `already exists as "${existing.title}"` };
    }

    const fields: {
      title: string;
      scheme: string;
      urgency: string;
      deadline: string;
      deadlineDate: string | null;
      scope: string;
    } = await ctx.runAction(api.extract.extractFields, { rawText: scanResult.rawText });

    await ctx.runAction(api.ingest.ingestCircular, {
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

    const existing: { title: string } | null = await ctx.runQuery(api.circulars.findBySourceUrl, {
      sourceUrl: scanResult.sourceUrl,
    });
    if (existing) {
      return { skipped: `already exists as "${existing.title}"` };
    }

    const fields: {
      title: string;
      scheme: string;
      urgency: string;
      deadline: string;
      deadlineDate: string | null;
      scope: string;
    } = await ctx.runAction(api.extract.extractFields, { rawText: scanResult.rawText });

    await ctx.runAction(api.ingest.ingestCircular, {
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

export const runOmanNetPipeline = action({
  args: {},
  handler: async (ctx): Promise<unknown> => {
    const scanResult: { rawText: string; sourceUrl: string } = await ctx.runAction(
      api.scanOmanNet.scanOmanNet,
      {}
    );

    const existing: { title: string } | null = await ctx.runQuery(api.circulars.findBySourceUrl, {
      sourceUrl: scanResult.sourceUrl,
    });
    if (existing) {
      return { skipped: `already exists as "${existing.title}"` };
    }

    const fields: {
      title: string;
      scheme: string;
      urgency: string;
      deadline: string;
      deadlineDate: string | null;
      scope: string;
    } = await ctx.runAction(api.extract.extractFields, { rawText: scanResult.rawText });

    await ctx.runAction(api.ingest.ingestCircular, {
      scheme: "OmanNet",
      title: fields.title,
      urgency: fields.urgency,
      deadline: fields.deadline,
      deadlineDate: fields.deadlineDate ?? null,
      scope: fields.scope,
      sourceUrl: scanResult.sourceUrl,
    });

    return { ...fields, scheme: "OmanNet" };
  },
});

export const runUzcardPipeline = action({
  args: {},
  handler: async (ctx): Promise<unknown> => {
    const scanResult: { rawText: string; sourceUrl: string } = await ctx.runAction(
      api.scanUzcard.scanUzcard,
      {}
    );

    const existing: { title: string } | null = await ctx.runQuery(api.circulars.findBySourceUrl, {
      sourceUrl: scanResult.sourceUrl,
    });
    if (existing) {
      return { skipped: `already exists as "${existing.title}"` };
    }

    const fields: {
      title: string;
      scheme: string;
      urgency: string;
      deadline: string;
      deadlineDate: string | null;
      scope: string;
    } = await ctx.runAction(api.extract.extractFields, { rawText: scanResult.rawText });

    await ctx.runAction(api.ingest.ingestCircular, {
      scheme: "Uzcard",
      title: fields.title,
      urgency: fields.urgency,
      deadline: fields.deadline,
      deadlineDate: fields.deadlineDate ?? null,
      scope: fields.scope,
      sourceUrl: scanResult.sourceUrl,
    });

    return { ...fields, scheme: "Uzcard" };
  },
});

export const runEpiWeroPipeline = action({
  args: {},
  handler: async (ctx): Promise<unknown> => {
    const scanResult: { rawText: string; sourceUrl: string } = await ctx.runAction(
      api.scanEpiWero.scanEpiWero,
      {}
    );

    const existing: { title: string } | null = await ctx.runQuery(api.circulars.findBySourceUrl, {
      sourceUrl: scanResult.sourceUrl,
    });
    if (existing) {
      return { skipped: `already exists as "${existing.title}"` };
    }

    const fields: {
      title: string;
      scheme: string;
      urgency: string;
      deadline: string;
      deadlineDate: string | null;
      scope: string;
    } = await ctx.runAction(api.extract.extractFields, { rawText: scanResult.rawText });

    await ctx.runAction(api.ingest.ingestCircular, {
      scheme: "EPI / Wero",
      title: fields.title,
      urgency: fields.urgency,
      deadline: fields.deadline,
      deadlineDate: fields.deadlineDate ?? null,
      scope: fields.scope,
      sourceUrl: scanResult.sourceUrl,
    });

    return { ...fields, scheme: "EPI / Wero" };
  },
});

export const runUaeSwitchPipeline = action({
  args: {},
  handler: async (ctx): Promise<unknown> => {
    const scanResult: { rawText: string; sourceUrl: string } = await ctx.runAction(
      api.scanUaeSwitch.scanUaeSwitch,
      {}
    );

    const existing: { title: string } | null = await ctx.runQuery(api.circulars.findBySourceUrl, {
      sourceUrl: scanResult.sourceUrl,
    });
    if (existing) {
      return { skipped: `already exists as "${existing.title}"` };
    }

    const fields: {
      title: string;
      scheme: string;
      urgency: string;
      deadline: string;
      deadlineDate: string | null;
      scope: string;
    } = await ctx.runAction(api.extract.extractFields, { rawText: scanResult.rawText });

    await ctx.runAction(api.ingest.ingestCircular, {
      scheme: "UAESWITCH",
      title: fields.title,
      urgency: fields.urgency,
      deadline: fields.deadline,
      deadlineDate: fields.deadlineDate ?? null,
      scope: fields.scope,
      sourceUrl: scanResult.sourceUrl,
    });

    return { ...fields, scheme: "UAESWITCH" };
  },
});

export const runKnetPipeline = action({
  args: {},
  handler: async (ctx): Promise<unknown> => {
    const scanResult: { rawText: string; sourceUrl: string } = await ctx.runAction(
      api.scanKnet.scanKnet,
      {}
    );

    const existing: { title: string } | null = await ctx.runQuery(api.circulars.findBySourceUrl, {
      sourceUrl: scanResult.sourceUrl,
    });
    if (existing) {
      return { skipped: `already exists as "${existing.title}"` };
    }

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
    await ctx.runAction(api.ingest.ingestCircular, {
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
