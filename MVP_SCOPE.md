# MEA Payment Intelligence Monitor — V1 Scoping Document

## 1. USER

Anand, 35, Compliance Product Manager at a Dubai-based PSP. Spends his day manually reading scheme compliance circulars across many bank/scheme portals, no tracking system, no red flags. He's the only user of v1 — no team accounts yet.

## 2. PROBLEM

Circulars get published across scattered scheme portals and inboxes with no central tracking. Anand finds out about one only when it's already overdue — usually via an escalation email from a bank blaming him for a missed mandate, a penalty getting passed down, and live customer transactions declining because the required change was never made. There's no dashboard, no alert, no red flag — just PDFs he has to remember to go re-check.

## 3. WHAT V1 DOES (step by step)

1. An automated scanner checks scheme portals and inboxes (Visa, Mastercard, mada, Meeza, and the rest of the 13) for new circulars — no manual trigger.
2. Each new PDF found gets queued and read by an AI extraction step, which pulls out: scheme, urgency (mandatory / optional / opt-in), deadline, and scope.
3. If extraction succeeds, the circular appears on the dashboard, tagged by scheme and colored by status (overdue / due soon / on track).
4. If extraction fails (bad PDF, portal auth issue, unreadable scan), the circular still shows up — as a visible error row ("Couldn't process — retry"), never silently dropped.
5. Anand opens the single shared dashboard (no login) at any time, filters by scheme or status, and clicks into a circular to see the full extracted detail plus a link to the original PDF.

## 4. WHAT V1 DOES NOT DO

- No sign-up, no login, no multi-user accounts — single shared view
- No email digest of any kind
- No manual PDF upload — ingestion is scanner-only
- No action item tracking / per-team task views (Product, Engineering, Ops, Legal, Bank)
- No audit trail beyond the raw ingestion log
- No calendar view
- No chat assistant

## 5. RISKIEST ASSUMPTION

**Extraction accuracy: validated.** A human can access a real scheme portal, find a genuine recent circular, and have an AI correctly extract scheme, urgency, deadline, and scope — including correctly telling two different schemes' circulars apart. Held on both schemes tested.

**New riskiest assumption — access, not extraction.** The validation test had a human logging in and retrieving the PDF each time. It proved AI extraction is trustworthy, but it did not prove the "no manual trigger" scanner works unattended — a human doing the login is a very different problem than a scheduled process logging in with nobody watching. Portal auth that's fine for a person in a browser (2FA prompts, "click to confirm it's you," session checks) often actively blocks or breaks for an automated script. Whether something can log in and fetch a PDF with zero human involved is the real open question — not whether the AI can read what it finds once it has the text.

## V1 Milestones

| # | Milestone | Layer |
|---|---|---|
| 1 | I can open the dashboard and see one hardcoded circular displayed with its scheme and status | Frontend |
| 2 | I can run a scan against ONE real scheme portal and get back the raw text of one real circular PDF *(built with Mastercard, after the originally-planned Visa source proved unreachable without credentials)* | Backend / Integration |
| 3 | I can send that raw text to the AI extractor and get back structured fields: scheme, urgency, deadline, scope | Backend / Integration |
| 4 | I can see that one real, AI-extracted circular saved and shown on the dashboard, replacing the hardcoded one | Backend / Database / Frontend |
| 5 | I can see the circular's status auto-computed as overdue / due soon / on track, based on today's date | Backend |
| 6 | I can feed the extractor a broken or unreadable PDF and see it show up as a visible "Couldn't process — retry" row instead of vanishing | Backend / Frontend |
| 7 | I can filter the dashboard by scheme and by status and see the list update correctly | Frontend / Backend |
| 8 | I can add a second scheme's scanner and see both schemes' circulars correctly tagged on the same dashboard *(built with Mada, via SAMA's public rulebook, as the most easily and reliably fetchable of Mada/Meeza/Verve)* | Backend / Integration |
| 9 | I can close the browser, reopen the dashboard, and still see every circular scanned before — nothing lost | Database |
