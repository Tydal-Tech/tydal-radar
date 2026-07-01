-- Tydal Radar — run this once in the Supabase SQL editor.

-- prospects: cached Google Places results
create table if not exists prospects (
  place_id          text primary key,
  name              text not null,
  type              text not null,     -- daycare | dental | gym | veterinary | medical | office
  neighborhood      text not null,
  lat               double precision not null,
  lng               double precision not null,
  phone             text,
  address           text,
  rating            double precision,  -- Places enrichment (filled on scrape)
  user_rating_count integer,
  website           text,
  created_at        timestamptz not null default now()
);

-- pipeline: per-prospect sales state
create table if not exists pipeline (
  place_id       text primary key references prospects(place_id) on delete cascade,
  stage          text not null default 'not_knocked'
                 check (stage in ('not_knocked','knocked','talked','follow_up','client','not_interested')),
  note           text,
  follow_up_date date,
  updated_at     timestamptz not null default now()
);

-- keep updated_at fresh on edits
create or replace function touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;
drop trigger if exists pipeline_touch on pipeline;
create trigger pipeline_touch before update on pipeline
  for each row execute function touch_updated_at();

-- RLS on, permissive for the anon/publishable role (the app is gated by a
-- shared password at the UI layer).
alter table prospects enable row level security;
alter table pipeline  enable row level security;
create policy "anon all prospects" on prospects for all to anon using (true) with check (true);
create policy "anon all pipeline"  on pipeline  for all to anon using (true) with check (true);

-- push_subscriptions: Web Push endpoints for follow-up reminders (see
-- app/api/notify-followups). Run this block to enable notifications.
create table if not exists push_subscriptions (
  endpoint   text primary key,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
alter table push_subscriptions enable row level security;
create policy "anon all push_subscriptions" on push_subscriptions
  for all to anon using (true) with check (true);
