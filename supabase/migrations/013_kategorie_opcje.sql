-- Własne kategorie: czy zadania z tą kategorią mają się pokazywać w "Najbliższych sprawdzianach i kartkówkach"
-- na pulpicie oraz czy oznaczać przedmiot wykrzyknikiem na planerze. Można uruchomić wiele razy.
alter table public.kategorie_wlasne add column if not exists na_pulpicie boolean not null default false;
alter table public.kategorie_wlasne add column if not exists na_planerze boolean not null default false;

grant update on public.kategorie_wlasne to authenticated;
