-- Widoczność pojedynczego zadania: czy pokazywać je na pulpicie w "Najbliższych sprawdzianach i kartkówkach"
-- oraz czy oznaczać przedmiot wykrzyknikiem na planerze. Można uruchomić wiele razy.
alter table public.zadania add column if not exists pokaz_na_pulpicie boolean not null default false;
alter table public.zadania add column if not exists oznacz_na_planerze boolean not null default false;

-- Dotychczasowe sprawdziany, kartkówki i odpowiedzi ustne mają obie opcje włączone.
update public.zadania set pokaz_na_pulpicie = true, oznacz_na_planerze = true
where typ <> 'zwykle' and pokaz_na_pulpicie = false and oznacz_na_planerze = false;

-- Zadania z własnych kategorii dziedziczą dotychczasowe ustawienia kategorii.
update public.zadania z
set pokaz_na_pulpicie = k.na_pulpicie, oznacz_na_planerze = k.na_planerze
from public.kategorie_wlasne k
where k.rodzina_id = z.rodzina_id and k.nazwa = z.kategoria
  and z.pokaz_na_pulpicie = false and z.oznacz_na_planerze = false;

-- Nowe sprawdziany (także z importu) domyślnie mają obie opcje włączone.
create or replace function public.zadania_domyslna_widocznosc() returns trigger
language plpgsql as $$
begin
  if new.typ <> 'zwykle' then
    new.pokaz_na_pulpicie := true;
    new.oznacz_na_planerze := true;
  end if;
  return new;
end $$;

drop trigger if exists zadania_widocznosc_przed_wstawieniem on public.zadania;
create trigger zadania_widocznosc_przed_wstawieniem
  before insert on public.zadania
  for each row execute function public.zadania_domyslna_widocznosc();
