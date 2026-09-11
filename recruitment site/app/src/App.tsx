import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { CreateJob } from "@/CreateJob";
import { SignIn } from "@/SignIn";
import { JobsListing } from "@/JobsListing";
import { PublicJobPage } from "@/PublicJobPage";
import { ClientReviewPage } from "@/ClientReviewPage";
import { ClientResumeViewPage } from "@/ClientResumeViewPage";
import { AppHeader } from "@/AppHeader";
import { Button } from "@/components/ui/button";
import { Id } from "../convex/_generated/dataModel";

function SignOutAction() {
  const { signOut } = useAuthActions();
  return (
    <Button variant="outline" onClick={() => void signOut()}>
      Sign out
    </Button>
  );
}

function RecruiterArea({ onBackToJobs }: { onBackToJobs: () => void }) {
  return (
    <>
      <AuthLoading>
        <AppHeader />
        <div className="px-6 py-16 text-center text-sm text-muted-foreground">Loading...</div>
      </AuthLoading>
      <Unauthenticated>
        <AppHeader />
        <SignIn onBackToJobs={onBackToJobs} />
      </Unauthenticated>
      <Authenticated>
        <AppHeader action={<SignOutAction />} />
        <CreateJob />
      </Authenticated>
    </>
  );
}

export default function App() {
  const jobMatch = window.location.pathname.match(/^\/jobs\/([^/]+)\/?$/);
  if (jobMatch) {
    return (
      <>
        <AppHeader />
        <PublicJobPage slug={jobMatch[1]} />
      </>
    );
  }

  const clientResumeMatch = window.location.pathname.match(/^\/client\/([^/]+)\/view\/([^/]+)\/?$/);
  if (clientResumeMatch) {
    return (
      <>
        <AppHeader />
        <ClientResumeViewPage
          token={clientResumeMatch[1]}
          applicationId={clientResumeMatch[2] as Id<"applications">}
        />
      </>
    );
  }

  const clientMatch = window.location.pathname.match(/^\/client\/([^/]+)\/?$/);
  if (clientMatch) {
    return (
      <>
        <AppHeader />
        <ClientReviewPage token={clientMatch[1]} />
      </>
    );
  }

  return <Landing />;
}

function Landing() {
  const [showRecruiter, setShowRecruiter] = useState(
    () => window.location.pathname.replace(/\/$/, "") === "/recruiter"
  );

  function goToRecruiter() {
    window.history.pushState({}, "", "/recruiter");
    setShowRecruiter(true);
  }

  function goToJobs() {
    window.history.pushState({}, "", "/");
    setShowRecruiter(false);
  }

  if (showRecruiter) {
    return <RecruiterArea onBackToJobs={goToJobs} />;
  }

  return (
    <>
      <AppHeader />
      <JobsListing onRecruiterClick={goToRecruiter} />
    </>
  );
}
