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
    <div>
      <div className="bg-gradient-to-br from-[#1e3a56] to-[#2c5680]">
        <div className="mx-auto max-w-2xl px-6 py-16">
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">{job.title}</h1>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium text-blue-100">
            <span>{job.location}</span>
            <span>•</span>
            <span>{job.experience}</span>
            <span>•</span>
            <span>{job.salary}</span>
          </div>

          {!showForm && (
            <button
              type="button"
              className="mt-8 inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:brightness-110"
              onClick={() => setShowForm(true)}
            >
              Apply Now
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-6 py-12">
        <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-bold text-foreground">About the role</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{job.description}</p>
        </section>

        {job.responsibilities.length > 0 && (
          <section className="mt-6 rounded-lg border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-bold text-foreground">Responsibilities</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
              {job.responsibilities.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        )}

        {job.skills.length > 0 && (
          <section className="mt-6 rounded-lg border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-bold text-foreground">Required skills</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {job.skills.map((skill) => (
                <span
                  key={skill}
                  className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground"
                >
                  {skill}
                </span>
              ))}
            </div>
          </section>
        )}

        {showForm && (
          <div className="mt-6 rounded-lg border border-border bg-card p-6 shadow-sm">
            <ApplicationForm jobId={job._id} onSubmitted={setSubmittedApplicationId} />
          </div>
        )}
      </div>
    </div>
  );
}
