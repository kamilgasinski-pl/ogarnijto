-- Dojazdy: stały tygodniowy rozkład autobusów i odwozów (np. do szkoły muzycznej)
-- oraz wyjątki na konkretne dni (odwołane zajęcia, zmiana godziny).
-- Uruchom jednorazowo w SQL Editorze.

begin;

create table public.dojazdy (
  id            uuid primary key default gen_random_uuid(),
  rodzina_id    uuid not null references public.rodziny (id) on delete cascade,
  rodzaj        text not null default 'autobus' check (rodzaj in ('autobus', 'odwoz')),
  tytul         text not null,
  opis          text,
  dni           smallint[] not null
                check (cardinality(dni) > 0 and dni <@ array[1,2,3,4,5,6,7]::smallint[]),
  godz_start    time not null,
  godz_koniec   time,
  przypisano_id uuid,
  od            date not null default current_date,
  do_dnia       date,
  created_at    timestamptz not null default now(),
  check (godz_koniec is null or godz_koniec > godz_start),
  check (do_dnia is null or do_dnia >= od),
  unique (rodzina_id, id),
  foreign key (rodzina_id, przypisano_id)
    references public.osoby (rodzina_id, id) on delete set null (przypisano_id)
);
create index dojazdy_rodzina_idx on public.dojazdy (rodzina_id);

create table public.dojazdy_wyjatki (
  id          uuid primary key default gen_random_uuid(),
  rodzina_id  uuid not null references public.rodziny (id) on delete cascade,
  dojazd_id   uuid not null,
  data        date not null,
  odwolany    boolean not null default false,
  godz_start  time,
  godz_koniec time,
  created_at  timestamptz not null default now(),
  check (godz_koniec is null or godz_start is null or godz_koniec > godz_start),
  unique (dojazd_id, data),
  foreign key (rodzina_id, dojazd_id)
    references public.dojazdy (rodzina_id, id) on delete cascade
);
create index dojazdy_wyjatki_rodzina_idx on public.dojazdy_wyjatki (rodzina_id, data);

alter table public.dojazdy enable row level security;
create policy dojazdy_rodzina on public.dojazdy
  for all to authenticated
  using (rodzina_id = public.moja_rodzina())
  with check (rodzina_id = public.moja_rodzina());

alter table public.dojazdy_wyjatki enable row level security;
create policy dojazdy_wyjatki_rodzina on public.dojazdy_wyjatki
  for all to authenticated
  using (rodzina_id = public.moja_rodzina())
  with check (rodzina_id = public.moja_rodzina());

revoke all on public.dojazdy, public.dojazdy_wyjatki from anon;
grant select, insert, update, delete on public.dojazdy, public.dojazdy_wyjatki to authenticated;

commit;
