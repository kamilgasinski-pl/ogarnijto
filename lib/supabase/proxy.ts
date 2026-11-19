import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Strony dostępne bez logowania.
const PUBLICZNE = ["/login", "/auth"];

function czyPubliczna(sciezka: string) {
  return PUBLICZNE.some((p) => sciezka === p || sciezka.startsWith(p + "/"));
}

// Odświeża sesję Supabase przy każdym żądaniu i robi szybkie przekierowania.
// To tylko optymistyczna kontrola. Prawdziwą ochronę danych zapewnia RLS w bazie,
// a stron chronionych pilnuje dodatkowo (app)/layout.tsx.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const zalogowany = Boolean(data?.claims);
  const sciezka = request.nextUrl.pathname;

  const przekieruj = (cel: string) => {
    const url = request.nextUrl.clone();
    url.pathname = cel;
    url.search = "";
    const odpowiedz = NextResponse.redirect(url);
    // Zachowaj odświeżone ciasteczka sesji.
    response.cookies.getAll().forEach((c) => odpowiedz.cookies.set(c));
    return odpowiedz;
  };

  if (!zalogowany && !czyPubliczna(sciezka)) {
    return przekieruj("/login");
  }
  if (zalogowany && sciezka === "/login") {
    return przekieruj("/");
  }

  return response;
}
