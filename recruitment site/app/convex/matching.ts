import { ConvexError, v } from "convex/values";
import { action, env } from "./_generated/server";
import { internal } from "./_generated/api";

type ScoreResult = {
  score: number;
  strengths: string[];
  gaps: string[];
  evidence: string;
};

async function scoreOneCandidate(
  apiKey: string,
  job: { title: string; mustHaveRequirements: string[]; niceToHaveRequirements: string[] },
  candidate: {
    name: string;
    currentTitle?: string;
    totalExperienceYears?: number;
    summary?: string;
    skills?: string[];
    experience?: { organization: string; title: string; dates: string; bullets: string[] }[];
    education?: { degree: string; institution: string; dates: string }[];
  },
): Promise<ScoreResult> {
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
          content: `You score one candidate's fit against a job's requirements, for a recruiter deciding who to shortlist. Be honest and specific — this is a working tool, not a hype generator, and an inflated score that turns out wrong wastes a recruiter's time later in the process.

Return ONLY a JSON object with keys:
- "score": an integer from 0 to 100 for overall fit. Weight must-have requirements much more heavily than nice-to-have ones — missing several must-haves should pull the score well down even if nice-to-haves are covered.
- "strengths": an array of short strings, each a specific, concrete reason this candidate fits — reference their actual listed skills, roles, or experience, not generic praise like "strong communicator" unless the source material actually supports it.
- "gaps": an array of short strings, each a specific requirement the candidate appears to be missing or weak on. Empty array only if there are genuinely none.
- "evidence": one or two sentences explaining what in the candidate's background actually drove this score — grounded in specifics, not a restatement of the score itself.

Base this only on the job requirements and candidate profile given to you. Do not invent skills or experience the candidate's profile doesn't support, and do not soften gaps to be encouraging.`,
        },
        { role: "user", content: JSON.stringify({ job, candidate }) },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new ConvexError(`Candidate scoring failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const completion = await res.json();
  const raw = completion.choices?.[0]?.message?.content;
  if (typeof raw !== "string") {
    throw new ConvexError("Candidate scoring returned no content.");
  }

  let parsed: ScoreResult;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ConvexError("Candidate scoring returned invalid JSON.");
  }
  return {
    score: typeof parsed.score === "number" ? parsed.score : 0,
    strengths: parsed.strengths ?? [],
    gaps: parsed.gaps ?? [],
    evidence: parsed.evidence ?? "",
  };
}

// Recruiter-triggered, once per job — scores every applicant who has a
// parsed profile (Milestone 2) against that job's must-have/nice-to-have
// requirements (Milestone 3's JD Analyzer). Scores one candidate at a time
// rather than batching them into a single AI call, so one candidate's
// result is never at risk from another's — at the cost of being slower for
// a job with many applicants.
export const scoreCandidates = action({
  args: { jobId: v.id("jobs") },
  returns: v.object({ scored: v.number(), skipped: v.number() }),
  handler: async (ctx, args): Promise<{ scored: number; skipped: number }> => {
    const job = await ctx.runQuery(internal.jobs.getForMatching, { jobId: args.jobId });
    if (job === null) {
      throw new ConvexError("Job not found.");
    }
    if (job.mustHaveRequirements.length === 0 && job.niceToHaveRequirements.length === 0) {
      throw new ConvexError("Analyze the job description first — there are no requirements to match against yet.");
    }

    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new ConvexError("OPENAI_API_KEY is not set on this deployment.");
    }

    const candidates = await ctx.runQuery(internal.candidates.getCandidatesForJob, { jobId: args.jobId });
    const totalApplications = await ctx.runQuery(internal.candidates.countApplicationsForJob, {
      jobId: args.jobId,
    });

    let scored = 0;
    for (const candidate of candidates) {
      const result = await scoreOneCandidate(apiKey, job, candidate);
      await ctx.runMutation(internal.matches.save, {
        applicationId: candidate.applicationId,
        jobId: args.jobId,
        score: result.score,
        strengths: result.strengths,
        gaps: result.gaps,
        evidence: result.evidence,
      });
      scored++;
    }

    return { scored, skipped: totalApplications - scored };
  },
});
