import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../convex/_generated/api";
import { ApplicationForm } from "@/ApplicationForm";
import { ConfirmationScreen } from "@/ConfirmationScreen";
import { Asterisk } from "@/Asterisk";

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

  const titleWords = job.title.trim().split(" ");
  const lastWord = titleWords.pop();
  const leadWords = titleWords.join(" ");

  return (
    <div className="relative mx-auto max-w-2xl px-6 py-16">
      <div className="hidden select-none flex-col items-center gap-3 text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground sm:absolute sm:right-2 sm:top-16 sm:flex">
        <span style={{ writingMode: "vertical-rl" }}>{job.location}</span>
      </div>

      <Asterisk className="h-10 w-10 text-primary" />
      <h1 className="font-display mt-3 max-w-xl text-6xl font-extrabold italic leading-[0.92] tracking-tight text-foreground">
        {leadWords ? `${leadWords} ` : ""}
        <span className="text-primary">{lastWord}</span>
      </h1>

      <div className="mt-5 flex flex-wrap gap-x-3 gap-y-1 text-sm font-semibold text-foreground">
        <span>{job.location}</span>
        <span className="text-primary">•</span>
        <span>{job.experience}</span>
        <span className="text-primary">•</span>
        <span>{job.salary}</span>
      </div>

      <section className="mt-10">
        <p className="max-w-xl text-base leading-relaxed text-foreground">{job.description}</p>
      </section>

      {job.responsibilities.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">Requirements:</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {job.responsibilities.map((item) => (
              <li key={item} className="flex gap-3 text-sm leading-relaxed text-foreground">
                <span className="font-bold text-primary">&rarr;</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {job.skills.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">Skills</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {job.skills.map((skill) => (
              <span
                key={skill}
                className="border-2 border-foreground bg-card px-3 py-1 text-xs font-bold uppercase tracking-wide text-foreground"
              >
                {skill}
              </span>
            ))}
          </div>
        </section>
      )}

      {!showForm && (
        <button
          type="button"
          className="mt-12 inline-flex items-center gap-2 bg-primary px-8 py-4 text-sm font-bold uppercase tracking-wide text-primary-foreground transition hover:brightness-110"
          onClick={() => setShowForm(true)}
        >
          Apply Now
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      )}

      {showForm && (
        <div className="mt-10 border-2 border-foreground bg-card p-6">
          <ApplicationForm jobId={job._id} onSubmitted={setSubmittedApplicationId} />
        </div>
      )}
    </div>
  );
}
