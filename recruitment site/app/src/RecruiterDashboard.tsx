import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../convex/_generated/api";

const STAGE_LABEL: Record<string, string> = {
  applied: "Applied",
  ai_screened: "AI Screened",
  shortlisted: "Shortlisted",
  interview: "Interview",
  offer: "Offer",
  hired: "Hired",
};

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <p className="text-2xl font-extrabold tabular-nums text-foreground">{value}</p>
      <p className="mt-1 text-xs font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

export function RecruiterDashboard() {
  const [now] = useState(() => Date.now());
  const data = useQuery(api.dashboard.getOverview, { now });

  if (data === undefined) {
    return <p className="mt-6 text-sm text-muted-foreground">Loading...</p>;
  }
  if (data === null) {
    return <p className="mt-6 text-sm text-muted-foreground">Sign in to view the dashboard.</p>;
  }

  const maxFunnelCount = Math.max(1, ...data.funnel.map((f) => f.count));

  return (
    <div className="mt-6 flex flex-col gap-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <KpiCard label="Published jobs" value={data.kpis.publishedJobs} />
        <KpiCard label="Candidates" value={data.kpis.totalCandidates} />
        <KpiCard label="Applications" value={data.kpis.totalApplications} />
        <KpiCard label="Hired" value={data.kpis.hired} />
        <KpiCard label="Rejected" value={data.kpis.rejected} />
      </div>

      <div>
        <h2 className="text-lg font-bold text-foreground">Pipeline funnel</h2>
        <p className="text-xs text-muted-foreground">Active (non-rejected) applications by stage.</p>
        <div className="mt-3 flex flex-col gap-2">
          {data.funnel.map((f) => (
            <div key={f.stage} className="flex items-center gap-3 text-sm">
              <span className="w-28 shrink-0 text-muted-foreground">{f.label}</span>
              <div className="h-5 flex-1 overflow-hidden rounded bg-background">
                <div
                  className="h-full rounded bg-primary"
                  style={{ width: `${(f.count / maxFunnelCount) * 100}%` }}
                />
              </div>
              <span className="w-8 shrink-0 text-right font-semibold tabular-nums text-foreground">{f.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold text-destructive">
          Needs attention — no movement in {data.stuckThresholdDays}+ days
        </h2>
        <ul className="mt-3 flex flex-col gap-2">
          {data.attentionRequired.map((a) => (
            <li
              key={a.applicationId}
              className="flex items-center justify-between gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm"
            >
              <div>
                <span className="font-semibold text-foreground">{a.name}</span>
                <span className="text-muted-foreground"> — {a.jobTitle}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                  {STAGE_LABEL[a.stage] ?? a.stage}
                </span>
                <span className="font-semibold text-destructive">{a.daysStuck}d stuck</span>
              </div>
            </li>
          ))}
          {data.attentionRequired.length === 0 && (
            <li className="text-sm text-muted-foreground">Nothing stalled — everything's moving.</li>
          )}
        </ul>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <h2 className="text-lg font-bold text-foreground">Recent applicants</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {data.recentCandidates.map((c) => (
              <li key={c.applicationId} className="rounded-lg border border-border bg-card p-3 text-sm shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-foreground">{c.name}</span>
                  <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                    {STAGE_LABEL[c.stage] ?? c.stage}
                  </span>
                </div>
                <p className="mt-0.5 text-muted-foreground">{c.jobTitle}</p>
              </li>
            ))}
            {data.recentCandidates.length === 0 && (
              <li className="text-sm text-muted-foreground">No applications yet.</li>
            )}
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-bold text-foreground">Top-scoring candidates</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {data.topCandidates.map((c) => (
              <li
                key={c.applicationId}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-3 text-sm shadow-sm"
              >
                <div>
                  <span className="font-semibold text-foreground">{c.name}</span>
                  <p className="text-muted-foreground">{c.jobTitle}</p>
                </div>
                <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-accent-foreground">
                  {c.score}/100
                </span>
              </li>
            ))}
            {data.topCandidates.length === 0 && (
              <li className="text-sm text-muted-foreground">No candidates scored yet.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
