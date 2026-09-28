import { v } from "convex/values";
import { env, internalAction, internalMutation, MutationCtx, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

const FROM = "Netlink Recruitment <noreply@netlink-group.com>";

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  kind: string;
  // Sign-in code emails: the body is sent but never stored in the log.
  sensitive?: boolean;
  attachment?: { filename: string; content: string; contentType: string };
};

const attachmentValidator = v.object({ filename: v.string(), content: v.string(), contentType: v.string() });

// The one way anything in the app sends email. Scheduled rather than sent
// inline so a mutation stays fast and transactional — the email only goes
// out if the mutation that queued it commits.
export async function queueEmail(ctx: MutationCtx, email: OutgoingEmail) {
  await ctx.scheduler.runAfter(0, internal.email.send, {
    to: email.to,
    subject: email.subject,
    html: email.html,
    kind: email.kind,
    sensitive: email.sensitive ?? false,
    attachment: email.attachment,
  });
}

export const send = internalAction({
  args: {
    to: v.string(),
    subject: v.string(),
    html: v.string(),
    kind: v.string(),
    sensitive: v.boolean(),
    attachment: v.optional(attachmentValidator),
  },
  handler: async (ctx, args) => {
    let status: "sent" | "failed" | "logged" = "logged";
    let error: string | undefined;

    if (env.EMAIL_MODE !== "log") {
      if (!env.RESEND_API_KEY) {
        status = "failed";
        error = "RESEND_API_KEY is not set on this deployment.";
      } else {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.RESEND_API_KEY}` },
          body: JSON.stringify({
            from: FROM,
            to: args.to,
            subject: args.subject,
            html: args.html,
            attachments: args.attachment
              ? [
                  {
                    filename: args.attachment.filename,
                    content: btoa(unescape(encodeURIComponent(args.attachment.content))),
                    content_type: args.attachment.contentType,
                  },
                ]
              : undefined,
          }),
        });
        if (res.ok) {
          status = "sent";
        } else {
          status = "failed";
          error = `${res.status}: ${(await res.text()).slice(0, 300)}`;
        }
      }
    }

    await ctx.runMutation(internal.email.record, {
      to: args.to,
      subject: args.subject,
      kind: args.kind,
      // In test mode nothing is delivered, so the body (even a sign-in code)
      // is kept — the Email log is the only way a tester can read it.
      html: args.sensitive && env.EMAIL_MODE !== "log" ? undefined : args.html,
      hasAttachment: args.attachment !== undefined,
      status,
      error,
    });
  },
});

export const record = internalMutation({
  args: {
    to: v.string(),
    subject: v.string(),
    kind: v.string(),
    html: v.optional(v.string()),
    hasAttachment: v.boolean(),
    status: v.union(v.literal("sent"), v.literal("failed"), v.literal("logged")),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("emailLog", { ...args, createdAt: Date.now() });
  },
});

export const listLog = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db.query("emailLog").withIndex("by_createdAt").order("desc").take(200);
  },
});

// ---- Templates -----------------------------------------------------------

export function siteUrl(): string {
  return (env.SITE_URL ?? "").replace(/\/$/, "");
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Every email shares one simple layout: Netlink header, the body, and an
// optional call-to-action button.
export function layout(opts: { heading: string; paragraphs: string[]; button?: { label: string; url: string } }) {
  const body = opts.paragraphs.map((p) => `<p style="margin:0 0 14px;line-height:1.55">${p}</p>`).join("");
  const button = opts.button
    ? `<p style="margin:22px 0"><a href="${opts.button.url}" style="background:#0b6fd6;color:#fff;padding:11px 20px;border-radius:6px;text-decoration:none;font-weight:600">${escapeHtml(opts.button.label)}</a></p><p style="font-size:12px;color:#6b7280">Or open: ${opts.button.url}</p>`
    : "";
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#1a2333;max-width:560px;margin:0 auto;padding:24px">
  <p style="font-weight:700;color:#1e3a56;margin:0 0 20px">Netlink Group · Recruitment</p>
  <h2 style="margin:0 0 16px;font-size:20px">${escapeHtml(opts.heading)}</h2>
  ${body}${button}
  <p style="font-size:12px;color:#6b7280;margin-top:28px">This is an automated message from the Netlink recruitment portal.</p>
</div>`;
}

export function formatWhen(at: number, timeZone?: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: timeZone || "UTC",
      timeZoneName: "short",
    }).format(new Date(at));
  } catch {
    return new Date(at).toUTCString();
  }
}
