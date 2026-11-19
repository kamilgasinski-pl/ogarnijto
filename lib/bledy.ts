// Tłumaczy najczęstsze komunikaty błędów Supabase Auth na polski.
// Komunikaty z funkcji SQL (utworz_rodzine itd.) są już po polsku.
export function tlumaczBlad(komunikat: string): string {
  const m = komunikat.toLowerCase();
  if (m.includes("invalid login credentials"))
    return "Nieprawidłowy e-mail lub hasło.";
  if (m.includes("email not confirmed"))
    return "Adres e-mail nie jest jeszcze potwierdzony. Kliknij link z wiadomości.";
  if (m.includes("user already registered"))
    return "Konto z tym adresem e-mail już istnieje. Zaloguj się.";
  if (m.includes("password should be at least"))
    return "Hasło jest za krótkie (minimum 6 znaków).";
  if (m.includes("unable to validate email") || m.includes("invalid email"))
    return "Nieprawidłowy adres e-mail.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Zbyt wiele prób. Spróbuj ponownie za chwilę.";
  if (m.includes("failed to fetch") || m.includes("network"))
    return "Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.";
  return komunikat;
}
