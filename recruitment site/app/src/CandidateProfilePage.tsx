import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CandidateProfile } from "@/CandidateProfile";
import { Link } from "@/lib/Link";
import { STAGE_LABEL } from "@/lib/labels";
import { errorMessage } from "@/lib/errors";

function InviteDialog({
  candidateId,
  candidateName,
  consent,
  open,
  onOpenChange,
}: {
  candidateId: Id<"candidates">;
  candidateName: string;
  consent: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const jobs = useQuery(api.candidateProfile.listInviteJobs, open ? { candidateId } : "skip");
  const scoreForJob = useAction(api.candidateProfile.scoreForJob);
  const sendInvite = useMutation(api.candidateProfile.sendInvite);
  const [selected, setSelected] = useState<Id<"jobs"> | null>(null);
  const [message, setMessage] = useState("");
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [scoring, setScoring] = useState<Id<"jobs"> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSelected(null);
      setMessage("");
      setConsentConfirmed(false);
      setError(null);
      setSentTo(null);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Invite {candidateName} to apply</DialogTitle>
          <DialogDescription>
            Pick an active job. They'll get an email with a link to the job page. Scores are computed on demand, one job
            at a time.
          </DialogDescription>
        </DialogHeader>

        {sentTo ? (
          <div className="flex flex-col gap-3">
            <p className="rounded-md border border-green-600/30 bg-green-50 p-3 text-sm text-green-800">
              Invite sent for {sentTo}.
            </p>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {jobs === undefined && <p className="text-sm text-muted-foreground">Loading jobs...</p>}
            {jobs?.length === 0 && (
              <p className="text-sm text-muted-foreground">No other active jobs — they've applied to all of them.</p>
            )}
            <ul className="flex flex-col gap-2" role="radiogroup" aria-label="Jobs">
              {jobs?.map((job) => (
                <li key={job.jobId}>
                  <label
                    className={`flex cursor-pointer items-center justify-between gap-3 rounded-md border p-3 text-sm ${
                      selected === job.jobId ? "border-primary bg-accent" : "border-border"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="invite-job"
                        checked={selected === job.jobId}
                        onChange={() => setSelected(job.jobId)}
                      />
                      <span>
                        <span className="font-medium text-foreground">{job.title}</span>
                        <span className="text-muted-foreground"> · {job.location}</span>
                        {job.alreadyInvited && <span className="ml-1 text-xs text-muted-foreground">(invited before)</span>}
                      </span>
                    </span>
                    {job.score !== null ? (
                      <span
                        className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-foreground"
                        title={job.evidence ?? undefined}
                      >
                        {job.score}/100
                      </span>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={scoring !== null || !job.hasRequirements}
                        title={job.hasRequirements ? undefined : "Analyze this job's description first"}
                        onClick={(e) => {
                          e.preventDefault();
                          setScoring(job.jobId);
                          setError(null);
                          scoreForJob({ candidateId, jobId: job.jobId })
                            .catch((err) => setError(errorMessage(err, "Scoring failed. Please try again.")))
                            .finally(() => setScoring(null));
                        }}
                      >
                        {scoring === job.jobId ? "Scoring..." : job.hasRequirements ? "Score" : "No requirements"}
                      </Button>
                    )}
                  </label>
                </li>
              ))}
            </ul>

            <Textarea
              rows={3}
              placeholder="Optional personal note to include in the email"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />

            {!consent && (
              <label className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-50 p-3 text-sm text-amber-900">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={consentConfirmed}
                  onChange={(e) => setConsentConfirmed(e.target.checked)}
                />
                <span>
                  This candidate didn't tick "contact me about other roles" when applying. I confirm they've agreed to
                  be contacted.
                </span>
              </label>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button
              disabled={!selected || sending || (!consent && !consentConfirmed)}
              onClick={() => {
                if (!selected) return;
                setSending(true);
                setError(null);
                const title = jobs?.find((j) => j.jobId === selected)?.title ?? "the job";
                sendInvite({ candidateId, jobId: selected, message, consentConfirmed })
                  .then(() => setSentTo(title))
                  .catch((err) => setError(errorMessage(err, "Couldn't send the invite.")))
                  .finally(() => setSending(false));
              }}
            >
              {sending ? "Sending..." : "Send invite"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ChatPanel({ candidateId, canChat }: { candidateId: Id<"candidates">; canChat: boolean }) {
  const messages = useQuery(api.candidateProfile.listMessages, { candidateId });
  const send = useMutation(api.candidateProfile.sendMessage);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-6 shadow-sm" aria-labelledby="chat-heading">
      <h2 id="chat-heading" className="text-lg font-bold text-foreground">
        Messages
      </h2>
      {!canChat && (
        <p className="text-sm text-muted-foreground">Chat opens once this candidate is shortlisted for a job.</p>
      )}
      <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
        {messages?.map((m) => (
          <li
            key={m._id}
            className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
              m.sender === "recruiter" ? "self-end bg-primary text-primary-foreground" : "self-start bg-accent text-foreground"
            }`}
          >
            <p className="whitespace-pre-wrap">{m.body}</p>
            <p className="mt-1 text-[11px] opacity-75">
              {m.senderLabel} · {new Date(m.createdAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
            </p>
          </li>
        ))}
        {messages?.length === 0 && canChat && <li className="text-sm text-muted-foreground">No messages yet.</li>}
      </ul>
      {canChat && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!body.trim()) return;
            setSending(true);
            setError(null);
            send({ candidateId, body })
              .then(() => setBody(""))
              .catch((err) => setError(errorMessage(err, "Couldn't send the message.")))
              .finally(() => setSending(false));
          }}
        >
          <Textarea
            rows={2}
            aria-label="Message to candidate"
            placeholder="Write a message — the candidate gets an email to read it in their portal"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" size="sm" className="self-end" disabled={sending || !body.trim()}>
            {sending ? "Sending..." : "Send message"}
          </Button>
        </form>
      )}
    </section>
  );
}

