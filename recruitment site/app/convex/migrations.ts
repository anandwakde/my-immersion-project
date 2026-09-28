import { Migrations } from "@convex-dev/migrations";
import { components } from "./_generated/api.js";
import { DataModel } from "./_generated/dataModel.js";

export const migrations = new Migrations<DataModel>(components.migrations);

// One-time production migration (Milestone 1's expand -> backfill ->
// contract): moves name/email/phone/linkedin off `applications` onto a
// deduplicated `candidates` record, and maps the old 3-value `status` onto
// the new 6-stage `stage` + separate `rejected` flag. Requires the schema's
// expand-phase shape (see schema.ts) to already be deployed — candidateId
// and stage optional, the legacy fields temporarily allowed back — so both
// migrated and not-yet-migrated rows validate while this runs.
//
// Status mapping (best-effort — the old model never recorded which stage a
// rejected candidate had reached, so a legacy "rejected" lands on "applied"
// with rejected: true rather than guessing a later stage):
//   "new"         -> stage: "applied",     rejected: false
//   "shortlisted" -> stage: "shortlisted", rejected: false
//   "rejected"    -> stage: "applied",     rejected: true
//
// Serial (not parallelized) because the candidate-dedupe-by-email lookup is
// a check-then-insert — running two applications for the same email
// concurrently could otherwise create two candidate records for one person.
export const backfillCandidatesAndStage = migrations.define({
  table: "applications",
  migrateOne: async (ctx, application) => {
    // Already migrated (either a fresh Milestone-1+ row, or this migration
    // already processed it) — nothing to do.
    if (application.candidateId !== undefined) {
      return;
    }

    // Cast to read the legacy fields: this file must keep typechecking
    // after the contract-phase schema (which no longer declares them) is
    // back in place, since it's kept as a permanent historical record
    // rather than deleted right after its one-time run.
    const legacy = application as unknown as {
      email?: string;
      name?: string;
      phone?: string;
      linkedin?: string;
      status?: "new" | "shortlisted" | "rejected";
    };

    const email = (legacy.email ?? "").trim().toLowerCase();
    const existingCandidate = await ctx.db
      .query("candidates")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    const candidateId =
      existingCandidate?._id ??
      (await ctx.db.insert("candidates", {
        name: legacy.name ?? "Unknown",
        email,
        phone: legacy.phone ?? "",
        linkedin: legacy.linkedin ?? "",
        searchText: legacy.name ?? "Unknown",
      }));

    const stage: "shortlisted" | "applied" = legacy.status === "shortlisted" ? "shortlisted" : "applied";
    const rejected = legacy.status === "rejected";

    return {
      candidateId,
      stage,
      rejected,
      name: undefined,
      email: undefined,
      phone: undefined,
      linkedin: undefined,
      status: undefined,
    };
  },
});
