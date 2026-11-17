-- =====================================================================
-- Run this once in Supabase → SQL Editor.
-- It only ADDS columns; nothing you already have is changed or deleted.
-- =====================================================================

-- When each race starts (used for the countdown on the home page)
alter table matches add column if not exists starts_at timestamptz;

-- Fastest lap and event details shown on the home page
-- If vehicles.id is a uuid in your project, change bigint to uuid below.
alter table settings add column if not exists best_lap_vehicle_id bigint;
alter table settings add column if not exists best_lap_time text;
alter table settings add column if not exists event_name text;
alter table settings add column if not exists event_place text;
alter table settings add column if not exists laps integer;


-- =====================================================================
-- Access rules (Row Level Security)
-- The site uses the public "anon" key with no login, so the anon role
-- needs these permissions. Skip any you already have.
-- Note: with these rules anyone who knows the address can also use /admin.
-- =====================================================================

alter table vehicles   enable row level security;
alter table categories enable row level security;
alter table matches    enable row level security;
alter table votes      enable row level security;
alter table bets       enable row level security;
alter table settings   enable row level security;

-- Everyone can read everything
create policy "read vehicles"   on vehicles   for select to anon using (true);
create policy "read categories" on categories for select to anon using (true);
create policy "read matches"    on matches    for select to anon using (true);
create policy "read votes"      on votes      for select to anon using (true);
create policy "read bets"       on bets       for select to anon using (true);
create policy "read settings"   on settings   for select to anon using (true);

-- Visitors can vote, offer bets and take bets
create policy "add votes" on votes for insert to anon with check (true);
create policy "add bets"  on bets  for insert to anon with check (true);
create policy "take bets" on bets  for update to anon using (taker_name is null) with check (true);

-- The admin page changes matches, vehicles (broken) and settings
create policy "admin matches"  on matches  for update to anon using (true) with check (true);
create policy "admin vehicles" on vehicles for update to anon using (true) with check (true);
create policy "admin settings" on settings for update to anon using (true) with check (true);
