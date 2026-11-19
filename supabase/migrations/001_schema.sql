-- =====================================================================
-- Aplikacja szkolna: migracja 001 (schemat, funkcje, RLS)
-- Uruchom w Supabase: SQL Editor -> New query -> wklej -> Run.
-- Zakładamy NOWY projekt Supabase (region UE), osobny od ClimbOS.
-- Dzień tygodnia: 1 = poniedziałek ... 7 = niedziela (jak ISO).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tabele
-- ---------------------------------------------------------------------

create table public.rodziny (
  id          uuid primary key default gen_random_uuid(),
  nazwa       text not null,
  created_at  timestamptz not null default now()
);

create table public.osoby (
  id          uuid primary key references auth.users (id) on delete cascade,
  rodzina_id  uuid not null references public.rodziny (id) on delete cascade,
  rola        text not null check (rola in ('uczen', 'rodzic')),
  imie        text not null,
  created_at  timestamptz not null default now()
);
create index osoby_rodzina_idx on public.osoby (rodzina_id);

create table public.zaproszenia (
  kod         text primary key,
  rodzina_id  uuid not null references public.rodziny (id) on delete cascade,
  rola        text not null check (rola in ('uczen', 'rodzic')),
  wygasa_at   timestamptz not null default (now() + interval '7 days'),
  uzyte_at    timestamptz,
  utworzyl    uuid references public.osoby (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index zaproszenia_rodzina_idx on public.zaproszenia (rodzina_id);

create table public.przedmioty (
  id          uuid primary key default gen_random_uuid(),
  rodzina_id  uuid not null references public.rodziny (id) on delete cascade,
  nazwa       text not null,
  kolor       text not null default '#3b82f6',
  created_at  timestamptz not null default now(),
  unique (rodzina_id, nazwa),
  unique (rodzina_id, id)
);

-- Szablon tygodnia. Jego id jest zarazem linia_id bloków w tygodniach.
create table public.bloki_szablonu (
  id            uuid primary key default gen_random_uuid(),
  rodzina_id    uuid not null references public.rodziny (id) on delete cascade,
  dzien         smallint not null check (dzien between 1 and 7),
  godz_start    time not null,
  godz_koniec   time not null,
  przedmiot_id  uuid,
  sala          text,
  nauczyciel    text,
  nr_lekcji     smallint check (nr_lekcji between 0 and 20),
  created_at    timestamptz not null default now(),
  check (godz_koniec > godz_start),
  foreign key (rodzina_id, przedmiot_id) references public.przedmioty (rodzina_id, id)
);
create index bloki_szablonu_rodzina_idx on public.bloki_szablonu (rodzina_id);

-- Znacznik, że dany tydzień (poniedziałek) już istnieje jako osobna kopia planu.
create table public.tygodnie_planu (
  rodzina_id    uuid not null references public.rodziny (id) on delete cascade,
  tydzien_start date not null check (extract(isodow from tydzien_start) = 1),
  created_at    timestamptz not null default now(),
  primary key (rodzina_id, tydzien_start)
);

-- Plan konkretnego tygodnia (kopia szablonu + zmiany tylko tego tygodnia).
create table public.bloki_planu (
  id            uuid primary key default gen_random_uuid(),
  rodzina_id    uuid not null references public.rodziny (id) on delete cascade,
  tydzien_start date not null,
  linia_id      uuid not null default gen_random_uuid(),
  dzien         smallint not null check (dzien between 1 and 7),
  godz_start    time not null,
  godz_koniec   time not null,
  przedmiot_id  uuid,
  sala          text,
  nauczyciel    text,
  nr_lekcji     smallint check (nr_lekcji between 0 and 20),
  status        text not null default 'normalna'
                check (status in ('normalna', 'odwolana', 'zastepstwo', 'przesunieta', 'dodatkowa')),
  uwagi         text,
  created_at    timestamptz not null default now(),
  check (godz_koniec > godz_start),
  unique (rodzina_id, tydzien_start, linia_id),
  foreign key (rodzina_id, tydzien_start)
    references public.tygodnie_planu (rodzina_id, tydzien_start) on delete cascade,
  foreign key (rodzina_id, przedmiot_id) references public.przedmioty (rodzina_id, id)
);
create index bloki_planu_tydzien_idx on public.bloki_planu (rodzina_id, tydzien_start);

create table public.zadania (
  id              uuid primary key default gen_random_uuid(),
  rodzina_id      uuid not null references public.rodziny (id) on delete cascade,
  tytul           text not null,
  typ             text not null default 'zwykle'
                  check (typ in ('zwykle', 'sprawdzian', 'kartkowka')),
  termin          date not null,
  godz_start      time,
  godz_koniec     time,
  nr_lekcji       smallint check (nr_lekcji between 0 and 20),
  przedmiot       text,
  nauczyciel      text,
  kategoria       text not null default 'inne'
                  check (kategoria in ('lekcje', 'do_szkoly', 'platnosc', 'transport', 'inne')),
  wykonawca       text not null default 'dziecko'
                  check (wykonawca in ('dziecko', 'rodzic', 'oba')),
  opis            text,
  status          text not null default 'do_zrobienia'
                  check (status in ('do_zrobienia', 'zrobione')),
  wykonane_at     timestamptz,
  wykonane_przez  uuid references public.osoby (id) on delete set null,
  utworzyl        uuid default auth.uid() references public.osoby (id) on delete set null,
  zrodlo          text not null default 'reczne'
                  check (zrodlo in ('reczne', 'wklejka', 'screen', 'ai')),
  klucz_dedup     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (godz_start is null or godz_koniec is null or godz_koniec > godz_start),
  unique (rodzina_id, id)
);
create index zadania_termin_idx on public.zadania (rodzina_id, termin);
create unique index zadania_dedup_idx
  on public.zadania (rodzina_id, klucz_dedup) where klucz_dedup is not null;

create table public.podzadania (
  id              uuid primary key default gen_random_uuid(),
  rodzina_id      uuid not null references public.rodziny (id) on delete cascade,
  zadanie_id      uuid not null,
  tresc           text not null,
  kolejnosc       integer not null default 0,
  wykonane        boolean not null default false,
  wykonane_at     timestamptz,
  created_at      timestamptz not null default now(),
  foreign key (rodzina_id, zadanie_id)
    references public.zadania (rodzina_id, id) on delete cascade
);
create index podzadania_zadanie_idx on public.podzadania (zadanie_id, kolejnosc);

-- ---------------------------------------------------------------------
-- 2. Funkcje pomocnicze i wyzwalacze
-- ---------------------------------------------------------------------

-- Rodzina zalogowanej osoby. SECURITY DEFINER, żeby polityki na tabeli osoby
-- nie wpadały w rekurencję.
create or replace function public.moja_rodzina()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select rodzina_id from public.osoby where id = auth.uid()
$$;

create or replace function public.jestem_rodzicem()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.osoby where id = auth.uid() and rola = 'rodzic')
$$;

create or replace function public.zadania_przed_zapisem()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if new.status = 'zrobione' and (tg_op = 'INSERT' or old.status is distinct from 'zrobione') then
    new.wykonane_at := now();
    new.wykonane_przez := auth.uid();
  elsif new.status = 'do_zrobienia' then
    new.wykonane_at := null;
    new.wykonane_przez := null;
  end if;
  return new;
end
$$;

create trigger zadania_przed_zapisem
  before insert or update on public.zadania
  for each row execute function public.zadania_przed_zapisem();

create or replace function public.podzadania_przed_zapisem()
returns trigger
language plpgsql
as $$
begin
  if new.wykonane and (tg_op = 'INSERT' or old.wykonane is distinct from true) then
    new.wykonane_at := now();
  elsif not new.wykonane then
    new.wykonane_at := null;
  end if;
  return new;
end
$$;

create trigger podzadania_przed_zapisem
  before insert or update on public.podzadania
  for each row execute function public.podzadania_przed_zapisem();

-- ---------------------------------------------------------------------
-- 3. Funkcje rodziny i zaproszeń (jedyna droga tworzenia rodzin i osób)
-- ---------------------------------------------------------------------

create or replace function public.utworz_rodzine(p_nazwa text, p_imie text, p_rola text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Wymagane logowanie';
  end if;
  if exists (select 1 from public.osoby where id = auth.uid()) then
    raise exception 'To konto należy już do rodziny';
  end if;
  if p_rola not in ('uczen', 'rodzic') then
    raise exception 'Nieprawidłowa rola';
  end if;
  insert into public.rodziny (nazwa) values (p_nazwa) returning id into v_id;
  insert into public.osoby (id, rodzina_id, rola, imie)
    values (auth.uid(), v_id, p_rola, p_imie);
  return v_id;
end
$$;

create or replace function public.utworz_zaproszenie(p_rola text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rodzina uuid;
  v_kod text;
begin
  select rodzina_id into v_rodzina from public.osoby where id = auth.uid();
  if v_rodzina is null then
    raise exception 'Brak rodziny';
  end if;
  if not public.jestem_rodzicem() then
    raise exception 'Zapraszać może tylko rodzic';
  end if;
  if p_rola not in ('uczen', 'rodzic') then
    raise exception 'Nieprawidłowa rola';
  end if;
  v_kod := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  insert into public.zaproszenia (kod, rodzina_id, rola, utworzyl)
    values (v_kod, v_rodzina, p_rola, auth.uid());
  return v_kod;
end
$$;

create or replace function public.dolacz_do_rodziny(p_kod text, p_imie text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  z public.zaproszenia%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Wymagane logowanie';
  end if;
  if exists (select 1 from public.osoby where id = auth.uid()) then
    raise exception 'To konto należy już do rodziny';
  end if;
  select * into z
    from public.zaproszenia
    where kod = upper(trim(p_kod)) and uzyte_at is null and wygasa_at > now()
    for update;
  if not found then
    raise exception 'Nieprawidłowy lub wygasły kod zaproszenia';
  end if;
  insert into public.osoby (id, rodzina_id, rola, imie)
    values (auth.uid(), z.rodzina_id, z.rola, p_imie);
  update public.zaproszenia set uzyte_at = now() where kod = z.kod;
  return z.rodzina_id;
end
$$;

-- ---------------------------------------------------------------------
-- 4. Funkcje planu (SECURITY INVOKER: obowiązuje RLS)
-- ---------------------------------------------------------------------

-- Tworzy tydzień przy pierwszym otwarciu. Zwraca true, gdy go utworzyła.
-- Źródło: szablon, a bez szablonu kopia poprzedniego tygodnia
-- (bez zmian tygodniowych: zostają tylko bloki normalne i odwołane, jako normalne).
create or replace function public.zapewnij_tydzien(p_tydzien_start date)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_rodzina uuid := public.moja_rodzina();
  v_poprz date;
begin
  if v_rodzina is null then
    raise exception 'Brak rodziny';
  end if;
  if extract(isodow from p_tydzien_start) <> 1 then
    raise exception 'Tydzień musi zaczynać się w poniedziałek';
  end if;

  insert into public.tygodnie_planu (rodzina_id, tydzien_start)
    values (v_rodzina, p_tydzien_start)
    on conflict do nothing;
  if not found then
    return false;
  end if;

  if exists (select 1 from public.bloki_szablonu where rodzina_id = v_rodzina) then
    insert into public.bloki_planu
      (rodzina_id, tydzien_start, linia_id, dzien, godz_start, godz_koniec,
       przedmiot_id, sala, nauczyciel, nr_lekcji)
    select rodzina_id, p_tydzien_start, id, dzien, godz_start, godz_koniec,
           przedmiot_id, sala, nauczyciel, nr_lekcji
      from public.bloki_szablonu
      where rodzina_id = v_rodzina;
  else
    select max(tydzien_start) into v_poprz
      from public.tygodnie_planu
      where rodzina_id = v_rodzina and tydzien_start < p_tydzien_start;
    if v_poprz is not null then
      insert into public.bloki_planu
        (rodzina_id, tydzien_start, linia_id, dzien, godz_start, godz_koniec,
         przedmiot_id, sala, nauczyciel, nr_lekcji)
      select rodzina_id, p_tydzien_start, linia_id, dzien, godz_start, godz_koniec,
             przedmiot_id, sala, nauczyciel, nr_lekcji
        from public.bloki_planu
        where rodzina_id = v_rodzina
          and tydzien_start = v_poprz
          and status in ('normalna', 'odwolana');
    end if;
  end if;
  return true;
end
$$;

-- Zapisuje plan wybranego tygodnia jako szablon (nadpisuje poprzedni).
-- Do szablonu trafiają bloki normalne i odwołane.
create or replace function public.zapisz_szablon(p_tydzien_start date)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_rodzina uuid := public.moja_rodzina();
  v_n integer;
begin
  if v_rodzina is null then
    raise exception 'Brak rodziny';
  end if;
  delete from public.bloki_szablonu where rodzina_id = v_rodzina;
  insert into public.bloki_szablonu
    (id, rodzina_id, dzien, godz_start, godz_koniec,
     przedmiot_id, sala, nauczyciel, nr_lekcji)
  select linia_id, rodzina_id, dzien, godz_start, godz_koniec,
         przedmiot_id, sala, nauczyciel, nr_lekcji
    from public.bloki_planu
    where rodzina_id = v_rodzina
      and tydzien_start = p_tydzien_start
      and status in ('normalna', 'odwolana');
  get diagnostics v_n = row_count;
  return v_n;
end
$$;

-- Przywraca wybrany tydzień do szablonu (kasuje zmiany tego tygodnia).
create or replace function public.zastosuj_szablon(p_tydzien_start date)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_rodzina uuid := public.moja_rodzina();
  v_n integer;
begin
  if v_rodzina is null then
    raise exception 'Brak rodziny';
  end if;
  if extract(isodow from p_tydzien_start) <> 1 then
    raise exception 'Tydzień musi zaczynać się w poniedziałek';
  end if;
  insert into public.tygodnie_planu (rodzina_id, tydzien_start)
    values (v_rodzina, p_tydzien_start)
    on conflict do nothing;
  delete from public.bloki_planu
    where rodzina_id = v_rodzina and tydzien_start = p_tydzien_start;
  insert into public.bloki_planu
    (rodzina_id, tydzien_start, linia_id, dzien, godz_start, godz_koniec,
     przedmiot_id, sala, nauczyciel, nr_lekcji)
  select rodzina_id, p_tydzien_start, id, dzien, godz_start, godz_koniec,
         przedmiot_id, sala, nauczyciel, nr_lekcji
    from public.bloki_szablonu
    where rodzina_id = v_rodzina;
  get diagnostics v_n = row_count;
  return v_n;
end
$$;

-- ---------------------------------------------------------------------
-- 5. Uprawnienia i RLS
-- ---------------------------------------------------------------------

-- Anonimowi nie mają dostępu do niczego.
revoke all on
  public.rodziny, public.osoby, public.zaproszenia, public.przedmioty,
  public.bloki_szablonu, public.tygodnie_planu, public.bloki_planu,
  public.zadania, public.podzadania
from anon;

-- Rodziny, osoby i zaproszenia nie są zapisywane bezpośrednio z przeglądarki
-- (tworzą je funkcje powyżej). Zalogowani mogą je czytać; osoba zmienia tylko
-- własne imię (rolę zmienić nie może), rodzic usuwa zaproszenia.
revoke insert, update, delete on public.rodziny from authenticated;
revoke insert, update, delete on public.osoby from authenticated;
revoke insert, update, delete on public.zaproszenia from authenticated;
grant update (imie) on public.osoby to authenticated;
grant update (nazwa) on public.rodziny to authenticated;
grant delete on public.zaproszenia to authenticated;

-- Funkcje: tylko zalogowani.
revoke execute on function
  public.moja_rodzina(), public.jestem_rodzicem(),
  public.utworz_rodzine(text, text, text),
  public.utworz_zaproszenie(text),
  public.dolacz_do_rodziny(text, text),
  public.zapewnij_tydzien(date),
  public.zapisz_szablon(date),
  public.zastosuj_szablon(date)
from public, anon;
grant execute on function
  public.moja_rodzina(), public.jestem_rodzicem(),
  public.utworz_rodzine(text, text, text),
  public.utworz_zaproszenie(text),
  public.dolacz_do_rodziny(text, text),
  public.zapewnij_tydzien(date),
  public.zapisz_szablon(date),
  public.zastosuj_szablon(date)
to authenticated;

alter table public.rodziny        enable row level security;
alter table public.osoby          enable row level security;
alter table public.zaproszenia    enable row level security;
alter table public.przedmioty     enable row level security;
alter table public.bloki_szablonu enable row level security;
alter table public.tygodnie_planu enable row level security;
alter table public.bloki_planu    enable row level security;
alter table public.zadania        enable row level security;
alter table public.podzadania     enable row level security;

create policy rodziny_odczyt on public.rodziny
  for select to authenticated
  using (id = public.moja_rodzina());

create policy rodziny_zmiana on public.rodziny
  for update to authenticated
  using (id = public.moja_rodzina())
  with check (id = public.moja_rodzina());

create policy osoby_odczyt on public.osoby
  for select to authenticated
  using (rodzina_id = public.moja_rodzina());

create policy osoby_zmiana_wlasnej on public.osoby
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and rodzina_id = public.moja_rodzina());

create policy zaproszenia_odczyt on public.zaproszenia
  for select to authenticated
  using (rodzina_id = public.moja_rodzina() and public.jestem_rodzicem());

create policy zaproszenia_usuwanie on public.zaproszenia
  for delete to authenticated
  using (rodzina_id = public.moja_rodzina() and public.jestem_rodzicem());

-- Tabele danych: jedna polityka na wszystkie operacje (SELECT, INSERT,
-- UPDATE, DELETE), z tym samym warunkiem w USING i WITH CHECK.
create policy przedmioty_rodzina on public.przedmioty
  for all to authenticated
  using (rodzina_id = public.moja_rodzina())
  with check (rodzina_id = public.moja_rodzina());

create policy bloki_szablonu_rodzina on public.bloki_szablonu
  for all to authenticated
  using (rodzina_id = public.moja_rodzina())
  with check (rodzina_id = public.moja_rodzina());

create policy tygodnie_planu_rodzina on public.tygodnie_planu
  for all to authenticated
  using (rodzina_id = public.moja_rodzina())
  with check (rodzina_id = public.moja_rodzina());

create policy bloki_planu_rodzina on public.bloki_planu
  for all to authenticated
  using (rodzina_id = public.moja_rodzina())
  with check (rodzina_id = public.moja_rodzina());

create policy zadania_rodzina on public.zadania
  for all to authenticated
  using (rodzina_id = public.moja_rodzina())
  with check (rodzina_id = public.moja_rodzina());

create policy podzadania_rodzina on public.podzadania
  for all to authenticated
  using (rodzina_id = public.moja_rodzina())
  with check (rodzina_id = public.moja_rodzina());

-- ---------------------------------------------------------------------
-- 6. Realtime: wspólne odhaczanie widoczne od razu u drugiej osoby
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.zadania, public.podzadania;
