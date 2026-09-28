import { useMutation } from "convex/react";
import { useState } from "react";
import { Doc } from "../convex/_generated/dataModel";
import { api } from "../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function EditJobDialog({ job }: { job: Doc<"jobs"> }) {
  const updateJob = useMutation(api.jobs.update);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(job.title);
  const [location, setLocation] = useState(job.location);
  const [experience, setExperience] = useState(job.experience);
  const [salary, setSalary] = useState(job.salary);
  const [description, setDescription] = useState(job.description);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the form back to the job's current saved values every time the
  // dialog is (re)opened, so a previous unsaved edit doesn't linger.
  function onOpenChange(next: boolean) {
    if (next) {
      setTitle(job.title);
      setLocation(job.location);
      setExperience(job.experience);
      setSalary(job.salary);
      setDescription(job.description);
      setError(null);
    }
    setOpen(next);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Button variant="outline" size="sm" onClick={() => onOpenChange(true)}>
        Edit
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit job</DialogTitle>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setSaving(true);
            setError(null);
            updateJob({ jobId: job._id, title, location, experience, salary, description })
              .then(() => setOpen(false))
              .catch(() => setError("Couldn't save changes. Please try again."))
              .finally(() => setSaving(false));
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-title">Job title</Label>
            <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-location">Location</Label>
              <Input id="edit-location" value={location} onChange={(e) => setLocation(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-experience">Experience</Label>
              <Input
                id="edit-experience"
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-salary">Salary</Label>
            <Input id="edit-salary" value={salary} onChange={(e) => setSalary(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-description">Job description</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={5}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
