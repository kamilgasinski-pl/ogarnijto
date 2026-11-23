-- Kategorie: wbudowane (sprawdzian, kartkówka, odp. ustna) oraz własne definiowane przez rodzinę.
-- Skrypt można uruchomić wiele razy.

-- 1) Kategoria staje się dowolnym tekstem (zdjęcie ograniczenia CHECK).
do $$
declare r record;
begin
  for r in
    select c.conrelid::regclass as tabela, c.conname
    from pg_constraint c
    where c.contype = 'c'
      and c.conrelid in ('public.zadania'::regclass, 'public.zadania_powtarzalne'::regclass)
      and pg_get_constraintdef(c.oid) ilike '%kategoria%'
  loop
    execute format('alter table %s drop constraint %I', r.tabela, r.conname);
  end loop;
end $$;

-- 2) Nowy rodzaj: odpowiedź ustna.
alter table public.zadania drop constraint if exists zadania_typ_check;
alter table public.zadania
  add constraint zadania_typ_check
  check (typ in ('zwykle', 'sprawdzian', 'kartkowka', 'odpowiedz'));

-- 3) Własne kategorie rodziny.
create table if not exists public.kategorie_wlasne (
  id         uuid primary key default gen_random_uuid(),
  rodzina_id uuid not null references public.rodziny (id) on delete cascade,
  nazwa      text not null check (char_length(btrim(nazwa)) between 1 and 40),
  created_at timestamptz not null default now(),
  unique (rodzina_id, nazwa)
);

alter table public.kategorie_wlasne enable row level security;

drop policy if exists kategorie_wlasne_rodzina on public.kategorie_wlasne;
create policy kategorie_wlasne_rodzina on public.kategorie_wlasne
  for all to authenticated
  using (rodzina_id = public.moja_rodzina())
  with check (rodzina_id = public.moja_rodzina());

grant select, insert, delete on public.kategorie_wlasne to authenticated;
