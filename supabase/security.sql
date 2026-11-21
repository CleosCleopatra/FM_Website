-- =====================================================================
-- Formula Makerspace: who may change what in the database.
--
-- Run this ONCE in Supabase → SQL Editor → New query → paste → Run.
-- It's safe to run again later (it replaces the rules each time).
--
-- After this:
--   * anyone can READ everything (the site shows it all)
--   * anyone can VOTE, OFFER a bet, and TAKE an open bet (only filling in
--     the taker's name and stake; nobody can edit or delete someone's bet)
--   * only a LOGGED-IN ADMIN can change races, cars, settings and
--     categories, and delete bets or votes (for cleaning up)
--
-- IMPORTANT, do these two things in the Supabase dashboard too:
--   1. Authentication → Sign In / Providers → turn OFF "Allow new users to
--      sign up". Otherwise anyone could make themselves an account and
--      count as an admin.
--   2. Authentication → Users → Add user → Create new user: make one user
--      per admin (email + password, tick "Auto Confirm User").
-- =====================================================================


-- 1. Turn on row level security, so the rules below are enforced.
alter table public.vehicles   enable row level security;
alter table public.categories enable row level security;
alter table public.matches    enable row level security;
alter table public.settings   enable row level security;
alter table public.bets       enable row level security;
alter table public.votes      enable row level security;


-- 2. Remove the old rules on these tables, so only the rules below apply.
do $$
declare p record;
begin
  for p in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('vehicles', 'categories', 'matches', 'settings', 'bets', 'votes')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;


-- 3. Everyone can read everything.
create policy "anyone can read" on public.vehicles   for select to anon, authenticated using (true);
create policy "anyone can read" on public.categories for select to anon, authenticated using (true);
create policy "anyone can read" on public.matches    for select to anon, authenticated using (true);
create policy "anyone can read" on public.settings   for select to anon, authenticated using (true);
create policy "anyone can read" on public.bets       for select to anon, authenticated using (true);
create policy "anyone can read" on public.votes      for select to anon, authenticated using (true);


-- 4. Anyone can vote.
create policy "anyone can vote" on public.votes
  for insert to anon, authenticated
  with check (category_id is not null and vehicle_id is not null);


-- 5. Anyone can offer a bet: it must be open (no taker yet), have a known
--    type, be about a car or a makerspace, and have a sensible name and stake.
create policy "anyone can offer a bet" on public.bets
  for insert to anon, authenticated
  with check (
    taker_name is null and taker_stake is null
    and type in ('race_win', 'tournament_win', 'breaks', 'fastest_lap')
    and (vehicle_id is not null or makerspace is not null)
    and char_length(trim(creator_name)) between 1 and 40
    and char_length(trim(creator_stake)) between 2 and 60
  );


-- 6. Anyone can take an OPEN bet. Once it's taken, nobody can change it again.
create policy "anyone can take an open bet" on public.bets
  for update to anon, authenticated
  using (taker_name is null)
  with check (
    char_length(trim(taker_name)) between 1 and 40
    and char_length(trim(taker_stake)) between 2 and 60
  );

-- ...and taking a bet may only fill in the taker's name and stake,
-- not change the bet itself (what it's about, or the creator's stake).
revoke update on public.bets from anon, authenticated;
grant update (taker_name, taker_stake) on public.bets to anon, authenticated;


-- 7. Logged-in admins can change the race data...
create policy "admins can change" on public.vehicles   for all to authenticated using (true) with check (true);
create policy "admins can change" on public.categories for all to authenticated using (true) with check (true);
create policy "admins can change" on public.matches    for all to authenticated using (true) with check (true);
create policy "admins can change" on public.settings   for all to authenticated using (true) with check (true);

-- ...and delete bets and votes, e.g. test bets or spam.
create policy "admins can delete bets"  on public.bets  for delete to authenticated using (true);
create policy "admins can delete votes" on public.votes for delete to authenticated using (true);
