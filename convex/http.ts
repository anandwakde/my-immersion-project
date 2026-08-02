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

export default http;
