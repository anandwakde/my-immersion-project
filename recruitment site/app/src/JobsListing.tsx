import { useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { api } from "../convex/_generated/api";
import { Doc } from "../convex/_generated/dataModel";

function JobCard({ job, index }: { job: Doc<"jobs">; index: number }) {
  return (
    <a
      href={`/jobs/${job.slug}`}
      className="job-card animate-fade-up group flex flex-col rounded-xl border border-border bg-card p-6 shadow-sm"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-bold text-foreground transition-colors group-hover:text-primary">
          {job.title}
        </h3>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M7 7h10v10" />
          </svg>
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-7-6.5-7-11a7 7 0 1 1 14 0c0 4.5-7 11-7 11z" />
            <circle cx="12" cy="10" r="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {job.location}
        </span>
        <span className="inline-flex items-center gap-1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
          </svg>
          {job.experience}
        </span>
      </div>

      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{job.description}</p>

      {job.skills.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {job.skills.slice(0, 4).map((skill) => (
            <span
              key={skill}
              className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground"
            >
              {skill}
            </span>
          ))}
          {job.skills.length > 4 && (
            <span className="rounded-full px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              +{job.skills.length - 4} more
            </span>
          )}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <span className="text-sm font-semibold text-foreground">{job.salary}</span>
        <span className="text-sm font-semibold text-primary transition-transform group-hover:translate-x-1">
          View &amp; apply &rarr;
        </span>
      </div>
    </a>
  );
}

export function JobsListing({ onRecruiterClick }: { onRecruiterClick: () => void }) {
  const jobs = useQuery(api.jobs.listPublished);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!jobs) return jobs;
    const q = search.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter(
      (job) =>
        job.title.toLowerCase().includes(q) ||
        job.location.toLowerCase().includes(q) ||
        job.skills.some((s) => s.toLowerCase().includes(q))
    );
  }, [jobs, search]);

  return (
    <div>
      <div className="relative overflow-hidden bg-gradient-to-br from-[#1e3a56] to-[#2c5680]">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 animate-float rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -left-10 bottom-0 h-40 w-40 animate-float rounded-full bg-white/5" style={{ animationDelay: "1.2s" }} />

        <div className="relative mx-auto max-w-4xl px-6 py-20 text-center">
          <h1 className="animate-fade-up text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Find your next role at Netlink Group
          </h1>
          <p className="animate-fade-up mt-4 text-base text-blue-100 sm:text-lg" style={{ animationDelay: "80ms" }}>
            Real openings, straight from our hiring team — click a role, see what the job actually involves,
            and apply in minutes.
          </p>

          <div className="animate-fade-up mx-auto mt-8 max-w-md" style={{ animationDelay: "140ms" }}>
            <div className="relative">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60"
              >
                <circle cx="11" cy="11" r="7" />
                <path strokeLinecap="round" d="m20 20-3.5-3.5" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title, location, or skill..."
                className="w-full rounded-full border border-white/20 bg-white/10 py-3 pl-11 pr-4 text-sm text-white placeholder:text-white/60 backdrop-blur transition focus:border-white/40 focus:bg-white/15 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={onRecruiterClick}
            className="animate-fade-up mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-blue-100 underline decoration-blue-100/40 underline-offset-4 transition hover:text-white hover:decoration-white"
            style={{ animationDelay: "200ms" }}
          >
            Hiring for Netlink Group? Recruiter login &rarr;
          </button>
          <p className="mt-2 text-sm text-blue-100">
            Already applied?{" "}
            <a href="/candidate" className="font-medium text-white underline underline-offset-4">
              Track your application
            </a>
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-12">
        {jobs === undefined && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-48 animate-pulse rounded-xl border border-border bg-card" />
            ))}
          </div>
        )}

        {jobs && jobs.length === 0 && (
          <div className="animate-fade-up rounded-xl border border-dashed border-border py-16 text-center">
            <p className="text-lg font-semibold text-foreground">No open roles right now</p>
            <p className="mt-1 text-sm text-muted-foreground">Check back soon — new roles are posted regularly.</p>
          </div>
        )}

        {filtered && filtered.length > 0 && (
          <>
            <p className="mb-5 text-sm font-medium text-muted-foreground">
              {filtered.length} open role{filtered.length === 1 ? "" : "s"}
            </p>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {filtered.map((job, i) => (
                <JobCard key={job._id} job={job} index={i} />
              ))}
            </div>
          </>
        )}

        {jobs && jobs.length > 0 && filtered && filtered.length === 0 && (
          <div className="animate-fade-up rounded-xl border border-dashed border-border py-16 text-center">
            <p className="text-lg font-semibold text-foreground">No roles match "{search}"</p>
            <button
              type="button"
              onClick={() => setSearch("")}
              className="mt-2 text-sm font-medium text-primary underline underline-offset-4"
            >
              Clear search
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
