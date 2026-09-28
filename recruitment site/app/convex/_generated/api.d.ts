/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as applicationStage from "../applicationStage.js";
import type * as applications from "../applications.js";
import type * as auth from "../auth.js";
import type * as candidateParser from "../candidateParser.js";
import type * as candidateProfile from "../candidateProfile.js";
import type * as candidates from "../candidates.js";
import type * as dashboard from "../dashboard.js";
import type * as email from "../email.js";
import type * as http from "../http.js";
import type * as ics from "../ics.js";
import type * as interviews from "../interviews.js";
import type * as jobRequirements from "../jobRequirements.js";
import type * as jobs from "../jobs.js";
import type * as matches from "../matches.js";
import type * as matching from "../matching.js";
import type * as migrations from "../migrations.js";
import type * as netlinkConvert from "../netlinkConvert.js";
import type * as notifications from "../notifications.js";
import type * as portal from "../portal.js";
import type * as recruiterAuth from "../recruiterAuth.js";
import type * as resumeExtraction from "../resumeExtraction.js";
import type * as shareLinks from "../shareLinks.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  applicationStage: typeof applicationStage;
  applications: typeof applications;
  auth: typeof auth;
  candidateParser: typeof candidateParser;
  candidateProfile: typeof candidateProfile;
  candidates: typeof candidates;
  dashboard: typeof dashboard;
  email: typeof email;
  http: typeof http;
  ics: typeof ics;
  interviews: typeof interviews;
  jobRequirements: typeof jobRequirements;
  jobs: typeof jobs;
  matches: typeof matches;
  matching: typeof matching;
  migrations: typeof migrations;
  netlinkConvert: typeof netlinkConvert;
  notifications: typeof notifications;
  portal: typeof portal;
  recruiterAuth: typeof recruiterAuth;
  resumeExtraction: typeof resumeExtraction;
  shareLinks: typeof shareLinks;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  migrations: import("@convex-dev/migrations/_generated/component.js").ComponentApi<"migrations">;
};
