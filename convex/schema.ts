import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  waitlist: defineTable({
    email: v.string(),
    reference: v.string(),
    source: v.string(),
  }).index("by_email", ["email"]),

  circulars: defineTable({
    scheme: v.optional(v.string()),
    title: v.optional(v.string()),
    urgency: v.optional(v.string()),
    deadline: v.optional(v.string()),
    deadlineDate: v.optional(v.union(v.string(), v.null())),
    scope: v.optional(v.string()),
    sourceUrl: v.string(),
    failed: v.optional(v.boolean()),
    errorMessage: v.optional(v.string()),
  }),
});
