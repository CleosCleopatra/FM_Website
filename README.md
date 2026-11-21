# Formula Makerspace website

Plain HTML, CSS and JavaScript. No build step. Data lives in Supabase.

## Files

| File | What it is |
|---|---|
| `index.html` | Home: current race, countdown, tiles, best lap |
| `grid.html` | All vehicles |
| `bracket.html` | Tournament tree |
| `vote.html` | Crowd votes |
| `betting.html` | No-money betting |
| `admin/index.html` | Admin page, opened at `/admin` |
| `css/base.css` | Colours, fonts, header + menu, buttons, forms (used by every page) |
| `css/<page>.css` | Styles for one page only |
| `js/config.js` | **The file you edit**: Supabase keys, bet types, defaults |
| `js/db.js` | Every Supabase read and write |
| `js/common.js` | Shared helpers: menu, pictures, messages, auto-refresh |
| `js/<page>.js` | Code for one page only |
| `images/` | Icons and the race-track background |
| `supabase/add-missing-columns.sql` | Columns the site needs (and the old, open access rules) |
| `supabase/security.sql` | Access rules: visitors can vote and bet, only a logged-in admin can change results |
| `template.html`, `css/template.css`, `js/template.js` | Copy these to make a new page |

## Where to add things

Every file has comments marked **ADD**, **CHANGE** or **Keep** that show where new things go.

| I want to… | Do this |
|---|---|
| Add or edit a vehicle | Edit the `vehicles` table in Supabase (no code change) |
| Add a vote category | Add a row to the `categories` table in Supabase |
| Add a bet type | Add a line to `BET_TYPES` in `js/config.js` |
| Change colours or fonts | Edit `:root` at the top of `css/base.css` |
| Style something on one page | Add it at the bottom of that page's CSS file (below "ADD NEW STYLES") |
| Add a section to a page | Put it between `PAGE CONTENT` and `END PAGE CONTENT` in that page's HTML |
| Add a home-page tile | Copy a `<a class="tile">` line in `index.html` (see the TILES comment) |
| Add a whole new page | Follow the steps at the top of `template.html` |
| Read a new Supabase table | Add a reader to `Data` in `js/db.js` (example in `js/template.js`) |

## Setup

1. **Supabase keys:** open `js/config.js` and paste your Project URL and anon public key
   (Supabase → Project Settings → API).
2. **Tables:** to start from scratch, run `supabase/create-tables.sql` in Supabase → SQL Editor.
   ⚠ It deletes and recreates all six tables. Then run `supabase/add-missing-columns.sql`
   (it also sets the access rules).
   Then run `supabase/security.sql`, which replaces those access rules with safer ones
   (see step 5).
   It adds `matches.starts_at` and the fastest-lap / event columns on `settings`,
   and the access rules for the anon key. Skip policies you already have.
3. **Bet types:** if `bets.type` already uses other values than
   `race_win`, `tournament_win`, `breaks`, `fastest_lap`, change the ids in `js/config.js`.
4. **Placeholder data:** run `supabase/seed.sql` in the SQL Editor (after step 2).
   It clears the tables and fills them with 16 placeholder cars, the 4 vote
   categories, an empty 16-car bracket and a settings row.
   The bracket expects round 1 to have 8 matches, with `next_match_id` and
   `next_slot` (`a` or `b`) pointing to where the winner goes. The seed sets this up.
5. **Admin login:** in Supabase → Authentication → Sign In / Providers, turn OFF
   "Allow new users to sign up". Then Authentication → Users → Add user: one user per
   admin (email + password, tick "Auto Confirm User"). Do this before running
   `supabase/security.sql`, or nobody can save anything on the admin page.

## Replacing placeholders

Everything you will replace lives in Supabase or on the admin page, not in the code.

| You see | Replace it in |
|---|---|
| `car_name_1` … `car_name_16` | Supabase → `vehicles.name` |
| `makerspace_1` … `makerspace_8` | Supabase → `vehicles.makerspace` (cars with the same text belong together) |
| `driver_1`, `powered_by_1`, `reg_nr_1`, `fun_fact_1` | Supabase → `vehicles` columns with the same names |
| Dashed box saying `image` | Supabase → `vehicles.image`: a picture URL (Supabase Storage, or `images/cars/…` in this folder) |
| Who races whom in round 1 | Supabase → `matches.vehicle_a_id` / `vehicle_b_id` (round 1 rows) |
| Vote categories | Supabase → `categories.name` |
| `event_name`, `event_place`, `laps` | Admin page → Event details |
| `best_lap_time`, `best_lap_vehicle` | Admin page → Fastest lap |
| `start_time` | Admin page → Current race |
| The placeholder words themselves | `PLACEHOLDER` in `js/config.js` |

## Try it on your computer

Open the folder in VS Code and use the **Live Server** extension, or run:

```
npx serve .
```

## Put it on GitHub Pages

1. Push the folder to a GitHub repository.
2. Repository → Settings → Pages → Source: *Deploy from a branch*, branch `main`, folder `/ (root)`.
3. The site appears at `https://<your-user>.github.io/<repo>/` and the admin page at
   `https://<your-user>.github.io/<repo>/admin/`.

## Good to know

- Pages fetch new data every 10 seconds (`REFRESH_MS` in `js/config.js`).
- Votes have no login: each browser remembers which categories it voted in,
  but someone could vote again from another browser.
- `/admin` needs a login (step 5). The database itself only accepts changes to races, cars
  and settings from a logged-in admin, so knowing the address isn't enough.
- If `vehicles.image` is empty, a drawn kart is shown instead of a photo.
