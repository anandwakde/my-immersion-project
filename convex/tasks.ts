import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const TEAMS = ["Product", "Engineering", "Ops", "Legal", "Bank"];

export const list = query({
  args: {},
  handler: async (ctx) => {
    const tasks = await ctx.db.query("tasks").take(200);
    const circulars = await ctx.db.query("circulars").take(200);
    const circularById = new Map(circulars.map((c) => [c._id, c]));

    return tasks.map((t) => {
      const circular = circularById.get(t.circularId);
      return {
        _id: t._id,
        team: t.team,
        deadline: t.deadline,
        status: t.status,
        circularTitle: circular?.title ?? "Unknown circular",
        circularScheme: circular?.scheme ?? "",
        circularUrgency: circular?.urgency ?? "",
        sourceUrl: circular?.sourceUrl ?? "",
      };
    });
  },
});

export const complete = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) {
      throw new Error("Task not found");
    }
    await ctx.db.patch(args.taskId, { status: "done" });
    await ctx.db.insert("auditLog", {
      circularId: task.circularId,
      taskId: args.taskId,
      action: "task_completed",
      detail: `${task.team} marked their task done`,
    });
  },
});

export const auditLog = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("auditLog").order("desc").take(100);
  },
});
