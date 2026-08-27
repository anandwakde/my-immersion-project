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

  if (selectedApplicationId) {
    return (
      <ApplicationDetail
        applicationId={selectedApplicationId}
        onBack={() => setSelectedApplicationId(null)}
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Button variant="outline" onClick={onBack}>
        &larr; Back to jobs
      </Button>

      <h1 className="mt-4 text-2xl font-bold">Applications for {jobTitle}</h1>

      <ul className="mt-6 flex flex-col gap-3">
        {applications?.map((app) => (
          <li key={app._id}>
            <button
              type="button"
              className="w-full rounded-md border p-4 text-left text-sm hover:bg-accent"
              onClick={() => setSelectedApplicationId(app._id)}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{app.name}</span>
                <span className="rounded-full border px-2 py-0.5 text-xs">
                  {STATUS_LABEL[app.status] ?? app.status}
                </span>
              </div>
              <div className="mt-1 text-muted-foreground">{app.email} · {app.phone}</div>
            </button>
          </li>
        ))}
        {applications?.length === 0 && (
          <li className="text-sm text-muted-foreground">No applications yet for this job.</li>
        )}
      </ul>
    </div>
  );
}
