import { useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "../convex/_generated/api";
import { ApplicationForm } from "@/ApplicationForm";
import { ConfirmationScreen } from "@/ConfirmationScreen";

// Job descriptions are stored as one free-text block, often pasted from Word
// or a job spec with each point on its own line (sometimes already prefixed
// with a bullet character). Splitting on line breaks and stripping any
// existing bullet markers turns that into a clean, consistent bullet list
// instead of one cluttered wall of text.
function splitIntoPoints(description: string): string[] {
  return description
    .split("\n")
    .map((line) => line.trim().replace(/^[•*⁠\s-]+/, "").trim())
    .filter((line) => line.length > 0);
}

export function PublicJobPage({ slug }: { slug: string }) {
  const job = useQuery(api.jobs.getBySlug, { slug });
  const [showForm, setShowForm] = useState(false);
  const [submittedApplicationId, setSubmittedApplicationId] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  // The form only mounts once showForm flips true, so it's not there yet on
  // the same render as the click that revealed it — scroll on the next
  // render, once formRef is actually attached to it.
  useEffect(() => {
    if (showForm) {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [showForm]);

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
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-blue-100 transition hover:text-white"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-3.5 w-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            All open roles
          </a>
          <h1 className="animate-fade-up text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            {job.title}
          </h1>
          <div className="animate-fade-up mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium text-blue-100" style={{ animationDelay: "60ms" }}>
            <span>{job.location}</span>
            <span>•</span>
            <span>{job.experience}</span>
            <span>•</span>
            <span>{job.salary}</span>
          </div>

          {!showForm && (
            <button
              type="button"
              className="animate-fade-up mt-8 inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:brightness-110 hover:shadow-xl active:scale-[0.98]"
              style={{ animationDelay: "120ms" }}
              onClick={() => setShowForm(true)}
            >
              Apply Now
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-4 w-4 transition-transform group-hover:translate-x-1">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-6 py-12">
        <section className="animate-fade-up rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-bold text-foreground">About the role</h2>
          {(() => {
            const points = splitIntoPoints(job.description);
            return points.length > 1 ? (
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
                {points.map((point, i) => (
                  <li key={i}>{point}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{job.description}</p>
            );
          })()}
        </section>

        {job.responsibilities.length > 0 && (
          <section className="animate-fade-up mt-6 rounded-lg border border-border bg-card p-6 shadow-sm" style={{ animationDelay: "60ms" }}>
            <h2 className="text-lg font-bold text-foreground">Responsibilities</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
              {job.responsibilities.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        )}

        {job.skills.length > 0 && (
          <section className="animate-fade-up mt-6 rounded-lg border border-border bg-card p-6 shadow-sm" style={{ animationDelay: "120ms" }}>
            <h2 className="text-lg font-bold text-foreground">Required skills</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {job.skills.map((skill) => (
                <span
                  key={skill}
                  className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground transition hover:bg-primary hover:text-primary-foreground"
                >
                  {skill}
                </span>
              ))}
            </div>
          </section>
        )}

        {showForm && (
          <div ref={formRef} className="animate-fade-up mt-6 scroll-mt-20 rounded-lg border border-border bg-card p-6 shadow-sm">
            <ApplicationForm jobId={job._id} onSubmitted={setSubmittedApplicationId} />
          </div>
        )}
      </div>
    </div>
  );
}
