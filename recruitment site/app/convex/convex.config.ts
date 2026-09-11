import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  env: {
    OPENAI_API_KEY: v.optional(v.string()),
    ADMIN_EMAIL: v.optional(v.string()),
    RESEND_API_KEY: v.optional(v.string()),
  },
});

export default app;
