import { useAction, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useState } from "react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function toLines(items: string[] | undefined): string {
  return (items ?? []).join("\n");
}
function fromLines(text: string): string[] {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function RequirementList({ label, items }: { label: string; items: string[] | undefined }) {
  return (
    <div>
      <p className="text-sm font-semibold text-foreground">{label}</p>
      {items && items.length > 0 ? (
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-foreground">
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">None</p>
      )}
    </div>
  );
}

// Read-only once requirements exist, so the analysis result reads as a
// finished answer rather than an open form; Edit switches to the form.
function RequirementsView({
  jobId,
  job,
}: {
  jobId: Id<"jobs">;
  job: { mustHaveRequirements?: string[]; niceToHaveRequirements?: string[] };
}) {
  const hasRequirements =
    (job.mustHaveRequirements?.length ?? 0) > 0 || (job.niceToHaveRequirements?.length ?? 0) > 0;
  const [editing, setEditing] = useState(false);

  if (editing || !hasRequirements) {
    return (
      <RequirementsForm
        jobId={jobId}
        initial={job}
        onDone={hasRequirements ? () => setEditing(false) : undefined}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <RequirementList label="Must-have requirements" items={job.mustHaveRequirements} />
      <RequirementList label="Nice-to-have requirements" items={job.niceToHaveRequirements} />
      <div>
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          Edit requirements
        </Button>
      </div>
    </div>
  );
}

function RequirementsForm({
  jobId,
  initial,
  onDone,
}: {
  jobId: Id<"jobs">;
  initial: { mustHaveRequirements?: string[]; niceToHaveRequirements?: string[] };
  onDone?: () => void;
}) {
  const updateRequirements = useMutation(api.jobs.updateRequirements);
  const [mustHaveText, setMustHaveText] = useState(toLines(initial.mustHaveRequirements));
  const [niceToHaveText, setNiceToHaveText] = useState(toLines(initial.niceToHaveRequirements));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function save() {
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    updateRequirements({
      jobId,
      mustHaveRequirements: fromLines(mustHaveText),
      niceToHaveRequirements: fromLines(niceToHaveText),
    })
      .then(() => {
        setSaved(true);
        onDone?.();
      })
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
      <div>
        <Label htmlFor="jr-must">Must-have requirements (one per line)</Label>
        <Textarea id="jr-must" rows={4} value={mustHaveText} onChange={(e) => setMustHaveText(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="jr-nice">Nice-to-have requirements (one per line)</Label>
        <Textarea id="jr-nice" rows={3} value={niceToHaveText} onChange={(e) => setNiceToHaveText(e.target.value)} />
      </div>
      <div className="flex items-center gap-3">
        <Button size="sm" disabled={saving} onClick={save}>
          {saving ? "Saving..." : "Save requirements"}
        </Button>
        {onDone && (
          <Button size="sm" variant="ghost" disabled={saving} onClick={onDone}>
            Cancel
          </Button>
        )}
        {saved && <span className="text-sm text-muted-foreground">Saved.</span>}
        {saveError && <span className="text-sm text-destructive">{saveError}</span>}
      </div>
    </div>
  );
}

export function JobRequirements({ jobId }: { jobId: Id<"jobs"> }) {
  const job = useQuery(api.jobs.get, { jobId });
  const analyze = useAction(api.jobRequirements.analyze);
  const scoreCandidates = useAction(api.matching.scoreCandidates);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [scoring, setScoring] = useState(false);
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [scoreResult, setScoreResult] = useState<{ scored: number; skipped: number } | null>(null);

  const hasRequirements =
    (job?.mustHaveRequirements?.length ?? 0) > 0 || (job?.niceToHaveRequirements?.length ?? 0) > 0;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-foreground">Job requirements &amp; matching</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={analyzing}
            onClick={() => {
              setAnalyzing(true);
              setAnalyzeError(null);
              analyze({ jobId })
                .catch((err) => {
                  setAnalyzeError(
                    err instanceof ConvexError && typeof err.data === "string"
                      ? err.data
                      : "Analysis failed. Please try again.",
                  );
                })
                .finally(() => setAnalyzing(false));
            }}
          >
            {analyzing ? "Analyzing..." : hasRequirements ? "Re-analyze job description" : "Analyze job description"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={scoring || !hasRequirements}
            onClick={() => {
              setScoring(true);
              setScoreError(null);
              setScoreResult(null);
              scoreCandidates({ jobId })
                .then((result) => setScoreResult(result))
                .catch((err) => {
                  setScoreError(
                    err instanceof ConvexError && typeof err.data === "string"
                      ? err.data
                      : "Scoring failed. Please try again.",
                  );
                })
                .finally(() => setScoring(false));
            }}
          >
            {scoring ? "Scoring..." : "Score candidates"}
          </Button>
        </div>
      </div>
      {analyzeError && <p className="text-sm text-destructive">{analyzeError}</p>}
      {scoreError && <p className="text-sm text-destructive">{scoreError}</p>}
      {scoreResult && (
        <p className="text-sm text-muted-foreground">
          Scored {scoreResult.scored} candidate{scoreResult.scored === 1 ? "" : "s"}
          {scoreResult.skipped > 0 &&
            ` · ${scoreResult.skipped} skipped (no parsed profile yet — use "Parse resume" on their application first)`}
        </p>
      )}
      {!hasRequirements && !analyzing && (
        <p className="text-sm text-muted-foreground">
          No requirements yet — click "Analyze job description" to generate them from the posting, or write them in
          below.
        </p>
      )}

      {job === undefined && <p className="text-sm text-muted-foreground">Loading...</p>}
      {job === null && <p className="text-sm text-muted-foreground">Job not found.</p>}
      {job?.requirementsStale && (
        <p className="rounded-md border border-amber-500/30 bg-amber-50 p-3 text-sm text-amber-900">
          The job description was edited after these requirements were generated. Re-analyze (or review and save
          them) before scoring candidates, so scores match the current posting.
        </p>
      )}

      {job && (
        <RequirementsView
          key={`${job.mustHaveRequirements?.join("|")}__${job.niceToHaveRequirements?.join("|")}`}
          jobId={jobId}
          job={job}
        />
      )}
    </div>
  );
}
