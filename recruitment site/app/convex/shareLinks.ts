import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

const EXPIRY_MS = 15 * 24 * 60 * 60 * 1000;

function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}

export const create = mutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("Must be signed in.");
    }
    const job = await ctx.db.get("jobs", args.jobId);
    if (job === null || job.createdBy !== userId) {
      throw new ConvexError("Job not found.");
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("shareLinks")
      .withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
      .order("desc")
      .first();
    if (existing !== null && existing.expiresAt > now) {
      return { token: existing.token, expiresAt: existing.expiresAt };
    }

    const token = generateToken();
    const expiresAt = now + EXPIRY_MS;
    await ctx.db.insert("shareLinks", {
      jobId: args.jobId,
      token,
      expiresAt,
      createdBy: userId,
    });
    return { token, expiresAt };
  },
});

export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("shareLinks")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (link === null || link.expiresAt < Date.now()) {
      return null;
    }
    const job = await ctx.db.get("jobs", link.jobId);
    if (job === null) {
      return null;
    }

    const applications = await ctx.db
      .query("applications")
      .withIndex("by_jobId", (q) => q.eq("jobId", link.jobId))
      .collect();

    const candidates = [];
    for (const app of applications) {
      if (app.status !== "shortlisted" || app.netlinkResumeStorageId === undefined) {
        continue;
      }
      const resumeUrl = await ctx.storage.getUrl(app.netlinkResumeStorageId);
      candidates.push({
        applicationId: app._id,
        label: app.netlinkResumeFileName?.replace(/\.docx$/i, "") ?? "Candidate",
        resumeUrl,
        clientStatus: app.clientStatus ?? null,
        clientRejectionReason: app.clientRejectionReason ?? null,
      });
    }

    return {
      jobTitle: job.title,
      expiresAt: link.expiresAt,
      candidates,
    };
  },
});

export const submitFeedback = mutation({
  args: {
    token: v.string(),
    applicationId: v.id("applications"),
    status: v.union(v.literal("accepted"), v.literal("rejected")),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("shareLinks")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (link === null || link.expiresAt < Date.now()) {
      throw new ConvexError("This review link has expired.");
    }

    const application = await ctx.db.get("applications", args.applicationId);
    if (application === null || application.jobId !== link.jobId) {
      throw new ConvexError("Candidate not found.");
    }
    if (application.status !== "shortlisted" || application.netlinkResumeStorageId === undefined) {
      throw new ConvexError("This candidate is not available for review.");
    }

    if (args.status === "rejected") {
      const reason = args.reason?.trim();
      if (!reason) {
        throw new ConvexError("A reason is required when rejecting a candidate.");
      }
      await ctx.db.patch("applications", args.applicationId, {
        clientStatus: "rejected",
        clientRejectionReason: reason,
        clientRespondedAt: Date.now(),
      });
    } else {
      await ctx.db.patch("applications", args.applicationId, {
        clientStatus: "accepted",
        clientRejectionReason: undefined,
        clientRespondedAt: Date.now(),
      });
    }
  },
});
