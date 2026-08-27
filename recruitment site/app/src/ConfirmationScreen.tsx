export function ConfirmationScreen({
  jobTitle,
  applicationId,
}: {
  jobTitle: string;
  applicationId: string;
}) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-6 py-24 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-7 w-7">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h1 className="mt-6 text-2xl font-bold">Application submitted</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Thanks for applying to <span className="font-medium text-foreground">{jobTitle}</span>. The
        hiring team will review your application and reach out if there's a match.
      </p>

      <div className="mt-8 w-full rounded-md border p-4 text-sm">
        <p className="text-muted-foreground">Your application ID</p>
        <p className="mt-1 break-all font-mono text-foreground">{applicationId}</p>
      </div>
    </div>
  );
}
