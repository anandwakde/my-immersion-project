import { useQuery } from "convex/react";
import { useEffect, useState } from "react";
import mammoth from "mammoth";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

export function ClientResumeViewPage({
  token,
  applicationId,
}: {
  token: string;
  applicationId: Id<"applications">;
}) {
  const data = useQuery(api.shareLinks.getByToken, { token });
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const candidate = data?.candidates.find((c) => c.applicationId === applicationId) ?? null;
  const resumeUrl = candidate?.resumeUrl ?? null;

  useEffect(() => {
    if (!resumeUrl) return;
    let cancelled = false;
    fetch(resumeUrl)
      .then((res) => res.arrayBuffer())
      .then((arrayBuffer) => mammoth.convertToHtml({ arrayBuffer }))
      .then((result) => {
        if (!cancelled) setHtml(result.value);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load this resume. Please try downloading it instead.");
      });
    return () => {
      cancelled = true;
    };
  }, [resumeUrl]);

  if (data === undefined) {
    return <div className="px-6 py-16 text-center text-sm text-muted-foreground">Loading...</div>;
  }

  if (data === null || candidate === null) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <h1 className="text-xl font-semibold">This resume isn't available</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The review link may have expired, or the resume is no longer available.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Resume of the candidate</h1>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      {!error && html === null && (
        <p className="mt-6 text-sm text-muted-foreground">Loading resume...</p>
      )}

      {html !== null && (
        <div
          className="resume-doc mt-8 rounded-lg border border-border bg-card p-6 text-sm leading-relaxed shadow-sm"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </div>
  );
}
