import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { computeStatus, urgencySortPriority } from "./status";

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
      .map((c) =>
        c.failed
          ? { ...c, status: "error" as const }
          : { ...c, status: computeStatus(c.urgency ?? "", c.deadlineDate, now) }
      )
      .sort((a, b) => {
        const pa = a.failed ? -1 : urgencySortPriority(a.urgency ?? "");
        const pb = b.failed ? -1 : urgencySortPriority(b.urgency ?? "");
        return pa - pb;
      });
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

export default http;
