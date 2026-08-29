# Payment Scheme Intelligence Monitor — V2 Scoping Document (Mentor Feedback)

## MENTOR FEEDBACK (verbatim)

> shouldnt you be giving me more information about the circular?
>
> i could just google/chatgpt circulars from "Visa", Mastercard, etc.
>
> unsure of this current version and the value i get
>
> how do you know if this impacts me?
>
> How do you know if this circular impacts me? doesnt it change from my goal?
>
> wont this apply to the user depending on:
> - Countries where the company operates
> - Schemes it participates in
> - Whether it is an issuer, acquirer, processor, fintech, merchant, or payment institution
> - Products and payment rails it supports
> - Licences and regulated entities
> - Possibly transaction types, currencies, and technical capabilities
>
> Right now, this feels like a central circular and deadline tracker. That is useful, but different from a compliance intelligence product that tells me what affects my company, why it affects me and what action I need to take.
>
> **What the product should actually do**
> For every new payment scheme publication, tell me whether it affects my company, explain why, create the work required, and prove that we completed it before the deadline.
>
> **The MVP I would build:**
> Start with:
> - One customer type: acquirer
> - One region: GCC or CEMEA
> - Two networks: Visa and Mastercard
> - One legal entity
>
> The first release should have only five screens:
> 1. New publications inbox
> 2. Why this applies
> 3. Extracted obligations
> 4. Implementation plan
> 5. Evidence and sign-off
>
> Bro, our product should quantify:
> - This publication may increase annual scheme fees by $180,000.
> - Opting out before September 30 avoids a new service charge.
> - Supporting this programme may reduce authorization costs by 8%.

## 1. WHAT'S WRONG WITH V1

V1 (see `MVP_SCOPE.md`) ingests circulars, extracts scheme/urgency/deadline/scope, and shows them on a shared dashboard. That's a **circular and deadline tracker** — genuinely useful, but not differentiated from just searching for circulars directly. It never answers the question that actually matters to the user: *does this affect my company, why, and what do I need to do about it.*

## 2. WHAT V2 ACTUALLY DOES

For every new payment scheme publication: tell the user whether it affects their company, explain why, create the work required, and prove it was completed before the deadline — including quantifying the financial impact where possible.

This is a new reasoning layer built **on top of** the existing V1 ingestion/AI-extraction pipeline. The scanners, cron jobs, and field extraction from V1 are not rebuilt — they stay as the input source.

## 3. SCOPE (deliberately narrow, per mentor's suggestion)

- One customer type: **acquirer**
- One region: **GCC or CEMEA**
- Two networks: **Visa and Mastercard**
- One legal entity (no multi-tenant/multi-entity support yet)

## 4. THE FIVE SCREENS

1. New publications inbox
2. Why this applies
3. Extracted obligations
4. Implementation plan
5. Evidence and sign-off

## 5. WHAT V2 DOES NOT DO

- No support for issuer, processor, fintech, merchant, or payment institution profiles — acquirer only
- No regions beyond GCC/CEMEA
- No schemes beyond Visa and Mastercard
- No multi-entity or multi-tenant company profiles
- No real-time fee-schedule integration — financial impact is an AI-estimated ballpark, not a certified figure
- No automated opt-out/opt-in submission to schemes — the product surfaces the deadline and impact, a human still acts

## 6. RISKIEST ASSUMPTION

AI judging **relevance** (does this apply to my company) and **obligations** (what must I do) against a company profile, and estimating **financial impact**, is a far more subjective judgment call than V1's structured field extraction (scheme/urgency/deadline/scope). This is unvalidated. Milestone 3 is where this gets tested — if the AI can't produce a trustworthy relevance verdict, the rest of the product (obligations, plan, evidence) has nothing solid to stand on.

## V2 Milestones

| # | Milestone | Layer |
|---|---|---|
| 1 | I can define one company profile (acquirer, GCC region, Visa + Mastercard) and see it stored and displayed on a "Company Profile" screen | Frontend / Database |
| 2 | I can open the "New Publications Inbox" and see only real Visa/Mastercard circulars, pulled from the existing pipeline | Frontend / Backend |
| 3 | I can open one circular and see an AI-generated "Why this applies" verdict — Applies / Doesn't apply — with a plain-English reason tied to the company profile | Backend / AI |
| 4 | I can see a "Doesn't apply" circular filtered out of the inbox, while an "Applies" one proceeds to the next screen | Backend / Frontend |
| 5 | I can open an "Applies" circular and see AI-extracted obligations — the specific things the company must actually do, not just urgency/deadline/scope | Backend / AI |
| 6 | I can see each obligation turned into an implementation plan — task, owner, due date | Backend / Frontend |
| 7 | I can attach evidence (file, link, or note) to a task, mark it signed off, and see that recorded against the circular before its deadline | Backend / Frontend |
| 8 | I can see an estimated financial impact (e.g. "+$180K in fees," "avoid a new charge by Sept 30," "-8% auth costs") surfaced next to a circular, generated by AI from its text | Backend / AI |
| 9 | I can pick one real, currently-live Visa or Mastercard circular and watch it flow end-to-end — ingested → relevance verdict → obligations → plan → evidence slot ready — with zero manual steps | Full stack (integration proof) |
