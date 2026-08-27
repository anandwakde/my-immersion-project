import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../convex/_generated/api";
import { ApplicationForm } from "@/ApplicationForm";
import { ConfirmationScreen } from "@/ConfirmationScreen";

export function PublicJobPage({ slug }: { slug: string }) {
  const job = useQuery(api.jobs.getBySlug, { slug });
  const [showForm, setShowForm] = useState(false);
  const [submittedApplicationId, setSubmittedApplicationId] = useState<string | null>(null);

  if (job === undefined) {
    return <div className="px-6 py-16 text-center text-sm text-muted-foreground">Loading...</div>;
  }

  if (job === null) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-xl font-semibold">This job isn't available</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          It may have been closed or the link is incorrect.
        </p>
      </div>
    );
  }

  if (submittedApplicationId) {
    return <ConfirmationScreen jobTitle={job.title} applicationId={submittedApplicationId} />;
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">{job.title}</h1>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span>{job.location}</span>
        <span>•</span>
        <span>{job.experience}</span>
        <span>•</span>
        <span>{job.salary}</span>
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">About the role</h2>
        <p className="mt-2 text-sm leading-relaxed">{job.description}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Responsibilities</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">
          {job.responsibilities.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Required skills</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {job.skills.map((skill) => (
            <span key={skill} className="rounded-full border px-3 py-1 text-xs font-medium">
              {skill}
            </span>
          ))}
        </div>
      </section>

      {!showForm && (
        <button
          type="button"
          className="mt-10 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
          onClick={() => setShowForm(true)}
        >
          Apply Now
        </button>
      )}

      {showForm && <ApplicationForm jobId={job._id} onSubmitted={setSubmittedApplicationId} />}
    </div>
  );
}
