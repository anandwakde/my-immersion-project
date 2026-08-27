import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Asterisk } from "@/Asterisk";

export function SignIn() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="mx-auto max-w-sm px-6 py-16">
      <Asterisk className="h-8 w-8 text-primary" />
      <h1 className="font-display mt-2 text-5xl font-extrabold italic leading-[0.95] tracking-tight text-foreground">
        Recruiter
        <br />
        <span className="text-primary">Sign In</span>
      </h1>
      <p className="mt-4 text-sm text-muted-foreground">
        {flow === "signIn" ? "Sign in to manage your job postings." : "Create a recruiter account."}
      </p>

      <form
        className="mt-6 flex flex-col gap-4 border-2 border-foreground bg-card p-6"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setSubmitting(true);
          const formData = new FormData(e.currentTarget);
          formData.set("flow", flow);
          signIn("password", formData).catch((err) => {
            setError(
              flow === "signIn"
                ? "Couldn't sign in. Check your email and password."
                : "Couldn't create an account. " + (err instanceof Error ? err.message : ""),
            );
          }).finally(() => setSubmitting(false));
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
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
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" disabled={submitting}>
          {flow === "signIn" ? "Sign in" : "Sign up"}
        </Button>
      </form>

      <button
        type="button"
        className="mt-4 text-sm text-muted-foreground underline underline-offset-4"
        onClick={() => {
          setError(null);
          setFlow(flow === "signIn" ? "signUp" : "signIn");
        }}
      >
        {flow === "signIn" ? "Need an account? Sign up" : "Already have an account? Sign in"}
      </button>
    </div>
  );
}
