import { useAction, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useState } from "react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ExperienceEntry = { organization: string; title: string; dates: string; bullets: string[] };
type EducationEntry = { degree: string; institution: string; dates: string };

function ProfileForm({
  candidateId,
  initial,
}: {
  candidateId: Id<"candidates">;
  initial: {
    currentTitle?: string;
    totalExperienceYears?: number;
    summary?: string;
    skills?: string[];
    experience?: ExperienceEntry[];
    education?: EducationEntry[];
    noticePeriod?: string;
    currentSalary?: string;
    expectedSalary?: string;
    location?: string;
  };
}) {
  const updateProfile = useMutation(api.candidates.updateProfile);
  const [currentTitle, setCurrentTitle] = useState(initial.currentTitle ?? "");
  const [totalExperienceYears, setTotalExperienceYears] = useState(
    initial.totalExperienceYears !== undefined ? String(initial.totalExperienceYears) : "",
  );
  const [summary, setSummary] = useState(initial.summary ?? "");
  const [skillsText, setSkillsText] = useState((initial.skills ?? []).join(", "));
  const [experience, setExperience] = useState<ExperienceEntry[]>(initial.experience ?? []);
  const [education, setEducation] = useState<EducationEntry[]>(initial.education ?? []);
  const [noticePeriod, setNoticePeriod] = useState(initial.noticePeriod ?? "");
  const [currentSalary, setCurrentSalary] = useState(initial.currentSalary ?? "");
  const [expectedSalary, setExpectedSalary] = useState(initial.expectedSalary ?? "");
  const [location, setLocation] = useState(initial.location ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function updateExperience(index: number, patch: Partial<ExperienceEntry>) {
    setExperience((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  }
  function updateEducation(index: number, patch: Partial<EducationEntry>) {
    setEducation((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  }

  function save() {
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    updateProfile({
      candidateId,
      currentTitle,
      totalExperienceYears: totalExperienceYears.trim() ? Number(totalExperienceYears) : 0,
      summary,
      skills: skillsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      experience,
      education,
      noticePeriod,
      currentSalary,
      expectedSalary,
      location,
    })
      .then(() => setSaved(true))
      .catch((err) => {
        setSaveError(
          err instanceof ConvexError && typeof err.data === "string"
            ? err.data
            : "Couldn't save. Please try again.",
        );
      })
      .finally(() => setSaving(false));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="cp-title">Current title</Label>
          <Input id="cp-title" value={currentTitle} onChange={(e) => setCurrentTitle(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="cp-experience-years">Total experience (years)</Label>
          <Input
            id="cp-experience-years"
            type="number"
            min="0"
            step="0.5"
            value={totalExperienceYears}
            onChange={(e) => setTotalExperienceYears(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="cp-location">Location</Label>
          <Input id="cp-location" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="cp-notice">Notice period</Label>
          <Input id="cp-notice" value={noticePeriod} onChange={(e) => setNoticePeriod(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="cp-current-salary">Current salary</Label>
          <Input id="cp-current-salary" value={currentSalary} onChange={(e) => setCurrentSalary(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="cp-expected-salary">Expected salary</Label>
          <Input
            id="cp-expected-salary"
            value={expectedSalary}
            onChange={(e) => setExpectedSalary(e.target.value)}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="cp-summary">Summary</Label>
        <Textarea id="cp-summary" rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} />
      </div>

      <div>
        <Label htmlFor="cp-skills">Skills (comma-separated)</Label>
        <Textarea id="cp-skills" rows={2} value={skillsText} onChange={(e) => setSkillsText(e.target.value)} />
      </div>

      {experience.length > 0 && (
        <div className="flex flex-col gap-3">
          <Label>Experience</Label>
          {experience.map((entry, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-md border border-border p-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Input
                  placeholder="Organization"
                  value={entry.organization}
                  onChange={(e) => updateExperience(i, { organization: e.target.value })}
                />
                <Input
                  placeholder="Title"
                  value={entry.title}
                  onChange={(e) => updateExperience(i, { title: e.target.value })}
                />
                <Input
                  placeholder="Dates"
                  value={entry.dates}
                  onChange={(e) => updateExperience(i, { dates: e.target.value })}
                />
              </div>
              <Textarea
                rows={3}
                placeholder="One bullet per line"
                value={entry.bullets.join("\n")}
                onChange={(e) => updateExperience(i, { bullets: e.target.value.split("\n") })}
              />
            </div>
          ))}
        </div>
      )}

      {education.length > 0 && (
        <div className="flex flex-col gap-3">
          <Label>Education</Label>
          {education.map((entry, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 rounded-md border border-border p-3 sm:grid-cols-3">
              <Input
                placeholder="Degree"
                value={entry.degree}
                onChange={(e) => updateEducation(i, { degree: e.target.value })}
              />
              <Input
                placeholder="Institution"
                value={entry.institution}
                onChange={(e) => updateEducation(i, { institution: e.target.value })}
              />
              <Input
                placeholder="Dates"
                value={entry.dates}
                onChange={(e) => updateEducation(i, { dates: e.target.value })}
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button size="sm" disabled={saving} onClick={save}>
          {saving ? "Saving..." : "Save profile"}
        </Button>
        {saved && <span className="text-sm text-muted-foreground">Saved.</span>}
        {saveError && <span className="text-sm text-destructive">{saveError}</span>}
      </div>
    </div>
  );
}

export function CandidateProfile({
  candidateId,
  applicationId,
}: {
  candidateId: Id<"candidates">;
  applicationId: Id<"applications">;
}) {
  const candidate = useQuery(api.candidates.get, { candidateId });
  const parseResume = useAction(api.candidateParser.parseResume);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Candidate profile</h2>
          <p className="text-sm text-muted-foreground">
            {candidate?.parsedAt ? `Parsed ${new Date(candidate.parsedAt).toLocaleString()}` : "Not parsed yet"}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={parsing}
          onClick={() => {
            setParsing(true);
            setParseError(null);
            parseResume({ applicationId })
              .catch((err) => {
                setParseError(
                  err instanceof ConvexError && typeof err.data === "string"
                    ? err.data
                    : "Parsing failed. Please try again.",
                );
              })
              .finally(() => setParsing(false));
          }}
        >
          {parsing ? "Parsing..." : "Parse resume"}
        </Button>
      </div>
      {parseError && <p className="text-sm text-destructive">{parseError}</p>}

      {candidate === undefined && <p className="text-sm text-muted-foreground">Loading...</p>}
      {candidate === null && <p className="text-sm text-muted-foreground">Candidate not found.</p>}
      {candidate && <ProfileForm key={candidate.parsedAt ?? "unparsed"} candidateId={candidateId} initial={candidate} />}
    </div>
  );
}
