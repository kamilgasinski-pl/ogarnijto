import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Dokąd przekierować po zalogowaniu (np. ustawianie hasła); tylko ścieżki wewnętrzne.
  const next = searchParams.get("next");
  const cel = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${cel}`);
  }
  return NextResponse.redirect(`${origin}/login`);
}
