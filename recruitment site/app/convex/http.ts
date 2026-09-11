import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

function approvalPage(message: string, ok: boolean): Response {
  return new Response(
    `<!doctype html><html><head><meta charset="UTF-8" /><title>Recruiter approval</title>
    <style>body{font-family:system-ui,sans-serif;color:#111;max-width:480px;margin:80px auto;text-align:center;padding:0 20px;}
    .icon{font-size:40px;}</style>
    </head><body>
      <p class="icon">${ok ? "✅" : "⚠️"}</p>
      <h2>${message}</h2>
    </body></html>`,
    { status: 200, headers: { "Content-Type": "text/html" } }
  );
}

http.route({
  path: "/admin/approve-recruiter",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");
    if (!token) {
      return approvalPage("Missing approval token.", false);
    }
    const result = await ctx.runMutation(internal.recruiterAuth.approveByToken, {
      approvalToken: token,
    });
    return approvalPage(result.message, result.ok);
  }),
});

export default http;
