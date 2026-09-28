import { useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { errorMessage } from "@/lib/errors";

export function HireDialog({
  applicationId,
  candidateName,
  jobTitle,
  open,
  onOpenChange,
}: {
  applicationId: Id<"applications">;
  candidateName: string;
  jobTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const markHired = useMutation(api.applications.markHired);
  const [notifyCandidate, setNotifyCandidate] = useState(true);
  const [closeJob, setCloseJob] = useState(true);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark {candidateName} as hired</DialogTitle>
          <DialogDescription>For {jobTitle}. You can still change the stage later.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 text-sm">
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-0.5" checked={closeJob} onChange={(e) => setCloseJob(e.target.checked)} />
            <span>
              <strong>Position filled — close the job.</strong> It disappears from the job board; you can reopen it from All
              Jobs.
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={notifyCandidate}
              onChange={(e) => setNotifyCandidate(e.target.checked)}
            />
            <span>
              <strong>Email the candidate</strong> a congratulations / next-steps message.
            </span>
          </label>
          {notifyCandidate && (
            <Textarea
              rows={3}
              aria-label="Message to the candidate"
              placeholder="Optional: offer details or next steps (otherwise a standard message is sent)"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          )}
          <p className="text-xs text-muted-foreground">
            The client is emailed a confirmation if their email is on the review link. Other candidates are not contacted —
            use "Notify other candidates" on the job page for that.
          </p>
          {error && <p className="text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button
            disabled={saving}
            onClick={() => {
              setSaving(true);
              setError(null);
              markHired({ applicationId, notifyCandidate, closeJob, message })
                .then(() => onOpenChange(false))
                .catch((err) => setError(errorMessage(err, "Couldn't mark as hired.")))
                .finally(() => setSaving(false));
            }}
          >
            {saving ? "Saving..." : "Confirm hire"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RejectDialog({
  applicationId,
  candidateName,
  open,
  onOpenChange,
}: {
  applicationId: Id<"applications">;
  candidateName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const setRejected = useMutation(api.applications.setRejected);
  const [notifyCandidate, setNotifyCandidate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject {candidateName}?</DialogTitle>
          <DialogDescription>They stay in your candidate database and can be shortlisted again later.</DialogDescription>
        </DialogHeader>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={notifyCandidate}
            onChange={(e) => setNotifyCandidate(e.target.checked)}
          />
          <span>Send a polite "not selected" email to the candidate</span>
        </label>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={saving}
            onClick={() => {
              setSaving(true);
              setError(null);
              setRejected({ applicationId, rejected: true, notifyCandidate })
                .then(() => onOpenChange(false))
                .catch((err) => setError(errorMessage(err, "Couldn't reject.")))
                .finally(() => setSaving(false));
            }}
          >
            {saving ? "Rejecting..." : "Reject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function NotifyOthersDialog({
  jobId,
  open,
  onOpenChange,
  count,
}: {
  jobId: Id<"jobs">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
}) {
  const notifyNotSelected = useMutation(api.applications.notifyNotSelected);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  // Freeze the count when the dialog opens — the live count drops to 0 as
  // soon as the notify succeeds, and the text shouldn't change under the user.
  const [countAtOpen, setCountAtOpen] = useState(count);
  useEffect(() => {
    if (open) {
      setResult(null);
      setError(null);
      setCountAtOpen(count);
    }
    // Only when the dialog opens — not every time the live count changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Notify other candidates</DialogTitle>
          <DialogDescription>
            {countAtOpen} candidate{countAtOpen === 1 ? "" : "s"} still in the running for this job will be marked rejected and
            emailed a polite "not selected" message.
          </DialogDescription>
        </DialogHeader>
        {result !== null ? (
          <p className="rounded-md border border-green-600/30 bg-green-50 p-3 text-sm text-green-800">
            Done — {result} candidate{result === 1 ? "" : "s"} notified.
          </p>
        ) : (
          <Textarea
            rows={4}
            aria-label="Message to candidates"
            placeholder="Optional: your own message (otherwise a standard one is used)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          {result === null ? (
            <Button
              disabled={saving || countAtOpen === 0}
              onClick={() => {
                setSaving(true);
                notifyNotSelected({ jobId, message })
                  .then(setResult)
                  .catch((err) => setError(errorMessage(err, "Couldn't send.")))
                  .finally(() => setSaving(false));
              }}
            >
              {saving ? "Sending..." : `Notify ${countAtOpen} candidate${countAtOpen === 1 ? "" : "s"}`}
            </Button>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
