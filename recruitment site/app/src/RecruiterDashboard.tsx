import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../convex/_generated/api";
import { Link } from "@/lib/Link";
import { ACTION_CARDS, STAGE_LABEL, tzOffsetMinutes } from "@/lib/labels";

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <p className="text-2xl font-extrabold tabular-nums text-foreground">{value}</p>
      <p className="mt-1 text-xs font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

function applicationHref(row: { jobId: string; applicationId: string }) {
  return `/recruiter/jobs/${row.jobId}/applications/${row.applicationId}`;
}

export function RecruiterDashboard() {
  const [now] = useState(() => Date.now());
  const data = useQuery(api.dashboard.getOverview, { now, tzOffsetMinutes: tzOffsetMinutes() });

  if (data === undefined) {
    return <p className="mt-6 text-sm text-muted-foreground">Loading...</p>;
  }
  if (data === null) {
    return <p className="mt-6 text-sm text-muted-foreground">Sign in to view the dashboard.</p>;
  }

  const maxFunnelCount = Math.max(1, ...data.funnel.map((f) => f.count));
  const days = { stuck: data.stuckThresholdDays, fresh: data.newWindowDays };

  return (
    <div className="mt-6 flex flex-col gap-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <KpiCard label="Published jobs" value={data.kpis.publishedJobs} />
        <KpiCard label="Candidates" value={data.kpis.totalCandidates} />
        <KpiCard label="Applications" value={data.kpis.totalApplications} />
        <KpiCard label="Hired" value={data.kpis.hired} />
        <KpiCard label="Rejected" value={data.kpis.rejected} />
      </div>

      <section aria-labelledby="action-required">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="action-required" className="text-lg font-bold text-foreground">
            Action required
          </h2>
          <Link href="/recruiter/applications" className="text-sm font-medium text-primary hover:underline">
            All applications &rarr;
          </Link>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ACTION_CARDS.map((card) => {
            const n = data.actionCounts[card.key];
            const active = n > 0;
            return (
              <Link
                key={card.key}
                href={`/recruiter/applications?view=${card.key}`}
                data-action={card.key}
                className={`group flex items-center justify-between gap-3 rounded-lg border p-4 text-sm shadow-sm transition ${
                  active
                    ? card.tone === "urgent"
                      ? "border-amber-500/40 bg-amber-50 hover:border-amber-500"
                      : "border-primary/30 bg-accent hover:border-primary"
                    : "border-border bg-card text-muted-foreground hover:border-primary/30"
                }`}
              >
                <span className={active ? "font-medium text-foreground" : ""}>{card.text(n, days)}</span>
                <span aria-hidden="true" className="shrink-0 font-semibold text-primary transition group-hover:translate-x-0.5">
                  &rarr;
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <div>
        <h2 className="text-lg font-bold text-foreground">Pipeline funnel</h2>
        <p className="text-xs text-muted-foreground">Active (non-rejected) applications by stage.</p>
        <div className="mt-3 flex flex-col gap-2">
          {data.funnel.map((f) => (
            <Link
              key={f.stage}
              href={`/recruiter/applications?stage=${f.stage}&status=active`}
              className="flex items-center gap-3 rounded text-sm hover:bg-accent"
            >
              <span className="w-28 shrink-0 text-muted-foreground">{f.label}</span>
              <div className="h-5 flex-1 overflow-hidden rounded bg-background">
                <div className="h-full rounded bg-primary" style={{ width: `${(f.count / maxFunnelCount) * 100}%` }} />
              </div>
              <span className="w-8 shrink-0 text-right font-semibold tabular-nums text-foreground">{f.count}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-bold text-foreground">Recent applicants</h2>
            <Link href="/recruiter/applications?view=recent" className="text-sm font-medium text-primary hover:underline">
              View all
            </Link>
          </div>
          <ul className="mt-3 flex flex-col gap-2">
            {data.recentCandidates.map((c) => (
              <li key={c.applicationId}>
                <Link
                  href={applicationHref(c)}
                  className="block rounded-lg border border-border bg-card p-3 text-sm shadow-sm transition hover:border-primary/40 hover:bg-accent"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground">{c.name}</span>
                    <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                      {c.rejected ? "Rejected" : (STAGE_LABEL[c.stage] ?? c.stage)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-muted-foreground">{c.jobTitle}</p>
                </Link>
              </li>
            ))}
            {data.recentCandidates.length === 0 && <li className="text-sm text-muted-foreground">No applications yet.</li>}
          </ul>
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-bold text-foreground">Top-scoring candidates</h2>
            <Link href="/recruiter/applications?view=top" className="text-sm font-medium text-primary hover:underline">
              View all
            </Link>
          </div>
          <ul className="mt-3 flex flex-col gap-2">
            {data.topCandidates.map((c) => (
              <li key={c.applicationId}>
                <Link
                  href={applicationHref(c)}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-3 text-sm shadow-sm transition hover:border-primary/40 hover:bg-accent"
                >
                  <div>
                    <span className="font-semibold text-foreground">{c.name}</span>
                    <p className="text-muted-foreground">{c.jobTitle}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-accent-foreground">
                    {c.score}/100
                  </span>
                </Link>
              </li>
            ))}
            {data.topCandidates.length === 0 && <li className="text-sm text-muted-foreground">No candidates scored yet.</li>}
          </ul>
        </div>
      </div>

      {data.truncated && (
        <p className="text-xs text-muted-foreground">
          Showing figures for the most recent 1,000 applications.
        </p>
      )}
    </div>
  );
}
