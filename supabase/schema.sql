-- project-hail-mary — database schema
--
-- Paste this into the Supabase SQL editor and run it once.
-- It creates two tables, a bucket for cover art, and the rules about who can
-- read and write what. Those rules are the important part: everyone on the
-- street can look at everyone else's shelves, but only you can change yours.

-- ── who's who ────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  handle      text unique not null,
  room        text not null default 'sid-loft',
  created_at  timestamptz not null default now()
);

comment on table public.profiles is 'One row per person; handle is what appears on the street.';

-- ── what's on the shelves ────────────────────────────────────────────────
create table if not exists public.items (
  id          text primary key,          -- the app's own id; never parsed or joined on
  owner       uuid not null references auth.users on delete cascade,
  kind        text not null check (kind in ('anime','film','series','book')),
  title       text not null,
  alt_title   text        not null default '',
  year        int,
  creator     text        not null default '',
  seasons     int,
  units       int         not null default 1 check (units >= 0),
  done        int         not null default 0 check (done >= 0),
  status      text        not null default 'planned'
                check (status in ('watching','done','planned','dropped')),
  rating      numeric(3,1) check (rating is null or (rating >= 0 and rating <= 10)),
  genres      text[]      not null default '{}',
  colour      text,
  started     date,
  finished    date,
  note        text        not null default '',
  cover_path  text,                       -- object key in the covers bucket
  source      jsonb,                      -- { provider, id } when it came from a catalogue
  "order"     int         not null default 0,
  updated_at  timestamptz not null default now()
);

create index if not exists items_owner_idx on public.items (owner, "order");
create index if not exists items_kind_idx  on public.items (owner, kind);

-- keep updated_at honest without trusting the client
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists items_touch on public.items;
create trigger items_touch before update on public.items
  for each row execute function public.touch_updated_at();

-- ── who can do what ──────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.items    enable row level security;

drop policy if exists "profiles are public" on public.profiles;
create policy "profiles are public"
  on public.profiles for select using (true);

drop policy if exists "you edit your own profile" on public.profiles;
create policy "you edit your own profile"
  on public.profiles for all
  using (auth.uid() = id) with check (auth.uid() = id);

-- readable by anyone signed in: that's the whole point of visiting a friend's loft
drop policy if exists "shelves are readable" on public.items;
create policy "shelves are readable"
  on public.items for select to authenticated using (true);

drop policy if exists "you edit your own shelf" on public.items;
create policy "you edit your own shelf"
  on public.items for all to authenticated
  using (auth.uid() = owner) with check (auth.uid() = owner);

-- ── cover art ────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do nothing;

-- Files live under <user-id>/<item-id>.jpg, so the folder name is the check.
drop policy if exists "covers are readable" on storage.objects;
create policy "covers are readable"
  on storage.objects for select using (bucket_id = 'covers');

drop policy if exists "you write your own covers" on storage.objects;
create policy "you write your own covers"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "you replace your own covers" on storage.objects;
create policy "you replace your own covers"
  on storage.objects for update to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "you remove your own covers" on storage.objects;
create policy "you remove your own covers"
  on storage.objects for delete to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);

-- ── a profile appears the moment someone signs up ────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base text := split_part(coalesce(new.email, 'guest'), '@', 1);
  cand text := base;
  n    int  := 1;
begin
  -- handle is unique, so two friends on sid@… and sid@… must not collide;
  -- a collision here would fail the sign-up itself.
  while exists (select 1 from public.profiles where handle = cand) loop
    n := n + 1;
    cand := base || n::text;
  end loop;
  insert into public.profiles (id, handle) values (new.id, cand)
    on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
