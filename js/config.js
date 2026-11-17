/* =====================================================================
   SETTINGS YOU EDIT
   ===================================================================== */

// Your Supabase project (Supabase dashboard → Project Settings → API).
// The "anon public" key is meant to be visible in the browser.
const SUPABASE_URL = "https://supabase.com/project/ehalmckvxzwrdwuctnuj";
const SUPABASE_ANON_KEY = "sb_publishable_9VlRqguVogk5nf6niUjjrw_hruC3-Nk";

// How often each page fetches fresh data from Supabase, in milliseconds.
const REFRESH_MS = 10000;

// The values stored in bets.type, and how each bet is written out.
// If your table already uses other words, change only the `id` values.
// name = vehicle or makerspace name, isMakerspace = true for makerspace bets.
const BET_TYPES = [
  { id: "race_win",       label: "Wins their race",      text: (name, isMakerspace) => isMakerspace ? `A ${name} car wins its race` : `${name} wins their race` },
  { id: "tournament_win", label: "Wins the whole thing", text: (name) => `${name} wins the whole thing` },
  { id: "breaks",         label: "Breaks down",          text: (name, isMakerspace) => isMakerspace ? `A ${name} car breaks down` : `${name} breaks down` },
  { id: "fastest_lap",    label: "Sets the fastest lap", text: (name, isMakerspace) => isMakerspace ? `A ${name} car sets the fastest lap` : `${name} sets the fastest lap` },
];

// PLACEHOLDER TEXT shown while a value is still empty in Supabase.
// You don't need to edit these: fill in the real values on the admin page
// (Event details, Fastest lap, Current race) and the placeholders disappear.
const PLACEHOLDER = {
  eventName:      "event_name",        // settings.event_name
  eventPlace:     "event_place",       // settings.event_place
  laps:           "laps",              // settings.laps
  bestLapTime:    "best_lap_time",     // settings.best_lap_time
  bestLapVehicle: "best_lap_vehicle",  // settings.best_lap_vehicle_id
  startTime:      "start_time",        // matches.starts_at of the current race
};
