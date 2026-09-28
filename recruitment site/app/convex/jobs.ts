import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") +
    "-" +
    Math.random().toString(36).slice(2, 8)
  );
}

export const create = mutation({
  args: {
    title: v.string(),
    location: v.string(),
    experience: v.string(),
    salary: v.string(),
    description: v.string(),
    responsibilities: v.array(v.string()),
    skills: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Must be signed in to create a job");
    }
    const slug = slugify(args.title);
    const jobId = await ctx.db.insert("jobs", {
      ...args,
      status: "published",
      slug,
      createdBy: userId,
    });
    return { jobId, slug };
  },
});

// Every recruiter (any signed-in account) manages every job, not just the
// ones they personally posted — this is a shared team inbox, not per-user.
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return [];
    }
    return await ctx.db.query("jobs").order("desc").take(200);
  },
});

export const listPublished = query({
  args: {},
  handler: async (ctx) => {
    const jobs = await ctx.db.query("jobs").order("desc").take(100);
    return jobs.filter((job) => job.status === "published");
  },
});

// Recruiter-facing lookup by id (any signed-in recruiter, like listAll
// above) — used by the JD requirements / AI matching UI and by the job's
// own page URL. Takes a plain string because the id may come straight from
// the address bar; anything that isn't a valid job id reads as not found.
export const get = query({
  args: { jobId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }
    const jobId = ctx.db.normalizeId("jobs", args.jobId);
    return jobId === null ? null : await ctx.db.get("jobs", jobId);
  },
});

// Validates an application id taken from the address bar and checks it
// belongs to the job in that same URL, so a mistyped or mismatched link
// shows "not found" instead of crashing or showing the wrong job's data.
export const resolveApplicationId = query({
  args: { jobId: v.string(), applicationId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }
    const applicationId = ctx.db.normalizeId("applications", args.applicationId);
    if (applicationId === null) {
      return null;
    }
    const application = await ctx.db.get("applications", applicationId);
    return application !== null && application.jobId === args.jobId ? applicationId : null;
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const job = await ctx.db
      .query("jobs")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (job === null || job.status !== "published") {
      return null;
    }
    return job;
  },
});

