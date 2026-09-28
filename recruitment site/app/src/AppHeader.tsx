import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/NotificationBell";
import { navigate, usePathname } from "@/lib/router";
import { Link } from "@/lib/Link";

// Signed-in recruiters keep their session everywhere in the app, so the
// header works out what to offer from the session itself rather than from
// whichever page rendered it: the logo leads "home" (the dashboard for a
// recruiter, the job board for everyone else), and public pages offer a
// way straight back to the dashboard instead of a second login.
export function AppHeader() {
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  const pathname = usePathname();
  const inRecruiterArea = pathname === "/recruiter" || pathname.startsWith("/recruiter/");

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-6 py-4">
        <Link href={isAuthenticated ? "/recruiter" : "/"} aria-label="Netlink Group home">
          <img src="/netlink-logo.png" alt="Netlink Group" className="h-7 w-auto" />
        </Link>
        {isAuthenticated && (
          <div className="flex items-center gap-2">
            {inRecruiterArea ? (
              <>
                <NotificationBell />
                <a
                  href="/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  View job board &#8599;
                </a>
                <Button
                  variant="outline"
                  onClick={() => {
                    void signOut().then(() => navigate("/"));
                  }}
                >
                  Sign out
                </Button>
              </>
            ) : (
              <Button onClick={() => navigate("/recruiter")}>Dashboard</Button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
