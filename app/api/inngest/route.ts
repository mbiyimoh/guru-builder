/**
 * Inngest API Endpoint
 *
 * This endpoint serves Inngest functions and handles webhook requests
 * from the Inngest platform.
 *
 * In development: Uses Inngest Dev Server (http://localhost:8288)
 * In production: Uses Inngest Cloud
 */

import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { inngestFunctions } from "@/lib/inngest-functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: inngestFunctions,
});
