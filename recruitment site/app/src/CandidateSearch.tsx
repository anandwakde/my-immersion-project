import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type MatchBucket = "strong" | "medium" | "weak";

function CandidateCard({
  candidate,
}: {
  candidate: {
    _id: Id<"candidates">;
    name: string;
    currentTitle?: string;
    totalExperienceYears?: number;
    location?: string;
    skills?: string[];
    education?: { degree: string; institution: string; dates: string }[];
    matchScore: number | null;
    applicationId: Id<"applications"> | null;
  };
}) {
  const [expanded, setExpanded] = useState(false);
  const profile = useQuery(api.candidates.get, expanded ? { candidateId: candidate._id } : "skip");

  return (
    <li className="rounded-lg border border-border bg-card p-4 text-sm shadow-sm">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">{candidate.name}</span>
            {candidate.currentTitle && (
              <span className="text-muted-foreground">— {candidate.currentTitle}</span>
            )}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {candidate.totalExperienceYears !== undefined && `${candidate.totalExperienceYears} yrs exp`}
            {candidate.totalExperienceYears !== undefined && candidate.location && " · "}
            {candidate.location}
          </div>
          {candidate.skills && candidate.skills.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {candidate.skills.slice(0, 8).map((skill) => (
                <span
                  key={skill}
                  className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {skill}
                </span>
              ))}
            </div>
          )}
        </div>
        {candidate.matchScore !== null && (
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ${
              candidate.matchScore >= 70
                ? "bg-accent text-accent-foreground"
                : candidate.matchScore >= 40
                  ? "bg-secondary text-secondary-foreground"
                  : "bg-destructive/10 text-destructive"
            }`}
          >
            {candidate.matchScore}/100
          </span>
        )}
      </button>

      {expanded && (
        <div className="mt-4 flex flex-col gap-3 border-t border-border pt-3">
          {profile === undefined && <p className="text-xs text-muted-foreground">Loading...</p>}
          {profile && profile.summary && <p className="text-muted-foreground">{profile.summary}</p>}
          {profile && profile.experience && profile.experience.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Experience</p>
              <ul className="mt-1 flex flex-col gap-2">
                {profile.experience.map((e, i) => (
                  <li key={i}>
                    <p className="font-medium text-foreground">
                      {e.title} at {e.organization}
                    </p>
                    <p className="text-xs text-muted-foreground">{e.dates}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {candidate.education && candidate.education.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Education</p>
              <ul className="mt-1 flex flex-col gap-0.5">
                {candidate.education.map((e, i) => (
                  <li key={i} className="text-muted-foreground">
                    {e.degree}, {e.institution}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export function CandidateSearch() {
  const [searchTerm, setSearchTerm] = useState("");
  const [minExperience, setMinExperience] = useState("");
  const [maxExperience, setMaxExperience] = useState("");
  const [location, setLocation] = useState("");
  const [education, setEducation] = useState("");
  const [jobId, setJobId] = useState<string>("");
  const [matchBucket, setMatchBucket] = useState<string>("");

  const jobs = useQuery(api.jobs.listAll);
  const results = useQuery(api.candidates.searchCandidates, {
    searchTerm: searchTerm.trim() || undefined,
    minExperience: minExperience ? Number(minExperience) : undefined,
    maxExperience: maxExperience ? Number(maxExperience) : undefined,
    location: location.trim() || undefined,
    education: education.trim() || undefined,
    jobId: jobId ? (jobId as Id<"jobs">) : undefined,
    matchBucket: jobId && matchBucket ? (matchBucket as MatchBucket) : undefined,
  });

  return (
    <div className="mt-6 flex flex-col gap-6">
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <Input
          placeholder="Search by name, title, or skill..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="minExp">Min years exp.</Label>
            <Input
              id="minExp"
              type="number"
              min={0}
              value={minExperience}
              onChange={(e) => setMinExperience(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="maxExp">Max years exp.</Label>
            <Input
              id="maxExp"
              type="number"
              min={0}
              value={maxExperience}
              onChange={(e) => setMaxExperience(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="location">Location</Label>
            <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="education">Education</Label>
            <Input id="education" value={education} onChange={(e) => setEducation(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="job">Job (for match score)</Label>
            <select
              id="job"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={jobId}
              onChange={(e) => {
                setJobId(e.target.value);
                if (!e.target.value) setMatchBucket("");
              }}
            >
              <option value="">Any</option>
              {jobs?.map((job) => (
                <option key={job._id} value={job._id}>
                  {job.title}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="matchBucket">Match strength</Label>
            <select
              id="matchBucket"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
              value={matchBucket}
              disabled={!jobId}
              onChange={(e) => setMatchBucket(e.target.value)}
            >
              <option value="">Any</option>
              <option value="strong">Strong (70+)</option>
              <option value="medium">Medium (40-69)</option>
              <option value="weak">Weak (&lt;40)</option>
            </select>
          </div>
        </div>
      </div>

      <div>
        <p className="text-sm text-muted-foreground">
          {results === undefined ? "Searching..." : `${results.length} candidate${results.length === 1 ? "" : "s"}`}
        </p>
        <ul className="mt-3 flex flex-col gap-3">
          {results?.map((candidate) => (
            <CandidateCard key={candidate._id} candidate={candidate} />
          ))}
          {results?.length === 0 && (
            <li className="text-sm text-muted-foreground">No candidates match these filters.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
