import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";

const STATUS_LABEL: Record<string, string> = {
  new: "New",
  shortlisted: "Shortlisted",
  rejected: "Rejected",
};

export function ApplicationDetail({
  applicationId,
  onBack,
}: {
  applicationId: Id<"applications">;
  onBack: () => void;
}) {
  const application = useQuery(api.applications.get, { applicationId });
  const setStatus = useMutation(api.applications.setStatus);
  const [updating, setUpdating] = useState(false);

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Button variant="outline" onClick={onBack}>
        &larr; Back to applications
      </Button>

      {application === undefined && (
        <p className="mt-6 text-sm text-muted-foreground">Loading...</p>
      )}

      {application === null && (
        <p className="mt-6 text-sm text-muted-foreground">This application couldn't be found.</p>
      )}

      {application && (
        <div className="mt-6 flex flex-col gap-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">{application.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Applied {new Date(application._creationTime).toLocaleString()}
              </p>
            </div>
            <span className="mt-1 shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium">
              {STATUS_LABEL[application.status] ?? application.status}
            </span>
          </div>

          <dl className="grid grid-cols-1 gap-4 rounded-md border p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="mt-0.5 break-all">{application.email}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Phone</dt>
              <dd className="mt-0.5">{application.phone}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">LinkedIn</dt>
              <dd className="mt-0.5 break-all">
                <a className="underline" href={application.linkedin} target="_blank" rel="noopener noreferrer">
                  {application.linkedin}
                </a>
              </dd>
            </div>
          </dl>

          {application.resumeUrl ? (
            <a
              href={application.resumeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block w-fit rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              View resume
            </a>
          ) : (
            <p className="text-sm text-destructive">Resume file is missing.</p>
          )}

          <div className="flex gap-3">
            <Button
              disabled={updating || application.status === "shortlisted"}
              onClick={() => {
                setUpdating(true);
                setStatus({ applicationId, status: "shortlisted" }).finally(() => setUpdating(false));
              }}
            >
              Shortlist
            </Button>
            <Button
              variant="outline"
              disabled={updating || application.status === "rejected"}
              onClick={() => {
                setUpdating(true);
                setStatus({ applicationId, status: "rejected" }).finally(() => setUpdating(false));
              }}
            >
              Reject
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
