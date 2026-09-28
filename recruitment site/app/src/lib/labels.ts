// Shared display labels for recruiter screens.

export const STAGE_LABEL: Record<string, string> = {
  applied: "Applied",
  ai_screened: "AI Screened",
  shortlisted: "Shortlisted",
  interview: "Interview",
  offer: "Offer",
  hired: "Hired",
};

export type ActionKey =
  | "new"
  | "undecided"
  | "client_pending"
  | "needs_scheduling"
  | "interviews_today"
  | "awaiting_decision"
  | "stalled";

// One sentence per Action Required card; `n` is the live count.
export const ACTION_CARDS: { key: ActionKey; text: (n: number, days: { stuck: number; fresh: number }) => string; tone: "urgent" | "normal" }[] = [
  { key: "new", tone: "normal", text: (n, d) => `${n} new application${n === 1 ? "" : "s"} to review (last ${d.fresh} days)` },
  { key: "undecided", tone: "urgent", text: (n) => `${n} candidate${n === 1 ? "" : "s"} not yet shortlisted or rejected` },
  { key: "client_pending", tone: "normal", text: (n) => `${n} client response${n === 1 ? "" : "s"} pending` },
  { key: "needs_scheduling", tone: "urgent", text: (n) => `${n} interview${n === 1 ? "" : "s"} need${n === 1 ? "s" : ""} scheduling` },
  { key: "interviews_today", tone: "normal", text: (n) => `${n} interview${n === 1 ? "" : "s"} scheduled for today` },
  { key: "awaiting_decision", tone: "urgent", text: (n) => `${n} candidate${n === 1 ? "" : "s"} awaiting your decision after interview` },
  { key: "stalled", tone: "urgent", text: (n, d) => `${n} application${n === 1 ? "" : "s"} with no movement in ${d.stuck}+ days` },
];

export function tzOffsetMinutes(): number {
  return new Date().getTimezoneOffset();
}
