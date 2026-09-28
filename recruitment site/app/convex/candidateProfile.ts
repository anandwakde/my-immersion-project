import { ConvexError, v } from "convex/values";
import { action, env, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { resolveRejected } from "./applicationStage";
import { escapeHtml, layout, queueEmail, siteUrl } from "./email";
import { scoreOneCandidate } from "./matching";

// Chat opens once a candidate has been shortlisted for any job (and stays
// open through interview, offer and hire).
const CHAT_STAGES = new Set(["shortlisted", "interview", "offer", "hired"]);

// Everything the recruiter's candidate profile page shows. Takes a plain
// string because the id comes from the address bar.
export const getProfilePage = query({
  args: { candidateId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const candidateId = ctx.db.normalizeId("candidates", args.candidateId);
    if (candidateId === null) return null;
    const candidate = await ctx.db.get("candidates", candidateId);
    if (candidate === null) return null;

    const apps = await ctx.db
      .query("applications")
      .withIndex("by_candidateId", (q) => q.eq("candidateId", candidateId))
      .order("desc")
      .take(50);
    const applications = [];
    for (const app of apps) {
      const job = await ctx.db.get("jobs", app.jobId);
      const match = await ctx.db
        .query("matches")
        .withIndex("by_applicationId", (q) => q.eq("applicationId", app._id))
        .unique();
      applications.push({
        applicationId: app._id,
        jobId: app.jobId,
        jobTitle: job?.title ?? "Deleted job",
        stage: app.stage,
        rejected: resolveRejected(app),
        appliedAt: app._creationTime,
        score: match?.score ?? null,
        resumeUrl: await ctx.storage.getUrl(app.resumeStorageId),
      });
    }

    const inviteRows = await ctx.db
      .query("invites")
      .withIndex("by_candidateId", (q) => q.eq("candidateId", candidateId))
      .order("desc")
      .take(20);
    const invites = [];
    for (const inv of inviteRows) {
      const job = await ctx.db.get("jobs", inv.jobId);
      invites.push({ _id: inv._id, jobTitle: job?.title ?? "Deleted job", createdAt: inv.createdAt });
    }

    return {
      candidate,
      applications,
      latestApplicationId: applications[0]?.applicationId ?? null,
      latestResumeUrl: applications[0]?.resumeUrl ?? null,
      invites,
      canChat: apps.some((a) => CHAT_STAGES.has(a.stage) && !resolveRejected(a)),
    };
  },
});

// Jobs the candidate could be invited to: published, not already applied
// to, with any fit score already computed for them.
export const listInviteJobs = query({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const jobs = (await ctx.db.query("jobs").order("desc").take(200)).filter((j) => j.status === "published");
    const invited = await ctx.db
      .query("invites")
      .withIndex("by_candidateId", (q) => q.eq("candidateId", args.candidateId))
      .take(200);
    const result = [];
    for (const job of jobs) {
      const applied = await ctx.db
        .query("applications")
        .withIndex("by_jobId_and_candidateId", (q) => q.eq("jobId", job._id).eq("candidateId", args.candidateId))
        .unique();
      if (applied !== null) continue;
      const score = await ctx.db
        .query("candidateJobScores")
        .withIndex("by_candidateId_and_jobId", (q) => q.eq("candidateId", args.candidateId).eq("jobId", job._id))
        .unique();
      result.push({
        jobId: job._id,
        title: job.title,
        location: job.location,
        hasRequirements:
          (job.mustHaveRequirements?.length ?? 0) > 0 || (job.niceToHaveRequirements?.length ?? 0) > 0,
        score: score?.score ?? null,
        evidence: score?.evidence ?? null,
        alreadyInvited: invited.some((i) => i.jobId === job._id),
      });
    }
    return result;
  },
});

export const getForJobScore = internalQuery({
  args: { candidateId: v.id("candidates"), jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const candidate = await ctx.db.get("candidates", args.candidateId);
    const job = await ctx.db.get("jobs", args.jobId);
    if (candidate === null || job === null) return null;
    return {
      job: {
        title: job.title,
        mustHaveRequirements: job.mustHaveRequirements ?? [],
        niceToHaveRequirements: job.niceToHaveRequirements ?? [],
      },
      candidate: {
        name: candidate.name,
        parsed: candidate.parsedAt !== undefined,
        currentTitle: candidate.currentTitle,
        totalExperienceYears: candidate.totalExperienceYears,
        summary: candidate.summary,
        skills: candidate.skills,
        experience: candidate.experience,
        education: candidate.education,
      },
    };
  },
});

export const saveJobScore = internalMutation({
  args: { candidateId: v.id("candidates"), jobId: v.id("jobs"), score: v.number(), evidence: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("candidateJobScores")
      .withIndex("by_candidateId_and_jobId", (q) => q.eq("candidateId", args.candidateId).eq("jobId", args.jobId))
      .unique();
    const data = { ...args, computedAt: Date.now() };
    if (existing) await ctx.db.patch("candidateJobScores", existing._id, data);
    else await ctx.db.insert("candidateJobScores", data);
  },
});

