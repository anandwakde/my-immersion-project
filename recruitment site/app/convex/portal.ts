import { ConvexError, v } from "convex/values";
import { mutation, MutationCtx, query, QueryCtx } from "./_generated/server";
import { resolveRejected } from "./applicationStage";
import { escapeHtml, layout, queueEmail } from "./email";
import { jobOwnerEmail, notifyRecruiters } from "./notifications";

// Candidate portal. Deliberately separate from Convex Auth: every recruiter
// function only checks "is someone signed in", so giving candidates a
// Convex Auth session would let them call recruiter functions. Instead a
// candidate proves they own the email they applied with (a 6-digit code)
// and gets an opaque session token that only this file's functions accept.

const CODE_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_CODES_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;
const CHAT_STAGES = new Set(["shortlisted", "interview", "offer", "hired"]);

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sessionCandidate(ctx: QueryCtx | MutationCtx, token: string) {
  if (!token) return null;
  const tokenHash = await sha256(token);
  const session = await ctx.db
    .query("candidateSessions")
    .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
    .unique();
  if (session === null || session.expiresAt < Date.now()) return null;
  return await ctx.db.get("candidates", session.candidateId);
}

export const requestCode = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(email)) {
      throw new ConvexError("Enter a valid email address.");
    }
    const now = Date.now();
    const recent = await ctx.db
      .query("candidateLoginCodes")
      .withIndex("by_email_and_createdAt", (q) => q.eq("email", email).gte("createdAt", now - 60 * 60 * 1000))
      .take(MAX_CODES_PER_HOUR + 1);
    if (recent.length >= MAX_CODES_PER_HOUR) {
      throw new ConvexError("Too many codes requested. Please wait an hour and try again.");
    }
    const candidate = await ctx.db
      .query("candidates")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    // Same response whether or not this email has applied, so the form
    // can't be used to find out who has applied to Netlink.
    if (candidate === null) return null;

    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
    await ctx.db.insert("candidateLoginCodes", {
      email,
      codeHash: await sha256(`${email}:${code}`),
      expiresAt: now + CODE_TTL_MS,
      attempts: 0,
      createdAt: now,
    });
    await queueEmail(ctx, {
      to: email,
      subject: `Your Netlink sign-in code: ${code}`,
      kind: "candidate_code",
      sensitive: true,
      html: layout({
        heading: "Your sign-in code",
        paragraphs: [
          `<span style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</span>`,
          "Enter this code to see your applications. It expires in 10 minutes. If you didn't ask for it, you can ignore this email.",
        ],
      }),
    });
    return null;
  },
});

// Returns an error instead of throwing on a wrong code: a thrown error
// would roll back the attempt counter and allow unlimited guesses.
export const verifyCode = mutation({
  args: { email: v.string(), code: v.string() },
  handler: async (ctx, args): Promise<{ ok: true; token: string } | { ok: false; error: string }> => {
    const email = args.email.trim().toLowerCase();
    const latest = await ctx.db
      .query("candidateLoginCodes")
      .withIndex("by_email_and_createdAt", (q) => q.eq("email", email))
      .order("desc")
      .first();
    if (latest === null || latest.expiresAt < Date.now()) {
      return { ok: false, error: "That code has expired. Request a new one." };
    }
    if (latest.attempts >= MAX_ATTEMPTS) {
      return { ok: false, error: "Too many wrong attempts. Request a new code." };
    }
    if ((await sha256(`${email}:${args.code.trim()}`)) !== latest.codeHash) {
      await ctx.db.patch("candidateLoginCodes", latest._id, { attempts: latest.attempts + 1 });
      return { ok: false, error: "That code isn't right. Check the email and try again." };
    }
    const candidate = await ctx.db
      .query("candidates")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (candidate === null) return { ok: false, error: "No applications found for this email." };
    await ctx.db.delete("candidateLoginCodes", latest._id);
    const token = randomHex(32);
    await ctx.db.insert("candidateSessions", {
      candidateId: candidate._id,
      tokenHash: await sha256(token),
      expiresAt: Date.now() + SESSION_TTL_MS,
    });
    return { ok: true, token };
  },
});

