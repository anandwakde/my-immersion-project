import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { JobApplications } from "@/JobApplications";

export function CreateJob() {
  const createJob = useMutation(api.jobs.create);
  const myJobs = useQuery(api.jobs.listMine);
  const [selectedJob, setSelectedJob] = useState<{ id: Id<"jobs">; title: string } | null>(null);

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

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Post a job</h1>
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
        <h2 className="text-xl font-bold tracking-tight text-foreground">Your jobs</h2>
        <ul className="mt-4 flex flex-col gap-3">
          {myJobs?.map((job) => (
            <li key={job._id} className="rounded-lg border border-border bg-card p-4 text-sm shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-foreground">{job.title}</div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedJob({ id: job._id, title: job.title })}
                >
                  View applications
                </Button>
              </div>
              <a className="break-all text-primary underline" href={`${publicOrigin}/jobs/${job.slug}`}>
                {publicOrigin}/jobs/{job.slug}
              </a>
            </li>
          ))}
          {myJobs?.length === 0 && (
            <li className="text-sm text-muted-foreground">No jobs posted yet.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
