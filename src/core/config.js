/* Where the shelves live.

   Empty means local-only: the app runs entirely on your device and never
   contacts a server. Fill these in and it signs in and syncs instead.

   These two values are safe in a public repo. The anon key is designed to be
   published — it identifies the project, not a person, and everything it can
   do is fenced by the row-level security rules in supabase/schema.sql.
   The service_role key is the dangerous one; it must never appear here. */

export const SUPABASE_URL = "https://vnvlnwfqmaeurnskfxkf.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_DAU3t_2EKOo84ohljzUB1A_goacVBEM";

/* An override for testing, or for pointing a build at a different project
   without rebuilding: set window.PHM_CONFIG before the bundle runs. */
export function supabaseConfig() {
  const w = globalThis.PHM_CONFIG || {};
  const url = (w.supabaseUrl || SUPABASE_URL || "").trim();
  const key = (w.supabaseAnonKey || SUPABASE_ANON_KEY || "").trim();
  return url && key ? { url, key } : null;
}

export const isConfigured = () => supabaseConfig() !== null;