export const signOut = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const tokenHash = await sha256(args.token);
    const session = await ctx.db
      .query("candidateSessions")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
      .unique();
    if (session) await ctx.db.delete("candidateSessions", session._id);
  },
});

// Candidate-facing status wording: internal stages like "AI Screened" and
// the client's rejection reason are never shown to candidates.
function candidateStatus(stage: string, rejected: boolean): string {
  if (rejected) return "Not selected";
  switch (stage) {
    case "applied":
    case "ai_screened":
      return "Under review";
    case "shortlisted":
      return "Shortlisted";
    case "interview":
      return "Interview";
    case "offer":
      return "Offer";
    case "hired":
      return "Hired";
    default:
      return "Under review";
  }
}

export const myPortal = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const candidate = await sessionCandidate(ctx, args.token);
    if (candidate === null) return null;
    const apps = await ctx.db
      .query("applications")
      .withIndex("by_candidateId", (q) => q.eq("candidateId", candidate._id))
      .order("desc")
      .take(50);
    const applications = [];
    for (const app of apps) {
      const job = await ctx.db.get("jobs", app.jobId);
      const rejected = resolveRejected(app);
      applications.push({
        applicationId: app._id,
        jobTitle: job?.title ?? "Role no longer listed",
        jobSlug: job?.status === "published" ? job.slug : null,
        appliedAt: app._creationTime,
        status: candidateStatus(app.stage, rejected),
        interview:
          !rejected && app.interviewToken && app.interviewStatus && app.interviewStatus !== "cancelled"
            ? {
                status: app.interviewStatus,
                at: app.interviewAt ?? null,
                meetingLink: app.interviewStatus === "confirmed" ? (app.meetingLink ?? null) : null,
                link: `/interview/${app.interviewToken}`,
              }
            : null,
      });
    }
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_candidateId_and_createdAt", (q) => q.eq("candidateId", candidate._id))
      .order("desc")
      .take(100);
    return {
      name: candidate.name,
      email: candidate.email,
      applications,
      canChat: apps.some((a) => CHAT_STAGES.has(a.stage) && !resolveRejected(a)),
      messages: messages.reverse().map((m) => ({ _id: m._id, sender: m.sender, body: m.body, createdAt: m.createdAt })),
    };
  },
});

export const sendMessage = mutation({
  args: { token: v.string(), body: v.string() },
  handler: async (ctx, args) => {
    const candidate = await sessionCandidate(ctx, args.token);
    if (candidate === null) throw new ConvexError("Your session has expired. Please sign in again.");
    const body = args.body.trim();
    if (!body) throw new ConvexError("Message can't be empty.");
    if (body.length > 2000) throw new ConvexError("Message is too long (2,000 characters max).");
    const apps = await ctx.db
      .query("applications")
      .withIndex("by_candidateId", (q) => q.eq("candidateId", candidate._id))
      .take(50);
    const active = apps.filter((a) => CHAT_STAGES.has(a.stage) && !resolveRejected(a));
    if (active.length === 0) throw new ConvexError("Messaging opens once you've been shortlisted.");
    await ctx.db.insert("messages", {
      candidateId: candidate._id,
      sender: "candidate",
      body,
      createdAt: Date.now(),
    });
    await notifyRecruiters(ctx, {
      title: `Message from ${candidate.name}`,
      body: body.length > 120 ? body.slice(0, 117) + "..." : body,
      link: `/recruiter/candidates/${candidate._id}`,
    });
    const job = await ctx.db.get("jobs", active[0].jobId);
    const owner = job ? await jobOwnerEmail(ctx, job.createdBy) : null;
    if (owner) {
      await queueEmail(ctx, {
        to: owner,
        subject: `Message from ${candidate.name}`,
        kind: "chat_message_recruiter",
        html: layout({
          heading: `New message from ${escapeHtml(candidate.name)}`,
          paragraphs: [escapeHtml(body).replace(/\n/g, "<br>")],
        }),
      });
    }
  },
});
