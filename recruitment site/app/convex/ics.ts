// Builds a calendar invite (.ics) — the standard format Google Calendar,
// Outlook and Apple Calendar all accept as an email attachment, so no
// calendar-service integration is needed. Times are written in UTC; each
// calendar app shows them in the reader's own time zone.

const INTERVIEW_MINUTES = 60;

function icsDate(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function icsText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

export function buildInterviewIcs(opts: {
  uid: string;
  sequence: number;
  startAt: number;
  title: string;
  description: string;
  meetingLink?: string;
  cancelled?: boolean;
}): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Netlink Group//Recruitment Portal//EN",
    `METHOD:${opts.cancelled ? "CANCEL" : "PUBLISH"}`,
    "BEGIN:VEVENT",
    `UID:${opts.uid}`,
    `SEQUENCE:${opts.sequence}`,
    `DTSTAMP:${icsDate(Date.now())}`,
    `DTSTART:${icsDate(opts.startAt)}`,
    `DTEND:${icsDate(opts.startAt + INTERVIEW_MINUTES * 60 * 1000)}`,
    `SUMMARY:${icsText(opts.title)}`,
    `DESCRIPTION:${icsText(opts.description + (opts.meetingLink ? `\nJoin: ${opts.meetingLink}` : ""))}`,
    ...(opts.meetingLink ? [`LOCATION:${icsText(opts.meetingLink)}`, `URL:${opts.meetingLink}`] : []),
    `STATUS:${opts.cancelled ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}
