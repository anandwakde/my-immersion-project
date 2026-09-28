import { ConvexError, v } from "convex/values";
import { action, env } from "./_generated/server";
import { internal } from "./_generated/api";

type AnalyzedRequirements = {
  mustHaveRequirements: string[];
  niceToHaveRequirements: string[];
};

// Recruiter-triggered (a button, like "Parse resume") — turns a job posting
// into structured must-have / nice-to-have requirements that AI matching
// (Milestone 3's "Score candidates") scores candidates against. The
// recruiter can edit the result before it's used (see jobs.updateRequirements).
export const analyze = action({
  args: { jobId: v.id("jobs") },
  returns: v.object({ analyzed: v.boolean() }),
  handler: async (ctx, args) => {
    const job = await ctx.runQuery(internal.jobs.getForAnalysis, { jobId: args.jobId });
    if (job === null) {
      throw new ConvexError("Job not found.");
    }

    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new ConvexError("OPENAI_API_KEY is not set on this deployment.");
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You analyze a job posting to extract structured hiring requirements, used later to score candidates against this job.

Return ONLY a JSON object with keys:
- "mustHaveRequirements": an array of short strings, each one specific, essential requirement a candidate must have (a skill, a minimum experience level, a certification, a domain, etc.) derived from the job posting. Keep each one concise and concrete enough to check a resume against — not vague ("strong communicator") but specific ("5+ years of Node.js backend development").
- "niceToHaveRequirements": an array of short strings, same style, for requirements that are preferred but not essential.

Base this only on what the job posting actually says. Do not invent requirements the text doesn't support. If the posting is thin on detail, it's fine to return a short list rather than padding it out.`,
          },
          {
            role: "user",
            content: JSON.stringify({
              title: job.title,
              description: job.description,
              responsibilities: job.responsibilities,
              skills: job.skills,
            }),
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new ConvexError(`Job analysis failed (${res.status}): ${text.slice(0, 300)}`);
    }

    const completion = await res.json();
    const raw = completion.choices?.[0]?.message?.content;
    if (typeof raw !== "string") {
      throw new ConvexError("Job analysis returned no content.");
    }

    let parsed: AnalyzedRequirements;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new ConvexError("Job analysis returned invalid JSON.");
    }

    await ctx.runMutation(internal.jobs.setRequirements, {
      jobId: args.jobId,
      mustHaveRequirements: parsed.mustHaveRequirements ?? [],
      niceToHaveRequirements: parsed.niceToHaveRequirements ?? [],
    });

    return { analyzed: true };
  },
});
