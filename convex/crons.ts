import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "scan mastercard circulars",
  { hours: 24 },
  api.pipeline.runMastercardPipeline,
  {}
);

crons.interval(
  "scan mada circulars",
  { hours: 24 },
  api.pipeline.runMadaPipeline,
  {}
);

crons.interval("scan visa circulars", { hours: 24 }, api.pipeline.runVisaPipeline, {});

crons.interval("scan amex circulars", { hours: 24 }, api.pipeline.runAmexPipeline, {});

crons.interval(
  "scan unionpay circulars",
  { hours: 24 },
  api.pipeline.runUnionPayPipeline,
  {}
);

crons.interval("scan knet circulars", { hours: 24 }, api.pipeline.runKnetPipeline, {});

// Re-checks a fixed list of known Cross-Border bulletin URLs. Dedups by
// source URL, so this only picks up new bulletins once their URL is added
// to the hardcoded list in scanMastercardArchive.ts — it does not discover
// brand-new bulletins on its own.
crons.interval(
  "scan mastercard cross-border archive",
  { hours: 24 },
  api.scanMastercardArchive.scanArchive,
  {}
);

// Re-reads Mastercard's own live, regularly-updated announcements
// spreadsheet each time, so this one genuinely picks up new entries
// automatically as Mastercard publishes them.
crons.interval(
  "scan mastercard send announcements",
  { hours: 24 },
  api.scanMastercardSend.scanSendAnnouncements,
  {}
);

// Visa's own GTLIG is gated behind Visa Online with no public URL — this
// re-checks a fixed list of DECTA's real third-party release-notes PDFs
// that summarize it. Dedups by source URL, so like the Mastercard archive
// scanner, this only picks up a new release once its URL is added to the
// hardcoded list in scanVisaDecta.ts.
crons.interval(
  "scan visa decta third-party summaries",
  { hours: 24 },
  api.scanVisaDecta.scanVisaDecta,
  {}
);

export default crons;
