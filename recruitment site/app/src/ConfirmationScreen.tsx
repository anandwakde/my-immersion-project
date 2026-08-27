import { Asterisk } from "@/Asterisk";

export function ConfirmationScreen({
  jobTitle,
  applicationId,
}: {
  jobTitle: string;
  applicationId: string;
}) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-6 py-24 text-center">
      <Asterisk className="h-12 w-12 text-primary" />

      <h1 className="font-display mt-4 text-4xl font-extrabold italic leading-[0.95] tracking-tight text-foreground">
        Application <span className="text-primary">Submitted</span>
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Thanks for applying to <span className="font-medium text-foreground">{jobTitle}</span>. The
        hiring team will review your application and reach out if there's a match.
      </p>

      <div className="mt-8 w-full border-2 border-foreground bg-card p-4 text-sm">
        <p className="text-muted-foreground">Your application ID</p>
        <p className="mt-1 break-all font-mono text-foreground">{applicationId}</p>
      </div>
    </div>
  );
}
