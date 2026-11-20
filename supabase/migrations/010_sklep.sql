-- Zakupy: nazwa sklepu przy liście zakupów.
alter table public.zadania add column if not exists sklep text;
