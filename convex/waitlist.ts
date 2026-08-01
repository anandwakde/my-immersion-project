import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

function generateReference() {
  const year = new Date().getFullYear();
  const n = Math.floor(1000 + Math.random() * 9000);
  return `WAITLIST/${year}/${n}`;
}

export const create = internalMutation({
  args: {
    email: v.string(),
    source: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("waitlist")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
    if (existing) {
      return existing.reference;
    }
    const reference = generateReference();
    await ctx.db.insert("waitlist", {
      email: args.email,
      source: args.source,
      reference,
    });
    return reference;
  },
});
