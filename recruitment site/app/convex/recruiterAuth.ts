import { v } from "convex/values";
import { env, internalAction, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { escapeHtml, layout, queueEmail, siteUrl } from "./email";

// Checked by the sign-up form before it submits, so a recruiter who already
// has an account gets a specific "already registered — sign in instead"
// message. Convex Auth's own duplicate-account error is a plain Error whose
// message is hidden on production, so it can't be told apart from other
// failures on the client (see src/lib/authErrors.ts). Trade-off: this lets
// anyone check whether an email has a recruiter account; acceptable for an
// internal, admin-approved recruiter portal.
export const isEmailRegistered = query({
  args: { email: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "password").eq("providerAccountId", args.email.trim()),
      )
      .unique();
    return account !== null;
  },
});

// Called from auth.ts's afterUserCreatedOrUpdated callback right after a new
// recruiter account is created. Emails the admin a one-click approve link;
// the recruiter has no working session until that link is used.
export const sendApprovalEmail = internalAction({
  args: { recruiterEmail: v.string(), approvalToken: v.string() },
  handler: async (ctx, args) => {
    const adminEmail = env.ADMIN_EMAIL;
    if (!adminEmail) {
      console.error("Recruiter signup notification skipped — ADMIN_EMAIL is not set on this deployment.");
      return;
    }
    const approveUrl = `${env.CONVEX_SITE_URL}/admin/approve-recruiter?token=${args.approvalToken}`;
    await ctx.scheduler.runAfter(0, internal.email.send, {
      to: adminEmail,
      subject: `New recruiter signup: ${args.recruiterEmail}`,
      kind: "recruiter_signup",
      sensitive: false,
      html: layout({
        heading: "New recruiter signup",
        paragraphs: [
          `A new recruiter account was just created: <strong>${escapeHtml(args.recruiterEmail)}</strong>`,
          "They cannot sign in until you approve this account.",
        ],
        button: { label: "Approve this recruiter", url: approveUrl },
      }),
    });
  },
});

export const approveByToken = internalMutation({
  args: { approvalToken: v.string() },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("recruiterProfiles")
      .withIndex("by_approvalToken", (q) => q.eq("approvalToken", args.approvalToken))
      .unique();
    if (!profile) {
      return { ok: false as const, message: "This approval link is invalid or has already been used." };
    }
    if (profile.status === "approved") {
      return { ok: true as const, message: `${profile.email} is already approved.` };
    }
    await ctx.db.patch(profile._id, { status: "approved", respondedAt: Date.now() });
    await queueEmail(ctx, {
      to: profile.email,
      subject: "Your Netlink recruiter account is approved",
      kind: "recruiter_approved",
      html: layout({
        heading: "You're approved",
        paragraphs: ["An admin has approved your recruiter account. You can sign in now."],
        button: { label: "Sign in", url: `${siteUrl()}/recruiter` },
      }),
    });
    return { ok: true as const, message: `${profile.email} has been approved and can now sign in.` };
  },
});
