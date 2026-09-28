import { v } from "convex/values";
import { env, internalAction, internalMutation, query } from "./_generated/server";

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
  handler: async (_ctx, args) => {
    const adminEmail = env.ADMIN_EMAIL;
    const resendKey = env.RESEND_API_KEY;
    if (!adminEmail || !resendKey) {
      console.error(
        "Recruiter signup notification skipped — ADMIN_EMAIL or RESEND_API_KEY is not set on this deployment."
      );
      return;
    }

    const approveUrl = `${env.CONVEX_SITE_URL}/admin/approve-recruiter?token=${args.approvalToken}`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: "Netlink Recruitment Portal <noreply@netlink-group.com>",
        to: adminEmail,
        subject: `New recruiter signup: ${args.recruiterEmail}`,
        html: `
          <p>A new recruiter account was just created:</p>
          <p><strong>${args.recruiterEmail}</strong></p>
          <p>They cannot sign in until you approve this account.</p>
          <p><a href="${approveUrl}" style="display:inline-block;padding:10px 20px;background:#111;color:#fff;text-decoration:none;border-radius:6px;">Approve this recruiter</a></p>
          <p>Or copy this link: ${approveUrl}</p>
        `,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`Failed to send recruiter approval email: ${res.status} ${errText}`);
    }
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
    return { ok: true as const, message: `${profile.email} has been approved and can now sign in.` };
  },
});
