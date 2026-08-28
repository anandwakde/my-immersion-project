import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useState } from "react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const DAY_MS = 24 * 60 * 60 * 1000;

export function ClientReviewPage({ token }: { token: string }) {
  const data = useQuery(api.shareLinks.getByToken, { token });
  const submitFeedback = useMutation(api.shareLinks.submitFeedback);

  const [rejectingId, setRejectingId] = useState<Id<"applications"> | null>(null);
  const [reason, setReason] = useState("");
  const [submittingId, setSubmittingId] = useState<Id<"applications"> | null>(null);
  const [downloadingId, setDownloadingId] = useState<Id<"applications"> | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (data === undefined) {
    return <div className="px-6 py-16 text-center text-sm text-muted-foreground">Loading...</div>;
  }

  if (data === null) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <h1 className="text-xl font-semibold">This review link isn't available</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          It may have expired or the link is incorrect. Contact your recruiter for a new link.
        </p>
      </div>
    );
  }

  const daysLeft = Math.max(0, Math.ceil((data.expiresAt - Date.now()) / DAY_MS));

  async function downloadResume(applicationId: Id<"applications">, url: string, label: string) {
    setDownloadingId(applicationId);
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${label}-resume.docx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } finally {
      setDownloadingId(null);
    }
  }

  function accept(applicationId: Id<"applications">) {
    setError(null);
    setSubmittingId(applicationId);
    submitFeedback({ token, applicationId, status: "accepted" })
      .catch((err) => {
        setError(err instanceof ConvexError && typeof err.data === "string" ? err.data : "Something went wrong.");
      })
      .finally(() => setSubmittingId(null));
  }

  function reject(applicationId: Id<"applications">) {
    if (!reason.trim()) return;
    setError(null);
    setSubmittingId(applicationId);
    submitFeedback({ token, applicationId, status: "rejected", reason })
      .then(() => {
        setRejectingId(null);
        setReason("");
      })
      .catch((err) => {
        setError(err instanceof ConvexError && typeof err.data === "string" ? err.data : "Something went wrong.");
      })
      .finally(() => setSubmittingId(null));
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">{data.jobTitle}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Shortlisted candidates for your review. This link expires in {daysLeft} day{daysLeft === 1 ? "" : "s"}.
      </p>

      <ul className="mt-8 flex flex-col gap-4">
        {data.candidates.map((c) => (
          <li key={c.applicationId} className="rounded-lg border border-border bg-card p-4 text-sm shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-foreground">Candidate {c.label}</span>
              {c.clientStatus && (
                <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {c.clientStatus === "accepted" ? "Accepted" : "Rejected"}
                </span>
              )}
            </div>

            {c.clientStatus === "rejected" && c.clientRejectionReason && (
              <p className="mt-2 text-muted-foreground">Reason: {c.clientRejectionReason}</p>
            )}

            {c.resumeUrl && (
              <div className="mt-3">
                <p className="text-muted-foreground">Resume of the candidate</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <a
                    href={`/client/${token}/view/${c.applicationId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button size="sm" variant="outline">
                      View
                    </Button>
                  </a>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={downloadingId === c.applicationId}
                    onClick={() => downloadResume(c.applicationId, c.resumeUrl!, c.label)}
                  >
                    {downloadingId === c.applicationId ? "Downloading..." : "Download"}
                  </Button>
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button size="sm" disabled={submittingId === c.applicationId} onClick={() => accept(c.applicationId)}>
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={submittingId === c.applicationId}
                onClick={() => {
                  setRejectingId(rejectingId === c.applicationId ? null : c.applicationId);
                  setReason("");
                  setError(null);
                }}
              >
                Reject
              </Button>
            </div>

            {rejectingId === c.applicationId && (
              <div className="mt-3 flex flex-col gap-2">
                <Textarea
                  placeholder="Reason for rejecting (required)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!reason.trim() || submittingId === c.applicationId}
                  onClick={() => reject(c.applicationId)}
                >
                  Submit rejection
                </Button>
              </div>
            )}
          </li>
        ))}
        {data.candidates.length === 0 && (
          <li className="text-sm text-muted-foreground">No shortlisted candidates yet.</li>
        )}
      </ul>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
    </div>
  );
}
