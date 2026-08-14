import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";

// Every scanner/pipeline/upload path calls this instead of
// internal.circulars.create directly, so that saving a new circular and
// alerting its scheme's subscribers always happen together, in one place.
export const ingestCircular = action({
  args: {
    scheme: v.string(),
    title: v.string(),
    urgency: v.string(),
    deadline: v.string(),
    deadlineDate: v.union(v.string(), v.null()),
    scope: v.string(),
    sourceUrl: v.string(),
    fileHash: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<unknown> => {
    await ctx.runMutation(internal.circulars.create, args);

    return await ctx.runAction(api.circularAlert.sendCircularAlert, {
      scheme: args.scheme,
      title: args.title,
      urgency: args.urgency,
      deadline: args.deadline,
      scope: args.scope,
      sourceUrl: args.sourceUrl,
    });
  },
});
