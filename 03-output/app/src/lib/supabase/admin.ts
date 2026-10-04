import { createClient } from "@supabase/supabase-js";
import { supabaseGlobalOptions } from "@/lib/supabase/route-fetch";

export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase 환경 변수 누락: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    ...supabaseGlobalOptions(),
  });
}
