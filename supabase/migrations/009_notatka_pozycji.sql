-- Zakupy: notatka przy pozycji (np. "bez laktozy", "ta w niebieskim opakowaniu").
alter table public.podzadania add column if not exists notatka text;
