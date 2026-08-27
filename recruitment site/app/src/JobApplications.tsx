import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { ApplicationDetail } from "@/ApplicationDetail";

const STATUS_LABEL: Record<string, string> = {
  new: "New",
  shortlisted: "Shortlisted",
  rejected: "Rejected",
};

type Tab = "all" | "shortlisted";

export function JobApplications({
  jobId,
  jobTitle,
  onBack,
}: {
  jobId: Id<"jobs">;
  jobTitle: string;
  onBack: () => void;
}) {
  const applications = useQuery(api.applications.listForJob, { jobId });
  const [selectedApplicationId, setSelectedApplicationId] = useState<Id<"applications"> | null>(null);
  const [tab, setTab] = useState<Tab>("all");

  if (selectedApplicationId) {
    return (
      <ApplicationDetail
        applicationId={selectedApplicationId}
        onBack={() => setSelectedApplicationId(null)}
      />
    );
  }

  const visibleApplications =
    tab === "shortlisted" ? applications?.filter((app) => app.status === "shortlisted") : applications;

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Button variant="outline" onClick={onBack}>
        &larr; Back to jobs
      </Button>

      <h1 className="font-display mt-4 text-4xl font-extrabold italic leading-[0.95] tracking-tight text-foreground">
        Applications for <span className="text-primary">{jobTitle}</span>
      </h1>

      <div className="mt-5 flex gap-2 border-b-2 border-foreground">
        <button
          type="button"
          className={`px-3 py-2 text-sm font-bold uppercase tracking-wide ${
            tab === "all" ? "border-b-4 border-primary text-foreground" : "text-muted-foreground"
          }`}
          onClick={() => setTab("all")}
        >
          All applications
        </button>
        <button
          type="button"
          className={`px-3 py-2 text-sm font-bold uppercase tracking-wide ${
            tab === "shortlisted" ? "border-b-4 border-primary text-foreground" : "text-muted-foreground"
          }`}
          onClick={() => setTab("shortlisted")}
        >
          Shortlisted
        </button>
      </div>

      <ul className="mt-6 flex flex-col gap-3">
        {visibleApplications?.map((app) => (
          <li key={app._id}>
            <button
              type="button"
              className="w-full border-2 border-foreground bg-card p-4 text-left text-sm transition hover:bg-accent"
              onClick={() => setSelectedApplicationId(app._id)}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground">{app.name}</span>
                <span className="border-2 border-foreground px-2 py-0.5 text-xs font-bold uppercase text-foreground">
                  {STATUS_LABEL[app.status] ?? app.status}
                </span>
              </div>
              <div className="mt-1 text-muted-foreground">{app.email} · {app.phone}</div>
            </button>
          </li>
        ))}
        {visibleApplications?.length === 0 && (
          <li className="text-sm text-muted-foreground">
            {tab === "shortlisted" ? "No shortlisted candidates yet." : "No applications yet for this job."}
          </li>
        )}
      </ul>
    </div>
  );
}