export function CandidateProfilePage({ candidateId }: { candidateId: string }) {
  const data = useQuery(api.candidateProfile.getProfilePage, { candidateId });
  const [inviteOpen, setInviteOpen] = useState(false);

  if (data === undefined) return <p className="mt-6 text-sm text-muted-foreground">Loading...</p>;
  if (data === null) {
    return (
      <div className="mt-10 text-center">
        <p className="text-sm text-muted-foreground">This candidate couldn't be found.</p>
        <Link href="/recruiter/candidates" className="mt-3 inline-block text-sm font-medium text-primary underline">
          Back to Candidates
        </Link>
      </div>
    );
  }
  const { candidate } = data;

  return (
    <div className="mx-auto mt-6 flex max-w-3xl flex-col gap-6">
      <Link href="/recruiter/candidates" className="text-sm font-medium text-muted-foreground hover:text-foreground">
        &larr; Candidates
      </Link>

      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{candidate.name}</h1>
            {candidate.currentTitle && <p className="mt-1 text-muted-foreground">{candidate.currentTitle}</p>}
            <p className="mt-2 text-sm text-muted-foreground">
              {candidate.email} · {candidate.phone}
              {candidate.linkedin && (
                <>
                  {" · "}
                  <a href={candidate.linkedin} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    LinkedIn
                  </a>
                </>
              )}
            </p>
            <p className="mt-2 text-xs">
              {candidate.contactConsent ? (
                <span className="rounded-full border border-green-600/30 px-2 py-0.5 text-green-700">
                  Agreed to be contacted about other roles
                </span>
              ) : (
                <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">
                  No consent recorded for other roles
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.latestResumeUrl && (
              <a href={data.latestResumeUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline">View resume</Button>
              </a>
            )}
            <Button onClick={() => setInviteOpen(true)}>Invite to apply</Button>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-6 shadow-sm" aria-labelledby="apps-heading">
        <h2 id="apps-heading" className="text-lg font-bold text-foreground">
          Applications ({data.applications.length})
        </h2>
        <ul className="mt-3 flex flex-col gap-2">
          {data.applications.map((a) => (
            <li key={a.applicationId}>
              <Link
                href={`/recruiter/jobs/${a.jobId}/applications/${a.applicationId}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-sm hover:border-primary/40 hover:bg-accent"
              >
                <span>
                  <span className="font-medium text-foreground">{a.jobTitle}</span>
                  <span className="text-muted-foreground"> · applied {new Date(a.appliedAt).toLocaleDateString()}</span>
                </span>
                <span className="flex items-center gap-2">
                  {a.score !== null && (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-foreground">
                      {a.score}/100
                    </span>
                  )}
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                    {a.rejected ? "Rejected" : (STAGE_LABEL[a.stage] ?? a.stage)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {data.invites.length > 0 && (
          <div className="mt-4 border-t border-border pt-3">
            <p className="text-sm font-semibold text-foreground">Invites sent</p>
            <ul className="mt-1 text-sm text-muted-foreground">
              {data.invites.map((i) => (
                <li key={i._id}>
                  {i.jobTitle} — {new Date(i.createdAt).toLocaleDateString()}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {data.latestApplicationId ? (
        <CandidateProfile candidateId={candidate._id} applicationId={data.latestApplicationId} />
      ) : (
        <p className="text-sm text-muted-foreground">No resume on file to parse.</p>
      )}

      <ChatPanel candidateId={candidate._id} canChat={data.canChat} />

      <InviteDialog
        candidateId={candidate._id}
        candidateName={candidate.name}
        consent={candidate.contactConsent ?? false}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
      />
    </div>
  );
}
