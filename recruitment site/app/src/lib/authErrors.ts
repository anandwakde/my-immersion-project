import { ConvexError } from "convex/values";

// Mirrors convex/auth.ts. Kept as a separate client-side copy rather than a
// shared import because this project's tsconfig deliberately keeps src/ and
// convex/ as separate TS projects (only the generated convex/ bindings are
// meant to cross that boundary) — importing convex/auth.ts directly from
// the client also pulled server-only code into the browser bundle, which is
// the bug this file avoids.
export const PENDING_APPROVAL_ERROR = "PENDING_APPROVAL";
export const WEAK_PASSWORD_ERROR = "WEAK_PASSWORD:";
export const INVALID_EMAIL_ERROR = "INVALID_EMAIL:";

// All three sentinels above are thrown server-side as ConvexError, never a
// plain Error — Convex strips a plain Error's message down to a generic
// "Server Error" on a production deployment (confirmed: this silently
// broke the pending-approval message on prod while working fine locally,
// since the local dev deployment doesn't redact). Reading `err.data`
// instead of `err.message` is what makes these checks work in both places.
function convexErrorData(err: unknown): string | null {
  return err instanceof ConvexError && typeof err.data === "string" ? err.data : null;
}

export function isPendingApproval(err: unknown): boolean {
  return convexErrorData(err)?.includes(PENDING_APPROVAL_ERROR) ?? false;
}

// Covers the sentinels this app controls (weak password, invalid email).
// "This email is already registered" is NOT included here — that error is
// thrown by Convex Auth's own library code as a plain Error, so on
// production its message is redacted the same way ours would be if we
// used a plain Error; there's no reliable way to detect that specific case
// from the client. The fallback message below is written to stay honest
// about that rather than guess.
export function friendlySignUpError(err: unknown): string {
  const data = convexErrorData(err);
  if (data?.includes(WEAK_PASSWORD_ERROR)) {
    return "Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number and a symbol.";
  }
  if (data?.includes(INVALID_EMAIL_ERROR)) {
    return "Enter a valid email address (e.g. name@company.com).";
  }
  return "Couldn't create that account — the email may already be registered, or something else went wrong. Try signing in instead, or use a different email.";
}
