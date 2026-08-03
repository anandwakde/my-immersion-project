import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

// Actions can't touch ctx.db directly, so file metadata (including the
// sha256 Convex already computes for every stored file) has to be fetched
// through a query and handed back via ctx.runQuery.
export const getFileMetadata = internalQuery({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.db.system.get(args.storageId);
  },
});
