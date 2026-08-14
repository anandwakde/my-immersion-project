import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { computeStatus, urgencySortPriority } from "./status";
import { Id } from "./_generated/dataModel";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Convex wraps thrown errors as "Uncaught Error: <message>\n    at handler (...)",
// and each nested ctx.runAction boundary the error crosses adds another
// "Uncaught Error:" prefix. Strip all of those repeated prefixes and only the
// stack-trace lines (lines starting with whitespace + "at ") — a naive
// split("\n")[0] would also truncate legitimate multi-line error content,
// like OpenAI's pretty-printed JSON error bodies, which is a real bug this
// replaced (an upload error showed only "429 {" with everything after the
// first line of the JSON silently cut off).
function cleanErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return raw
    .replace(/^(Uncaught Error:\s*)+/, "")
    .split("\n")
    .filter((line) => !/^\s*at\s/.test(line))
    .join("\n")
    .trim();
}

const http = httpRouter();

http.route({
  path: "/submit-email",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const source = typeof body.source === "string" ? body.source : "unknown";

    if (!email.includes("@") || email.length > 320) {
      return new Response(JSON.stringify({ error: "Invalid email" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const reference = await ctx.runMutation(internal.waitlist.create, {
      email,
      source,
    });

    return new Response(JSON.stringify({ ok: true, reference }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }),
});

http.route({
  path: "/submit-email",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders });
  }),
});

http.route({
  path: "/circulars",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const circulars = await ctx.runQuery(api.circulars.list, {});
    const now = Date.now();
    const withStatus = circulars
      .map((c) => ({ ...c, status: computeStatus(c.urgency, c.deadlineDate, now) }))
      .sort((a, b) => urgencySortPriority(a.urgency) - urgencySortPriority(b.urgency));
    return new Response(JSON.stringify(withStatus), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }),
});

http.route({
  path: "/circulars",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders });
  }),
});

http.route({
  path: "/tasks",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const tasks = await ctx.runQuery(api.tasks.list, {});
    const now = Date.now();
    const withOverdue = tasks.map((t) => {
      const deadlineMs = t.deadline ? Date.parse(t.deadline + "T00:00:00Z") : NaN;
      const overdue = t.status === "open" && !Number.isNaN(deadlineMs) && deadlineMs < now;
      return { ...t, overdue };
    });
    return new Response(JSON.stringify(withOverdue), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }),
});

http.route({
  path: "/tasks",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders });
  }),
});

http.route({
  path: "/tasks/complete",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    const taskId = typeof body.taskId === "string" ? body.taskId : "";
    if (!taskId) {
      return new Response(JSON.stringify({ error: "Missing taskId" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    await ctx.runMutation(api.tasks.complete, { taskId: taskId as Id<"tasks"> });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }),
});

http.route({
  path: "/tasks/complete",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders });
  }),
});

http.route({
  path: "/audit-log",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const entries = await ctx.runQuery(api.tasks.auditLog, {});
    return new Response(JSON.stringify(entries), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }),
});

http.route({
  path: "/audit-log",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders });
  }),
});

http.route({
  path: "/subscribe",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const schemes = Array.isArray(body.schemes)
      ? body.schemes.filter((s: unknown) => typeof s === "string")
      : [];

    if (!email.includes("@") || email.length > 320) {
      return new Response(JSON.stringify({ error: "Invalid email" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    await ctx.runMutation(api.subscribers.subscribe, { email, schemes });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }),
});

http.route({
  path: "/subscribe",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders });
  }),
});

http.route({
  path: "/upload-url",
  method: "POST",
  handler: httpAction(async (ctx) => {
    const uploadUrl = await ctx.storage.generateUploadUrl();
    return new Response(JSON.stringify({ uploadUrl }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }),
});

http.route({
  path: "/upload-url",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders });
  }),
});

http.route({
  path: "/process-upload",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    const storageId = typeof body.storageId === "string" ? body.storageId : "";
    const scheme = typeof body.scheme === "string" ? body.scheme.trim() : "";

    if (!storageId || !scheme) {
      return new Response(JSON.stringify({ error: "Missing storageId or scheme" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    try {
      const result = await ctx.runAction(api.scanUpload.processUpload, {
        storageId: storageId as Id<"_storage">,
        scheme,
      });
      return new Response(JSON.stringify({ ok: true, result }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    } catch (err) {
      const message = cleanErrorMessage(err);
      return new Response(JSON.stringify({ error: message }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
  }),
});

http.route({
  path: "/process-upload",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders });
  }),
});

http.route({
  path: "/chat",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    const question = typeof body.question === "string" ? body.question.trim() : "";

    if (!question) {
      return new Response(JSON.stringify({ error: "Missing question" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    try {
      const answer = await ctx.runAction(api.chat.askAssistant, { question });
      return new Response(JSON.stringify({ ok: true, answer }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    } catch (err) {
      const message = cleanErrorMessage(err);
      return new Response(JSON.stringify({ error: message }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
  }),
});

http.route({
  path: "/chat",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders });
  }),
});

function unsubscribePage(message: string): Response {
  return new Response(
    `<!doctype html><html><head><meta charset="UTF-8" /><title>Unsubscribed</title>
    <style>body{font-family:sans-serif;color:#2B2350;max-width:480px;margin:80px auto;text-align:center;padding:0 20px;}</style>
    </head><body><h2>${message}</h2></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html", ...corsHeaders } }
  );
}

http.route({
  path: "/unsubscribe",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return unsubscribePage("Missing unsubscribe link — nothing to do.");
    }

    try {
      const result = await ctx.runMutation(api.subscribers.unsubscribe, {
        subscriberId: id as Id<"subscribers">,
      });
      if ("alreadyGone" in result) {
        return unsubscribePage("You're already unsubscribed.");
      }
      return unsubscribePage(`Unsubscribed ${result.email} — you won't get any more digest emails.`);
    } catch {
      return unsubscribePage("Couldn't process that unsubscribe link.");
    }
  }),
});

export default http;
