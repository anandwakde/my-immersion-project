import { ConvexError, v } from "convex/values";
import { mutation, MutationCtx, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { resolveRejected } from "./applicationStage";
import { escapeHtml, layout, queueEmail, siteUrl } from "./email";
import { startCandidateScheduling } from "./interviews";
import { jobOwnerEmail, notifyRecruiters } from "./notifications";

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

const EXPIRY_MS = 15 * 24 * 60 * 60 * 1000;

function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}

export const create = mutation({
  args: { jobId: v.id("jobs"), clientEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("Must be signed in.");
    }
    // Any signed-in recruiter can share any job — see listAll in jobs.ts.
    const job = await ctx.db.get("jobs", args.jobId);
    if (job === null) {
      throw new ConvexError("Job not found.");
    }

    const clientEmail = args.clientEmail?.trim().toLowerCase() || undefined;
    if (clientEmail !== undefined && !EMAIL_FORMAT.test(clientEmail)) {
      throw new ConvexError("Enter a valid client email address.");
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("shareLinks")
      .withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
      .order("desc")
      .first();
    let token: string;
    let expiresAt: number;
    if (existing !== null && existing.expiresAt > now) {
      token = existing.token;
      expiresAt = existing.expiresAt;
      if (clientEmail !== undefined && clientEmail !== existing.clientEmail) {
        await ctx.db.patch("shareLinks", existing._id, { clientEmail });
      }
    } else {
      token = generateToken();
      expiresAt = now + EXPIRY_MS;
      await ctx.db.insert("shareLinks", { jobId: args.jobId, token, expiresAt, createdBy: userId, clientEmail });
    }

    if (clientEmail !== undefined) {
      await queueEmail(ctx, {
        to: clientEmail,
        subject: `Shortlisted candidates for ${job.title}`,
        kind: "client_review_link",
        html: layout({
          heading: `Candidates for ${job.title}`,
          paragraphs: [
            "Netlink Group has shortlisted candidates for your review.",
            "Open the link to view each resume, then accept (and propose two interview times) or reject with a reason. No login needed.",
            `The link expires on ${new Date(expiresAt).toUTCString().slice(0, 16)}.`,
          ],
          button: { label: "Review candidates", url: `${siteUrl()}/client/${token}` },
        }),
      });
    }
    return { token, expiresAt, clientEmail: clientEmail ?? existing?.clientEmail ?? null };
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
      if (app.stage !== "shortlisted" || resolveRejected(app) || app.netlinkResumeStorageId === undefined) {
        continue;
      }
      const resumeUrl = await ctx.storage.getUrl(app.netlinkResumeStorageId);
      candidates.push({
        applicationId: app._id,
        label: app.netlinkResumeFileName?.replace(/\.pdf$/i, "") ?? "Candidate",
        resumeUrl,
        clientStatus: app.clientStatus ?? null,
        clientRejectionReason: app.clientRejectionReason ?? null,
        interviewSlotAt: app.interviewSlotAt ?? null,
        interviewSlotAt2: app.interviewSlotAt2 ?? null,
        interviewSlotTimezone: app.interviewSlotTimezone ?? null,
        interviewStatus: app.interviewStatus ?? null,
        interviewAt: app.interviewAt ?? null,
        meetingLink: app.meetingLink ?? null,
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
    interviewSlotAt: v.optional(v.number()),
    interviewSlotAt2: v.optional(v.number()),
    interviewSlotTimezone: v.optional(v.string()),
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
    if (
      application.stage !== "shortlisted" ||
      resolveRejected(application) ||
      application.netlinkResumeStorageId === undefined
    ) {
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
      await notifyClientDecision(ctx, args.applicationId, "rejected", reason);
    } else {
      if (args.interviewSlotAt === undefined || args.interviewSlotAt2 === undefined) {
        throw new ConvexError("Please pick two interview slots before accepting.");
      }
      if (args.interviewSlotAt <= Date.now() || args.interviewSlotAt2 <= Date.now()) {
        throw new ConvexError("Please pick interview slots that are in the future.");
      }
      if (args.interviewSlotAt === args.interviewSlotAt2) {
        throw new ConvexError("Please pick two different interview slots.");
      }
      await ctx.db.patch("applications", args.applicationId, {
        clientStatus: "accepted",
        clientRejectionReason: undefined,
        clientRespondedAt: Date.now(),
        interviewSlotAt: args.interviewSlotAt,
        interviewSlotAt2: args.interviewSlotAt2,
        interviewSlotTimezone: args.interviewSlotTimezone,
      });
      await notifyClientDecision(ctx, args.applicationId, "accepted");
      await startCandidateScheduling(ctx, args.applicationId);
    }
  },
});

async function notifyClientDecision(
  ctx: MutationCtx,
  applicationId: Id<"applications">,
  decision: "accepted" | "rejected",
  reason?: string,
) {
  const application = await ctx.db.get("applications", applicationId);
  if (application === null) return;
  const job = await ctx.db.get("jobs", application.jobId);
  const candidate = await ctx.db.get("candidates", application.candidateId);
  if (job === null || candidate === null) return;
  const link = `/recruiter/jobs/${job._id}/applications/${applicationId}`;
  const title = decision === "accepted" ? `Client accepted ${candidate.name}` : `Client rejected ${candidate.name}`;
  const body =
    decision === "accepted"
      ? `${job.title} — the candidate has been emailed to pick an interview slot.`
      : `${job.title} — reason: ${reason ?? ""}`;
  await notifyRecruiters(ctx, { title, body, link });
  const owner = await jobOwnerEmail(ctx, job.createdBy);
  if (owner) {
    await queueEmail(ctx, {
      to: owner,
      subject: `${title} — ${job.title}`,
      kind: `client_${decision}`,
      html: layout({
        heading: title,
        paragraphs: [
          `<strong>${escapeHtml(job.title)}</strong>`,
          decision === "accepted"
            ? "The client proposed two interview slots. The candidate has been emailed a link to pick one."
            : `Reason given: "${escapeHtml(reason ?? "")}"`,
        ],
        button: { label: "Open application", url: `${siteUrl()}${link}` },
      }),
    });
  }
}
