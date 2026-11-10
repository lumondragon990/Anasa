"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser client, used only to upload a file to a one-time signed upload URL
 * that the server issued after checking permissions. It never queries tables.
 */
export function createBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!;
  return createBrowserClient(url, key);
}
