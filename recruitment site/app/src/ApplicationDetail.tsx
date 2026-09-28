import { useAction, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useState } from "react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CandidateProfile } from "@/CandidateProfile";
import { InterviewPanel } from "@/InterviewPanel";
import { HireDialog, RejectDialog } from "@/DecisionDialogs";
import { Link } from "@/lib/Link";

const STAGE_LABEL: Record<string, string> = {
  applied: "Applied",
  ai_screened: "AI Screened",
  shortlisted: "Shortlisted",
  interview: "Interview",
  offer: "Offer",
  hired: "Hired",
};

export function ApplicationDetail({
  applicationId,
  onBack,
}: {
  applicationId: Id<"applications">;
  onBack: () => void;
}) {
  const application = useQuery(api.applications.get, { applicationId });
  const match = useQuery(api.matches.getForApplication, { applicationId });
  const stageHistory = useQuery(api.applications.listStageHistory, { applicationId });
  const setStage = useMutation(api.applications.setStage);
  const setRejected = useMutation(api.applications.setRejected);
  const addNote = useMutation(api.applications.addNote);
  const convertToNetlink = useAction(api.netlinkConvert.convert);
  const [updating, setUpdating] = useState(false);
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [hireOpen, setHireOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  async function downloadNetlinkResume(url: string, fileName: string) {
    setDownloading(true);
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="mx-auto mt-6 max-w-2xl">
      <Button variant="outline" onClick={onBack}>
        &larr; Back to applications
      </Button>

      {application === undefined && (
        <p className="mt-6 text-sm text-muted-foreground">Loading...</p>
      )}

      {application === null && (
        <p className="mt-6 text-sm text-muted-foreground">This application couldn't be found.</p>
      )}

      {application && (
        <div className="mt-6 flex flex-col gap-6 rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
                <Link href={`/recruiter/candidates/${application.candidateId}`} className="hover:underline">
                  {application.name}
                </Link>
              </h1>
              <p className="text-sm text-muted-foreground">{application.jobTitle}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Applied {new Date(application._creationTime).toLocaleString()}
              </p>
            </div>
            <div className="mt-1 flex shrink-0 gap-2">
              {application.rejected && (
                <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive">
                  Rejected
                </span>
              )}
              <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">
                {STAGE_LABEL[application.stage] ?? application.stage}
              </span>
            </div>
          </div>

          <dl className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-background p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="mt-0.5 break-all">{application.email}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Phone</dt>
              <dd className="mt-0.5">{application.phone}</dd>
            </div>
            {application.linkedin && (
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">LinkedIn</dt>
                <dd className="mt-0.5 break-all">
                  <a className="text-primary underline" href={application.linkedin} target="_blank" rel="noopener noreferrer">
                    {application.linkedin}
                  </a>
                </dd>
              </div>
            )}
          </dl>

          {!application.rejected &&
            (application.interviewStatus !== undefined ||
              application.clientStatus === "accepted" ||
              ["shortlisted", "interview", "offer"].includes(application.stage)) && (
              <InterviewPanel
                applicationId={applicationId}
                clientStatus={application.clientStatus}
                interviewStatus={application.interviewStatus}
                interviewAt={application.interviewAt}
                interviewSlotAt={application.interviewSlotAt}
                interviewSlotAt2={application.interviewSlotAt2}
                interviewSlotTimezone={application.interviewSlotTimezone}
                candidateSlotNote={application.candidateSlotNote}
                meetingLink={application.meetingLink}
                interviewToken={application.interviewToken}
              />
            )}

          {application.clientStatus === "rejected" && application.clientRejectionReason && (
            <div className="rounded-lg border border-border bg-background p-4 text-sm">
              <p className="font-medium text-foreground">Client rejected this candidate</p>
              <p className="mt-1 text-muted-foreground">Reason: {application.clientRejectionReason}</p>
            </div>
          )}

          {application.resumeUrl ? (
            <a
              href={application.resumeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block w-fit rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              View resume
            </a>
          ) : (
            <p className="text-sm text-destructive">Resume file is missing.</p>
          )}

          <div className="flex flex-col items-start gap-2">
            <Button
              variant="outline"
              disabled={converting}
              onClick={() => {
                setConverting(true);
                setConvertError(null);
                convertToNetlink({ applicationId })
                  .catch((err) => {
                    setConvertError(
                      err instanceof ConvexError && typeof err.data === "string"
                        ? err.data
                        : "Conversion failed. Please try again.",
                    );
                  })
                  .finally(() => setConverting(false));
              }}
            >
              {converting ? "Converting..." : "Convert to Netlink format"}
            </Button>
            {convertError && <p className="text-sm text-destructive">{convertError}</p>}
            {application.stage === "shortlisted" && !application.netlinkResumeUrl && !converting && (
              <p className="text-sm text-muted-foreground">
                Converting resume for client sharing — this runs automatically after shortlisting, give it a
                few seconds and refresh.
              </p>
            )}
            {application.netlinkResumeUrl && (
              <button
                type="button"
                disabled={downloading}
                className="text-sm font-medium text-primary underline disabled:opacity-50"
                onClick={() =>
                  downloadNetlinkResume(
                    application.netlinkResumeUrl!,
                    application.netlinkResumeFileName ?? "Netlink-CV.pdf",
                  )
                }
              >
                {downloading ? "Downloading..." : "Download Netlink-format CV"}
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              disabled={
                updating ||
                (["shortlisted", "interview", "offer", "hired"].includes(application.stage) && !application.rejected)
              }
              onClick={() => {
                setUpdating(true);
                // Shortlisting supersedes a prior rejection — otherwise the
                // candidate would show both badges and still be excluded
                // from the Shortlisted tab and client-facing share link.
                Promise.all([
                  setStage({ applicationId, stage: "shortlisted" }),
                  setRejected({ applicationId, rejected: false }),
                ]).finally(() => setUpdating(false));
              }}
            >
              {["shortlisted", "interview", "offer", "hired"].includes(application.stage) && !application.rejected
                ? "Shortlisted ✓"
                : "Shortlist"}
            </Button>
            <Button variant="outline" disabled={updating || application.rejected} onClick={() => setRejectOpen(true)}>
              {application.rejected ? "Rejected" : "Reject"}
            </Button>
            <Button
              variant="outline"
              disabled={updating || application.stage === "hired"}
              onClick={() => setHireOpen(true)}
            >
              {application.stage === "hired" ? "Hired" : "Mark as hired"}
            </Button>
          </div>
          <HireDialog
            applicationId={applicationId}
            candidateName={application.name}
            jobTitle={application.jobTitle}
            open={hireOpen}
            onOpenChange={setHireOpen}
          />
          <RejectDialog
            applicationId={applicationId}
            candidateName={application.name}
            open={rejectOpen}
            onOpenChange={setRejectOpen}
          />
        </div>
      )}

      {match && (
        <div className="mt-6 flex flex-col gap-3 rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-foreground">Match for this job</h2>
            <span
              className={`rounded-full px-3 py-1 text-sm font-bold ${
                match.score >= 70
                  ? "bg-accent text-accent-foreground"
                  : match.score >= 40
                    ? "bg-secondary text-secondary-foreground"
                    : "bg-destructive/10 text-destructive"
              }`}
            >
              {match.score}/100
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{match.evidence}</p>
          {match.strengths.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-foreground">Strengths</p>
              <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">
                {match.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {match.gaps.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-foreground">Gaps</p>
              <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">
                {match.gaps.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Scored {new Date(match.computedAt).toLocaleString()}
          </p>
        </div>
      )}

      {application && (
        <div className="mt-6 flex flex-col gap-3 rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-bold text-foreground">Notes &amp; history</h2>
          <div className="flex flex-col gap-2">
            <Textarea
              rows={2}
              placeholder="Add a note (e.g. why you moved them, interview feedback)..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
            />
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                variant="outline"
                disabled={addingNote || !noteText.trim()}
                onClick={() => {
                  setAddingNote(true);
                  setNoteError(null);
                  addNote({ applicationId, note: noteText.trim() })
                    .then(() => setNoteText(""))
                    .catch((err) => {
                      setNoteError(
                        err instanceof ConvexError && typeof err.data === "string"
                          ? err.data
                          : "Couldn't add note. Please try again.",
                      );
                    })
                    .finally(() => setAddingNote(false));
                }}
              >
                {addingNote ? "Adding..." : "Add note"}
              </Button>
              {noteError && <span className="text-sm text-destructive">{noteError}</span>}
            </div>
          </div>

          {stageHistory && stageHistory.length > 0 && (
            <ul className="flex flex-col gap-2 border-t border-border pt-3">
              {stageHistory.map((h) => (
                <li key={h._id} className="text-sm">
                  <span className="text-xs text-muted-foreground">
                    {new Date(h.changedAt).toLocaleString()}
                  </span>
                  {h.fromStage !== h.toStage ? (
                    <p className="text-foreground">
                      Moved {(h.fromStage && STAGE_LABEL[h.fromStage]) ?? h.fromStage} →{" "}
                      {STAGE_LABEL[h.toStage] ?? h.toStage}
                    </p>
                  ) : (
                    <p className="text-muted-foreground">Note</p>
                  )}
                  {h.note && <p className="mt-0.5 text-muted-foreground">{h.note}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {application && (
        <div className="mt-6">
          <CandidateProfile candidateId={application.candidateId} applicationId={applicationId} />
        </div>
      )}
    </div>
  );
}
