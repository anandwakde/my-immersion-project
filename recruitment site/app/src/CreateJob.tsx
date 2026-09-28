import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../convex/_generated/api";
import { Doc, Id } from "../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { JobApplications } from "@/JobApplications";
import { CandidateSearch } from "@/CandidateSearch";
import { RecruiterDashboard } from "@/RecruiterDashboard";
import { EditJobDialog } from "@/EditJobDialog";

type View = "jobs" | "candidates" | "dashboard";
const VIEWS: { key: View; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "jobs", label: "Jobs" },
  { key: "candidates", label: "Candidates" },
];

function ViewTabs({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div className="flex gap-2 border-b border-border">
      {VIEWS.map((v) => (
        <button
          key={v.key}
          type="button"
          className={`px-3 py-2 text-sm font-semibold ${
            view === v.key ? "border-b-2 border-primary text-foreground" : "text-muted-foreground"
          }`}
          onClick={() => onChange(v.key)}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}

export function CreateJob() {
  const createJob = useMutation(api.jobs.create);
  const allJobs = useQuery(api.jobs.listAll);
  const [selectedJob, setSelectedJob] = useState<{ id: Id<"jobs">; title: string } | null>(null);
  const [view, setView] = useState<View>("dashboard");

  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [experience, setExperience] = useState("");
  const [salary, setSalary] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lastPublishedUrl, setLastPublishedUrl] = useState<string | null>(null);

  const publicOrigin = window.location.origin;

  if (selectedJob) {
    return (
      <JobApplications
        jobId={selectedJob.id}
        jobTitle={selectedJob.title}
        onBack={() => setSelectedJob(null)}
      />
    );
  }

  if (view === "dashboard") {
    return (
      <div className="mx-auto max-w-5xl px-6 py-12">
        <ViewTabs view={view} onChange={setView} />
        <RecruiterDashboard />
      </div>
    );
  }

  if (view === "candidates") {
    return (
      <div className="mx-auto max-w-5xl px-6 py-12">
        <ViewTabs view={view} onChange={setView} />
        <CandidateSearch />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <ViewTabs view={view} onChange={setView} />

      <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-foreground">Post a job</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Fill in the role details and publish a shareable link for candidates.
      </p>

      <form
        className="mt-6 flex flex-col gap-4 rounded-lg border border-border bg-card p-6 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitting(true);
          setLastPublishedUrl(null);
          createJob({
            title,
            location,
            experience,
            salary,
            description,
            responsibilities: [],
            skills: [],
          })
            .then(({ slug }) => {
              setLastPublishedUrl(`${publicOrigin}/jobs/${slug}`);
              setTitle("");
              setLocation("");
              setExperience("");
              setSalary("");
              setDescription("");
            })
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
        <Button type="submit" disabled={submitting}>
          Publish job
        </Button>
      </form>

      {lastPublishedUrl && (
        <div className="mt-6 rounded-lg border border-primary/20 bg-accent p-4 text-sm">
          <p className="font-medium text-accent-foreground">Published! Share this link with candidates:</p>
          <a className="mt-1 block break-all font-medium text-primary underline" href={lastPublishedUrl}>
            {lastPublishedUrl}
          </a>
        </div>
      )}

      <div className="mt-12">
        <h2 className="text-xl font-bold tracking-tight text-foreground">All jobs</h2>
        <ul className="mt-4 flex flex-col gap-3">
          {allJobs?.map((job) => <JobListItem key={job._id} job={job} onViewApplications={setSelectedJob} />)}
          {allJobs?.length === 0 && (
            <li className="text-sm text-muted-foreground">No jobs posted yet.</li>
          )}
        </ul>
      </div>
    </div>
  );
}

function JobListItem({
  job,
  onViewApplications,
}: {
  job: Doc<"jobs">;
  onViewApplications: (job: { id: Id<"jobs">; title: string }) => void;
}) {
  const setVisibility = useMutation(api.jobs.setVisibility);
  const removeJob = useMutation(api.jobs.remove);
  const [updatingVisibility, setUpdatingVisibility] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const publicOrigin = window.location.origin;

  return (
    <li className="rounded-lg border border-border bg-card p-4 text-sm shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">{job.title}</span>
          {job.status === "private" && (
            <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
              Private
            </span>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => onViewApplications({ id: job._id, title: job.title })}>
            View applications
          </Button>
          <EditJobDialog job={job} />
        </div>
      </div>
      <a className="break-all text-primary underline" href={`${publicOrigin}/jobs/${job.slug}`}>
        {publicOrigin}/jobs/{job.slug}
      </a>
      <div className="mt-3 flex gap-2 border-t border-border pt-3">
        <Button
          variant="outline"
          size="sm"
          disabled={updatingVisibility}
          onClick={() => {
            setUpdatingVisibility(true);
            setVisibility({ jobId: job._id, status: job.status === "private" ? "published" : "private" }).finally(
              () => setUpdatingVisibility(false),
            );
          }}
        >
          {job.status === "private" ? "Make public" : "Make private"}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          disabled={deleting}
          onClick={() => {
            if (
              !window.confirm(
                `Delete "${job.title}"? This permanently removes the job and all of its applications. This can't be undone.`,
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
