import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation, MutationCtx, query, QueryCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";
import { resolveRejected } from "./applicationStage";
import { buildSearchText } from "./candidates";
import { escapeHtml, layout, queueEmail, siteUrl } from "./email";
import { jobOwnerEmail, notifyRecruiters } from "./notifications";

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
    contactConsent: v.optional(v.boolean()),
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

    // Consent is only ever turned on here, never off — a later application
    // without the box ticked doesn't withdraw consent given earlier.
    if (args.contactConsent === true) {
      await ctx.db.patch("candidates", candidateId, { contactConsent: true, contactConsentAt: Date.now() });
    }

    const candidateName = existingCandidate?.name ?? args.name;
    await queueEmail(ctx, {
      to: email,
      subject: `Application received: ${job.title}`,
      kind: "application_received",
      html: layout({
        heading: `Thanks for applying, ${escapeHtml(args.name.split(" ")[0])}`,
        paragraphs: [
          `We've received your application for <strong>${escapeHtml(job.title)}</strong>.`,
          `Your application ID is <code>${applicationId}</code>.`,
          "You can check your application status any time — sign in with this email address and we'll send you a one-time code.",
        ],
        button: { label: "Track my application", url: `${siteUrl()}/candidate` },
      }),
    });
    const link = `/recruiter/jobs/${job._id}/applications/${applicationId}`;
    await notifyRecruiters(ctx, {
      title: `New application: ${candidateName}`,
      body: job.title,
      link,
    });
    const owner = await jobOwnerEmail(ctx, job.createdBy);
    if (owner) {
      await queueEmail(ctx, {
        to: owner,
        subject: `New application: ${candidateName} — ${job.title}`,
        kind: "new_application",
        html: layout({
          heading: "New application",
          paragraphs: [`${escapeHtml(candidateName)} applied for <strong>${escapeHtml(job.title)}</strong>.`],
          button: { label: "Review application", url: `${siteUrl()}${link}` },
        }),
      });
    }
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
    const job = await ctx.db.get("jobs", application.jobId);
    return { ...enriched, resumeUrl, netlinkResumeUrl, jobTitle: job?.title ?? "Unknown role" };
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
    // Rejection emails are always the recruiter's choice, never automatic.
    notifyCandidate: v.optional(v.boolean()),
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
    if (args.rejected && args.notifyCandidate) {
      await sendNotSelectedEmail(ctx, application);
    }
  },
});

async function sendNotSelectedEmail(ctx: MutationCtx, application: Doc<"applications">, message?: string) {
  const job = await ctx.db.get("jobs", application.jobId);
  const candidate = await ctx.db.get("candidates", application.candidateId);
  if (job === null || candidate === null) return;
  await queueEmail(ctx, {
    to: candidate.email,
    subject: `Your application for ${job.title}`,
    kind: "not_selected",
    html: layout({
      heading: `Thank you, ${escapeHtml(candidate.name.split(" ")[0])}`,
      paragraphs: [
        `Thank you for your interest in <strong>${escapeHtml(job.title)}</strong> at Netlink Group.`,
        message
          ? escapeHtml(message).replace(/\n/g, "<br>")
          : "After careful consideration, we've decided to move forward with other candidates for this role. We'll keep your details on file and may reach out about future openings.",
        "We wish you the very best in your search.",
      ],
    }),
  });
}

// Final hiring step. The recruiter makes the Hired move (after the
// client's interview verdict); optionally emails the candidate and the
// client, and closes the job if the position is now filled.
export const markHired = mutation({
  args: {
    applicationId: v.id("applications"),
    notifyCandidate: v.boolean(),
    message: v.optional(v.string()),
    closeJob: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new ConvexError("Must be signed in.");
    const application = await ctx.db.get("applications", args.applicationId);
    if (application === null) throw new ConvexError("Application not found.");
    const job = await ctx.db.get("jobs", application.jobId);
    const candidate = await ctx.db.get("candidates", application.candidateId);
    if (job === null || candidate === null) throw new ConvexError("Job or candidate not found.");

    if (application.stage !== "hired") {
      await ctx.db.insert("stageHistory", {
        applicationId: application._id,
        fromStage: application.stage,
        toStage: "hired",
        changedBy: userId,
        changedAt: Date.now(),
        note: args.closeJob ? "Hired — job closed." : "Hired.",
      });
    }
    await ctx.db.patch("applications", application._id, { stage: "hired", rejected: false, hiredAt: Date.now() });
    if (args.closeJob && job.status !== "closed") {
      await ctx.db.patch("jobs", job._id, { status: "closed" });
    }

    if (args.notifyCandidate) {
      await queueEmail(ctx, {
        to: candidate.email,
        subject: `Great news about ${job.title} at Netlink Group`,
        kind: "hired",
        html: layout({
          heading: `Congratulations, ${escapeHtml(candidate.name.split(" ")[0])}!`,
          paragraphs: [
            `We're delighted to let you know you've been selected for <strong>${escapeHtml(job.title)}</strong>.`,
            args.message?.trim()
              ? escapeHtml(args.message.trim()).replace(/\n/g, "<br>")
              : "Our team will contact you shortly with the offer details and next steps.",
          ],
        }),
      });
    }
    const link = await ctx.db
      .query("shareLinks")
      .withIndex("by_jobId", (q) => q.eq("jobId", job._id))
      .order("desc")
      .first();
    if (link?.clientEmail) {
      await queueEmail(ctx, {
        to: link.clientEmail,
        subject: `Hired: ${candidate.name} — ${job.title}`,
        kind: "hired_client",
        html: layout({
          heading: "Position filled",
          paragraphs: [
            `${escapeHtml(candidate.name)} has been marked as hired for <strong>${escapeHtml(job.title)}</strong>.`,
            args.closeJob ? "The job posting has been closed." : "The job posting remains open.",
          ],
        }),
      });
    }
    await notifyRecruiters(ctx, {
      title: `Hired: ${candidate.name}`,
      body: `${job.title}${args.closeJob ? " — job closed" : ""}`,
      link: `/recruiter/jobs/${job._id}/applications/${application._id}`,
    });
  },
});

// After a hire: everyone else still in the running for this job (not
// hired, not already rejected) is marked rejected and — only because the
// recruiter explicitly clicked this — sent a polite "not selected" email.
export const listStillInRunning = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const apps = await ctx.db
      .query("applications")
      .withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
      .take(500);
    const result = [];
    for (const app of apps) {
      if (app.stage === "hired" || resolveRejected(app)) continue;
      const candidate = await ctx.db.get("candidates", app.candidateId);
      result.push({ applicationId: app._id, name: candidate?.name ?? "Unknown", stage: app.stage });
    }
    return result;
  },
});

export const notifyNotSelected = mutation({
  args: { jobId: v.id("jobs"), message: v.optional(v.string()) },
  returns: v.number(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new ConvexError("Must be signed in.");
    const apps = await ctx.db
      .query("applications")
      .withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
      .take(500);
    let count = 0;
    for (const app of apps) {
      if (app.stage === "hired" || resolveRejected(app)) continue;
      await ctx.db.patch("applications", app._id, { rejected: true });
      await sendNotSelectedEmail(ctx, app, args.message?.trim() || undefined);
      count++;
    }
    return count;
  },
});
