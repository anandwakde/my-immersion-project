"use node";

import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

// Below this length, treat the PDF as having no real text layer (i.e. a
// scanned image) and reject it rather than feeding near-empty text to the
// extractor.
const MIN_TEXT_LENGTH = 100;

export const processUpload = action({
  args: {
    storageId: v.id("_storage"),
    scheme: v.string(),
  },
  handler: async (ctx, args): Promise<unknown> => {
    const metadata: { sha256: string } | null = await ctx.runQuery(
      internal.uploads.getFileMetadata,
      { storageId: args.storageId }
    );
    if (!metadata) {
      throw new Error("Uploaded file not found");
    }
    const fileHash = metadata.sha256;

    const existing: { title: string; scheme: string } | null = await ctx.runQuery(
      api.circulars.findByFileHash,
      { fileHash }
    );
    if (existing) {
      throw new Error(
        `This exact file was already uploaded as "${existing.title}" (${existing.scheme}) — skipping duplicate.`
      );
    }

    const blob = await ctx.storage.get(args.storageId);
    if (!blob) {
      throw new Error("Uploaded file not found in storage");
    }
    const buffer = Buffer.from(await blob.arrayBuffer());

    let rawText = "";
    try {
      const parsed = await pdfParse(buffer);
      rawText = parsed.text.trim();
    } catch {
      rawText = "";
    }

    if (rawText.length < MIN_TEXT_LENGTH) {
      throw new Error(
        "Couldn't extract readable text from this PDF — it looks like a scanned image without a text layer. Please upload a text-based PDF instead."
      );
    }

    const fields: {
      title: string;
      urgency: string;
      deadline: string;
      deadlineDate: string | null;
      scope: string;
    } = await ctx.runAction(api.extract.extractFields, { rawText });

    const sourceUrl = await ctx.storage.getUrl(args.storageId);
    if (!sourceUrl) {
      throw new Error("Could not generate a source URL for the uploaded file");
    }

    await ctx.runMutation(internal.circulars.create, {
      scheme: args.scheme,
      title: fields.title,
      urgency: fields.urgency,
      deadline: fields.deadline,
      deadlineDate: fields.deadlineDate ?? null,
      scope: fields.scope,
      sourceUrl,
      fileHash,
    });

    return { ...fields, scheme: args.scheme };
  },
});
