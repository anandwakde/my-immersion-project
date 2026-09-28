import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc } from "./_generated/dataModel";

const experienceEntryValidator = v.object({
  organization: v.string(),
  title: v.string(),
  dates: v.string(),
  bullets: v.array(v.string()),
});

const educationEntryValidator = v.object({
  degree: v.string(),
  institution: v.string(),
  dates: v.string(),
});

// Kept in sync on every write that can change name/currentTitle/skills, so
// the Milestone 5 search index always reflects the candidate's current
// profile instead of going stale.
export function buildSearchText(name: string, currentTitle?: string, skills?: string[]): string {
  return [name, currentTitle ?? "", ...(skills ?? [])].filter(Boolean).join(" ");
}

export const get = query({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, args) => {
    // Any signed-in recruiter can view any candidate — same model as
    // applications (see listAll in jobs.ts).
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }
    return await ctx.db.get("candidates", args.candidateId);
  },
});

// Manual edits from the candidate profile UI. Every field is optional so a
// caller can send just the fields it's changing — but note "omitted" and
// "explicitly empty" are different here: an omitted field is left alone, an
// explicitly-sent empty string/array clears it. The profile form always
// sends its full current state, so this matches what the recruiter sees.
export const updateProfile = mutation({
  args: {
    candidateId: v.id("candidates"),
    currentTitle: v.optional(v.string()),
    totalExperienceYears: v.optional(v.number()),
    summary: v.optional(v.string()),
    skills: v.optional(v.array(v.string())),
    experience: v.optional(v.array(experienceEntryValidator)),
    education: v.optional(v.array(educationEntryValidator)),
    noticePeriod: v.optional(v.string()),
    currentSalary: v.optional(v.string()),
    expectedSalary: v.optional(v.string()),
    location: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("Must be signed in.");
    }
    const candidate = await ctx.db.get("candidates", args.candidateId);
    if (candidate === null) {
      throw new ConvexError("Candidate not found.");
    }
    const patch: Partial<Doc<"candidates">> = {};
    if (args.currentTitle !== undefined) patch.currentTitle = args.currentTitle;
    if (args.totalExperienceYears !== undefined) patch.totalExperienceYears = args.totalExperienceYears;
    if (args.summary !== undefined) patch.summary = args.summary;
    if (args.skills !== undefined) patch.skills = args.skills;
    if (args.experience !== undefined) patch.experience = args.experience;
    if (args.education !== undefined) patch.education = args.education;
    if (args.noticePeriod !== undefined) patch.noticePeriod = args.noticePeriod;
    if (args.currentSalary !== undefined) patch.currentSalary = args.currentSalary;
    if (args.expectedSalary !== undefined) patch.expectedSalary = args.expectedSalary;
    if (args.location !== undefined) patch.location = args.location;
    patch.searchText = buildSearchText(
      candidate.name,
      args.currentTitle !== undefined ? args.currentTitle : candidate.currentTitle,
      args.skills !== undefined ? args.skills : candidate.skills,
    );
    await ctx.db.patch("candidates", args.candidateId, patch);
  },
});

