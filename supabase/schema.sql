-- ===========================================================================
-- FIT — adatbázis séma
-- Futtatás: Supabase Dashboard → SQL Editor → beilleszt → Run
-- Újrafuttatható (idempotens).
-- ===========================================================================

create extension if not exists pgcrypto;

-- --- táblák ----------------------------------------------------------------

create table if not exists public.people (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) between 1 and 60),
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

-- Profilkép: a böngésző 200×200-ra kicsinyíti és JPEG data URL-ként küldi
-- (jellemzően 8–15 kB), így nincs szükség külön tárolóra. A felső korlát
-- védi az adatbázist attól, hogy valaki egy nyers fotót töltsön fel.
alter table public.people add column if not exists avatar text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'people_avatar_size'
  ) then
    alter table public.people
      add constraint people_avatar_size check (avatar is null or length(avatar) <= 300000);
  end if;
end $$;

-- Választott alapszín. Nem hexakód, hanem kulcs: a világos és a sötét
-- árnyalatot a CSS párosítja hozzá. Üresen a lila az alapértelmezés.
alter table public.people add column if not exists color text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'people_color_valid'
  ) then
    alter table public.people
      add constraint people_color_valid
      check (color is null or color in ('violet', 'blue', 'teal', 'orange'));
  end if;
end $$;

create table if not exists public.goals (
  id          uuid primary key default gen_random_uuid(),
  person_id   uuid not null references public.people(id) on delete cascade,
  title       text not null check (length(btrim(title)) between 1 and 60),
  frequency   int  not null default 1 check (frequency between 1 and 99),
  period      text not null default 'week' check (period in ('week', 'month')),
  sort_order  int  not null default 0,
  archived    boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists goals_person_idx on public.goals (person_id);

-- Egy cél egy adott napon vagy teljesült, vagy nem — innen az összetett kulcs.
create table if not exists public.completions (
  goal_id     uuid not null references public.goals(id) on delete cascade,
  day         date not null,
  created_at  timestamptz not null default now(),
  primary key (goal_id, day)
);

create index if not exists completions_day_idx on public.completions (day);

-- --- hozzáférés ------------------------------------------------------------
-- Nincs bejelentkezés: aki ismeri az oldal címét, az szerkeszthet is.
-- Ez tudatos döntés egy pár fős, privát csoportnál. Ha később kell belépés,
-- ezeket a policy-ket kell szigorítani (pl. auth.uid() is not null).

alter table public.people      enable row level security;
alter table public.goals       enable row level security;
alter table public.completions enable row level security;

do $$
declare t text;
begin
  foreach t in array array['people', 'goals', 'completions'] loop
    execute format('drop policy if exists "public_all" on public.%I', t);
    execute format(
      'create policy "public_all" on public.%I for all to anon, authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;

-- --- élő szinkron ----------------------------------------------------------
-- A telefonok azonnal látják egymás módosításait.

do $$
declare t text;
begin
  foreach t in array array['people', 'goals', 'completions'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- --- kezdeti adat (opcionális) ---------------------------------------------
-- Írd át a neveket, majd vedd ki a kommentből, ha egyből fel akarod tölteni.
--
-- insert into public.people (name, sort_order) values
--   ('Ádám', 0), ('Bence', 1), ('Csaba', 2),
--   ('Dóra', 3), ('Eszter', 4), ('Feri', 5);
