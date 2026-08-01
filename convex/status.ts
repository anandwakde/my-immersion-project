const DUE_SOON_THRESHOLD_DAYS = 14;

// Pure function: given urgency, a normalized deadline date (YYYY-MM-DD or null),
// and the current time, compute the display status. Informational circulars have
// no real compliance deadline to be overdue about, so they always stay "informational"
// regardless of any date — never treated as urgent, per product rule.
export function computeStatus(
  urgency: string,
  deadlineDate: string | null | undefined,
  nowMs: number
): "informational" | "overdue" | "due-soon" | "on-track" {
  if (urgency !== "mandatory" && urgency !== "optional") {
    return "informational";
  }

  if (!deadlineDate) {
    // A mandatory/optional circular with no parseable date: err toward drawing
    // attention rather than silently marking it safe.
    return "due-soon";
  }

  const deadlineMs = Date.parse(deadlineDate + "T00:00:00Z");
  if (Number.isNaN(deadlineMs)) {
    return "due-soon";
  }

  const daysLeft = (deadlineMs - nowMs) / (1000 * 60 * 60 * 24);

  if (daysLeft < 0) return "overdue";
  if (daysLeft <= DUE_SOON_THRESHOLD_DAYS) return "due-soon";
  return "on-track";
}

// Sort priority for the circular list: mandatory first, informational always
// last, everything else (e.g. optional) in between.
export function urgencySortPriority(urgency: string): number {
  if (urgency === "mandatory") return 0;
  if (urgency === "informational") return 2;
  return 1;
}