export const getForParse = internalQuery({
  args: { applicationId: v.id("applications") },
  returns: v.union(
    v.null(),
    v.object({
      candidateId: v.id("candidates"),
      resumeStorageId: v.id("_storage"),
      resumeContentType: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    // Any signed-in recruiter can parse any application's resume — see
    // listAll in jobs.ts.
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }
    const application = await ctx.db.get("applications", args.applicationId);
    if (application === null) {
      return null;
    }
    const resumeMeta = await ctx.db.system.get("_storage", application.resumeStorageId);
    return {
      candidateId: application.candidateId,
      resumeStorageId: application.resumeStorageId,
      resumeContentType: resumeMeta?.contentType ?? null,
    };
  },
});

// Writes AI-parsed fields onto a candidate, but ONLY into fields that are
// still empty — a recruiter's manual correction always wins over a later
// re-parse (e.g. after a newer resume is uploaded for the same candidate).
export const mergeParsedFields = internalMutation({
  args: {
    candidateId: v.id("candidates"),
    parsed: v.object({
      currentTitle: v.optional(v.string()),
      totalExperienceYears: v.optional(v.number()),
      summary: v.optional(v.string()),
      skills: v.optional(v.array(v.string())),
      experience: v.optional(v.array(experienceEntryValidator)),
      education: v.optional(v.array(educationEntryValidator)),
      noticePeriod: v.optional(v.string()),
      currentSalary: v.optional(v.string()),
      expectedSalary: v.optional(v.string()),
      location: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const candidate = await ctx.db.get("candidates", args.candidateId);
    if (candidate === null) {
      throw new ConvexError("Candidate not found.");
    }
    const { parsed } = args;
    const patch: Partial<Doc<"candidates">> = { parsedAt: Date.now() };

    if (parsed.currentTitle !== undefined && !candidate.currentTitle) {
      patch.currentTitle = parsed.currentTitle;
    }
    if (parsed.totalExperienceYears !== undefined && candidate.totalExperienceYears === undefined) {
      patch.totalExperienceYears = parsed.totalExperienceYears;
    }
    if (parsed.summary !== undefined && !candidate.summary) {
      patch.summary = parsed.summary;
    }
    if (parsed.skills !== undefined && (!candidate.skills || candidate.skills.length === 0)) {
      patch.skills = parsed.skills;
    }
    if (parsed.experience !== undefined && (!candidate.experience || candidate.experience.length === 0)) {
      patch.experience = parsed.experience;
    }
    if (parsed.education !== undefined && (!candidate.education || candidate.education.length === 0)) {
      patch.education = parsed.education;
    }
    if (parsed.noticePeriod !== undefined && !candidate.noticePeriod) {
      patch.noticePeriod = parsed.noticePeriod;
    }
    if (parsed.currentSalary !== undefined && !candidate.currentSalary) {
      patch.currentSalary = parsed.currentSalary;
    }
    if (parsed.expectedSalary !== undefined && !candidate.expectedSalary) {
      patch.expectedSalary = parsed.expectedSalary;
    }
    if (parsed.location !== undefined && !candidate.location) {
      patch.location = parsed.location;
    }

    patch.searchText = buildSearchText(
      candidate.name,
      patch.currentTitle ?? candidate.currentTitle,
      patch.skills ?? candidate.skills,
    );

    await ctx.db.patch("candidates", args.candidateId, patch);
  },
});

// For AI matching (Milestone 3): every application for a job, with its
// candidate's parsed profile. A candidate who hasn't been parsed yet (no
// Milestone 2 data) has nothing structured to score against, so they're
// left out here — the matching action reports how many were skipped.
export const getCandidatesForJob = internalQuery({
  args: { jobId: v.id("jobs") },
  returns: v.array(
    v.object({
      applicationId: v.id("applications"),
      candidateId: v.id("candidates"),
      name: v.string(),
      currentTitle: v.optional(v.string()),
      totalExperienceYears: v.optional(v.number()),
      summary: v.optional(v.string()),
      skills: v.optional(v.array(v.string())),
      experience: v.optional(v.array(experienceEntryValidator)),
      education: v.optional(v.array(educationEntryValidator)),
    }),
  ),
  handler: async (ctx, args) => {
    const applications = await ctx.db
      .query("applications")
      .withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
      .collect();
    const results: {
      applicationId: typeof applications[number]["_id"];
      candidateId: Doc<"candidates">["_id"];
      name: string;
      currentTitle?: string;
      totalExperienceYears?: number;
      summary?: string;
      skills?: string[];
      experience?: Doc<"candidates">["experience"];
      education?: Doc<"candidates">["education"];
    }[] = [];
    for (const app of applications) {
      const candidate = await ctx.db.get("candidates", app.candidateId);
      if (candidate === null || candidate.parsedAt === undefined) continue;
      results.push({
        applicationId: app._id,
        candidateId: candidate._id,
        name: candidate.name,
        currentTitle: candidate.currentTitle,
        totalExperienceYears: candidate.totalExperienceYears,
        summary: candidate.summary,
        skills: candidate.skills,
        experience: candidate.experience,
        education: candidate.education,
      });
    }
    return results;
  },
});

// Every application for a job, whether or not it's been parsed — used
// alongside getCandidatesForJob just to report how many were skipped.
export const countApplicationsForJob = internalQuery({
  args: { jobId: v.id("jobs") },
  returns: v.number(),
  handler: async (ctx, args) => {
    const applications = await ctx.db
      .query("applications")
      .withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
      .collect();
    return applications.length;
  },
});

// Milestone 5: the first query that searches across every candidate
// globally rather than one job's applicants. `jobId` is optional — pass it
// to also show each candidate's match score for that specific job (and to
// enable the matchBucket filter), since a match score only exists per
// job/application, not on the candidate record itself.
export const searchCandidates = query({
  args: {
    searchTerm: v.optional(v.string()),
    jobId: v.optional(v.id("jobs")),
    minExperience: v.optional(v.number()),
    maxExperience: v.optional(v.number()),
    location: v.optional(v.string()),
    education: v.optional(v.string()),
    matchBucket: v.optional(v.union(v.literal("strong"), v.literal("medium"), v.literal("weak"))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return [];
    }

    const term = args.searchTerm?.trim();
    const candidates = term
      ? await ctx.db
          .query("candidates")
          .withSearchIndex("search_candidates", (q) => q.search("searchText", term))
          .take(200)
      : await ctx.db.query("candidates").take(500);

    const locationFilter = args.location?.trim().toLowerCase();
    const educationFilter = args.education?.trim().toLowerCase();

    const results: {
      _id: Doc<"candidates">["_id"];
      name: string;
      currentTitle?: string;
      totalExperienceYears?: number;
      location?: string;
      skills?: string[];
      education?: Doc<"candidates">["education"];
      matchScore: number | null;
      applicationId: Doc<"applications">["_id"] | null;
    }[] = [];

    for (const candidate of candidates) {
      if (
        args.minExperience !== undefined &&
        (candidate.totalExperienceYears === undefined || candidate.totalExperienceYears < args.minExperience)
      ) {
        continue;
      }
      if (
        args.maxExperience !== undefined &&
        (candidate.totalExperienceYears === undefined || candidate.totalExperienceYears > args.maxExperience)
      ) {
        continue;
      }
      if (locationFilter && !(candidate.location ?? "").toLowerCase().includes(locationFilter)) {
        continue;
      }
      if (
        educationFilter &&
        !(candidate.education ?? []).some((e) =>
          `${e.degree} ${e.institution}`.toLowerCase().includes(educationFilter),
        )
      ) {
        continue;
      }

      let matchScore: number | null = null;
      let applicationId: Doc<"applications">["_id"] | null = null;
      if (args.jobId !== undefined) {
        const application = await ctx.db
          .query("applications")
          .withIndex("by_jobId_and_candidateId", (q) => q.eq("jobId", args.jobId!).eq("candidateId", candidate._id))
          .unique();
        if (application !== null) {
          applicationId = application._id;
          const match = await ctx.db
            .query("matches")
            .withIndex("by_applicationId", (q) => q.eq("applicationId", application._id))
            .unique();
          matchScore = match?.score ?? null;
        }

        if (args.matchBucket !== undefined) {
          const bucket = matchScore === null ? null : matchScore >= 70 ? "strong" : matchScore >= 40 ? "medium" : "weak";
          if (bucket !== args.matchBucket) continue;
        }
      }

      results.push({
        _id: candidate._id,
        name: candidate.name,
        currentTitle: candidate.currentTitle,
        totalExperienceYears: candidate.totalExperienceYears,
        location: candidate.location,
        skills: candidate.skills,
        education: candidate.education,
        matchScore,
        applicationId,
      });
    }

    return results.slice(0, 100);
  },
});
