import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isPendingApproval, friendlySignUpError } from "@/lib/authErrors";

function BackButton({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-3.5 w-3.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      {children}
    </button>
  );
}

function ForgotPasswordRequestForm({
  onBack,
  onCodeSent,
}: {
  onBack: () => void;
  onCodeSent: (email: string) => void;
}) {
  const { signIn } = useAuthActions();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="animate-fade-up mx-auto max-w-sm px-6 py-16">
      <BackButton onClick={onBack}>Back to sign in</BackButton>

      <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Reset your password</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Enter your email and we'll send you a 6-digit code.
      </p>

      <form
        className="mt-6 flex flex-col gap-4 rounded-lg border border-border bg-card p-6 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setSubmitting(true);
          const formData = new FormData(e.currentTarget);
          const email = String(formData.get("email"));
          formData.set("flow", "reset");
          signIn("password", formData)
            .then(() => onCodeSent(email))
            .catch((err) => {
              setError(err instanceof Error ? err.message : "Couldn't send a reset code. Check the email and try again.");
            })
            .finally(() => setSubmitting(false));
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" disabled={submitting}>
          {submitting ? "Sending..." : "Send reset code"}
        </Button>
      </form>
    </div>
  );
}

function ResetPasswordForm({ email, onBack }: { email: string; onBack: () => void }) {
  const { signIn } = useAuthActions();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="animate-fade-up mx-auto max-w-sm px-6 py-16">
      <BackButton onClick={onBack}>Use a different email</BackButton>

      <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Enter your code</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        We sent a code to <span className="font-medium text-foreground">{email}</span>. It expires in 15
        minutes.
      </p>

      <form
        className="mt-6 flex flex-col gap-4 rounded-lg border border-border bg-card p-6 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setSubmitting(true);
          const formData = new FormData(e.currentTarget);
          formData.set("email", email);
          formData.set("flow", "reset-verification");
          // On success Convex Auth signs the user straight in — App.tsx's
          // <Authenticated> branch takes over, so there's nothing to do here.
          signIn("password", formData)
            .catch((err) => {
              setError(
                err instanceof Error ? err.message : "Couldn't reset your password. Check the code and try again.",
              );
            })
            .finally(() => setSubmitting(false));
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="code">6-digit code</Label>
          <Input id="code" name="code" inputMode="numeric" maxLength={6} required autoComplete="one-time-code" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="newPassword">New password</Label>
          <Input id="newPassword" name="newPassword" type="password" required minLength={8} autoComplete="new-password" />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" disabled={submitting}>
          {submitting ? "Resetting..." : "Reset password"}
        </Button>
      </form>
    </div>
  );
}

function PendingApprovalScreen({ onBackToJobs }: { onBackToJobs: () => void }) {
  return (
    <div className="animate-pop-in mx-auto max-w-sm px-6 py-16 text-center">
      <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500 text-white shadow-lg shadow-green-500/30">
        <span className="absolute inset-0 animate-ping rounded-full bg-green-400/40" />
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="relative h-8 w-8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-foreground">Signup complete</h1>
      <p className="mt-2 text-sm font-medium text-green-700">
        Your recruiter account has been created and sent to our admin for approval.
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        You'll be able to sign in as soon as it's approved.
      </p>
      <Button variant="outline" className="mt-6" onClick={onBackToJobs}>
        &larr; Back to job listings
      </Button>
    </div>
  );
}

export function SignIn({ onBackToJobs }: { onBackToJobs: () => void }) {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState(false);
  const [forgotStep, setForgotStep] = useState<"none" | "request" | "verify">("none");
  const [resetEmail, setResetEmail] = useState("");

  if (pending) {
    return <PendingApprovalScreen onBackToJobs={onBackToJobs} />;
  }

  if (forgotStep === "request") {
    return (
      <ForgotPasswordRequestForm
        onBack={() => setForgotStep("none")}
        onCodeSent={(email) => {
          setResetEmail(email);
          setForgotStep("verify");
        }}
      />
    );
  }

  if (forgotStep === "verify") {
    return <ResetPasswordForm email={resetEmail} onBack={() => setForgotStep("request")} />;
  }

  return (
    <div className="animate-fade-up mx-auto max-w-sm px-6 py-16">
      <BackButton onClick={onBackToJobs}>Back to job listings</BackButton>

      <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Recruiter sign in</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {flow === "signIn" ? "Sign in to manage your job postings." : "Create a recruiter account."}
      </p>

      <form
        className="mt-6 flex flex-col gap-4 rounded-lg border border-border bg-card p-6 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setSubmitting(true);
          const formData = new FormData(e.currentTarget);
          formData.set("flow", flow);
          signIn("password", formData)
            .catch((err) => {
              if (isPendingApproval(err)) {
                setPending(true);
                return;
              }
              setError(
                flow === "signIn"
                  ? "Couldn't sign in. Check your email and password."
                  : friendlySignUpError(err),
              );
            })
            .finally(() => setSubmitting(false));
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            pattern="[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}"
            title="Enter a valid email address (e.g. name@company.com)."
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={flow === "signIn" ? "current-password" : "new-password"}
          />
          {flow === "signUp" && (
            <p className="text-xs text-muted-foreground">
              At least 8 characters, with at least one letter and one number.
            </p>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" disabled={submitting}>
          {flow === "signIn" ? "Sign in" : "Sign up"}
        </Button>
      </form>

      <div className="mt-4 flex flex-col items-start gap-2">
        <button
          type="button"
          className="text-sm text-muted-foreground underline underline-offset-4"
          onClick={() => {
            setError(null);
            setFlow(flow === "signIn" ? "signUp" : "signIn");
          }}
        >
          {flow === "signIn" ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>

        {flow === "signIn" && (
          <button
            type="button"
            className="text-sm text-muted-foreground underline underline-offset-4"
            onClick={() => {
              setError(null);
              setForgotStep("request");
            }}
          >
            Forgot password?
          </button>
        )}
      </div>
    </div>
  );
}
