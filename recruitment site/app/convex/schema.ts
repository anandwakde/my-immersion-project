import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,

  jobs: defineTable({
    title: v.string(),
    location: v.string(),
    experience: v.string(),
    salary: v.string(),
    description: v.string(),
    responsibilities: v.array(v.string()),
    skills: v.array(v.string()),
    status: v.union(v.literal("draft"), v.literal("published"), v.literal("closed"), v.literal("private")),
    slug: v.string(),
    createdBy: v.id("users"),
    // Populated by the JD Analyzer (Milestone 3). Empty/absent until then —
    // used by AI matching to score candidates against this job.
    mustHaveRequirements: v.optional(v.array(v.string())),
    niceToHaveRequirements: v.optional(v.array(v.string())),
    // Set when the description/responsibilities/skills are edited after
    // requirements were generated; cleared when requirements are saved or
    // re-analyzed.
    requirementsStale: v.optional(v.boolean()),
  })
    .index("by_slug", ["slug"])
    .index("by_createdBy", ["createdBy"]),

  // A deduplicated (by email) candidate identity, shared across every job
  // they've applied to. Replaces the name/email/phone/linkedin fields that
  // used to live directly on `applications`.
  candidates: defineTable({
    name: v.string(),
    email: v.string(),
    phone: v.string(),
    linkedin: v.string(),
    // Populated by the Milestone 2 resume parser (recruiter-triggered, via
    // "Parse resume"). All optional/absent until a resume has been parsed.
    // Re-parsing only fills fields that are still empty — it never
    // overwrites a value the recruiter has already set or corrected, so a
    // manual fix survives a later re-parse (e.g. after a newer resume is
    // uploaded).
    currentTitle: v.optional(v.string()),
    totalExperienceYears: v.optional(v.number()),
    summary: v.optional(v.string()),
    skills: v.optional(v.array(v.string())),
    experience: v.optional(
      v.array(
        v.object({
          organization: v.string(),
          title: v.string(),
          dates: v.string(),
          bullets: v.array(v.string()),
        }),
      ),
    ),
    education: v.optional(
      v.array(
        v.object({
          degree: v.string(),
          institution: v.string(),
          dates: v.string(),
        }),
      ),
    ),
    noticePeriod: v.optional(v.string()),
    currentSalary: v.optional(v.string()),
    expectedSalary: v.optional(v.string()),
    location: v.optional(v.string()),
    parsedAt: v.optional(v.number()),
    // Kept in sync with name/currentTitle/skills on every write (see
    // buildSearchText in candidates.ts) so Milestone 5's search index has a
    // single field to search across all three.
    searchText: v.optional(v.string()),
    // Ticked by the candidate on the application form: may Netlink contact
    // them about other roles (the recruiter "Invite to apply" feature).
    contactConsent: v.optional(v.boolean()),
    contactConsentAt: v.optional(v.number()),
  })
    .index("by_email", ["email"])
    .searchIndex("search_candidates", { searchField: "searchText" }),

  applications: defineTable({
    jobId: v.id("jobs"),
    candidateId: v.id("candidates"),
    resumeStorageId: v.id("_storage"),
    // Rejection is tracked separately from stage (see `rejected` below) so
    // we don't lose which stage a candidate was rejected from.
    stage: v.union(
      v.literal("applied"),
      v.literal("ai_screened"),
      v.literal("shortlisted"),
      v.literal("interview"),
      v.literal("offer"),
      v.literal("hired"),
    ),
    rejected: v.optional(v.boolean()),
    netlinkResumeStorageId: v.optional(v.id("_storage")),
    netlinkResumeFileName: v.optional(v.string()),
    clientStatus: v.optional(v.union(v.literal("accepted"), v.literal("rejected"))),
    clientRejectionReason: v.optional(v.string()),
    clientRespondedAt: v.optional(v.number()),
    // Set together with clientStatus "accepted" — two proposed interview
    // slots the client offered, in their own local timezone (captured for
    // display since the *At fields themselves are plain UTC instants).
    // interviewSlotAt2 was added after interviewSlotAt already shipped, so
    // some already-accepted applications only have interviewSlotAt set.
    interviewSlotAt: v.optional(v.number()),
    interviewSlotAt2: v.optional(v.number()),
    interviewSlotTimezone: v.optional(v.string()),
    // Interview scheduling. The client proposes two slots (above); the
    // candidate picks one via a no-login link keyed by interviewToken.
    interviewStatus: v.optional(
      v.union(
        v.literal("awaiting_candidate"),
        v.literal("confirmed"),
        v.literal("needs_new_slots"),
        v.literal("cancelled"),
      ),
    ),
    interviewAt: v.optional(v.number()),
    interviewToken: v.optional(v.string()),
    candidateSlotNote: v.optional(v.string()),
    meetingLink: v.optional(v.string()),
    // Bumped on every change to a confirmed interview so calendar apps
    // replace the earlier invite instead of adding a second event.
    interviewSequence: v.optional(v.number()),
    hiredAt: v.optional(v.number()),
  })
    .index("by_jobId", ["jobId"])
    .index("by_candidateId", ["candidateId"])
    .index("by_interviewToken", ["interviewToken"])
    .index("by_jobId_and_candidateId", ["jobId", "candidateId"]),

  // Populated by AI matching (Milestone 3). Empty/unused until then.
  matches: defineTable({
    applicationId: v.id("applications"),
    jobId: v.id("jobs"),
    score: v.number(),
    strengths: v.array(v.string()),
    gaps: v.array(v.string()),
    evidence: v.string(),
    computedAt: v.number(),
  })
    .index("by_applicationId", ["applicationId"])
    .index("by_jobId", ["jobId"]),

  // Populated by the Kanban pipeline (Milestone 4). Empty/unused until then.
  stageHistory: defineTable({
    applicationId: v.id("applications"),
    fromStage: v.optional(v.string()),
    toStage: v.string(),
    changedBy: v.id("users"),
    changedAt: v.number(),
    note: v.optional(v.string()),
  }).index("by_applicationId", ["applicationId"]),

  shareLinks: defineTable({
    jobId: v.id("jobs"),
    token: v.string(),
    expiresAt: v.number(),
    createdBy: v.id("users"),
    // Optional — when set, the client is emailed the review link and gets
    // interview invites and hiring updates.
    clientEmail: v.optional(v.string()),
  })
    .index("by_token", ["token"])
    .index("by_jobId", ["jobId"]),

  recruiterProfiles: defineTable({
    userId: v.id("users"),
    email: v.string(),
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    approvalToken: v.string(),
    createdAt: v.number(),
    respondedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_approvalToken", ["approvalToken"]),

  // Every email the app sends (or, with EMAIL_MODE=log, would have sent),
  // shown to recruiters on the Email log page. Bodies of sign-in code
  // emails are never stored.
  emailLog: defineTable({
    to: v.string(),
    subject: v.string(),
    kind: v.string(),
    html: v.optional(v.string()),
    hasAttachment: v.boolean(),
    status: v.union(v.literal("sent"), v.literal("failed"), v.literal("logged")),
    error: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_createdAt", ["createdAt"]),

  // In-app bell notifications, one row per recruiter per event.
  notifications: defineTable({
    userId: v.id("users"),
    title: v.string(),
    body: v.string(),
    link: v.string(),
    createdAt: v.number(),
    read: v.boolean(),
  })
    .index("by_userId_and_createdAt", ["userId", "createdAt"])
    .index("by_userId_and_read", ["userId", "read"]),

  // "Invite to apply" sent from a candidate's profile.
  invites: defineTable({
    candidateId: v.id("candidates"),
    jobId: v.id("jobs"),
    invitedBy: v.id("users"),
    message: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_candidateId", ["candidateId"])
    .index("by_jobId", ["jobId"]),

  // AI fit scores for a candidate against a job they have NOT applied to
  // (computed on demand in the invite pop-up). Scores for jobs they did
  // apply to live in `matches`.
  candidateJobScores: defineTable({
    candidateId: v.id("candidates"),
    jobId: v.id("jobs"),
    score: v.number(),
    evidence: v.string(),
    computedAt: v.number(),
  }).index("by_candidateId_and_jobId", ["candidateId", "jobId"]),

  // Recruiter <-> candidate chat, one thread per candidate.
  messages: defineTable({
    candidateId: v.id("candidates"),
    sender: v.union(v.literal("recruiter"), v.literal("candidate")),
    senderUserId: v.optional(v.id("users")),
    body: v.string(),
    createdAt: v.number(),
  }).index("by_candidateId_and_createdAt", ["candidateId", "createdAt"]),

  // Candidate portal sign-in: a 6-digit code emailed to the address they
  // applied with, exchanged for a session token. Candidates never get a
  // Convex Auth session, so they can't reach any recruiter-only function.
  candidateLoginCodes: defineTable({
    email: v.string(),
    codeHash: v.string(),
    expiresAt: v.number(),
    attempts: v.number(),
    createdAt: v.number(),
  }).index("by_email_and_createdAt", ["email", "createdAt"]),

  candidateSessions: defineTable({
    candidateId: v.id("candidates"),
    tokenHash: v.string(),
    expiresAt: v.number(),
  }).index("by_tokenHash", ["tokenHash"]),
});
