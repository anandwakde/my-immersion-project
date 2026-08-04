/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as chat from "../chat.js";
import type * as circulars from "../circulars.js";
import type * as crons from "../crons.js";
import type * as digest from "../digest.js";
import type * as extract from "../extract.js";
import type * as http from "../http.js";
import type * as pipeline from "../pipeline.js";
import type * as scan from "../scan.js";
import type * as scanAmex from "../scanAmex.js";
import type * as scanKnet from "../scanKnet.js";
import type * as scanMada from "../scanMada.js";
import type * as scanMastercardArchive from "../scanMastercardArchive.js";
import type * as scanMastercardSend from "../scanMastercardSend.js";
import type * as scanUnionPay from "../scanUnionPay.js";
import type * as scanUpload from "../scanUpload.js";
import type * as scanVisa from "../scanVisa.js";
import type * as status from "../status.js";
import type * as subscribers from "../subscribers.js";
import type * as tasks from "../tasks.js";
import type * as uploads from "../uploads.js";
import type * as waitlist from "../waitlist.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  chat: typeof chat;
  circulars: typeof circulars;
  crons: typeof crons;
  digest: typeof digest;
  extract: typeof extract;
  http: typeof http;
  pipeline: typeof pipeline;
  scan: typeof scan;
  scanAmex: typeof scanAmex;
  scanKnet: typeof scanKnet;
  scanMada: typeof scanMada;
  scanMastercardArchive: typeof scanMastercardArchive;
  scanMastercardSend: typeof scanMastercardSend;
  scanUnionPay: typeof scanUnionPay;
  scanUpload: typeof scanUpload;
  scanVisa: typeof scanVisa;
  status: typeof status;
  subscribers: typeof subscribers;
  tasks: typeof tasks;
  uploads: typeof uploads;
  waitlist: typeof waitlist;
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

export declare const components: {};
