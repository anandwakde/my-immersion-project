import { Doc } from "./_generated/dataModel";

export type ApplicationStage =
  | "applied"
  | "ai_screened"
  | "shortlisted"
  | "interview"
  | "offer"
  | "hired";

export function resolveRejected(app: Doc<"applications">): boolean {
  return app.rejected ?? false;
}

export const STAGES: { key: ApplicationStage; label: string }[] = [
  { key: "applied", label: "Applied" },
  { key: "ai_screened", label: "AI Screened" },
  { key: "shortlisted", label: "Shortlisted" },
  { key: "interview", label: "Interview" },
  { key: "offer", label: "Offer" },
  { key: "hired", label: "Hired" },
];
