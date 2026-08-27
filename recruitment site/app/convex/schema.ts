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
  })
    .index("by_jobId", ["jobId"])
    .index("by_jobId_and_email", ["jobId", "email"]),
});
