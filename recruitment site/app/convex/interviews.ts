import { ConvexError, v } from "convex/values";
import { mutation, MutationCtx, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "./_generated/dataModel";
import { escapeHtml, formatWhen, layout, queueEmail, siteUrl } from "./email";
import { buildInterviewIcs } from "./ics";
import { jobOwnerEmail, notifyRecruiters } from "./notifications";

// Interview scheduling flow:
//   1. Client accepts a shortlisted candidate and proposes two slots
//      (shareLinks.submitFeedback) → startCandidateScheduling below.
//   2. Candidate opens a no-login link (/interview/:token), sees both slots
//      in their own time zone, and picks one — or says neither works.
//   3. On pick: confirmed; candidate, job owner and client (if their email
//      is known) get an email with a calendar invite and the meeting link.
//   4. Recruiter can add/generate the meeting link, propose new slots,
//      set a time directly, or cancel — each change re-sends the invite.

function newToken(): string {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}

async function latestClientEmail(ctx: MutationCtx, jobId: Id<"jobs">): Promise<string | null> {
  const link = await ctx.db
    .query("shareLinks")
    .withIndex("by_jobId", (q) => q.eq("jobId", jobId))
    .order("desc")
    .first();
  return link?.clientEmail ?? null;
}

async function loadContext(ctx: MutationCtx, application: Doc<"applications">) {
  const job = await ctx.db.get("jobs", application.jobId);
  const candidate = await ctx.db.get("candidates", application.candidateId);
  if (job === null || candidate === null) {
    throw new ConvexError("Job or candidate not found.");
  }
  return { job, candidate };
}

export async function startCandidateScheduling(ctx: MutationCtx, applicationId: Id<"applications">) {
  const application = await ctx.db.get("applications", applicationId);
  if (application === null || application.interviewSlotAt === undefined) return;
  const { job, candidate } = await loadContext(ctx, application);
  const token = application.interviewToken ?? newToken();
  await ctx.db.patch("applications", applicationId, {
    interviewStatus: "awaiting_candidate",
    interviewToken: token,
    interviewAt: undefined,
    candidateSlotNote: undefined,
  });
  await queueEmail(ctx, {
    to: candidate.email,
    subject: `Interview invitation: ${job.title} at Netlink Group`,
    kind: "interview_pick_slot",
    html: layout({
      heading: `Let's schedule your interview, ${candidate.name.split(" ")[0]}`,
      paragraphs: [
        `Good news — the hiring team would like to interview you for <strong>${escapeHtml(job.title)}</strong>.`,
        "Please pick one of the proposed times. They'll be shown in your own time zone. If neither works, you can tell us that too.",
      ],
      button: { label: "Choose an interview time", url: `${siteUrl()}/interview/${token}` },
    }),
  });
}

async function sendInvites(
  ctx: MutationCtx,
  applicationId: Id<"applications">,
  change: "confirmed" | "updated" | "cancelled",
) {
  const application = await ctx.db.get("applications", applicationId);
  if (application === null || application.interviewAt === undefined) return;
  const { job, candidate } = await loadContext(ctx, application);
  const sequence = application.interviewSequence ?? 0;
  const when = formatWhen(application.interviewAt);
  const title = `Interview: ${job.title} — ${candidate.name}`;
  const ics = buildInterviewIcs({
    uid: `${applicationId}@netlink-recruitment`,
    sequence,
    startAt: application.interviewAt,
    title,
    description: `Interview for ${job.title} at Netlink Group with ${candidate.name}.`,
    meetingLink: application.meetingLink,
    cancelled: change === "cancelled",
  });
  const attachment = { filename: "interview.ics", content: ics, contentType: "text/calendar" };
  const linkLine = application.meetingLink
    ? `Meeting link: <a href="${escapeHtml(application.meetingLink)}">${escapeHtml(application.meetingLink)}</a>`
    : "The meeting link will be shared before the interview.";
  const verb = change === "confirmed" ? "confirmed" : change === "updated" ? "updated" : "cancelled";
  const subjectPrefix =
    change === "confirmed" ? "Interview confirmed" : change === "updated" ? "Interview updated" : "Interview cancelled";

  await queueEmail(ctx, {
    to: candidate.email,
    subject: `${subjectPrefix}: ${job.title} at Netlink Group`,
    kind: `interview_${change}`,
    attachment,
    html: layout({
      heading: `Your interview is ${verb}`,
      paragraphs:
        change === "cancelled"
          ? [`Your interview for <strong>${escapeHtml(job.title)}</strong> on ${when} has been cancelled. The hiring team will be in touch.`]
          : [
              `<strong>${escapeHtml(job.title)}</strong> — ${when} (shown in UTC; the attached calendar invite shows your local time).`,
              linkLine,
            ],
      button: { label: "View interview details", url: `${siteUrl()}/interview/${application.interviewToken}` },
    }),
  });

  const internalRecipients = new Set<string>();
  const owner = await jobOwnerEmail(ctx, job.createdBy);
  if (owner) internalRecipients.add(owner);
  const client = await latestClientEmail(ctx, job._id);
  if (client) internalRecipients.add(client);
  for (const to of internalRecipients) {
    await queueEmail(ctx, {
      to,
      subject: `${subjectPrefix}: ${candidate.name} — ${job.title}`,
      kind: `interview_${change}`,
      attachment,
      html: layout({
        heading: `${subjectPrefix}`,
        paragraphs: [
          `${escapeHtml(candidate.name)} — <strong>${escapeHtml(job.title)}</strong>`,
          change === "cancelled" ? `Was scheduled for ${when}.` : `${when} (UTC). The calendar invite is attached.`,
          ...(change === "cancelled" ? [] : [linkLine]),
        ],
      }),
    });
  }
}

// ---- Candidate side (no login; the token is the key) --------------------

export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    if (!args.token) return null;
    const application = await ctx.db
      .query("applications")
      .withIndex("by_interviewToken", (q) => q.eq("interviewToken", args.token))
      .unique();
    if (application === null) return null;
    const job = await ctx.db.get("jobs", application.jobId);
    const candidate = await ctx.db.get("candidates", application.candidateId);
    return {
      jobTitle: job?.title ?? "the role",
      firstName: candidate?.name.split(" ")[0] ?? "",
      status: application.interviewStatus ?? "awaiting_candidate",
      slots: [application.interviewSlotAt, application.interviewSlotAt2].filter((s): s is number => s !== undefined),
      interviewAt: application.interviewAt ?? null,
      meetingLink: application.meetingLink ?? null,
      sequence: application.interviewSequence ?? 0,
    };
  },
});

