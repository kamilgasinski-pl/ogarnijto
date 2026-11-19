-- Testy sprawdzające generowane z tekstu podręcznika.
-- Pytania widzi cała rodzina, klucz odpowiedzi tylko rodzice.
-- Uruchom jednorazowo w SQL Editorze.

begin;

create table public.testy (
  id         uuid primary key,
  rodzina_id uuid not null references public.rodziny (id) on delete cascade,
  tytul      text not null,
  przedmiot  text,
  pytania    jsonb not null,
  utworzyl   uuid default auth.uid() references public.osoby (id) on delete set null,
  created_at timestamptz not null default now()
);
create index testy_rodzina_idx on public.testy (rodzina_id, created_at desc);

create table public.testy_klucz (
  test_id    uuid primary key references public.testy (id) on delete cascade,
  rodzina_id uuid not null references public.rodziny (id) on delete cascade,
  odpowiedzi jsonb not null
);

alter table public.testy enable row level security;
create policy testy_rodzina on public.testy
  for all to authenticated
  using (rodzina_id = public.moja_rodzina())
  with check (rodzina_id = public.moja_rodzina());

alter table public.testy_klucz enable row level security;
-- Każdy w rodzinie może zapisać klucz przy tworzeniu testu, ale odczytać go mogą tylko rodzice.
create policy testy_klucz_zapis on public.testy_klucz
  for insert to authenticated
  with check (rodzina_id = public.moja_rodzina());
create policy testy_klucz_odczyt on public.testy_klucz
  for select to authenticated
  using (rodzina_id = public.moja_rodzina() and public.jestem_rodzicem());
create policy testy_klucz_zmiana on public.testy_klucz
  for update to authenticated
  using (rodzina_id = public.moja_rodzina() and public.jestem_rodzicem())
  with check (rodzina_id = public.moja_rodzina() and public.jestem_rodzicem());
create policy testy_klucz_usuwanie on public.testy_klucz
  for delete to authenticated
  using (rodzina_id = public.moja_rodzina() and public.jestem_rodzicem());

revoke all on public.testy, public.testy_klucz from anon;
grant select, insert, update, delete on public.testy, public.testy_klucz to authenticated;

commit;
