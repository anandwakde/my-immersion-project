import { defineApp } from "convex/server";
import { v } from "convex/values";
import migrations from "@convex-dev/migrations/convex.config.js";

const app = defineApp({
  env: {
    OPENAI_API_KEY: v.optional(v.string()),
    ADMIN_EMAIL: v.optional(v.string()),
    RESEND_API_KEY: v.optional(v.string()),
  },
});
app.use(migrations);

export default app;
