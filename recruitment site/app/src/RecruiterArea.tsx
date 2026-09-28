import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { AllJobs, PostJob } from "@/CreateJob";
import { JobApplications } from "@/JobApplications";
import { ApplicationDetail } from "@/ApplicationDetail";
import { CandidateSearch } from "@/CandidateSearch";
import { RecruiterDashboard } from "@/RecruiterDashboard";
import { navigate } from "@/lib/router";
import { Link } from "@/lib/Link";

// Every recruiter screen has its own address under /recruiter:
//   /recruiter                                  Dashboard
//   /recruiter/post                             Post a job
//   /recruiter/jobs[?status=…]                  All jobs
//   /recruiter/jobs/:jobId                      One job's applications
//   /recruiter/jobs/:jobId/applications/:appId  One application
//   /recruiter/candidates                       Candidate search

const TABS = [
  { href: "/recruiter", label: "Dashboard" },
  { href: "/recruiter/post", label: "Post a Job" },
  { href: "/recruiter/jobs", label: "All Jobs" },
  { href: "/recruiter/candidates", label: "Candidates" },
];

function activeTab(pathname: string): string {
  if (pathname.startsWith("/recruiter/jobs")) return "/recruiter/jobs";
  return TABS.some((t) => t.href === pathname) ? pathname : "/recruiter";
}

function Tabs({ pathname }: { pathname: string }) {
  const active = activeTab(pathname);
  return (
    <nav className="flex gap-2 overflow-x-auto border-b border-border" aria-label="Recruiter sections">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={active === t.href ? "page" : undefined}
          className={`whitespace-nowrap px-3 py-2 text-sm font-semibold ${
            active === t.href ? "border-b-2 border-primary text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

function NotFound({ message }: { message: string }) {
  return (
    <div className="mt-10 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" className="mt-4" onClick={() => navigate("/recruiter/jobs")}>
        Back to All Jobs
      </Button>
    </div>
  );
}

function JobRoute({ jobId }: { jobId: string }) {
  const job = useQuery(api.jobs.get, { jobId });
  if (job === undefined) return <p className="mt-6 text-sm text-muted-foreground">Loading...</p>;
  if (job === null) return <NotFound message="This job couldn't be found — it may have been deleted." />;
  return <JobApplications jobId={job._id} jobTitle={job.title} onBack={() => navigate("/recruiter/jobs")} />;
}

function ApplicationRoute({ jobId, applicationId }: { jobId: string; applicationId: string }) {
  const resolvedId = useQuery(api.jobs.resolveApplicationId, { jobId, applicationId });
  if (resolvedId === undefined) return <p className="mt-6 text-sm text-muted-foreground">Loading...</p>;
  if (resolvedId === null) return <NotFound message="This application couldn't be found." />;
  return <ApplicationDetail applicationId={resolvedId} onBack={() => navigate(`/recruiter/jobs/${jobId}`)} />;
}

function Screen({ pathname }: { pathname: string }) {
  if (pathname === "/recruiter/post") return <PostJob />;
  if (pathname === "/recruiter/jobs") return <AllJobs />;
  if (pathname === "/recruiter/candidates") return <CandidateSearch />;

  const applicationMatch = pathname.match(/^\/recruiter\/jobs\/([^/]+)\/applications\/([^/]+)$/);
  if (applicationMatch) {
    return <ApplicationRoute key={pathname} jobId={applicationMatch[1]} applicationId={applicationMatch[2]} />;
  }
  const jobMatch = pathname.match(/^\/recruiter\/jobs\/([^/]+)$/);
  if (jobMatch) return <JobRoute key={pathname} jobId={jobMatch[1]} />;

  return <RecruiterDashboard />;
}

export function RecruiterArea({ pathname }: { pathname: string }) {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <Tabs pathname={pathname} />
      <Screen pathname={pathname} />
    </div>
  );
}
