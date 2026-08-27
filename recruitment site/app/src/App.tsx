import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { CreateJob } from "@/CreateJob";
import { SignIn } from "@/SignIn";
import { PublicJobPage } from "@/PublicJobPage";

export default function App() {
  const jobMatch = window.location.pathname.match(/^\/jobs\/([^/]+)\/?$/);
  if (jobMatch) {
    return <PublicJobPage slug={jobMatch[1]} />;
  }

  return (
    <>
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
