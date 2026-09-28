import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../convex/_generated/api";
import { Doc } from "../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EditJobDialog } from "@/EditJobDialog";
import { navigate, useSearchParam } from "@/lib/router";
import { Link } from "@/lib/Link";
import { linesToList, skillsToList } from "@/lib/listFields";

export function PostJob() {
  const createJob = useMutation(api.jobs.create);

  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [experience, setExperience] = useState("");
  const [salary, setSalary] = useState("");
  const [description, setDescription] = useState("");
  const [responsibilities, setResponsibilities] = useState("");
  const [skills, setSkills] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPublishedUrl, setLastPublishedUrl] = useState<string | null>(null);

  const publicOrigin = window.location.origin;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-foreground">Post a job</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Fill in the role details and publish a shareable link for candidates.
      </p>

      <form
        className="mt-6 flex flex-col gap-4 rounded-lg border border-border bg-card p-6 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitting(true);
          setError(null);
          setLastPublishedUrl(null);
          createJob({
            title,
            location,
            experience,
            salary,
            description,
            responsibilities: linesToList(responsibilities),
            skills: skillsToList(skills),
          })
            .then(({ slug }) => {
              setLastPublishedUrl(`${publicOrigin}/jobs/${slug}`);
              setTitle("");
              setLocation("");
              setExperience("");
              setSalary("");
              setDescription("");
              setResponsibilities("");
              setSkills("");
            })
            .catch(() => setError("Couldn't publish the job. Please try again."))
            .finally(() => setSubmitting(false));
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="title">Job title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="location">Location</Label>
            <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="experience">Experience</Label>
            <Input id="experience" value={experience} onChange={(e) => setExperience(e.target.value)} required />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="salary">Salary</Label>
          <Input id="salary" value={salary} onChange={(e) => setSalary(e.target.value)} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="description">Job description</Label>
          <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} required rows={4} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="responsibilities">Responsibilities (optional, one per line)</Label>
          <Textarea
            id="responsibilities"
            value={responsibilities}
            onChange={(e) => setResponsibilities(e.target.value)}
            rows={3}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="skills">Required skills (optional, comma-separated)</Label>
          <Input
            id="skills"
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            placeholder="e.g. Java, Spring Boot, SQL"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Publishing..." : "Publish job"}
        </Button>
      </form>

      {lastPublishedUrl && (
        <div className="mt-6 rounded-lg border border-primary/20 bg-accent p-4 text-sm">
          <p className="font-medium text-accent-foreground">Published! Share this link with candidates:</p>
          <a
            className="mt-1 block break-all font-medium text-primary underline"
            href={lastPublishedUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {lastPublishedUrl}
          </a>
          <Link className="mt-3 inline-block font-medium text-primary underline" href="/recruiter/jobs">
            Go to All Jobs &rarr;
          </Link>
        </div>
      )}
    </div>
  );
}

type StatusFilter = "all" | "published" | "private" | "closed";
const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "published", label: "Active" },
  { key: "private", label: "Private" },
  { key: "closed", label: "Closed" },
];

export function AllJobs() {
  const allJobs = useQuery(api.jobs.listAll);
  const statusParam = useSearchParam("status");
  const filter: StatusFilter = STATUS_FILTERS.some((f) => f.key === statusParam)
    ? (statusParam as StatusFilter)
    : "all";

  const counts: Record<StatusFilter, number> = { all: 0, published: 0, private: 0, closed: 0 };
  for (const job of allJobs ?? []) {
    counts.all++;
    if (job.status === "published" || job.status === "private" || job.status === "closed") {
      counts[job.status]++;
    }
  }
  const visibleJobs = filter === "all" ? allJobs : allJobs?.filter((job) => job.status === filter);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">All jobs</h1>
        <Button onClick={() => navigate("/recruiter/post")}>+ Post a job</Button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Filter jobs by status">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            onClick={() => navigate(f.key === "all" ? "/recruiter/jobs" : `/recruiter/jobs?status=${f.key}`)}
            className={`rounded-full border px-3 py-1 text-sm font-medium ${
              filter === f.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label} <span className="tabular-nums opacity-80">({counts[f.key]})</span>
          </button>
        ))}
      </div>

      <ul className="mt-4 flex flex-col gap-3">
        {allJobs === undefined && <li className="text-sm text-muted-foreground">Loading...</li>}
        {visibleJobs?.map((job) => <JobListItem key={job._id} job={job} />)}
        {visibleJobs?.length === 0 && (
          <li className="text-sm text-muted-foreground">
            {filter === "all" ? "No jobs posted yet." : "No jobs with this status."}
          </li>
        )}
      </ul>
    </div>
  );
}

const STATUS_BADGE: Record<string, string> = {
  published: "Active",
  private: "Private",
  closed: "Closed",
  draft: "Draft",
};

function JobListItem({ job }: { job: Doc<"jobs"> }) {
  const setVisibility = useMutation(api.jobs.setVisibility);
  const removeJob = useMutation(api.jobs.remove);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const publicUrl = `${window.location.origin}/jobs/${job.slug}`;

  function changeStatus(status: "published" | "private" | "closed") {
    setUpdatingStatus(true);
    setVisibility({ jobId: job._id, status })
      .catch(() => window.alert("Couldn't update the job's status. Please try again."))
      .finally(() => setUpdatingStatus(false));
  }

  return (
    <li className="rounded-lg border border-border bg-card p-4 text-sm shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link href={`/recruiter/jobs/${job._id}`} className="font-semibold text-foreground hover:underline">
            {job.title}
          </Link>
          <span
            className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
              job.status === "published"
                ? "border-green-600/30 text-green-700"
                : "border-border text-muted-foreground"
            }`}
          >
            {STATUS_BADGE[job.status] ?? job.status}
          </span>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(`/recruiter/jobs/${job._id}`)}>
            View applications
          </Button>
          <EditJobDialog job={job} />
        </div>
      </div>
      {job.status === "published" ? (
        <a className="break-all text-primary underline" href={publicUrl} target="_blank" rel="noopener noreferrer">
          {publicUrl}
        </a>
      ) : (
        <p className="text-muted-foreground">
          {job.status === "closed"
            ? "Closed — hidden from candidates and no longer accepting applications."
            : "Private — hidden from the public job board and its link."}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
        {job.status === "published" && (
          <Button variant="outline" size="sm" disabled={updatingStatus} onClick={() => changeStatus("private")}>
            Make private
          </Button>
        )}
        {job.status === "private" && (
          <Button variant="outline" size="sm" disabled={updatingStatus} onClick={() => changeStatus("published")}>
            Make public
          </Button>
        )}
        {job.status === "closed" ? (
          <Button variant="outline" size="sm" disabled={updatingStatus} onClick={() => changeStatus("published")}>
            Reopen job
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled={updatingStatus} onClick={() => changeStatus("closed")}>
            Close job
          </Button>
        )}
        <Button
          variant="destructive"
          size="sm"
          disabled={deleting}
          onClick={() => {
            if (
              !window.confirm(
                `Delete "${job.title}"? This permanently removes the job and all of its applications. This can't be undone.\n\nTip: "Close job" hides it but keeps the candidate history.`,
              )
            ) {
              return;
            }
            setDeleting(true);
            removeJob({ jobId: job._id }).catch(() => setDeleting(false));
          }}
        >
          {deleting ? "Deleting..." : "Delete"}
        </Button>
      </div>
    </li>
  );
}
