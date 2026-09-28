import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useState } from "react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const DAY_MS = 24 * 60 * 60 * 1000;

// <input type="datetime-local"> takes/returns "YYYY-MM-DDTHH:mm" in whatever
// timezone the browser is set to — exactly the client's own local time, no
// conversion needed. This just formats "now" into that same shape, so it can
// be used as the picker's `min` (block picking a slot in the past).
function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatSlot(atMs: number, timezone: string | null): string {
  const formatted = new Date(atMs).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return timezone ? `${formatted} (${timezone})` : formatted;
}

// Applications accepted before the two-slot change only have interviewSlotAt
// set — interviewSlotAt2 is undefined for those, not a bug.
function formatSlots(atMs: number, atMs2: number | null, timezone: string | null): string {
  const first = formatSlot(atMs, timezone);
  return atMs2 === null ? first : `${first}, or ${new Date(atMs2).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`;
}

export function ClientReviewPage({ token }: { token: string }) {
  const data = useQuery(api.shareLinks.getByToken, { token });
  const submitFeedback = useMutation(api.shareLinks.submitFeedback);

  const [rejectingId, setRejectingId] = useState<Id<"applications"> | null>(null);
  const [reason, setReason] = useState("");
  const [submittingId, setSubmittingId] = useState<Id<"applications"> | null>(null);
  const [downloadingId, setDownloadingId] = useState<Id<"applications"> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acceptTarget, setAcceptTarget] = useState<{ applicationId: Id<"applications">; label: string } | null>(
    null,
  );
  const [slotValue, setSlotValue] = useState("");
  const [slotValue2, setSlotValue2] = useState("");
  const [slotError, setSlotError] = useState<string | null>(null);

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
      link.download = `${label}-resume.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } finally {
      setDownloadingId(null);
    }
  }

  function openAcceptDialog(applicationId: Id<"applications">, label: string) {
    setError(null);
    setSlotError(null);
    setSlotValue("");
    setSlotValue2("");
    setAcceptTarget({ applicationId, label });
  }

  function confirmAccept() {
    if (!acceptTarget) return;
    if (!slotValue || !slotValue2) {
      setSlotError("Please pick two interview slots.");
      return;
    }
    const slotDate = new Date(slotValue);
    const slotDate2 = new Date(slotValue2);
    if (Number.isNaN(slotDate.getTime()) || slotDate.getTime() <= Date.now()) {
      setSlotError("Slot 1 must be a date and time in the future.");
      return;
    }
    if (Number.isNaN(slotDate2.getTime()) || slotDate2.getTime() <= Date.now()) {
      setSlotError("Slot 2 must be a date and time in the future.");
      return;
    }
    if (slotDate.getTime() === slotDate2.getTime()) {
      setSlotError("Please pick two different slots.");
      return;
    }

    setSlotError(null);
    setError(null);
    setSubmittingId(acceptTarget.applicationId);
    submitFeedback({
      token,
      applicationId: acceptTarget.applicationId,
      status: "accepted",
      interviewSlotAt: slotDate.getTime(),
      interviewSlotAt2: slotDate2.getTime(),
      interviewSlotTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    })
      .then(() => setAcceptTarget(null))
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

            {c.clientStatus === "accepted" && c.interviewStatus === "confirmed" && c.interviewAt ? (
              <p className="mt-2 font-medium text-green-800">
                Interview confirmed: {formatSlot(c.interviewAt, null)} (your time)
                {c.meetingLink && (
                  <>
                    {" · "}
                    <a className="text-primary underline" href={c.meetingLink} target="_blank" rel="noopener noreferrer">
                      Meeting link
                    </a>
                  </>
                )}
              </p>
            ) : (
              c.clientStatus === "accepted" &&
              c.interviewSlotAt && (
                <p className="mt-2 text-muted-foreground">
                  Proposed slot{c.interviewSlotAt2 ? "s" : ""}:{" "}
                  {formatSlots(c.interviewSlotAt, c.interviewSlotAt2, c.interviewSlotTimezone)}
                  {c.interviewStatus === "awaiting_candidate" && " — waiting for the candidate to pick one."}
                  {c.interviewStatus === "needs_new_slots" && " — neither works for the candidate; the recruiter will follow up."}
                </p>
              )
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
              <Button
                size="sm"
                disabled={submittingId === c.applicationId}
                onClick={() => openAcceptDialog(c.applicationId, c.label)}
              >
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

      <Dialog open={acceptTarget !== null} onOpenChange={(open) => !open && setAcceptTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pick two interview slots</DialogTitle>
            <DialogDescription>
              {acceptTarget &&
                `Offer two date and time options for ${acceptTarget.label}'s interview, in your local time.`}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="interview-slot-1">Slot 1</Label>
              <Input
                id="interview-slot-1"
                type="datetime-local"
                value={slotValue}
                min={toDatetimeLocalValue(new Date())}
                onChange={(e) => {
                  setSlotValue(e.target.value);
                  if (slotError) setSlotError(null);
                }}
                aria-invalid={!!slotError}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="interview-slot-2">Slot 2</Label>
              <Input
                id="interview-slot-2"
                type="datetime-local"
                value={slotValue2}
                min={toDatetimeLocalValue(new Date())}
                onChange={(e) => {
                  setSlotValue2(e.target.value);
                  if (slotError) setSlotError(null);
                }}
                aria-invalid={!!slotError}
              />
            </div>
            {slotError && <p className="text-sm text-destructive">{slotError}</p>}
          </div>

          <DialogFooter>
            <Button
              disabled={acceptTarget !== null && submittingId === acceptTarget.applicationId}
              onClick={confirmAccept}
            >
              {acceptTarget !== null && submittingId === acceptTarget.applicationId
                ? "Confirming..."
                : "Confirm & accept"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
