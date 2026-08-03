import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { TEAMS } from "./tasks";

export const create = internalMutation({
  args: {
    scheme: v.string(),
    title: v.string(),
    urgency: v.string(),
    deadline: v.string(),
    deadlineDate: v.optional(v.union(v.string(), v.null())),
    scope: v.string(),
    sourceUrl: v.string(),
    fileHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const circularId = await ctx.db.insert("circulars", args);

    await ctx.db.insert("auditLog", {
      circularId,
      action: "circular_ingested",
      detail: `"${args.title}" ingested from ${args.scheme} (${args.urgency})`,
    });

    for (const team of TEAMS) {
      const taskId = await ctx.db.insert("tasks", {
        circularId,
        team,
        deadline: args.deadlineDate ?? null,
        status: "open",
      });
      await ctx.db.insert("auditLog", {
        circularId,
        taskId,
        action: "task_created",
        detail: `Task created for ${team}`,
      });
    }

    return circularId;
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("circulars").order("desc").take(50);
  },
});

export const findByFileHash = query({
  args: { fileHash: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("circulars")
      .withIndex("by_file_hash", (q) => q.eq("fileHash", args.fileHash))
      .unique();
  },
});
