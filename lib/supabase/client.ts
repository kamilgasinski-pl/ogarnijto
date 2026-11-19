import { createBrowserClient } from "@supabase/ssr";

// Klient dla komponentów przeglądarkowych ("use client").
// Używa wyłącznie klucza publishable. Dostęp do danych chroni RLS w bazie.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
