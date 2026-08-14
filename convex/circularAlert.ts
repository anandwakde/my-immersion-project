import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";

const DASHBOARD_URL = "https://pim.anandwakde.com/";
const CONVEX_SITE_URL = "https://calculating-ptarmigan-789.convex.site";
const FROM_ADDRESS = "MEA Payment Intelligence Monitor <alerts@updates.pim.anandwakde.com>";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildAlertHtml(
  circular: {
    scheme: string;
    title: string;
    urgency: string;
    deadline: string;
    scope: string;
    sourceUrl: string;
  },
  unsubscribeUrl: string
): string {
  return `
    <div style="font-family:sans-serif;color:#2B2350;">
      <p style="font-size:12px;text-transform:uppercase;letter-spacing:0.04em;color:#5B4BD6;font-weight:600;">New ${escapeHtml(circular.scheme)} circular</p>
      <h2 style="margin-top:4px;">${escapeHtml(circular.title)}</h2>
      <p><strong>Urgency:</strong> <span style="text-transform:capitalize;">${escapeHtml(circular.urgency)}</span></p>
      <p><strong>Effective date:</strong> ${escapeHtml(circular.deadline)}</p>
      <p><strong>Audience:</strong> ${escapeHtml(circular.scope)}</p>
      <p><a href="${escapeHtml(circular.sourceUrl)}" style="color:#5B4BD6;font-weight:600;">View source &rarr;</a></p>
      <p><a href="${DASHBOARD_URL}" style="color:#5B4BD6;">Open the monitoring dashboard &rarr;</a></p>
      <p style="margin-top:24px;padding-top:16px;border-top:1px solid #eee;font-size:12px;color:#999;"><a href="${unsubscribeUrl}" style="color:#999;">Unsubscribe</a> from these alerts.</p>
    </div>`;
}

// Fires once per new circular, immediately after it's ingested — sent only
// to subscribers whose scheme list includes this circular's scheme (or who
// left their list empty, meaning "everything").
export const sendCircularAlert = action({
  args: {
    scheme: v.string(),
    title: v.string(),
    urgency: v.string(),
    deadline: v.string(),
    scope: v.string(),
    sourceUrl: v.string(),
  },
  handler: async (ctx, args): Promise<unknown> => {
    if (process.env.EMAIL_ALERTS_PAUSED === "true") {
      return { paused: true };
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not set on this deployment");
    }

    const subscribers: { _id: string; email: string; schemes: string[] }[] = await ctx.runQuery(
      api.subscribers.list,
      {}
    );
    const matching = subscribers.filter(
      (sub) => sub.schemes.length === 0 || sub.schemes.includes(args.scheme)
    );

    const results = [];
    for (const sub of matching) {
      const unsubscribeUrl = `${CONVEX_SITE_URL}/unsubscribe?id=${sub._id}`;
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from: FROM_ADDRESS,
          to: sub.email,
          subject: `New ${args.scheme} circular: ${args.title}`,
          html: buildAlertHtml(args, unsubscribeUrl),
        }),
      });
      const body = await res.json();
      results.push({ email: sub.email, ok: res.ok, response: body });
    }

    return { matchedSubscribers: matching.length, results };
  },
});
