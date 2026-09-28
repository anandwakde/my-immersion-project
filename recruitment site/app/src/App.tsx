import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignIn } from "@/SignIn";
import { JobsListing } from "@/JobsListing";
import { PublicJobPage } from "@/PublicJobPage";
import { ClientReviewPage } from "@/ClientReviewPage";
import { ClientResumeViewPage } from "@/ClientResumeViewPage";
import { AppHeader } from "@/AppHeader";
import { RecruiterArea } from "@/RecruiterArea";
import { navigate, usePathname } from "@/lib/router";
import { Id } from "../convex/_generated/dataModel";

function RecruiterGate({ pathname }: { pathname: string }) {
  return (
    <>
      <AppHeader />
      <AuthLoading>
        <div className="px-6 py-16 text-center text-sm text-muted-foreground">Loading...</div>
      </AuthLoading>
      <Unauthenticated>
        <SignIn onBackToJobs={() => navigate("/")} />
      </Unauthenticated>
      <Authenticated>
        <RecruiterArea pathname={pathname} />
      </Authenticated>
    </>
  );
}

export default function App() {
  const pathname = usePathname();

  if (pathname === "/recruiter" || pathname.startsWith("/recruiter/")) {
    return <RecruiterGate pathname={pathname.replace(/\/$/, "")} />;
  }

  const jobMatch = pathname.match(/^\/jobs\/([^/]+)\/?$/);
  if (jobMatch) {
    return (
      <>
        <AppHeader />
        <PublicJobPage slug={jobMatch[1]} />
      </>
    );
  }

  const clientResumeMatch = pathname.match(/^\/client\/([^/]+)\/view\/([^/]+)\/?$/);
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

  const clientMatch = pathname.match(/^\/client\/([^/]+)\/?$/);
  if (clientMatch) {
    return (
      <>
        <AppHeader />
        <ClientReviewPage token={clientMatch[1]} />
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <JobsListing onRecruiterClick={() => navigate("/recruiter")} />
    </>
  );
}
