import { useQuery } from "convex/react";
import { Fragment, useState } from "react";
import { api } from "../convex/_generated/api";

const STATUS_STYLE: Record<string, string> = {
  sent: "bg-green-100 text-green-800",
  failed: "bg-destructive/10 text-destructive",
  logged: "bg-muted text-muted-foreground",
};
const STATUS_TEXT: Record<string, string> = {
  sent: "Sent",
  failed: "Failed",
  logged: "Test mode — not sent",
};

// Every email the portal sends. In test mode (EMAIL_MODE=log) nothing is
// actually delivered, so this page is how testers see what would have gone
// out. Sign-in code emails are listed without their body.
export function EmailLog() {
  const rows = useQuery(api.email.listLog);
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="mt-6">
      <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Email log</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        The last 200 emails the portal sent. Sign-in code emails are listed without their contents (except in test
        mode, where nothing is delivered).
      </p>
      <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border bg-background text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">To</th>
              <th className="px-3 py-2">Subject</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows === undefined && (
              <tr>
                <td className="px-3 py-3 text-muted-foreground" colSpan={5}>
                  Loading...
                </td>
              </tr>
            )}
            {rows?.length === 0 && (
              <tr>
                <td className="px-3 py-3 text-muted-foreground" colSpan={5}>
                  No emails yet.
                </td>
              </tr>
            )}
            {rows?.map((r) => (
              <Fragment key={r._id}>
                <tr className="border-b border-border last:border-0" data-kind={r.kind}>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {new Date(r.createdAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="px-3 py-2">{r.to}</td>
                  <td className="px-3 py-2">
                    {r.subject}
                    {r.hasAttachment && <span className="ml-1 text-xs text-muted-foreground">(+ calendar invite)</span>}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[r.status]}`} title={r.error}>
                      {STATUS_TEXT[r.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {r.html && (
                      <button
                        type="button"
                        className="text-xs font-medium text-primary underline"
                        onClick={() => setOpenId(openId === r._id ? null : r._id)}
                      >
                        {openId === r._id ? "Hide" : "View"}
                      </button>
                    )}
                  </td>
                </tr>
                {openId === r._id && r.html && (
                  <tr>
                    <td colSpan={5} className="bg-background px-3 py-3">
                      <iframe title={`Email: ${r.subject}`} sandbox="" srcDoc={r.html} className="h-96 w-full rounded border border-border bg-white" />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
