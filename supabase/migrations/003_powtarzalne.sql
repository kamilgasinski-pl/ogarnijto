-- Zadania powtarzalne (np. "w każdą środę odbieram dziecko o 15:30") oraz
-- przypisywanie zadań do konkretnej osoby. Uruchom jednorazowo w SQL Editorze.

begin;

-- Potrzebne do złożonych kluczy obcych (rodzina_id, osoba).
alter table public.osoby add constraint osoby_rodzina_id_key unique (rodzina_id, id);

create table public.zadania_powtarzalne (
  id            uuid primary key default gen_random_uuid(),
  rodzina_id    uuid not null references public.rodziny (id) on delete cascade,
  tytul         text not null,
  opis          text,
  kategoria     text not null default 'inne'
                check (kategoria in ('lekcje', 'do_szkoly', 'platnosc', 'transport', 'inne')),
  wykonawca     text not null default 'rodzic'
                check (wykonawca in ('dziecko', 'rodzic', 'oba')),
  przypisano_id uuid,
  dni           smallint[] not null
                check (cardinality(dni) > 0 and dni <@ array[1,2,3,4,5,6,7]::smallint[]),
  godz_start    time,
  godz_koniec   time,
  od            date not null default current_date,
  do_dnia       date,
  pominiete     date[] not null default '{}',
  utworzyl      uuid default auth.uid() references public.osoby (id) on delete set null,
  created_at    timestamptz not null default now(),
  check (godz_start is null or godz_koniec is null or godz_koniec > godz_start),
  check (do_dnia is null or do_dnia >= od),
  unique (rodzina_id, id),
  foreign key (rodzina_id, przypisano_id)
    references public.osoby (rodzina_id, id) on delete set null (przypisano_id)
);
create index zadania_powtarzalne_rodzina_idx on public.zadania_powtarzalne (rodzina_id);

alter table public.zadania
  add column przypisano_id  uuid,
  add column powtarzalne_id uuid,
  add foreign key (rodzina_id, przypisano_id)
    references public.osoby (rodzina_id, id) on delete set null (przypisano_id),
  add foreign key (rodzina_id, powtarzalne_id)
    references public.zadania_powtarzalne (rodzina_id, id) on delete set null (powtarzalne_id);

-- Jedno zadanie na regułę i dzień (generowanie jest bezpieczne do powtarzania).
create unique index zadania_powtarzalne_termin_idx
  on public.zadania (powtarzalne_id, termin) where powtarzalne_id is not null;

alter table public.zadania_powtarzalne enable row level security;
create policy zadania_powtarzalne_rodzina on public.zadania_powtarzalne
  for all to authenticated
  using (rodzina_id = public.moja_rodzina())
  with check (rodzina_id = public.moja_rodzina());

revoke all on public.zadania_powtarzalne from anon;
grant select, insert, update, delete on public.zadania_powtarzalne to authenticated;

-- Tworzy brakujące zadania z reguł powtarzalnych w podanym zakresie dat.
create or replace function public.zapewnij_powtarzalne(p_od date, p_do date)
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
  if p_do < p_od or p_do - p_od > 190 then
    raise exception 'Nieprawidłowy zakres dat';
  end if;

  insert into public.zadania
    (rodzina_id, tytul, typ, termin, godz_start, godz_koniec, kategoria,
     wykonawca, przypisano_id, opis, zrodlo, powtarzalne_id)
  select r.rodzina_id, r.tytul, 'zwykle', d::date, r.godz_start, r.godz_koniec,
         r.kategoria, r.wykonawca, r.przypisano_id, r.opis, 'reczne', r.id
    from public.zadania_powtarzalne r
    cross join lateral generate_series(
      greatest(p_od, r.od)::timestamp,
      least(p_do, coalesce(r.do_dnia, p_do))::timestamp,
      interval '1 day'
    ) as d
    where r.rodzina_id = v_rodzina
      and extract(isodow from d)::smallint = any (r.dni)
      and not (d::date = any (r.pominiete))
  on conflict (powtarzalne_id, termin) where powtarzalne_id is not null do nothing;

  get diagnostics v_n = row_count;
  return v_n;
end
$$;

-- Usuwa jedno wystąpienie powtarzalnego zadania i zapamiętuje, że ten dzień
-- ma zostać pominięty (inaczej wygenerowałoby się ponownie).
create or replace function public.pomin_termin(p_zadanie uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_regula uuid;
  v_termin date;
begin
  select powtarzalne_id, termin into v_regula, v_termin
    from public.zadania where id = p_zadanie;
  if v_regula is not null then
    update public.zadania_powtarzalne
      set pominiete = array_append(pominiete, v_termin)
      where id = v_regula;
  end if;
  delete from public.zadania where id = p_zadanie;
end
$$;

-- Odwołuje regułę: ostatnie wystąpienie to p_ostatni, późniejsze niewykonane znikają.
create or replace function public.odwolaj_powtarzalne(p_id uuid, p_ostatni date)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.zadania_powtarzalne
    set do_dnia = greatest(od, p_ostatni)
    where id = p_id;
  delete from public.zadania
    where powtarzalne_id = p_id and termin > p_ostatni and status = 'do_zrobienia';
end
$$;

revoke execute on function
  public.zapewnij_powtarzalne(date, date),
  public.pomin_termin(uuid),
  public.odwolaj_powtarzalne(uuid, date)
from public, anon;
grant execute on function
  public.zapewnij_powtarzalne(date, date),
  public.pomin_termin(uuid),
  public.odwolaj_powtarzalne(uuid, date)
to authenticated;

commit;
