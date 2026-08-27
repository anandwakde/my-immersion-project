import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

const ALLOWED_RESUME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_RESUME_BYTES = 5 * 1024 * 1024;

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const create = mutation({
  args: {
    jobId: v.id("jobs"),
    name: v.string(),
    email: v.string(),
    phone: v.string(),
    linkedin: v.string(),
    resumeStorageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get("jobs", args.jobId);
    if (job === null || job.status !== "published") {
      await ctx.storage.delete(args.resumeStorageId);
      throw new ConvexError("This job is no longer accepting applications.");
    }

    const email = args.email.trim().toLowerCase();
    const existing = await ctx.db
      .query("applications")
      .withIndex("by_jobId_and_email", (q) => q.eq("jobId", args.jobId).eq("email", email))
      .unique();
    if (existing !== null) {
      await ctx.storage.delete(args.resumeStorageId);
      throw new ConvexError("You've already applied to this job with this email address.");
    }

    const resumeMeta = await ctx.db.system.get("_storage", args.resumeStorageId);
    if (
      resumeMeta === null ||
      resumeMeta.size > MAX_RESUME_BYTES ||
      (resumeMeta.contentType && !ALLOWED_RESUME_TYPES.includes(resumeMeta.contentType))
    ) {
      await ctx.storage.delete(args.resumeStorageId);
      throw new ConvexError("Resume must be a PDF or Word document under 5MB.");
    }

    const applicationId = await ctx.db.insert("applications", {
      ...args,
      email,
      status: "new",
    });
    return { applicationId };
  },
});

export const listForJob = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return [];
    }
    const job = await ctx.db.get("jobs", args.jobId);
    if (job === null || job.createdBy !== userId) {
      return [];
    }
    return await ctx.db
      .query("applications")
      .withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
      .order("desc")
      .take(200);
  },
});

export const get = query({
  args: { applicationId: v.id("applications") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }
    const application = await ctx.db.get("applications", args.applicationId);
    if (application === null) {
      return null;
    }
    const job = await ctx.db.get("jobs", application.jobId);
    if (job === null || job.createdBy !== userId) {
      return null;
    }
    const resumeUrl = await ctx.storage.getUrl(application.resumeStorageId);
    const netlinkResumeUrl = application.netlinkResumeStorageId
      ? await ctx.storage.getUrl(application.netlinkResumeStorageId)
      : null;
    return { ...application, resumeUrl, netlinkResumeUrl };
  },
});

export const getForConvert = internalQuery({
  args: { applicationId: v.id("applications") },
  returns: v.union(
    v.null(),
    v.object({
      name: v.string(),
      resumeStorageId: v.id("_storage"),
      resumeContentType: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }
    const application = await ctx.db.get("applications", args.applicationId);
    if (application === null) {
      return null;
    }
    const job = await ctx.db.get("jobs", application.jobId);
    if (job === null || job.createdBy !== userId) {
      return null;
    }
    const resumeMeta = await ctx.db.system.get("_storage", application.resumeStorageId);
    return {
      name: application.name,
      resumeStorageId: application.resumeStorageId,
      resumeContentType: resumeMeta?.contentType ?? null,
    };
  },
});

export const setNetlinkResume = internalMutation({
  args: {
    applicationId: v.id("applications"),
    netlinkResumeStorageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch("applications", args.applicationId, {
      netlinkResumeStorageId: args.netlinkResumeStorageId,
    });
  },
});

export const setStatus = mutation({
  args: {
    applicationId: v.id("applications"),
    status: v.union(v.literal("new"), v.literal("shortlisted"), v.literal("rejected")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("Must be signed in.");
    }
    const application = await ctx.db.get("applications", args.applicationId);
    if (application === null) {
      throw new ConvexError("Application not found.");
    }
    const job = await ctx.db.get("jobs", application.jobId);
    if (job === null || job.createdBy !== userId) {
      throw new ConvexError("Application not found.");
    }
    await ctx.db.patch("applications", args.applicationId, { status: args.status });
  },
});
