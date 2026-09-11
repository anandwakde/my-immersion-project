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
    status: v.union(v.literal("draft"), v.literal("published"), v.literal("closed")),
    slug: v.string(),
    createdBy: v.id("users"),
  })
    .index("by_slug", ["slug"])
    .index("by_createdBy", ["createdBy"]),

  applications: defineTable({
    jobId: v.id("jobs"),
    name: v.string(),
    email: v.string(),
    phone: v.string(),
    linkedin: v.string(),
    resumeStorageId: v.id("_storage"),
    status: v.union(v.literal("new"), v.literal("shortlisted"), v.literal("rejected")),
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
    .index("by_jobId_and_email", ["jobId", "email"]),

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
