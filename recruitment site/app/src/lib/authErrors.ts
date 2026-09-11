// Mirrors convex/authErrors.ts. Kept as a separate client-side copy rather
// than a shared import because this project's tsconfig deliberately keeps
// src/ and convex/ as separate TS projects (only the generated convex/
// bindings are meant to cross that boundary) — importing convex/auth.ts
// directly from the client also pulled server-only code into the browser
// bundle, which is the bug this file avoids.
export const PENDING_APPROVAL_ERROR = "PENDING_APPROVAL";
