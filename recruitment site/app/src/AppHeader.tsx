import { ReactNode } from "react";

export function AppHeader({ action }: { action?: ReactNode }) {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <a href="/" aria-label="Netlink Group home">
          <img src="/netlink-logo.png" alt="Netlink Group" className="h-7 w-auto" />
        </a>
        {action}
      </div>
    </header>
  );
}
