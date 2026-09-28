import { v } from "convex/values";
import { mutation, MutationCtx, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

// Every recruiter is a shared-inbox member (see listAll in jobs.ts), so a
// bell notification goes to every recruiter account that is allowed to sign
// in — i.e. everyone except accounts still pending or rejected by the admin.
export async function notifyRecruiters(ctx: MutationCtx, n: { title: string; body: string; link: string }) {
  const users = await ctx.db.query("users").take(200);
  const now = Date.now();
  for (const user of users) {
    const profile = await ctx.db
      .query("recruiterProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();
    if (profile !== null && profile.status !== "approved") continue;
    await ctx.db.insert("notifications", { userId: user._id, ...n, createdAt: now, read: false });
  }
}

// The email address to notify about a specific job — whoever posted it.
export async function jobOwnerEmail(ctx: MutationCtx, createdBy: Id<"users">): Promise<string | null> {
  const user = await ctx.db.get("users", createdBy);
  return user?.email ?? null;
}

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { items: [], unread: 0 };
    const items = await ctx.db
      .query("notifications")
      .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(30);
    const unreadRows = await ctx.db
      .query("notifications")
      .withIndex("by_userId_and_read", (q) => q.eq("userId", userId).eq("read", false))
      .take(100);
    return { items, unread: unreadRows.length };
  },
});

export const markRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return;
    const n = await ctx.db.get("notifications", args.notificationId);
    if (n === null || n.userId !== userId) return;
    await ctx.db.patch("notifications", args.notificationId, { read: true });
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return;
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_userId_and_read", (q) => q.eq("userId", userId).eq("read", false))
      .take(200);
    for (const n of unread) {
      await ctx.db.patch("notifications", n._id, { read: true });
    }
  },
});
