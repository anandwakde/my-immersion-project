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
  })
    .index("by_jobId", ["jobId"])
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
});
