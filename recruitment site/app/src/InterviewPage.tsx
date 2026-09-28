import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/errors";

const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

function fmt(ms: number) {
  return new Date(ms).toLocaleString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function icsDate(ms: number) {
  return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function downloadIcs(opts: { at: number; title: string; link: string | null; uid: string; sequence: number }) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Netlink Group//Recruitment Portal//EN",
    "BEGIN:VEVENT",
    `UID:${opts.uid}`,
    `SEQUENCE:${opts.sequence}`,
    `DTSTAMP:${icsDate(Date.now())}`,
    `DTSTART:${icsDate(opts.at)}`,
    `DTEND:${icsDate(opts.at + 60 * 60 * 1000)}`,
    `SUMMARY:${opts.title.replace(/[,;]/g, " ")}`,
    ...(opts.link ? [`LOCATION:${opts.link}`, `URL:${opts.link}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  const url = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "netlink-interview.ics";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function InterviewPage({ token }: { token: string }) {
  const data = useQuery(api.interviews.getByToken, { token });
  const pickSlot = useMutation(api.interviews.pickSlot);
  const declineSlots = useMutation(api.interviews.declineSlots);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState("");
  const [now] = useState(() => Date.now());

  if (data === undefined) return <p className="px-6 py-16 text-center text-sm text-muted-foreground">Loading...</p>;
  if (data === null) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <h1 className="text-xl font-semibold">This interview link isn't valid</h1>
        <p className="mt-2 text-sm text-muted-foreground">Check the link in your email, or contact the hiring team.</p>
      </div>
    );
  }

  const futureSlots = data.slots.filter((s) => s > now);

  return (
    <div className="mx-auto max-w-lg px-6 py-12">
      <p className="text-sm font-medium text-primary">Netlink Group · Interview</p>
      <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-foreground">{data.jobTitle}</h1>

      {data.status === "awaiting_candidate" && (
        <div className="mt-6 flex flex-col gap-4">
          <p className="text-foreground">
            Hi {data.firstName}, please choose a time for your interview. Times are shown in your time zone ({TZ}).
          </p>
          {futureSlots.length === 0 && (
            <p className="rounded-md border border-amber-500/30 bg-amber-50 p-3 text-sm text-amber-900">
              These proposed times have already passed. Let us know below and the hiring team will send new ones.
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {data.slots.map((slot) => {
              const past = slot <= now;
              return (
                <li key={slot}>
                  <Button
                    variant="outline"
                    className="h-auto w-full justify-between py-3 text-left"
                    disabled={busy || past}
                    onClick={() => {
                      setBusy(true);
                      setError(null);
                      pickSlot({ token, slotAt: slot })
                        .catch((err) => setError(errorMessage(err, "Couldn't confirm that time. Please try again.")))
                        .finally(() => setBusy(false));
                    }}
                  >
                    <span className="font-medium">{fmt(slot)}</span>
                    <span className="text-sm text-primary">{past ? "Passed" : "Choose this time"}</span>
                  </Button>
                </li>
              );
            })}
          </ul>
          {!declining ? (
            <button
              type="button"
              className="w-fit text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
              onClick={() => setDeclining(true)}
            >
              Neither time works for me
            </button>
          ) : (
            <div className="flex flex-col gap-2 rounded-md border border-border p-3">
              <Textarea
                rows={3}
                aria-label="When are you available?"
                placeholder="Optional: when are you usually available?"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <Button
                variant="outline"
                className="self-start"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  setError(null);
                  declineSlots({ token, note })
                    .catch((err) => setError(errorMessage(err, "Couldn't send. Please try again.")))
                    .finally(() => setBusy(false));
                }}
              >
                Ask for different times
              </Button>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      )}

      {data.status === "confirmed" && data.interviewAt && (
        <div className="mt-6 flex flex-col gap-4">
          <div className="rounded-lg border border-green-600/30 bg-green-50 p-4">
            <p className="text-sm font-medium text-green-800">Your interview is confirmed</p>
            <p className="mt-1 text-lg font-bold text-foreground">{fmt(data.interviewAt)}</p>
          </div>
          {data.meetingLink ? (
            <a href={data.meetingLink} target="_blank" rel="noopener noreferrer">
              <Button className="w-full">Join the meeting</Button>
            </a>
          ) : (
            <p className="text-sm text-muted-foreground">The meeting link will be shared before the interview.</p>
          )}
          <Button
            variant="outline"
            onClick={() =>
              downloadIcs({
                at: data.interviewAt!,
                title: `Interview: ${data.jobTitle} — Netlink Group`,
                link: data.meetingLink,
                uid: `${token.slice(0, 16)}@netlink-recruitment`,
                sequence: data.sequence,
              })
            }
          >
            Add to my calendar
          </Button>
          <p className="text-xs text-muted-foreground">
            Need to change the time? Reply to your confirmation email or message the team from{" "}
            <a href="/candidate" className="underline">
              My applications
            </a>
            .
          </p>
        </div>
      )}

      {data.status === "needs_new_slots" && (
        <p className="mt-6 rounded-md border border-border bg-card p-4 text-foreground">
          Thanks — we've let the hiring team know neither time works. They'll email you new options soon.
        </p>
      )}

      {data.status === "cancelled" && (
        <p className="mt-6 rounded-md border border-border bg-card p-4 text-foreground">
          This interview has been cancelled. The hiring team will be in touch if anything changes.
        </p>
      )}
    </div>
  );
}
