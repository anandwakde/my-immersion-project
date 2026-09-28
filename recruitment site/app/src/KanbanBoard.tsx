import { DndContext, DragEndEvent, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

type Stage = "applied" | "ai_screened" | "shortlisted" | "interview" | "offer" | "hired";
type KanbanApplication = {
  _id: Id<"applications">;
  name: string;
  stage: Stage;
  rejected: boolean;
  matchScore: number | null;
};

const STAGES: { key: Stage; label: string }[] = [
  { key: "applied", label: "Applied" },
  { key: "ai_screened", label: "AI Screened" },
  { key: "shortlisted", label: "Shortlisted" },
  { key: "interview", label: "Interview" },
  { key: "offer", label: "Offer" },
  { key: "hired", label: "Hired" },
];

function KanbanCard({ app, onOpen }: { app: KanbanApplication; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: app._id });
  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: isDragging ? 50 : undefined,
        opacity: isDragging ? 0.6 : 1,
      }
    : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onOpen}
      className="min-w-0 cursor-grab select-none rounded-md border border-border bg-card p-3 text-sm shadow-sm transition hover:border-primary/40 active:cursor-grabbing"
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="truncate font-semibold text-foreground" title={app.name}>
          {app.name}
        </span>
        {app.matchScore !== null && (
          <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-foreground">
            {app.matchScore}
          </span>
        )}
      </div>
      {app.rejected && (
        <span className="mt-1.5 inline-block rounded-full border border-destructive/30 px-2 py-0.5 text-xs font-medium text-destructive">
          Rejected
        </span>
      )}
    </div>
  );
}

function KanbanColumn({
  stageKey,
  label,
  apps,
  onOpen,
}: {
  stageKey: Stage;
  label: string;
  apps: KanbanApplication[];
  onOpen: (id: Id<"applications">) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stageKey });
  return (
    <div
      ref={setNodeRef}
      className={`flex min-w-0 flex-col gap-2 rounded-lg border p-3 transition ${
        isOver ? "border-primary bg-accent/40" : "border-border bg-background"
      }`}
    >
      <div className="flex items-center justify-between px-1">
        <span className="text-sm font-bold text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">{apps.length}</span>
      </div>
      <div className="flex min-h-[40px] flex-col gap-2">
        {apps.map((app) => (
          <KanbanCard key={app._id} app={app} onOpen={() => onOpen(app._id)} />
        ))}
      </div>
    </div>
  );
}

// Cards are sorted by match score within each column (highest first, unscored
// last) — the Milestone 3 scoring feeds directly into ranking here instead
// of needing a separate mechanism.
export function KanbanBoard({
  jobId,
  onOpen,
}: {
  jobId: Id<"jobs">;
  onOpen: (id: Id<"applications">) => void;
}) {
  const applications = useQuery(api.applications.listForJob, { jobId });
  const setStage = useMutation(api.applications.setStage);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const applicationId = active.id as Id<"applications">;
    const newStage = over.id as Stage;
    const app = applications?.find((a) => a._id === applicationId);
    if (!app || app.stage === newStage) return;
    setStage({ applicationId, stage: newStage });
  }

  if (applications === undefined) {
    return <p className="mt-6 text-sm text-muted-foreground">Loading...</p>;
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="mt-6 grid grid-cols-6 gap-3 overflow-x-auto pb-4">
        {STAGES.map((s) => {
          const apps = applications
            .filter((a) => a.stage === s.key)
            .sort((a, b) => (b.matchScore ?? -1) - (a.matchScore ?? -1));
          return <KanbanColumn key={s.key} stageKey={s.key} label={s.label} apps={apps} onOpen={onOpen} />;
        })}
      </div>
    </DndContext>
  );
}
