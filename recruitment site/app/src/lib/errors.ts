import { ConvexError } from "convex/values";

// ConvexError messages are written for users and survive production's
// error redaction; anything else falls back to a generic message.
export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ConvexError && typeof err.data === "string" ? err.data : fallback;
}
