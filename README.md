# OgarnijTo!

Aplikacja do codziennego ogarniania szkoły: plan lekcji, zadania rodzica i ucznia, sprawdziany z Librusa.

Stack: Next.js (App Router) · TypeScript · Tailwind · Supabase · Vercel.

## Uruchomienie lokalnie

1. `npm install`
2. Skopiuj `.env.example` do `.env.local` i wpisz Project URL oraz klucz `sb_publishable_…` (nigdy `sb_secret_…`).
3. W Supabase (SQL Editor) uruchom `supabase/migrations/001_schema.sql`.
4. `npm run dev` i otwórz http://localhost:3000

## Supabase → Authentication → URL Configuration

- Site URL: adres z Vercela (z `https://`)
- Redirect URLs: `https://twoj-adres.vercel.app/**` oraz `http://localhost:3000/**`

Specyfikacja projektu jest w dokumencie „OgarnijTo!: specyfikacja”.