async function applicationByToken(ctx: MutationCtx, token: string) {
  const application = await ctx.db
    .query("applications")
    .withIndex("by_interviewToken", (q) => q.eq("interviewToken", token))
    .unique();
  if (application === null) throw new ConvexError("This interview link is not valid.");
  return application;
}

export const pickSlot = mutation({
  args: { token: v.string(), slotAt: v.number() },
  handler: async (ctx, args) => {
    const application = await applicationByToken(ctx, args.token);
    if (application.interviewStatus !== "awaiting_candidate") {
      throw new ConvexError("This interview time can no longer be changed here — please contact the hiring team.");
    }
    if (args.slotAt !== application.interviewSlotAt && args.slotAt !== application.interviewSlotAt2) {
      throw new ConvexError("That time isn't one of the proposed slots.");
    }
    if (args.slotAt <= Date.now()) {
      throw new ConvexError("That time has already passed. Please pick another, or tell us neither works.");
    }
    const { job, candidate } = await loadContext(ctx, application);
    await ctx.db.patch("applications", application._id, {
      interviewStatus: "confirmed",
      interviewAt: args.slotAt,
      interviewSequence: (application.interviewSequence ?? -1) + 1,
      stage: application.stage === "shortlisted" ? "interview" : application.stage,
    });
    if (application.stage === "shortlisted") {
      await ctx.db.insert("stageHistory", {
        applicationId: application._id,
        fromStage: "shortlisted",
        toStage: "interview",
        changedBy: job.createdBy,
        changedAt: Date.now(),
        note: "Candidate confirmed an interview slot.",
      });
    }
    await sendInvites(ctx, application._id, "confirmed");
    await notifyRecruiters(ctx, {
      title: `Interview confirmed: ${candidate.name}`,
      body: `${job.title} — ${formatWhen(args.slotAt)}`,
      link: `/recruiter/jobs/${job._id}/applications/${application._id}`,
    });
  },
});

export const declineSlots = mutation({
  args: { token: v.string(), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const application = await applicationByToken(ctx, args.token);
    if (application.interviewStatus !== "awaiting_candidate") {
      throw new ConvexError("This interview can no longer be changed here — please contact the hiring team.");
    }
    const { job, candidate } = await loadContext(ctx, application);
    const note = args.note?.trim().slice(0, 500) || undefined;
    await ctx.db.patch("applications", application._id, { interviewStatus: "needs_new_slots", candidateSlotNote: note });
    await notifyRecruiters(ctx, {
      title: `New interview times needed: ${candidate.name}`,
      body: `${job.title} — neither proposed slot works${note ? `: "${note}"` : "."}`,
      link: `/recruiter/jobs/${job._id}/applications/${application._id}`,
    });
    const owner = await jobOwnerEmail(ctx, job.createdBy);
    if (owner) {
      await queueEmail(ctx, {
        to: owner,
        subject: `New interview times needed: ${candidate.name} — ${job.title}`,
        kind: "interview_needs_new_slots",
        html: layout({
          heading: "Neither interview slot works",
          paragraphs: [
            `${escapeHtml(candidate.name)} can't make either proposed time for <strong>${escapeHtml(job.title)}</strong>.`,
            ...(note ? [`Their note: "${escapeHtml(note)}"`] : []),
            "Propose new times from the application page.",
          ],
          button: { label: "Open application", url: `${siteUrl()}/recruiter/jobs/${job._id}/applications/${application._id}` },
        }),
      });
    }
  },
});

// ---- Recruiter side -------------------------------------------------------

