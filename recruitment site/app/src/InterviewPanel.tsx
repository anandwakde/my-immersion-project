import { useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage } from "@/lib/errors";

type Props = {
  applicationId: Id<"applications">;
  clientStatus?: "accepted" | "rejected";
  interviewStatus?: "awaiting_candidate" | "confirmed" | "needs_new_slots" | "cancelled";
  interviewAt?: number;
  interviewSlotAt?: number;
  interviewSlotAt2?: number;
  interviewSlotTimezone?: string;
  candidateSlotNote?: string;
  meetingLink?: string;
  interviewToken?: string;
};

function fmt(ms: number) {
  return new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const STATUS_TEXT: Record<string, string> = {
  awaiting_candidate: "Waiting for the candidate to pick a slot",
  confirmed: "Interview confirmed",
  needs_new_slots: "Candidate asked for different times",
  cancelled: "Interview cancelled",
};

export function InterviewPanel(props: Props) {
  const proposeSlots = useMutation(api.interviews.proposeSlots);
  const confirmTime = useMutation(api.interviews.confirmTime);
  const setMeetingLink = useMutation(api.interviews.setMeetingLink);
  const generateMeetingLink = useMutation(api.interviews.generateMeetingLink);
  const cancel = useMutation(api.interviews.cancel);
  const askCandidate = useMutation(api.interviews.askCandidate);

  const [mode, setMode] = useState<"none" | "propose" | "confirm">("none");
  const [slot1, setSlot1] = useState("");
  const [slot2, setSlot2] = useState("");
  const [linkDraft, setLinkDraft] = useState(props.meetingLink ?? "");
  // Keep the field in step when the saved link changes (e.g. generated here
  // or edited by another recruiter) without resetting the rest of the panel.
  useEffect(() => setLinkDraft(props.meetingLink ?? ""), [props.meetingLink]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  function run(p: Promise<unknown>, success: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    p.then(() => {
      setNotice(success);
      setMode("none");
    })
      .catch((err) => setError(errorMessage(err, "Something went wrong. Please try again.")))
      .finally(() => setBusy(false));
  }

  const status = props.interviewStatus;
  const minNow = toLocalInput(new Date());
  const legacyAccepted = props.clientStatus === "accepted" && status === undefined;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-background p-4 text-sm" aria-labelledby="interview-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="interview-heading" className="font-semibold text-foreground">
          Interview
        </h2>
        {status && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              status === "confirmed"
                ? "bg-green-100 text-green-800"
                : status === "cancelled"
                  ? "bg-muted text-muted-foreground"
                  : "bg-amber-100 text-amber-900"
            }`}
          >
            {STATUS_TEXT[status]}
          </span>
        )}
      </div>

      {status === "confirmed" && props.interviewAt && (
        <p className="text-foreground">
          <strong>{fmt(props.interviewAt)}</strong> (your time). Invites with a calendar file went to the candidate, the job
          owner and the client (if their email is known).
        </p>
      )}
      {(status === "awaiting_candidate" || legacyAccepted) && props.interviewSlotAt && (
        <p className="text-muted-foreground">
          Proposed: {fmt(props.interviewSlotAt)}
          {props.interviewSlotAt2 && ` or ${fmt(props.interviewSlotAt2)}`}
          {props.interviewSlotTimezone && ` (proposed in ${props.interviewSlotTimezone})`}
        </p>
      )}
      {status === "needs_new_slots" && (
        <p className="text-amber-900">
          Neither proposed time works for the candidate{props.candidateSlotNote ? `: "${props.candidateSlotNote}"` : "."}{" "}
          Propose new times below.
        </p>
      )}
      {status === undefined && props.clientStatus !== "accepted" && (
        <p className="text-muted-foreground">
          Scheduling starts when the client accepts this candidate on the review link. You can also set up an interview
          directly.
        </p>
      )}
      {legacyAccepted && (
        <p className="text-muted-foreground">
          The client accepted before automatic scheduling existed, so the candidate hasn't been asked yet.
        </p>
      )}
      {status === "awaiting_candidate" && props.interviewToken && (
        <p className="text-xs text-muted-foreground">
          Candidate's link:{" "}
          <a className="text-primary underline" href={`/interview/${props.interviewToken}`} target="_blank" rel="noopener noreferrer">
            /interview/…
          </a>
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="meeting-link">Meeting link</Label>
        <div className="flex flex-wrap gap-2">
          <Input
            id="meeting-link"
            className="min-w-0 flex-1"
            placeholder="Paste a Teams / Google Meet / Zoom link"
            value={linkDraft}
            onChange={(e) => setLinkDraft(e.target.value)}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={busy || linkDraft === (props.meetingLink ?? "")}
            onClick={() => run(setMeetingLink({ applicationId: props.applicationId, meetingLink: linkDraft }), "Meeting link saved.")}
          >
            Save link
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setError(null);
              generateMeetingLink({ applicationId: props.applicationId })
                .then((link) => {
                  setLinkDraft(link);
                  setNotice("Free Jitsi meeting link created.");
                })
                .catch((err) => setError(errorMessage(err, "Couldn't create a link.")))
                .finally(() => setBusy(false));
            }}
          >
            Generate free link
          </Button>
        </div>
        {props.meetingLink && (
          <a className="w-fit text-primary underline" href={props.meetingLink} target="_blank" rel="noopener noreferrer">
            Join meeting &#8599;
          </a>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {legacyAccepted && (
          <Button size="sm" disabled={busy} onClick={() => run(askCandidate({ applicationId: props.applicationId }), "Candidate emailed to pick a slot.")}>
            Ask candidate to pick a slot
          </Button>
        )}
        <Button size="sm" variant="outline" disabled={busy} onClick={() => setMode(mode === "propose" ? "none" : "propose")}>
          Propose new times
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => setMode(mode === "confirm" ? "none" : "confirm")}>
          {status === "confirmed" ? "Reschedule" : "Set time directly"}
        </Button>
        {status === "confirmed" &&
          (confirmingCancel ? (
            <>
              <Button
                size="sm"
                variant="destructive"
                disabled={busy}
                onClick={() => {
                  setConfirmingCancel(false);
                  run(cancel({ applicationId: props.applicationId }), "Interview cancelled; everyone was notified.");
                }}
              >
                Yes, cancel interview
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmingCancel(false)}>
                Keep it
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirmingCancel(true)}>
              Cancel interview
            </Button>
          ))}
      </div>

      {mode === "propose" && (
        <div className="flex flex-col gap-2 rounded-md border border-border p-3">
          <p className="text-muted-foreground">The candidate gets an email to pick one of these (shown in their time zone).</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input aria-label="New slot 1" type="datetime-local" min={minNow} value={slot1} onChange={(e) => setSlot1(e.target.value)} />
            <Input aria-label="New slot 2" type="datetime-local" min={minNow} value={slot2} onChange={(e) => setSlot2(e.target.value)} />
          </div>
          <Button
            size="sm"
            className="self-start"
            disabled={busy || !slot1 || !slot2}
            onClick={() =>
              run(
                proposeSlots({
                  applicationId: props.applicationId,
                  slotAt: new Date(slot1).getTime(),
                  slotAt2: new Date(slot2).getTime(),
                  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                }),
                "New times sent to the candidate.",
              )
            }
          >
            Send new times
          </Button>
        </div>
      )}
      {mode === "confirm" && (
        <div className="flex flex-col gap-2 rounded-md border border-border p-3">
          <p className="text-muted-foreground">Use this when the time was agreed another way. Everyone gets a calendar invite.</p>
          <Input aria-label="Interview time" type="datetime-local" min={minNow} value={slot1} onChange={(e) => setSlot1(e.target.value)} />
          <Button
            size="sm"
            className="self-start"
            disabled={busy || !slot1}
            onClick={() =>
              run(confirmTime({ applicationId: props.applicationId, at: new Date(slot1).getTime() }), "Interview time confirmed; invites sent.")
            }
          >
            Confirm time
          </Button>
        </div>
      )}

      {notice && <p className="text-green-700">{notice}</p>}
      {error && <p className="text-destructive">{error}</p>}
    </section>
  );
}
