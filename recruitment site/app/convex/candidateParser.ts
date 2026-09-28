"use node";

import { ConvexError, v } from "convex/values";
import { action, env } from "./_generated/server";
import { internal } from "./_generated/api";
import { extractResumeText } from "./resumeExtraction";

// This prompt is deliberately different in spirit from netlinkConvert.ts's
// PDF-conversion prompt: that one preserves wording verbatim (it's a
// candidate-facing document). This one is building a structured database
// record for filtering and matching, so normalizing/summarizing IS the
// point — e.g. estimating total years of experience from date ranges, or
// writing a summary when the resume doesn't have one.
const MAX_RESUME_TEXT_LENGTH = 60000;

type ParsedProfile = {
  currentTitle: string;
  totalExperienceYears: number;
  summary: string;
  skills: string[];
  experience: { organization: string; title: string; dates: string; bullets: string[] }[];
  education: { degree: string; institution: string; dates: string }[];
  noticePeriod: string;
  currentSalary: string;
  expectedSalary: string;
  location: string;
};

export const parseResume = action({
  args: { applicationId: v.id("applications") },
  returns: v.object({ parsed: v.boolean() }),
  handler: async (ctx, args) => {
    const info = await ctx.runQuery(internal.candidates.getForParse, {
      applicationId: args.applicationId,
    });
    if (info === null) {
      throw new ConvexError("Application not found.");
    }

    const blob = await ctx.storage.get(info.resumeStorageId);
    if (blob === null) {
      throw new ConvexError("Resume file is missing.");
    }
    const buffer = Buffer.from(await blob.arrayBuffer());
    const resumeText = await extractResumeText(buffer, info.resumeContentType, MAX_RESUME_TEXT_LENGTH);

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
            content: `You extract a candidate's professional profile from their resume's raw text into structured fields for a recruiting database. Unlike a document-formatting tool, here you SHOULD normalize and synthesize where that makes the data more useful for filtering and search — e.g. estimate total years of experience from the work history's date ranges if it isn't stated outright, and list skills as clean individual keywords rather than full sentences.

Return ONLY a JSON object with keys:
- "currentTitle": the candidate's current or most recent job title (string; empty string if unclear).
- "totalExperienceYears": total years of professional experience (number). Estimate it from the work history's date ranges if not explicitly stated. Use 0 only if there is genuinely no work history.
- "summary": a concise 2-4 sentence professional summary in third person, synthesized from the resume's content — write one even if the resume has no explicit summary/objective section.
- "skills": a flat array of individual skill/technology/tool keywords, deduplicated, each a short string (not full sentences).
- "experience": an array of past roles, most recent first, each an object with "organization", "title", "dates" (as written, e.g. "Jan 2022 - Present"), and "bullets" (an array of concise achievement/responsibility strings — light wording cleanup is fine, but do not invent accomplishments the source doesn't support).
- "education": an array of objects with "degree", "institution", "dates".
- "noticePeriod": the candidate's notice period, ONLY if explicitly stated in the resume (e.g. "30 days", "Immediate joiner") — otherwise an empty string. Do not guess.
- "currentSalary": current salary/CTC, ONLY if explicitly stated — otherwise an empty string. Do not guess.
- "expectedSalary": expected salary, ONLY if explicitly stated — otherwise an empty string. Do not guess.
- "location": the candidate's current city/location, ONLY if stated — otherwise an empty string.

Do not invent employers, dates, degrees, or numbers with no reasonable basis in the source text. For fields that are genuinely absent from the resume (notice period, salary figures, location) return an empty string rather than guessing — these feed real hiring decisions, and a wrong guess is worse than a blank.`,
          },
          { role: "user", content: resumeText },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
        max_tokens: 4096,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new ConvexError(`Resume parsing failed (${res.status}): ${text.slice(0, 300)}`);
    }

    const completion = await res.json();
    const raw = completion.choices?.[0]?.message?.content;
    if (typeof raw !== "string") {
      throw new ConvexError("Resume parsing returned no content.");
    }

    let parsed: ParsedProfile;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new ConvexError("Resume parsing returned invalid JSON.");
    }

    await ctx.runMutation(internal.candidates.mergeParsedFields, {
      candidateId: info.candidateId,
      parsed: {
        currentTitle: parsed.currentTitle || undefined,
        totalExperienceYears:
          typeof parsed.totalExperienceYears === "number" ? parsed.totalExperienceYears : undefined,
        summary: parsed.summary || undefined,
        skills: parsed.skills?.length ? parsed.skills : undefined,
        experience: parsed.experience?.length ? parsed.experience : undefined,
        education: parsed.education?.length ? parsed.education : undefined,
        noticePeriod: parsed.noticePeriod || undefined,
        currentSalary: parsed.currentSalary || undefined,
        expectedSalary: parsed.expectedSalary || undefined,
        location: parsed.location || undefined,
      },
    });

    return { parsed: true };
  },
});
