import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation, query, QueryCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";
import { resolveRejected } from "./applicationStage";
import { buildSearchText } from "./candidates";

const ALLOWED_RESUME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_RESUME_BYTES = 5 * 1024 * 1024;

// Merges in the referenced candidate's contact fields for the frontend,
// which still reads name/email/phone/linkedin directly on the application
// object rather than making a second round trip to `candidates`. Also folds
// in the application's match score (Milestone 3), if one has been
// computed, so both the ranked list and the Kanban board (Milestone 4) can
// share this one query instead of each fetching matches separately.
async function withCandidate(ctx: QueryCtx, application: Doc<"applications">) {
  const candidate = await ctx.db.get("candidates", application.candidateId);
  const match = await ctx.db
    .query("matches")
    .withIndex("by_applicationId", (q) => q.eq("applicationId", application._id))
    .unique();
  return {
    ...application,
    name: candidate?.name ?? "Unknown",
    email: candidate?.email ?? "",
    phone: candidate?.phone ?? "",
    linkedin: candidate?.linkedin ?? "",
    rejected: resolveRejected(application),
    matchScore: match?.score ?? null,
  };
}

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

    const existingCandidate = await ctx.db
      .query("candidates")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    const candidateId =
      existingCandidate?._id ??
      (await ctx.db.insert("candidates", {
        name: args.name,
        email,
        phone: args.phone,
        linkedin: args.linkedin,
        searchText: buildSearchText(args.name),
      }));

    const existingApplication = await ctx.db
      .query("applications")
      .withIndex("by_jobId_and_candidateId", (q) => q.eq("jobId", args.jobId).eq("candidateId", candidateId))
      .unique();
    if (existingApplication !== null) {
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
      jobId: args.jobId,
      candidateId,
      resumeStorageId: args.resumeStorageId,
      stage: "applied",
    });
    return { applicationId };
  },
});

export const listForJob = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    // Any signed-in recruiter can see any job's applicants — see listAll in jobs.ts.
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return [];
    }
    const applications = await ctx.db
      .query("applications")
      .withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
      .order("desc")
      .take(200);
    return await Promise.all(applications.map((a) => withCandidate(ctx, a)));
  },
});

export const get = query({
  args: { applicationId: v.id("applications") },
  handler: async (ctx, args) => {
    // Any signed-in recruiter can see any application — see listAll in jobs.ts.
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }
    const application = await ctx.db.get("applications", args.applicationId);
    if (application === null) {
      return null;
    }
    const enriched = await withCandidate(ctx, application);
    const resumeUrl = await ctx.storage.getUrl(application.resumeStorageId);
    const netlinkResumeUrl = application.netlinkResumeStorageId
      ? await ctx.storage.getUrl(application.netlinkResumeStorageId)
      : null;
    return { ...enriched, resumeUrl, netlinkResumeUrl };
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
    // Auth is checked by the callers of this internal query — the `convert`
    // action (a real recruiter) and the scheduler-invoked `convertInternal`
    // (triggered from the already-authenticated setStage mutation), which
    // runs with no caller identity of its own.
    const application = await ctx.db.get("applications", args.applicationId);
    if (application === null) {
      return null;
    }
    const candidate = await ctx.db.get("candidates", application.candidateId);
    const resumeMeta = await ctx.db.system.get("_storage", application.resumeStorageId);
    return {
      name: candidate?.name ?? "Unknown",
      resumeStorageId: application.resumeStorageId,
      resumeContentType: resumeMeta?.contentType ?? null,
    };
  },
});

export const setNetlinkResume = internalMutation({
  args: {
    applicationId: v.id("applications"),
    netlinkResumeStorageId: v.id("_storage"),
    netlinkResumeFileName: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch("applications", args.applicationId, {
      netlinkResumeStorageId: args.netlinkResumeStorageId,
      netlinkResumeFileName: args.netlinkResumeFileName,
    });
  },
});

export const setStage = mutation({
  args: {
    applicationId: v.id("applications"),
    stage: v.union(
      v.literal("applied"),
      v.literal("ai_screened"),
      v.literal("shortlisted"),
      v.literal("interview"),
      v.literal("offer"),
      v.literal("hired"),
    ),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Any signed-in recruiter can update any application — see listAll in jobs.ts.
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("Must be signed in.");
    }
    const application = await ctx.db.get("applications", args.applicationId);
    if (application === null) {
      throw new ConvexError("Application not found.");
    }
    // Only log a transition if the stage is actually changing (e.g. a
    // Kanban card dropped back in its own column is a no-op) — a note with
    // no stage change goes through addNote below instead, which still
    // writes to the same stageHistory table.
    if (application.stage !== args.stage) {
      await ctx.db.insert("stageHistory", {
        applicationId: args.applicationId,
        fromStage: application.stage,
        toStage: args.stage,
        changedBy: userId,
        changedAt: Date.now(),
        note: args.note,
      });
    }
    await ctx.db.patch("applications", args.applicationId, { stage: args.stage });

    // The client-facing share link only ever shows candidates with a
    // Netlink-formatted resume (see shareLinks.getByToken) — auto-convert on
    // shortlist so a recruiter doesn't have to remember the separate
    // "Convert to Netlink format" step before sharing. Guarded so it never
    // re-runs once a conversion already exists.
    if (args.stage === "shortlisted" && application.netlinkResumeStorageId === undefined) {
      await ctx.scheduler.runAfter(0, internal.netlinkConvert.convertInternal, {
        applicationId: args.applicationId,
      });
    }
  },
});

export const addNote = mutation({
  args: {
    applicationId: v.id("applications"),
    note: v.string(),
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
    const note = args.note.trim();
    if (!note) {
      throw new ConvexError("Note can't be empty.");
    }
    await ctx.db.insert("stageHistory", {
      applicationId: args.applicationId,
      fromStage: application.stage,
      toStage: application.stage,
      changedBy: userId,
      changedAt: Date.now(),
      note,
    });
  },
});

export const listStageHistory = query({
  args: { applicationId: v.id("applications") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return [];
    }
    return await ctx.db
      .query("stageHistory")
      .withIndex("by_applicationId", (q) => q.eq("applicationId", args.applicationId))
      .order("desc")
      .collect();
  },
});

export const setRejected = mutation({
  args: {
    applicationId: v.id("applications"),
    rejected: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Any signed-in recruiter can update any application — see listAll in jobs.ts.
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("Must be signed in.");
    }
    const application = await ctx.db.get("applications", args.applicationId);
    if (application === null) {
      throw new ConvexError("Application not found.");
    }
    await ctx.db.patch("applications", args.applicationId, { rejected: args.rejected });
  },
});
