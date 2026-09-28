import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/errors";

const TOKEN_KEY = "netlinkCandidateSession";

function readToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}
function writeToken(token: string) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Private mode: the session just won't survive a refresh.
  }
}

const STATUS_STYLE: Record<string, string> = {
  "Under review": "bg-accent text-accent-foreground",
  Shortlisted: "bg-blue-100 text-blue-800",
  Interview: "bg-amber-100 text-amber-900",
  Offer: "bg-green-100 text-green-800",
  Hired: "bg-green-100 text-green-800",
  "Not selected": "bg-muted text-muted-foreground",
};

function SignInForm({ onSignedIn }: { onSignedIn: (token: string) => void }) {
  const requestCode = useMutation(api.portal.requestCode);
  const verifyCode = useMutation(api.portal.verifyCode);
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-sm px-6 py-16">
      <h1 className="text-3xl font-extrabold tracking-tight text-foreground">My applications</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {step === "email"
          ? "Enter the email you applied with. We'll send you a one-time code — no password needed."
          : `If ${email} has applied to Netlink, a 6-digit code is on its way. It expires in 10 minutes.`}
      </p>
      <form
        className="mt-6 flex flex-col gap-4 rounded-lg border border-border bg-card p-6 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          if (step === "email") {
            requestCode({ email })
              .then(() => setStep("code"))
              .catch((err) => setError(errorMessage(err, "Couldn't send a code. Please try again.")))
              .finally(() => setBusy(false));
          } else {
            verifyCode({ email, code })
              .then((res) => {
                if (res.ok) onSignedIn(res.token);
                else setError(res.error);
              })
              .catch((err) => setError(errorMessage(err, "Couldn't sign you in. Please try again.")))
              .finally(() => setBusy(false));
          }
        }}
      >
        {step === "email" ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="candidate-email">Email</Label>
            <Input
              id="candidate-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="candidate-code">6-digit code</Label>
            <Input
              id="candidate-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={busy}>
          {busy ? "Please wait..." : step === "email" ? "Send me a code" : "Sign in"}
        </Button>
        {step === "code" && (
          <button
            type="button"
            className="text-sm text-muted-foreground underline underline-offset-4"
            onClick={() => {
              setStep("email");
              setCode("");
              setError(null);
            }}
          >
            Use a different email
          </button>
        )}
      </form>
    </div>
  );
}

export function CandidatePortal() {
  const [token, setToken] = useState(readToken);
  const data = useQuery(api.portal.myPortal, token ? { token } : "skip");
  const signOut = useMutation(api.portal.signOut);
  const sendMessage = useMutation(api.portal.sendMessage);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setSession(next: string) {
    writeToken(next);
    setToken(next);
  }

  if (!token || data === null) {
    return <SignInForm onSignedIn={setSession} />;
  }
  if (data === undefined) {
    return <p className="px-6 py-16 text-center text-sm text-muted-foreground">Loading...</p>;
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Hi {data.name.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Signed in as {data.email}</p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            void signOut({ token });
            setSession("");
          }}
        >
          Sign out
        </Button>
      </div>

      <section aria-labelledby="my-apps">
        <h2 id="my-apps" className="text-lg font-bold text-foreground">
          Your applications
        </h2>
        <ul className="mt-3 flex flex-col gap-3">
          {data.applications.map((a) => (
            <li key={a.applicationId} className="rounded-lg border border-border bg-card p-4 text-sm shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-foreground">
                  {a.jobSlug ? (
                    <a href={`/jobs/${a.jobSlug}`} className="hover:underline">
                      {a.jobTitle}
                    </a>
                  ) : (
                    a.jobTitle
                  )}
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[a.status] ?? ""}`}>
                  {a.status}
                </span>
              </div>
              <p className="mt-1 text-muted-foreground">Applied {new Date(a.appliedAt).toLocaleDateString()}</p>
              {a.interview && (
                <div className="mt-3 rounded-md border border-border bg-background p-3">
                  {a.interview.status === "confirmed" && a.interview.at ? (
                    <p className="text-foreground">
                      Interview:{" "}
                      <strong>
                        {new Date(a.interview.at).toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" })}
                      </strong>
                      {a.interview.meetingLink && (
                        <>
                          {" · "}
                          <a href={a.interview.meetingLink} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                            Join meeting
                          </a>
                        </>
                      )}
                    </p>
                  ) : a.interview.status === "awaiting_candidate" ? (
                    <p className="text-foreground">You've been invited to interview — please pick a time.</p>
                  ) : (
                    <p className="text-muted-foreground">The hiring team is arranging new interview times.</p>
                  )}
                  <a href={a.interview.link} className="mt-1 inline-block text-sm font-medium text-primary underline">
                    {a.interview.status === "awaiting_candidate" ? "Choose a time" : "Interview details"}
                  </a>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="my-messages" className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <h2 id="my-messages" className="text-lg font-bold text-foreground">
          Messages with the hiring team
        </h2>
        {!data.canChat && (
          <p className="mt-2 text-sm text-muted-foreground">Messaging opens once you've been shortlisted for a role.</p>
        )}
        <ul className="mt-3 flex max-h-80 flex-col gap-2 overflow-y-auto">
          {data.messages.map((m) => (
            <li
              key={m._id}
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                m.sender === "candidate" ? "self-end bg-primary text-primary-foreground" : "self-start bg-accent text-foreground"
              }`}
            >
              <p className="whitespace-pre-wrap">{m.body}</p>
              <p className="mt-1 text-[11px] opacity-75">
                {m.sender === "candidate" ? "You" : "Netlink hiring team"} ·{" "}
                {new Date(m.createdAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
              </p>
            </li>
          ))}
          {data.canChat && data.messages.length === 0 && <li className="text-sm text-muted-foreground">No messages yet.</li>}
        </ul>
        {data.canChat && (
          <form
            className="mt-3 flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!body.trim()) return;
              setSending(true);
              setError(null);
              sendMessage({ token, body })
                .then(() => setBody(""))
                .catch((err) => setError(errorMessage(err, "Couldn't send. Please try again.")))
                .finally(() => setSending(false));
            }}
          >
            <Textarea rows={2} aria-label="Message to the hiring team" value={body} onChange={(e) => setBody(e.target.value)} />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" size="sm" className="self-end" disabled={sending || !body.trim()}>
              {sending ? "Sending..." : "Send"}
            </Button>
          </form>
        )}
      </section>
    </div>
  );
}
