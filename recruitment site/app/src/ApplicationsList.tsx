import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/lib/Link";
import { navigate, useSearchParam } from "@/lib/router";
import { ACTION_CARDS, ActionKey, STAGE_LABEL, tzOffsetMinutes } from "@/lib/labels";

const PAGE_SIZE = 25;

type View = "all" | "recent" | "top" | ActionKey;
const VIEW_TITLES: Record<View, string> = {
  all: "All applications",
  recent: "Recent applicants",
  top: "Top-scoring candidates",
  new: "New applications to review",
  undecided: "Not yet shortlisted or rejected",
  client_pending: "Client responses pending",
  needs_scheduling: "Interviews needing scheduling",
  interviews_today: "Interviews today",
  awaiting_decision: "Awaiting your decision after interview",
  stalled: "No movement in 5+ days",
};
const VIEWS = Object.keys(VIEW_TITLES) as View[];

// Every filter lives in the URL, so a filtered list can be refreshed,
// bookmarked or opened in a new tab.
function setParam(name: string, value: string | null) {
  const params = new URLSearchParams(window.location.search);
  if (value) params.set(name, value);
  else params.delete(name);
  if (name !== "page") params.delete("page");
  const qs = params.toString();
  navigate(`/recruiter/applications${qs ? `?${qs}` : ""}`);
}

function describeInterview(row: { interviewStatus: string | null; interviewAt: number | null }) {
  if (row.interviewStatus === "confirmed" && row.interviewAt) {
    return `Interview ${new Date(row.interviewAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`;
  }
  if (row.interviewStatus === "awaiting_candidate") return "Waiting for candidate to pick a slot";
  if (row.interviewStatus === "needs_new_slots") return "Candidate asked for new times";
  if (row.interviewStatus === "cancelled") return "Interview cancelled";
  return null;
}

export function ApplicationsList() {
  const viewParam = useSearchParam("view");
  const view: View = VIEWS.includes(viewParam as View) ? (viewParam as View) : "all";
  const jobId = useSearchParam("job") ?? "";
  const stage = useSearchParam("stage") ?? "";
  const statusParam = useSearchParam("status");
  const status = statusParam === "active" || statusParam === "rejected" ? statusParam : "";
  const search = useSearchParam("q") ?? "";
  const page = Math.max(1, Number(useSearchParam("page") ?? "1") || 1);
  const [now] = useState(() => Date.now());
  const [searchDraft, setSearchDraft] = useState(search);

  const jobs = useQuery(api.jobs.listAll);
  const rows = useQuery(api.dashboard.listApplications, {
    now,
    tzOffsetMinutes: tzOffsetMinutes(),
    view,
    jobId: jobId || undefined,
    stage: stage || undefined,
    status: status || undefined,
    search: search || undefined,
  });

  const total = rows?.length ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = rows?.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const actionCard = ACTION_CARDS.find((c) => c.key === view);

  return (
    <div className="mt-6">
      <Link href="/recruiter" className="text-sm font-medium text-muted-foreground hover:text-foreground">
        &larr; Dashboard
      </Link>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground">{VIEW_TITLES[view]}</h1>
      {actionCard && <p className="mt-1 text-sm text-muted-foreground">From the dashboard's Action required list.</p>}

      <div className="mt-4 grid grid-cols-1 gap-3 rounded-lg border border-border bg-card p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">View</span>
          <select
            className="h-9 rounded-md border border-input bg-background px-2"
            value={view}
            onChange={(e) => setParam("view", e.target.value === "all" ? null : e.target.value)}
          >
            {VIEWS.map((v) => (
              <option key={v} value={v}>
                {VIEW_TITLES[v]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Job</span>
          <select
            className="h-9 rounded-md border border-input bg-background px-2"
            value={jobId}
            onChange={(e) => setParam("job", e.target.value || null)}
          >
            <option value="">All jobs</option>
            {jobs?.map((j) => (
              <option key={j._id} value={j._id}>
                {j.title}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Stage</span>
          <select
            className="h-9 rounded-md border border-input bg-background px-2"
            value={stage}
            onChange={(e) => setParam("stage", e.target.value || null)}
          >
            <option value="">Any stage</option>
            {Object.entries(STAGE_LABEL).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Status</span>
          <select
            className="h-9 rounded-md border border-input bg-background px-2"
            value={status}
            onChange={(e) => setParam("status", e.target.value || null)}
          >
            <option value="">Active and rejected</option>
            <option value="active">Active only</option>
            <option value="rejected">Rejected only</option>
          </select>
        </label>
        <form
          className="flex flex-col gap-1 text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            setParam("q", searchDraft.trim() || null);
          }}
        >
          <span className="font-medium">Search</span>
          <Input
            aria-label="Search by candidate or job"
            placeholder="Name or job, then Enter"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
          />
        </form>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        {rows === undefined
          ? "Loading..."
          : total === 0
            ? "No applications match."
            : `Showing ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, total)} of ${total}`}
      </p>

      <ul className="mt-2 flex flex-col gap-2">
        {pageRows?.map((row) => {
          const interview = describeInterview(row);
          return (
            <li key={row.applicationId} className="rounded-lg border border-border bg-card p-3 text-sm shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Link
                    href={`/recruiter/jobs/${row.jobId}/applications/${row.applicationId}`}
                    className="font-semibold text-foreground hover:underline"
                  >
                    {row.name}
                  </Link>
                  <span className="text-muted-foreground"> — {row.jobTitle}</span>
                </div>
                <div className="flex items-center gap-2">
                  {row.score !== null && (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-foreground">
                      {row.score}/100
                    </span>
                  )}
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                    {row.rejected ? "Rejected" : (STAGE_LABEL[row.stage] ?? row.stage)}
                  </span>
                </div>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>Applied {new Date(row.appliedAt).toLocaleDateString()}</span>
                {row.clientStatus && <span>Client {row.clientStatus}</span>}
                {interview && <span>{interview}</span>}
                {view === "stalled" && <span className="font-semibold text-destructive">{row.daysStuck} days without movement</span>}
                <Link href={`/recruiter/candidates/${row.candidateId}`} className="text-primary hover:underline">
                  Candidate profile
                </Link>
              </div>
            </li>
          );
        })}
      </ul>

      {pageCount > 1 && (
        <nav className="mt-4 flex items-center justify-center gap-3" aria-label="Pages">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => setParam("page", String(currentPage - 1))}
          >
            &larr; Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= pageCount}
            onClick={() => setParam("page", String(currentPage + 1))}
          >
            Next &rarr;
          </Button>
        </nav>
      )}
    </div>
  );
}