// On demand, one job at a time (one AI call each) — never in bulk, to keep
// AI cost proportional to what a recruiter actually looks at.
export const scoreForJob = action({
  args: { candidateId: v.id("candidates"), jobId: v.id("jobs") },
  handler: async (ctx, args): Promise<number> => {
    const data = await ctx.runQuery(internal.candidateProfile.getForJobScore, args);
    if (data === null) throw new ConvexError("Candidate or job not found.");
    if (!data.candidate.parsed) throw new ConvexError("Parse this candidate's resume first.");
    if (data.job.mustHaveRequirements.length === 0 && data.job.niceToHaveRequirements.length === 0) {
      throw new ConvexError("This job's description hasn't been analyzed yet.");
    }
    if (!env.OPENAI_API_KEY) throw new ConvexError("OPENAI_API_KEY is not set on this deployment.");
    const result = await scoreOneCandidate(env.OPENAI_API_KEY, data.job, data.candidate);
    await ctx.runMutation(internal.candidateProfile.saveJobScore, {
      candidateId: args.candidateId,
      jobId: args.jobId,
      score: result.score,
      evidence: result.evidence,
    });
    return result.score;
  },
});

export const sendInvite = mutation({
  args: {
    candidateId: v.id("candidates"),
    jobId: v.id("jobs"),
    message: v.optional(v.string()),
    consentConfirmed: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new ConvexError("Must be signed in.");
    const candidate = await ctx.db.get("candidates", args.candidateId);
    const job = await ctx.db.get("jobs", args.jobId);
    if (candidate === null || job === null) throw new ConvexError("Candidate or job not found.");
    if (job.status !== "published") throw new ConvexError("Only active (public) jobs can be shared with candidates.");
    if (!candidate.contactConsent && !args.consentConfirmed) {
      throw new ConvexError("This candidate hasn't agreed to be contacted about other roles.");
    }
    const message = args.message?.trim() || undefined;
    await ctx.db.insert("invites", {
      candidateId: args.candidateId,
      jobId: args.jobId,
      invitedBy: userId,
      message,
      createdAt: Date.now(),
    });
    await queueEmail(ctx, {
      to: candidate.email,
      subject: `A role you might like: ${job.title} at Netlink Group`,
      kind: "invite_to_apply",
      html: layout({
        heading: `${escapeHtml(candidate.name.split(" ")[0])}, we think you'd be a great fit`,
        paragraphs: [
          `Our hiring team would like to invite you to apply for <strong>${escapeHtml(job.title)}</strong> (${escapeHtml(job.location)}).`,
          ...(message ? [escapeHtml(message).replace(/\n/g, "<br>")] : []),
        ],
        button: { label: "View the role and apply", url: `${siteUrl()}/jobs/${job.slug}` },
      }),
    });
  },
});

// ---- Chat (recruiter side) ------------------------------------------------

export const listMessages = query({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const rows = await ctx.db
      .query("messages")
      .withIndex("by_candidateId_and_createdAt", (q) => q.eq("candidateId", args.candidateId))
      .order("desc")
      .take(100);
    const result = [];
    for (const m of rows.reverse()) {
      const sender = m.senderUserId ? await ctx.db.get("users", m.senderUserId) : null;
      result.push({ ...m, senderLabel: m.sender === "candidate" ? "Candidate" : (sender?.email ?? "Recruiter") });
    }
    return result;
  },
});

export const sendMessage = mutation({
  args: { candidateId: v.id("candidates"), body: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new ConvexError("Must be signed in.");
    const body = args.body.trim();
    if (!body) throw new ConvexError("Message can't be empty.");
    if (body.length > 2000) throw new ConvexError("Message is too long (2,000 characters max).");
    const candidate = await ctx.db.get("candidates", args.candidateId);
    if (candidate === null) throw new ConvexError("Candidate not found.");
    const apps = await ctx.db
      .query("applications")
      .withIndex("by_candidateId", (q) => q.eq("candidateId", args.candidateId))
      .take(50);
    if (!apps.some((a) => CHAT_STAGES.has(a.stage) && !resolveRejected(a))) {
      throw new ConvexError("Chat opens once the candidate has been shortlisted.");
    }
    await ctx.db.insert("messages", {
      candidateId: args.candidateId,
      sender: "recruiter",
      senderUserId: userId,
      body,
      createdAt: Date.now(),
    });
    await queueEmail(ctx, {
      to: candidate.email,
      subject: "New message from the Netlink hiring team",
      kind: "chat_message",
      html: layout({
        heading: "You have a new message",
        paragraphs: [
          "The Netlink hiring team sent you a message about your application.",
          "Sign in with your email address to read and reply — we'll send you a one-time code.",
        ],
        button: { label: "Read message", url: `${siteUrl()}/candidate` },
      }),
    });
  },
});
