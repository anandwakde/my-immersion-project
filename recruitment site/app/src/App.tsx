import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { CreateJob } from "@/CreateJob";
import { SignIn } from "@/SignIn";
import { PublicJobPage } from "@/PublicJobPage";
import { AppHeader } from "@/AppHeader";
import { Button } from "@/components/ui/button";

function SignOutAction() {
  const { signOut } = useAuthActions();
  return (
    <Button variant="outline" onClick={() => void signOut()}>
      Sign out
    </Button>
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

  return (
    <>
      <AuthLoading>
        <AppHeader />
        <div className="px-6 py-16 text-center text-sm text-muted-foreground">Loading...</div>
      </AuthLoading>
      <Unauthenticated>
        <AppHeader />
        <SignIn />
      </Unauthenticated>
      <Authenticated>
        <AppHeader action={<SignOutAction />} />
        <CreateJob />
      </Authenticated>
    </>
  );
}
