import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { useState } from "react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ALLOWED_RESUME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_RESUME_BYTES = 5 * 1024 * 1024;

export function ApplicationForm({
  jobId,
  onSubmitted,
}: {
  jobId: Id<"jobs">;
  onSubmitted: (applicationId: string) => void;
}) {
  const generateUploadUrl = useMutation(api.applications.generateUploadUrl);
  const createApplication = useMutation(api.applications.create);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setSubmitError(null);

        if (!resumeFile) {
          setFileError("Please attach your resume.");
          return;
        }

        setSubmitting(true);
        (async () => {
          const uploadUrl = await generateUploadUrl();
          const uploadRes = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": resumeFile.type },
            body: resumeFile,
          });
          if (!uploadRes.ok) {
            throw new Error("Resume upload failed. Please try again.");
          }
          const { storageId } = await uploadRes.json();

          const { applicationId: newId } = await createApplication({
            jobId,
            name,
            email,
            phone,
            linkedin: "",
            resumeStorageId: storageId,
          });
          onSubmitted(newId);
        })()
          .catch((err) => {
            if (err instanceof ConvexError) {
              setSubmitError(typeof err.data === "string" ? err.data : "Something went wrong. Please try again.");
            } else {
              setSubmitError("Something went wrong. Please try again.");
            }
          })
          .finally(() => setSubmitting(false));
      }}
    >
      <h2 className="text-lg font-bold text-foreground">Apply for this role</h2>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Full name</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="resume">Resume (PDF or Word, under 5MB)</Label>
        <Input
          id="resume"
          type="file"
          accept=".pdf,.doc,.docx"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            setFileError(null);
            if (!file) {
              setResumeFile(null);
              return;
            }
            if (!ALLOWED_RESUME_TYPES.includes(file.type)) {
              setFileError("Resume must be a PDF or Word document.");
              setResumeFile(null);
              return;
            }
            if (file.size > MAX_RESUME_BYTES) {
              setFileError("Resume must be under 5MB.");
              setResumeFile(null);
              return;
            }
            setResumeFile(file);
          }}
          required
        />
        {fileError && <p className="text-sm text-destructive">{fileError}</p>}
      </div>

      {submitError && <p className="text-sm text-destructive">{submitError}</p>}

      <Button type="submit" disabled={submitting || !!fileError}>
        {submitting ? "Submitting..." : "Submit Application"}
      </Button>
    </form>
  );
}