async function recruiterApplication(ctx: MutationCtx, applicationId: Id<"applications">) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new ConvexError("Must be signed in.");
  const application = await ctx.db.get("applications", applicationId);
  if (application === null) throw new ConvexError("Application not found.");
  return application;
}

export const proposeSlots = mutation({
  args: { applicationId: v.id("applications"), slotAt: v.number(), slotAt2: v.number(), timezone: v.string() },
  handler: async (ctx, args) => {
    const application = await recruiterApplication(ctx, args.applicationId);
    const now = Date.now();
    if (args.slotAt <= now || args.slotAt2 <= now) throw new ConvexError("Both slots must be in the future.");
    if (args.slotAt === args.slotAt2) throw new ConvexError("Pick two different slots.");
    const wasConfirmed = application.interviewStatus === "confirmed";
    await ctx.db.patch("applications", args.applicationId, {
      interviewSlotAt: args.slotAt,
      interviewSlotAt2: args.slotAt2,
      interviewSlotTimezone: args.timezone,
    });
    if (wasConfirmed) {
      // The old confirmed time is withdrawn before the candidate picks again.
      await ctx.db.patch("applications", args.applicationId, {
        interviewSequence: (application.interviewSequence ?? 0) + 1,
      });
      await sendInvites(ctx, args.applicationId, "cancelled");
    }
    await startCandidateScheduling(ctx, args.applicationId);
  },
});

export const confirmTime = mutation({
  args: { applicationId: v.id("applications"), at: v.number() },
  handler: async (ctx, args) => {
    const application = await recruiterApplication(ctx, args.applicationId);
    if (args.at <= Date.now()) throw new ConvexError("The interview time must be in the future.");
    const change = application.interviewStatus === "confirmed" ? "updated" : "confirmed";
    await ctx.db.patch("applications", args.applicationId, {
      interviewStatus: "confirmed",
      interviewAt: args.at,
      interviewToken: application.interviewToken ?? newToken(),
      interviewSequence: (application.interviewSequence ?? -1) + 1,
      stage: application.stage === "shortlisted" ? "interview" : application.stage,
    });
    await sendInvites(ctx, args.applicationId, change);
  },
});

export const setMeetingLink = mutation({
  args: { applicationId: v.id("applications"), meetingLink: v.string() },
  handler: async (ctx, args) => {
    const application = await recruiterApplication(ctx, args.applicationId);
    const link = args.meetingLink.trim();
    if (link && !/^https:\/\/\S+$/.test(link)) {
      throw new ConvexError("Meeting link must start with https://");
    }
    await ctx.db.patch("applications", args.applicationId, {
      meetingLink: link || undefined,
      ...(application.interviewStatus === "confirmed"
        ? { interviewSequence: (application.interviewSequence ?? 0) + 1 }
        : {}),
    });
    if (application.interviewStatus === "confirmed") {
      await sendInvites(ctx, args.applicationId, "updated");
    }
  },
});

// A free Jitsi Meet room — no account or integration needed; anyone with
// the link can join. The random suffix keeps rooms from being guessable.
export const generateMeetingLink = mutation({
  args: { applicationId: v.id("applications") },
  handler: async (ctx, args) => {
    const application = await recruiterApplication(ctx, args.applicationId);
    const job = await ctx.db.get("jobs", application.jobId);
    const slug = (job?.title ?? "interview").replace(/[^a-zA-Z0-9]+/g, "").slice(0, 24);
    const link = `https://meet.jit.si/Netlink-${slug}-${crypto.randomUUID().slice(0, 8)}`;
    await ctx.db.patch("applications", args.applicationId, {
      meetingLink: link,
      ...(application.interviewStatus === "confirmed"
        ? { interviewSequence: (application.interviewSequence ?? 0) + 1 }
        : {}),
    });
    if (application.interviewStatus === "confirmed") {
      await sendInvites(ctx, args.applicationId, "updated");
    }
    return link;
  },
});

export const cancel = mutation({
  args: { applicationId: v.id("applications") },
  handler: async (ctx, args) => {
    const application = await recruiterApplication(ctx, args.applicationId);
    const wasConfirmed = application.interviewStatus === "confirmed";
    await ctx.db.patch("applications", args.applicationId, {
      interviewStatus: "cancelled",
      ...(wasConfirmed ? { interviewSequence: (application.interviewSequence ?? 0) + 1 } : {}),
    });
    if (wasConfirmed) {
      await sendInvites(ctx, args.applicationId, "cancelled");
    }
  },
});

// For applications a client accepted before this flow existed (slots saved,
// candidate never asked): send the candidate the pick-a-slot link now.
export const askCandidate = mutation({
  args: { applicationId: v.id("applications") },
  handler: async (ctx, args) => {
    const application = await recruiterApplication(ctx, args.applicationId);
    const slots = [application.interviewSlotAt, application.interviewSlotAt2].filter(
      (s): s is number => s !== undefined && s > Date.now(),
    );
    if (slots.length === 0) {
      throw new ConvexError("The proposed slots have passed — propose new times instead.");
    }
    await startCandidateScheduling(ctx, args.applicationId);
  },
});
