import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const PBKDF2_ITERATIONS = 100_000;
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

async function hashPassword(password: string, saltHex: string): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: hexToBytes(saltHex), iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return bytesToHex(new Uint8Array(bits));
}

export const signup = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    legalEntityName: v.string(),
    customerType: v.string(),
    countries: v.array(v.string()),
    schemes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    if (!email.includes("@")) throw new Error("Enter a valid email address");
    if (args.password.length < 8) throw new Error("Password must be at least 8 characters");

    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (existing) throw new Error("An account with this email already exists");

    const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
    const passwordHash = await hashPassword(args.password, salt);
    const userId = await ctx.db.insert("users", { email, passwordHash, passwordSalt: salt });

    await ctx.db.insert("companyProfile", {
      userId,
      legalEntityName: args.legalEntityName,
      customerType: args.customerType,
      countries: args.countries,
      schemes: args.schemes,
    });

    const token = crypto.randomUUID();
    await ctx.db.insert("sessions", { token, userId, expiresAt: Date.now() + SESSION_DURATION_MS });
    return { token };
  },
});

export const login = mutation({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (!user) throw new Error("Invalid email or password");

    const hash = await hashPassword(args.password, user.passwordSalt);
    if (hash !== user.passwordHash) throw new Error("Invalid email or password");

    const token = crypto.randomUUID();
    await ctx.db.insert("sessions", { token, userId: user._id, expiresAt: Date.now() + SESSION_DURATION_MS });
    return { token };
  },
});

export const logout = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (session) await ctx.db.delete(session._id);
    return { ok: true };
  },
});

export const me = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!session || session.expiresAt < Date.now()) return null;

    const user = await ctx.db.get(session.userId);
    if (!user) return null;

    const profile = await ctx.db
      .query("companyProfile")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    return { userId: user._id, email: user.email, profile };
  },
});
