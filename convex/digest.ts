import { action } from "./_generated/server";
import { api } from "./_generated/api";

const DASHBOARD_URL = "https://mea-payment-intelligence-monitor.vercel.app/dashboard.html";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildDigestHtml(
  circulars: { scheme: string; title: string; urgency: string; deadline: string; sourceUrl: string }[]
): string {
  const dashboardLink = `<p><a href="${DASHBOARD_URL}" style="color:#5B4BD6;font-weight:600;">Open the monitoring dashboard &rarr;</a></p>`;

  if (!circulars.length) {
    return `<div style="font-family:sans-serif;color:#2B2350;"><h2>Your circular digest</h2><p>No circulars matched your subscription right now.</p>${dashboardLink}</div>`;
  }

  const rows = circulars
    .map(
      (c) => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(c.scheme)}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;"><a href="${escapeHtml(c.sourceUrl)}" style="color:#2B2350;">${escapeHtml(c.title)}</a></td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-transform:capitalize;">${escapeHtml(c.urgency)}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(c.deadline)}</td>
        </tr>`
    )
    .join("");
  return `
    <div style="font-family:sans-serif;color:#2B2350;">
      <h2>Your circular digest</h2>
      ${dashboardLink}
      <table style="border-collapse:collapse;width:100%;">
        <thead>
          <tr style="text-align:left;">
            <th style="padding:8px;">Scheme</th>
            <th style="padding:8px;">Title</th>
            <th style="padding:8px;">Urgency</th>
            <th style="padding:8px;">Deadline</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

export const sendDigest = action({
  args: {},
  handler: async (ctx): Promise<unknown> => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not set on this deployment");
    }

    const subscribers: { email: string; schemes: string[] }[] = await ctx.runQuery(
      api.subscribers.list,
      {}
    );
    const circulars: { scheme: string; title: string; urgency: string; deadline: string; sourceUrl: string }[] =
      await ctx.runQuery(api.circulars.list, {});

    const results = [];

    for (const sub of subscribers) {
      const matching =
        sub.schemes.length === 0 ? circulars : circulars.filter((c) => sub.schemes.includes(c.scheme));

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from: "MEA Payment Intelligence Monitor <onboarding@resend.dev>",
          to: sub.email,
          subject: `Your circular digest — ${matching.length} update${matching.length === 1 ? "" : "s"}`,
          html: buildDigestHtml(matching),
        }),
      });

      const body = await res.json();
      results.push({ email: sub.email, ok: res.ok, matched: matching.length, response: body });
    }

    return results;
  },
});
