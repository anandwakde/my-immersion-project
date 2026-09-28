import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useState } from "react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { JobRequirements } from "@/JobRequirements";
import { KanbanBoard } from "@/KanbanBoard";
import { Input } from "@/components/ui/input";
import { NotifyOthersDialog } from "@/DecisionDialogs";
import { navigate } from "@/lib/router";

const STAGE_LABEL: Record<string, string> = {
  applied: "Applied",
  ai_screened: "AI Screened",
  shortlisted: "Shortlisted",
  interview: "Interview",
  offer: "Offer",
  hired: "Hired",
};

type Tab = "all" | "shortlisted" | "clientFeedback" | "pipeline";

export function JobApplications({
  jobId,
  jobTitle,
  onBack,
}: {
  jobId: Id<"jobs">;
  jobTitle: string;
  onBack: () => void;
}) {
  const applications = useQuery(api.applications.listForJob, { jobId });
  const createShareLink = useMutation(api.shareLinks.create);
  const [tab, setTab] = useState<Tab>("all");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareExpiresAt, setShareExpiresAt] = useState<number | null>(null);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [sortByScore, setSortByScore] = useState(false);
  const [clientEmail, setClientEmail] = useState("");
  const [sharedWith, setSharedWith] = useState<string | null>(null);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const stillInRunning = useQuery(api.applications.listStillInRunning, { jobId });

  function openApplication(applicationId: Id<"applications">) {
    navigate(`/recruiter/jobs/${jobId}/applications/${applicationId}`);
  }

  const shortlisted = applications?.filter((app) => app.stage === "shortlisted" && !app.rejected) ?? [];
  const baseList = tab === "shortlisted" ? shortlisted : applications;
  const visibleApplications = sortByScore
    ? baseList && [...baseList].sort((a, b) => (b.matchScore ?? -1) - (a.matchScore ?? -1))
    : baseList;

  const accepted = shortlisted.filter((app) => app.clientStatus === "accepted").length;
  const rejected = shortlisted.filter((app) => app.clientStatus === "rejected").length;
  const pending = shortlisted.filter((app) => app.clientStatus === undefined).length;

  return (
    <div className={`mx-auto mt-6 ${tab === "pipeline" ? "" : "max-w-2xl"}`}>
      <Button variant="outline" onClick={onBack}>
        &larr; Back to jobs
      </Button>

      <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-foreground">
        Applications for {jobTitle}
      </h1>

      {applications?.some((a) => a.stage === "hired") && (stillInRunning?.length ?? 0) > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-green-600/30 bg-green-50 p-4 text-sm">
          <p className="text-green-900">
            Someone has been hired for this role. {stillInRunning!.length} other candidate
            {stillInRunning!.length === 1 ? " is" : "s are"} still in the running.
          </p>
          <Button size="sm" variant="outline" onClick={() => setNotifyOpen(true)}>
            Notify other candidates
          </Button>
        </div>
      )}
      <NotifyOthersDialog
        jobId={jobId}
        open={notifyOpen}
        onOpenChange={setNotifyOpen}
        count={stillInRunning?.length ?? 0}
      />

      <div className="mt-4">
        <JobRequirements jobId={jobId} />
      </div>

      <div className="mt-4 rounded-lg border border-border bg-card p-4 text-sm shadow-sm">
        <p className="font-medium text-foreground">Share shortlisted candidates with your client</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Add the client's email to send them the link, interview invites and hiring updates automatically.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Input
            type="email"
            aria-label="Client email (optional)"
            placeholder="Client email (optional)"
            className="min-w-0 flex-1"
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={sharing}
            onClick={() => {
              setSharing(true);
              setCopied(false);
              setShareError(null);
              setSharedWith(null);
              createShareLink({ jobId, clientEmail: clientEmail.trim() || undefined })
                .then(({ token, expiresAt, clientEmail: savedEmail }) => {
                  setShareUrl(`${window.location.origin}/client/${token}`);
                  setShareExpiresAt(expiresAt);
                  setSharedWith(clientEmail.trim() ? savedEmail : null);
                })
                .catch((err) => {
                  setShareError(
                    err instanceof ConvexError && typeof err.data === "string"
                      ? err.data
                      : "Couldn't generate a link. Please try again.",
                  );
                })
                .finally(() => setSharing(false));
            }}
          >
            {sharing ? "Generating..." : clientEmail.trim() ? "Email link to client" : "Generate link"}
          </Button>
        </div>
        {shareError && <p className="mt-2 text-sm text-destructive">{shareError}</p>}
        {sharedWith && <p className="mt-2 text-sm text-green-700">Review link emailed to {sharedWith}.</p>}
        {shareUrl && (
          <div className="mt-3 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="break-all text-primary underline">
                {shareUrl}
              </a>
              <button
                type="button"
                className="shrink-0 text-xs font-medium text-primary underline"
                onClick={() => {
                  navigator.clipboard.writeText(shareUrl).then(() => setCopied(true));
                }}
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            {shareExpiresAt && (
              <p className="text-xs text-muted-foreground">
                Expires {new Date(shareExpiresAt).toLocaleDateString()}. No login required to view — only
                shortlisted candidates with a Netlink-formatted resume are visible.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-2 border-b border-border">
        <button
          type="button"
          className={`px-3 py-2 text-sm font-semibold ${
            tab === "all" ? "border-b-2 border-primary text-foreground" : "text-muted-foreground"
          }`}
          onClick={() => setTab("all")}
        >
          All applications
        </button>
        <button
          type="button"
          className={`px-3 py-2 text-sm font-semibold ${
            tab === "shortlisted" ? "border-b-2 border-primary text-foreground" : "text-muted-foreground"
          }`}
          onClick={() => setTab("shortlisted")}
        >
          Shortlisted
        </button>
        <button
          type="button"
          className={`px-3 py-2 text-sm font-semibold ${
            tab === "clientFeedback" ? "border-b-2 border-primary text-foreground" : "text-muted-foreground"
          }`}
          onClick={() => setTab("clientFeedback")}
        >
          Client Feedback
        </button>
        <button
          type="button"
          className={`px-3 py-2 text-sm font-semibold ${
            tab === "pipeline" ? "border-b-2 border-primary text-foreground" : "text-muted-foreground"
          }`}
          onClick={() => setTab("pipeline")}
        >
          Pipeline
        </button>
      </div>

      {tab === "pipeline" ? (
        <KanbanBoard jobId={jobId} onOpen={openApplication} />
      ) : tab === "clientFeedback" ? (
        <div className="mt-6 flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            {accepted} accepted · {rejected} rejected · {pending} awaiting response
          </p>
          <ul className="flex flex-col gap-3">
            {shortlisted.map((app) => (
              <li key={app._id} className="rounded-lg border border-border bg-card p-4 text-sm shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-foreground">{app.name}</span>
                  <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {app.clientStatus === "accepted"
                      ? "Accepted"
                      : app.clientStatus === "rejected"
                        ? "Rejected"
                        : "Awaiting response"}
                  </span>
                </div>
                {app.clientStatus === "rejected" && app.clientRejectionReason && (
                  <p className="mt-2 text-muted-foreground">Reason: {app.clientRejectionReason}</p>
                )}
                {app.clientStatus === "accepted" && app.interviewSlotAt && (
                  <p className="mt-2 text-muted-foreground">
                    Proposed slot{app.interviewSlotAt2 ? "s" : ""}:{" "}
                    {new Date(app.interviewSlotAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                    {app.interviewSlotAt2 &&
                      `, or ${new Date(app.interviewSlotAt2).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}`}
                    {app.interviewSlotTimezone && ` (client's timezone: ${app.interviewSlotTimezone})`}
                  </p>
                )}
              </li>
            ))}
            {shortlisted.length === 0 && (
              <li className="text-sm text-muted-foreground">No shortlisted candidates yet.</li>
            )}
          </ul>
        </div>
      ) : (
        <>
          <div className="mt-6 flex items-center justify-end">
            <Button variant="outline" size="sm" onClick={() => setSortByScore((v) => !v)}>
              {sortByScore ? "Sorted by match score" : "Sort by match score"}
            </Button>
          </div>
          <ul className="mt-2 flex flex-col gap-3">
          {visibleApplications?.map((app) => (
            <li key={app._id}>
              <button
                type="button"
                className="w-full rounded-lg border border-border bg-card p-4 text-left text-sm shadow-sm transition hover:border-primary/40 hover:bg-accent"
                onClick={() => openApplication(app._id)}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">{app.name}</span>
                  <span className="flex gap-1.5">
                    {app.matchScore !== null && (
                      <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-foreground">
                        {app.matchScore}/100
                      </span>
                    )}
                    {app.rejected && (
                      <span className="rounded-full border border-destructive/30 px-2 py-0.5 text-xs font-medium text-destructive">
                        Rejected
                      </span>
                    )}
                    <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {STAGE_LABEL[app.stage] ?? app.stage}
                    </span>
                  </span>
                </div>
                <div className="mt-1 text-muted-foreground">{app.email} · {app.phone}</div>
              </button>
            </li>
          ))}
          {visibleApplications?.length === 0 && (
            <li className="text-sm text-muted-foreground">
              {tab === "shortlisted" ? "No shortlisted candidates yet." : "No applications yet for this job."}
            </li>
          )}
          </ul>
        </>
      )}
    </div>
  );
}
