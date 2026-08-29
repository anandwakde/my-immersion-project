import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  waitlist: defineTable({
    email: v.string(),
    reference: v.string(),
    source: v.string(),
  }).index("by_email", ["email"]),

  // ---------- AUTH (hand-rolled — this app has no bundler/React, so
  // @convex-dev/auth's React-oriented client isn't a fit; a simple
  // email+password + bearer-token session is, and it plugs into the
  // existing plain-fetch httpAction architecture directly). ----------
  users: defineTable({
    email: v.string(),
    passwordHash: v.string(),
    passwordSalt: v.string(),
  }).index("by_email", ["email"]),

  sessions: defineTable({
    token: v.string(),
    userId: v.id("users"),
    expiresAt: v.number(),
  }).index("by_token", ["token"]),

  circulars: defineTable({
    scheme: v.string(),
    title: v.string(),
    urgency: v.string(),
    deadline: v.string(),
    deadlineDate: v.optional(v.union(v.string(), v.null())),
    scope: v.string(),
    sourceUrl: v.string(),
    fileHash: v.optional(v.string()),
  })
    .index("by_file_hash", ["fileHash"])
    .index("by_source_url", ["sourceUrl"]),

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

  // Per-user (V3) — one profile per logged-in account, not a singleton.
  companyProfile: defineTable({
    userId: v.id("users"),
    legalEntityName: v.string(),
    customerType: v.string(), // "Issuer" | "Acquirer" | "Processor" | "Fintech" | "Merchant" | "Payment Institution"
    countries: v.array(v.string()), // global — not limited to GCC/CEMEA
    schemes: v.array(v.string()), // full scheme list, not limited to Visa/Mastercard
  }).index("by_user", ["userId"]),

  // Per-user relevance verdict + financial impact for a given circular.
  // The same circular can have a different verdict for every user.
  circularVerdicts: defineTable({
    userId: v.id("users"),
    circularId: v.id("circulars"),
    appliesToCompany: v.boolean(),
    applicabilityReason: v.string(),
    checkedAt: v.number(),
    financialImpactSummary: v.optional(v.string()),
    financialImpactCheckedAt: v.optional(v.number()),
  })
    .index("by_user_and_circular", ["userId", "circularId"])
    .index("by_user", ["userId"]),

  // AI-extracted obligations, private per user.
  obligations: defineTable({
    userId: v.id("users"),
    circularId: v.id("circulars"),
    description: v.string(),
  }).index("by_user_and_circular", ["userId", "circularId"]),

  // One implementation-plan row per obligation, private per user.
  planItems: defineTable({
    userId: v.id("users"),
    obligationId: v.id("obligations"),
    circularId: v.id("circulars"),
    owner: v.string(),
    dueDate: v.optional(v.string()),
    evidenceType: v.optional(
      v.union(v.literal("file"), v.literal("link"), v.literal("note"))
    ),
    evidenceContent: v.optional(v.string()),
    evidenceFileId: v.optional(v.id("_storage")),
    signedOff: v.boolean(),
    signedOffAt: v.optional(v.number()),
  })
    .index("by_user_and_circular", ["userId", "circularId"])
    .index("by_obligation", ["obligationId"]),
});
