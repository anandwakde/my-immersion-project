import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { navigate } from "@/lib/router";

function timeAgo(ms: number): string {
  const mins = Math.round((Date.now() - ms) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

export function NotificationBell() {
  const data = useQuery(api.notifications.listMine);
  const markRead = useMutation(api.notifications.markRead);
  const markAllRead = useMutation(api.notifications.markAllRead);
  const unread = data?.unread ?? 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="relative rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0a3 3 0 1 1-6 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          {unread > 0 && (
            <button
              type="button"
              className="text-xs font-medium text-primary hover:underline"
              onClick={(e) => {
                e.preventDefault();
                void markAllRead();
              }}
            >
              Mark all read
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-96 overflow-y-auto">
          {data?.items.length === 0 && <p className="px-2 py-4 text-sm text-muted-foreground">No notifications yet.</p>}
          {data?.items.map((n) => (
            <DropdownMenuItem
              key={n._id}
              className="flex cursor-pointer flex-col items-start gap-0.5 py-2"
              onSelect={() => {
                if (!n.read) void markRead({ notificationId: n._id });
                navigate(n.link);
              }}
            >
              <span className={`text-sm ${n.read ? "text-muted-foreground" : "font-semibold text-foreground"}`}>
                {!n.read && <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-primary" aria-hidden="true" />}
                {n.title}
              </span>
              <span className="line-clamp-2 text-xs text-muted-foreground">{n.body}</span>
              <span className="text-[11px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
