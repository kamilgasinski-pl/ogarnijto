import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Rola = "uczen" | "rodzic";

export type Osoba = {
  id: string;
  rodzina_id: string;
  rola: Rola;
  imie: string;
};

/**
 * Zalogowane konto i jego profil w rodzinie (lub null, gdy rodzina nie jest
 * jeszcze założona). Wynik jest zapamiętywany na czas jednego żądania.
 * Niezalogowanych odsyła do /login.
 */
export const pobierzOsobe = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: osoba, error } = await supabase
    .from("osoby")
    .select("id, rodzina_id, rola, imie")
    .eq("id", user.id)
    .maybeSingle<Osoba>();

  // Błąd odczytu (np. brak uprawnień w bazie) nie może wyglądać jak brak rodziny.
  if (error) throw new Error(`Nie można odczytać profilu: ${error.message}`);

  return { supabase, user, osoba };
});

/** Jak pobierzOsobe, ale bez rodziny odsyła do /start. */
export async function wymagajRodziny() {
  const wynik = await pobierzOsobe();
  if (!wynik.osoba) redirect("/start");
  return { ...wynik, osoba: wynik.osoba };
}
