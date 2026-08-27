import { ReactNode } from "react";

export function AppHeader({ action }: { action?: ReactNode }) {
  return (
    <header className="sticky top-0 z-10 border-b-2 border-foreground bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-5">
        <img src="/netlink-logo.png" alt="Netlink Group" className="h-7 w-auto" />
        {action}
      </div>
    </header>
  );
}
