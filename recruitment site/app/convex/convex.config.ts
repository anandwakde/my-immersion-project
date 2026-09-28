import { defineApp } from "convex/server";
import { v } from "convex/values";
import migrations from "@convex-dev/migrations/convex.config.js";

const app = defineApp({
  env: {
    OPENAI_API_KEY: v.optional(v.string()),
    ADMIN_EMAIL: v.optional(v.string()),
    RESEND_API_KEY: v.optional(v.string()),
    // The web app's own origin (e.g. https://…vercel.app) — used to build
    // links in emails. Also read by Convex Auth.
    SITE_URL: v.optional(v.string()),
    // "log" records every email in the in-app Email log without sending it
    // (local development and testing); anything else sends for real.
    EMAIL_MODE: v.optional(v.string()),
  },
});
app.use(migrations);

export default app;
