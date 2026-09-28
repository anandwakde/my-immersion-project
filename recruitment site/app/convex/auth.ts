import { Password } from "@convex-dev/auth/providers/Password";
import { Email } from "@convex-dev/auth/providers/Email";
import { convexAuth } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { MutationCtx, env } from "./_generated/server";
import { AnyDataModel, GenericMutationCtx } from "convex/server";

// Sends the 6-digit code used by the "forgot password" flow. Convex Auth's
// Password provider calls this itself (via its `reset` option below) when a
// client requests `signIn("password", { email, flow: "reset" })` — this
// project never calls sendVerificationRequest directly.
const ResendPasswordReset = Email({
  id: "password-reset-otp",
  maxAge: 60 * 15, // code expires 15 minutes after it's sent
  async generateVerificationToken() {
    const bytes = crypto.getRandomValues(new Uint32Array(1));
    return String(bytes[0] % 1_000_000).padStart(6, "0");
  },
  async sendVerificationRequest({ identifier: email, token }) {
    if (env.EMAIL_MODE === "log") {
      // Test mode: nothing is sent; the code is printed to the Convex logs.
      console.log(`[EMAIL_MODE=log] Password reset code for ${email}: ${token}`);
      return;
    }
    const apiKey = env.RESEND_API_KEY;
    if (!apiKey) {
      console.error("Password reset email skipped — RESEND_API_KEY is not set on this deployment.");
      return;
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: "Netlink Recruitment Portal <noreply@netlink-group.com>",
        to: email,
        subject: "Reset your Netlink recruiter password",
        html: `
          <p>Your password reset code is:</p>
          <p style="font-size:28px;font-weight:bold;letter-spacing:4px;">${token}</p>
          <p>This code expires in 15 minutes. If you didn't request this, you can ignore this email.</p>
        `,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`Failed to send password reset email: ${res.status} ${errText}`);
    }
  },
});

// Kept in sync manually with src/lib/authErrors.ts — deliberately not a
// shared import. A plain helper file under convex/ gets swept into the
// generated api.d.ts's import graph, which then fails the client (src/)
// TS project's stricter file-list check; importing convex/auth.ts itself
// from the client is worse, since it pulls server-only code into the
// browser bundle (confirmed: caused a "process is not defined" runtime
// error). Duplicating this one string avoids both.
//
// All of these are thrown as ConvexError, never a plain Error — Convex
// strips a plain Error's message down to a generic "Server Error" on a
// production deployment (a real bug caught here: this exact redaction
// silently broke the pending-approval message on prod while working fine
// against the local dev deployment, which doesn't redact). ConvexError's
// `data` payload is always delivered to the client, dev or prod alike.
const PENDING_APPROVAL_ERROR = "PENDING_APPROVAL";

// Sentinel prefix so the client can tell "this message is safe to show
// verbatim" apart from Convex Auth's own internal errors — see
// WEAK_PASSWORD_ERROR / INVALID_EMAIL_ERROR in src/lib/authErrors.ts.
export const WEAK_PASSWORD_ERROR = "WEAK_PASSWORD:";
const PASSWORD_REQUIREMENTS_MESSAGE =
  "Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number and a symbol.";

// Mirrored in src/lib/passwordRules.ts, which shows the same rules to the
// user as a live checklist. Applies to new sign-ups and password resets
// only — existing passwords keep working until they're next changed.
function validatePasswordRequirements(password: string) {
  if (
    password.length < 8 ||
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) {
    throw new ConvexError(`${WEAK_PASSWORD_ERROR} ${PASSWORD_REQUIREMENTS_MESSAGE}`);
  }
}

export const INVALID_EMAIL_ERROR = "INVALID_EMAIL:";
const INVALID_EMAIL_MESSAGE = "Enter a valid email address (e.g. name@company.com).";
// Requires a local part, an @, and a domain with at least one dot and a
// letters-only TLD of 2+ characters — deliberately not tied to a specific
// list of TLDs (.com/.org/...) so real domains like .io or .dev still work.
const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

function profile(params: Record<string, unknown>) {
  const email = typeof params.email === "string" ? params.email.trim() : "";
  if (!EMAIL_FORMAT.test(email)) {
    throw new ConvexError(`${INVALID_EMAIL_ERROR} ${INVALID_EMAIL_MESSAGE}`);
  }
  return { email };
}

// The auth callbacks below receive a schema-erased GenericMutationCtx —
// this project's own tables (like recruiterProfiles) aren't visible on it.
// Casting to this project's real MutationCtx restores that type info; the
// underlying object is the same ctx Convex always passes to a mutation.
function typed(ctx: GenericMutationCtx<AnyDataModel>): MutationCtx {
  return ctx as unknown as MutationCtx;
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password({ reset: ResendPasswordReset, validatePasswordRequirements, profile })],
  callbacks: {
    // Runs once, right after a brand-new user row is created by a
    // credentials signup (not on subsequent logins — existingUserId is
    // null only the first time). Creates the recruiter's approval record
    // and emails the admin, so every new recruiter starts out blocked.
    async afterUserCreatedOrUpdated(genericCtx, { userId, existingUserId, type }) {
      if (existingUserId !== null || type !== "credentials") return;
      const ctx = typed(genericCtx);

      const user = await ctx.db.get(userId);
      const email = user?.email;
      if (!email) return;

      const approvalToken = crypto.randomUUID();
      await ctx.db.insert("recruiterProfiles", {
        userId,
        email,
        status: "pending",
        approvalToken,
        createdAt: Date.now(),
      });

      await ctx.scheduler.runAfter(0, internal.recruiterAuth.sendApprovalEmail, {
        recruiterEmail: email,
        approvalToken,
      });
    },

    // Runs on every sign-in attempt (including the auto sign-in right
    // after signup) — throwing here rejects the session outright, so an
    // unapproved recruiter never gets a working login no matter how many
    // times they try.
    async beforeSessionCreation(genericCtx, { userId }) {
      const ctx = typed(genericCtx);
      const recruiterProfile = await ctx.db
        .query("recruiterProfiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .unique();
      if (recruiterProfile && recruiterProfile.status !== "approved") {
        throw new ConvexError(PENDING_APPROVAL_ERROR);
      }
    },
  },
});
