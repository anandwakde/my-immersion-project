import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  waitlist: defineTable({
    email: v.string(),
    reference: v.string(),
    source: v.string(),
  }).index("by_email", ["email"]),

  circulars: defineTable({
    scheme: v.string(),
    title: v.string(),
    urgency: v.string(),
    deadline: v.string(),
    deadlineDate: v.optional(v.union(v.string(), v.null())),
    scope: v.string(),
    sourceUrl: v.string(),
    fileHash: v.optional(v.string()),
  }).index("by_file_hash", ["fileHash"]),

  tasks: defineTable({
    circularId: v.id("circulars"),
    team: v.string(),
    deadline: v.optional(v.union(v.string(), v.null())),
    status: v.string(),
  })
    .index("by_circular", ["circularId"])
    .index("by_team", ["team"]),

  auditLog: defineTable({
    circularId: v.optional(v.id("circulars")),
    taskId: v.optional(v.id("tasks")),
    action: v.string(),
    detail: v.string(),
  }).index("by_circular", ["circularId"]),

  subscribers: defineTable({
    email: v.string(),
    schemes: v.array(v.string()), // empty array = all schemes
  }).index("by_email", ["email"]),
});
