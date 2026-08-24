import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const addressFieldsValidator = v.object({
  floorUnit: v.union(v.string(), v.null()),
  buildingNumber: v.union(v.string(), v.null()),
  streetName: v.union(v.string(), v.null()),
  townName: v.union(v.string(), v.null()),
  postalCode: v.union(v.string(), v.null()),
  countryCode: v.union(v.string(), v.null()),
  countryName: v.union(v.string(), v.null()),
});

export default defineSchema({
  addressChecks: defineTable({
    rawAddress: v.string(),
    aiFields: addressFieldsValidator,
    finalFields: addressFieldsValidator,
    confidence: v.number(),
    missingRequiredFields: v.array(v.string()),
    status: v.union(v.literal("ready"), v.literal("needs_review")),
    reviewed: v.boolean(),
  }),
});
