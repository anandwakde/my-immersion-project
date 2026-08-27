import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { CreateJob } from "@/CreateJob";
import { SignIn } from "@/SignIn";
import { PublicJobPage } from "@/PublicJobPage";
import { AppHeader } from "@/AppHeader";

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

  return (
    <>
      <AppHeader />
      <AuthLoading>
        <div className="px-6 py-16 text-center text-sm text-muted-foreground">Loading...</div>
      </AuthLoading>
      <Unauthenticated>
        <SignIn />
      </Unauthenticated>
      <Authenticated>
        <CreateJob />
      </Authenticated>
    </>
  );
}
