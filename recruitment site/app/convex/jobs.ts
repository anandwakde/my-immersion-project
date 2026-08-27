import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") +
    "-" +
    Math.random().toString(36).slice(2, 8)
  );
}

export const create = mutation({
  args: {
    title: v.string(),
    location: v.string(),
    experience: v.string(),
    salary: v.string(),
    description: v.string(),
    responsibilities: v.array(v.string()),
    skills: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Must be signed in to create a job");
    }
    const slug = slugify(args.title);
    const jobId = await ctx.db.insert("jobs", {
      ...args,
      status: "published",
      slug,
      createdBy: userId,
    });
    return { jobId, slug };
  },
});

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return [];
    }
    return await ctx.db
      .query("jobs")
      .withIndex("by_createdBy", (q) => q.eq("createdBy", userId))
      .order("desc")
      .take(50);
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const job = await ctx.db
      .query("jobs")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (job === null || job.status !== "published") {
      return null;
    }
    return job;
  },
});