export const getForAnalysis = internalQuery({
  args: { jobId: v.id("jobs") },
  returns: v.union(
    v.null(),
    v.object({
      title: v.string(),
      description: v.string(),
      responsibilities: v.array(v.string()),
      skills: v.array(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    // Any signed-in recruiter can analyze any job — see listAll above.
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }
    const job = await ctx.db.get("jobs", args.jobId);
    if (job === null) {
      return null;
    }
    return {
      title: job.title,
      description: job.description,
      responsibilities: job.responsibilities,
      skills: job.skills,
    };
  },
});

export const setRequirements = internalMutation({
  args: {
    jobId: v.id("jobs"),
    mustHaveRequirements: v.array(v.string()),
    niceToHaveRequirements: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch("jobs", args.jobId, {
      mustHaveRequirements: args.mustHaveRequirements,
      niceToHaveRequirements: args.niceToHaveRequirements,
      requirementsStale: false,
    });
  },
});

// For matching: any signed-in recruiter can score candidates for any job.
export const getForMatching = internalQuery({
  args: { jobId: v.id("jobs") },
  returns: v.union(
    v.null(),
    v.object({
      title: v.string(),
      mustHaveRequirements: v.array(v.string()),
      niceToHaveRequirements: v.array(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }
    const job = await ctx.db.get("jobs", args.jobId);
    if (job === null) {
      return null;
    }
    return {
      title: job.title,
      mustHaveRequirements: job.mustHaveRequirements ?? [],
      niceToHaveRequirements: job.niceToHaveRequirements ?? [],
    };
  },
});

// Recruiter-facing edits to the AI-derived requirements before they're used
// for matching (the plan calls for the recruiter to be able to correct
// these, same principle as the candidate profile in Milestone 2).
// Recruiter-facing edit of the fields shown on the "Post a job" form. Does
// not touch status/slug — visibility is a separate action (setVisibility)
// so the two concerns (what the job says vs. who can see it) stay decoupled.
export const update = mutation({
  args: {
    jobId: v.id("jobs"),
    title: v.string(),
    location: v.string(),
    experience: v.string(),
    salary: v.string(),
    description: v.string(),
    responsibilities: v.array(v.string()),
    skills: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("Must be signed in.");
    }
    const job = await ctx.db.get("jobs", args.jobId);
    if (job === null) {
      throw new ConvexError("Job not found.");
    }
    // The AI requirements were derived from the description,
    // responsibilities and skills — if any of those change, flag the
    // requirements (and so any match scores built on them) as out of date
    // until the recruiter re-analyzes or saves them again.
    const hasRequirements =
      (job.mustHaveRequirements?.length ?? 0) > 0 || (job.niceToHaveRequirements?.length ?? 0) > 0;
    const sourceChanged =
      job.description !== args.description ||
      job.responsibilities.join("\n") !== args.responsibilities.join("\n") ||
      job.skills.join("\n") !== args.skills.join("\n");
    await ctx.db.patch("jobs", args.jobId, {
      title: args.title,
      location: args.location,
      experience: args.experience,
      salary: args.salary,
      description: args.description,
      responsibilities: args.responsibilities,
      skills: args.skills,
      ...(hasRequirements && sourceChanged ? { requirementsStale: true } : {}),
    });
  },
});

// Moves a job between published (on the public "All open roles" listing),
// private (hidden, still hiring via shared links) and closed (no longer
// hiring). listPublished/getBySlug are gated on status === "published", so
// both private and closed jobs disappear from candidates' view; the
// recruiter's listAll always shows every job regardless of status, so they
// stay fully manageable — and a closed job can be reopened at any time.
export const setVisibility = mutation({
  args: {
    jobId: v.id("jobs"),
    status: v.union(v.literal("published"), v.literal("private"), v.literal("closed")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("Must be signed in.");
    }
    const job = await ctx.db.get("jobs", args.jobId);
    if (job === null) {
      throw new ConvexError("Job not found.");
    }
    await ctx.db.patch("jobs", args.jobId, { status: args.status });
  },
});

// Permanently deletes a job posting along with its own pipeline data
// (applications, their match scores and stage history, and any client
// share links) — but never the shared `candidates` records, which may be
// referenced by other jobs' applications too (Milestone 1's dedup model).
export const remove = mutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("Must be signed in.");
    }
    const job = await ctx.db.get("jobs", args.jobId);
    if (job === null) {
      throw new ConvexError("Job not found.");
    }

    const shareLinks = await ctx.db
      .query("shareLinks")
      .withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
      .collect();
    for (const link of shareLinks) {
      await ctx.db.delete("shareLinks", link._id);
    }

    const matches = await ctx.db
      .query("matches")
      .withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
      .collect();
    for (const match of matches) {
      await ctx.db.delete("matches", match._id);
    }

    const applications = await ctx.db
      .query("applications")
      .withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
      .collect();
    for (const application of applications) {
      const history = await ctx.db
        .query("stageHistory")
        .withIndex("by_applicationId", (q) => q.eq("applicationId", application._id))
        .collect();
      for (const entry of history) {
        await ctx.db.delete("stageHistory", entry._id);
      }
      await ctx.db.delete("applications", application._id);
    }

    await ctx.db.delete("jobs", args.jobId);
  },
});

export const updateRequirements = mutation({
  args: {
    jobId: v.id("jobs"),
    mustHaveRequirements: v.array(v.string()),
    niceToHaveRequirements: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("Must be signed in.");
    }
    const job = await ctx.db.get("jobs", args.jobId);
    if (job === null) {
      throw new ConvexError("Job not found.");
    }
    await ctx.db.patch("jobs", args.jobId, {
      mustHaveRequirements: args.mustHaveRequirements,
      niceToHaveRequirements: args.niceToHaveRequirements,
      requirementsStale: false,
    });
  },
});
