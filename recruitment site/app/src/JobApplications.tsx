import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { ApplicationDetail } from "@/ApplicationDetail";

const STATUS_LABEL: Record<string, string> = {
  new: "New",
  shortlisted: "Shortlisted",
  rejected: "Rejected",
};

type Tab = "all" | "shortlisted" | "clientFeedback";

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
  const [selectedApplicationId, setSelectedApplicationId] = useState<Id<"applications"> | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareExpiresAt, setShareExpiresAt] = useState<number | null>(null);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  if (selectedApplicationId) {
    return (
      <ApplicationDetail
        applicationId={selectedApplicationId}
        onBack={() => setSelectedApplicationId(null)}
      />
    );
  }

  const shortlisted = applications?.filter((app) => app.status === "shortlisted") ?? [];
  const visibleApplications = tab === "shortlisted" ? shortlisted : applications;

  const accepted = shortlisted.filter((app) => app.clientStatus === "accepted").length;
  const rejected = shortlisted.filter((app) => app.clientStatus === "rejected").length;
  const pending = shortlisted.filter((app) => app.clientStatus === undefined).length;

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Button variant="outline" onClick={onBack}>
        &larr; Back to jobs
      </Button>

      <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-foreground">
        Applications for {jobTitle}
      </h1>

      <div className="mt-4 rounded-lg border border-border bg-card p-4 text-sm shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="font-medium text-foreground">Share shortlisted candidates with your client</p>
          <Button
            size="sm"
            variant="outline"
            disabled={sharing}
            onClick={() => {
              setSharing(true);
              setCopied(false);
              createShareLink({ jobId })
                .then(({ token, expiresAt }) => {
                  setShareUrl(`${window.location.origin}/client/${token}`);
                  setShareExpiresAt(expiresAt);
                })
                .finally(() => setSharing(false));
            }}
          >
            {sharing ? "Generating..." : "Generate link"}
          </Button>
        </div>
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
      </div>

      {tab === "clientFeedback" ? (
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
              </li>
            ))}
            {shortlisted.length === 0 && (
              <li className="text-sm text-muted-foreground">No shortlisted candidates yet.</li>
            )}
          </ul>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {visibleApplications?.map((app) => (
            <li key={app._id}>
              <button
                type="button"
                className="w-full rounded-lg border border-border bg-card p-4 text-left text-sm shadow-sm transition hover:border-primary/40 hover:bg-accent"
                onClick={() => setSelectedApplicationId(app._id)}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">{app.name}</span>
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {STATUS_LABEL[app.status] ?? app.status}
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
      )}
    </div>
  );
}
