export function ConfirmationScreen({
  jobTitle,
  applicationId,
}: {
  jobTitle: string;
  applicationId: string;
}) {
  return (
    <div className="animate-pop-in mx-auto flex max-w-lg flex-col items-center px-6 py-24 text-center">
      <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30">
        <span className="absolute inset-0 animate-ping rounded-full bg-primary/40" />
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="relative h-8 w-8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-foreground">You're all set! 🎉</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Thanks for applying to <span className="font-medium text-foreground">{jobTitle}</span>. The
        hiring team will review your application and reach out if there's a match.
      </p>

      <div className="mt-8 w-full rounded-lg border border-border bg-card p-4 text-sm shadow-sm">
        <p className="text-muted-foreground">Your application ID</p>
        <p className="mt-1 break-all font-mono text-foreground">{applicationId}</p>
      </div>

      <a
        href="/"
        className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 transition hover:underline"
      >
        &larr; Browse more open roles
      </a>
    </div>
  );
}
