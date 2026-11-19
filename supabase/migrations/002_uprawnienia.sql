-- Jawne uprawnienia dla zalogowanych. Nowe projekty Supabase nie zawsze nadają
-- je automatycznie, a 001 zakładał, że tak jest. Skrypt można uruchomić wiele razy.

grant usage on schema public to authenticated;

-- Odczyt wszystkich tabel (zakres wierszy i tak ogranicza RLS).
grant select on
  public.rodziny, public.osoby, public.zaproszenia, public.przedmioty,
  public.bloki_szablonu, public.tygodnie_planu, public.bloki_planu,
  public.zadania, public.podzadania
to authenticated;

-- Tabele danych: pełna edycja (RLS pilnuje, że tylko w swojej rodzinie).
grant insert, update, delete on
  public.przedmioty, public.bloki_szablonu, public.tygodnie_planu,
  public.bloki_planu, public.zadania, public.podzadania
to authenticated;

-- Rodziny, osoby i zaproszenia: bez bezpośredniego zapisu (jak w 001).
grant update (imie) on public.osoby to authenticated;
grant update (nazwa) on public.rodziny to authenticated;
grant delete on public.zaproszenia to authenticated;
