# Recruitment Portal — V1 Scoping Document

## 1. USER

Priya, 29, HR lead at a 40-person startup, currently hiring for 3 open roles. Every day she sits with a pile of resumes emailed to her personal inbox, screening each one manually before shortlisting and forwarding to hiring managers.

## 2. PROBLEM

Job posts go out across multiple channels, but applications land as scattered emails with no structure. Screening is fully manual — Priya reads every resume herself before anything gets shortlisted. On the candidate side, application forms have too many fields and often require creating an account, so candidates drop off before finishing. There's no consistent backend record of who applied to what, and no safe, structured place to store resumes.

## 3. CORE ACTION

Recruiter creates a job → publishes and shares the job link → candidate views the job → fills the application form → uploads resume → submits application → recruiter receives the application and can shortlist or reject it.

## 4. WHAT V1 DOES (step by step)

1. Priya logs in and creates a job — title, location, experience, salary, description, responsibilities, required skills.
2. She publishes it, and the system generates a unique public URL for that job.
3. A candidate opens the link with no login required, and sees a clean job page with the full JD.
4. The candidate taps Apply, fills in name, email, phone, LinkedIn, uploads a resume, and submits.
5. The system validates the input (required fields, valid email/phone, resume file type and size) before saving.
6. If that email has already applied to this same job, the system blocks the duplicate submission.
7. On success, the candidate sees an application confirmation screen with an application ID.
8. Priya opens her dashboard and sees applications listed per job — never mixed across jobs.
9. She opens an application to see full candidate details and the resume.
10. She marks the application Shortlisted or Rejected, and that status is saved against the candidate.

## 5. WHAT V1 DOES NOT DO

**Deliberately cut from V1:**
- Candidate login or account creation
- AI resume screening or reformatting
- Candidate ranking/scoring
- Interview scheduling or video interviews
- Payments
- Social features
- Advanced analytics/reporting
- Background verification
- Payroll
- HR/ATS integrations

**Also deferred (nice-to-have, not V1):**
- Full status pipeline (New / Screening / Shortlisted / Interview / Hired / Rejected) — V1 ships with just Shortlisted / Rejected
- Editing or closing a published job
- Email confirmation sent to the candidate (V1 shows an on-screen confirmation only)
- Optional cover letter / custom screening questions
- Real-time notification to Priya on new applications
- Typeform-style one-field-per-page application flow

## 6. KNOWN FAILURE RISKS

1. Too many form fields → candidates abandon the application before submitting.
2. Inconsistent backend data → Priya can't trust or search applications reliably.
3. Security gaps → database or resumes exposed to people who shouldn't see them.

## 7. RISKIEST ASSUMPTION

That a candidate can go from a shared link to a fully submitted application — including a resume upload — in one sitting, with no login, no data loss, and no duplicate or corrupted records; and that the application then reliably shows up exactly once on Priya's dashboard, correctly attached to the right job. This is the entire value of the product — if this path is flaky, nothing else matters yet.

## V1 Milestones

| # | Milestone | Layer |
|---|---|---|
| 1 | I can open a hardcoded job page and see the JD displayed | Frontend |
| 2 | I can log in as a recruiter and create a job, and see it saved with a generated public URL | Backend / Database / Frontend |
| 3 | I can open that public job URL (no login) and see the real job details load | Frontend / Backend |
| 4 | I can fill out the application form, upload a resume, and submit — and see a new application saved with an application ID | Frontend / Backend / File storage |
| 5 | I can submit the same email twice to the same job and see the second attempt blocked | Backend |
| 6 | I can see an on-screen confirmation after applying, showing my application ID | Frontend |
| 7 | I can open the recruiter dashboard and see applications listed per job, never mixed across jobs | Frontend / Backend |
| 8 | I can open one application and see full candidate details plus the uploaded resume | Frontend / Backend / File storage |
| 9 | I can mark an application Shortlisted or Rejected and see that status persist | Backend / Frontend |
| 10 | I can close the browser, reopen the dashboard, and still see every job and application — nothing lost | Database |
