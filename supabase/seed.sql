-- =====================================================================
-- PLACEHOLDER DATA for Formula Makerspace
--
-- Run in Supabase → SQL Editor, AFTER add-missing-columns.sql.
-- It CLEARS vehicles, matches, categories, votes, bets and settings and
-- fills them with placeholders like car_name_1. Safe to run again.
--
-- REPLACING PLACEHOLDERS LATER: open the Table Editor in Supabase and
-- type over the placeholder values. The site picks up changes within
-- 10 seconds. You never need to edit the website code for this.
-- =====================================================================

begin;

-- 1. Empty the tables (bets and votes first, because they point to the others)
delete from bets;
delete from votes;
delete from settings;
update matches set next_match_id = null, winner_id = null;
delete from matches;
delete from categories;
delete from vehicles;


-- 2. VEHICLES: 16 cars, 2 per makerspace.
--    REPLACE: name, makerspace, driver, powered_by, reg_nr, fun_fact.
--    image: leave empty until you have a picture, then put its URL here.
insert into vehicles (name, makerspace, driver, powered_by, reg_nr, fun_fact, image, broken)
select
  'car_name_'   || n,
  'makerspace_' || ((n + 1) / 2),   -- cars 1-2 → makerspace_1, 3-4 → makerspace_2, ...
  'driver_'     || n,
  'powered_by_' || n,
  'reg_nr_'     || n,
  'fun_fact_'   || n,
  null,
  false
from generate_series(1, 16) as n;


-- 3. VOTE CATEGORIES. REPLACE: rename, add or delete rows freely.
insert into categories (name) values
  ('Crowd favourite'),
  ('Craziest'),
  ('Most stupid'),
  ('Best looking');


-- 4. BRACKET: 15 matches, built from the final down to round 1.
--    round 1 = 8 matches (16 cars), round 2 = 4, round 3 = 2, round 4 = final.
--    position counts from 1 within each round.
--    Winners go to next_match_id, into slot 'a' (odd positions) or 'b' (even).

-- Final
insert into matches (round, position, next_match_id, next_slot)
values (4, 1, null, null);

-- Semifinals → final
insert into matches (round, position, next_match_id, next_slot)
select 3, p,
       (select id from matches where round = 4 and position = 1),
       case when p % 2 = 1 then 'a' else 'b' end
from generate_series(1, 2) as p;

-- Quarterfinals → semifinals
insert into matches (round, position, next_match_id, next_slot)
select 2, p,
       (select id from matches where round = 3 and position = (p + 1) / 2),
       case when p % 2 = 1 then 'a' else 'b' end
from generate_series(1, 4) as p;

-- Round 1 → quarterfinals. Match p is car_name_(2p-1) vs car_name_(2p).
-- REPLACE: to change who races whom, change vehicle_a_id / vehicle_b_id in the
-- matches table (round 1 rows only).
insert into matches (round, position, next_match_id, next_slot, vehicle_a_id, vehicle_b_id)
select 1, p,
       (select id from matches where round = 2 and position = (p + 1) / 2),
       case when p % 2 = 1 then 'a' else 'b' end,
       (select id from vehicles where name = 'car_name_' || (2 * p - 1)),
       (select id from vehicles where name = 'car_name_' || (2 * p))
from generate_series(1, 8) as p;


-- 5. SETTINGS: one row. The first race is shown on the home page.
--    event_name, event_place, laps, best lap and start time are left empty:
--    fill them in on the admin page (/admin).
insert into settings (current_match, tournament_over)
values ((select id from matches where round = 1 and position = 1), false);

commit;
