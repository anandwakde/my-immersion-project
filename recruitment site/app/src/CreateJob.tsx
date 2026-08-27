import { useAuthActions } from "@convex-dev/auth/react";
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
  const { signOut } = useAuthActions();
  const createJob = useMutation(api.jobs.create);
  const myJobs = useQuery(api.jobs.listMine);
  const [selectedJob, setSelectedJob] = useState<{ id: Id<"jobs">; title: string } | null>(null);

  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [experience, setExperience] = useState("");
  const [salary, setSalary] = useState("");
  const [description, setDescription] = useState("");
  const [responsibilities, setResponsibilities] = useState("");
  const [skills, setSkills] = useState("");
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Post a job</h1>
        <Button variant="outline" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>

      <form
        className="mt-6 flex flex-col gap-4"
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
            responsibilities: responsibilities
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean),
            skills: skills
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
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
          <Label htmlFor="responsibilities">Responsibilities (one per line)</Label>
          <Textarea
            id="responsibilities"
            value={responsibilities}
            onChange={(e) => setResponsibilities(e.target.value)}
            required
            rows={4}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="skills">Required skills (comma separated)</Label>
          <Input id="skills" value={skills} onChange={(e) => setSkills(e.target.value)} required />
        </div>

        <Button type="submit" disabled={submitting}>
          Publish job
        </Button>
      </form>

      {lastPublishedUrl && (
        <div className="mt-6 rounded-md border p-4 text-sm">
          <p className="font-medium">Published! Share this link with candidates:</p>
          <a className="mt-1 block break-all underline" href={lastPublishedUrl}>
            {lastPublishedUrl}
          </a>
        </div>
      )}

      <div className="mt-10">
        <h2 className="text-lg font-semibold">Your jobs</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {myJobs?.map((job) => (
            <li key={job._id} className="rounded-md border p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">{job.title}</div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedJob({ id: job._id, title: job.title })}
                >
                  View applications
                </Button>
              </div>
              <a className="break-all text-muted-foreground underline" href={`${publicOrigin}/jobs/${job.slug}`}>
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
