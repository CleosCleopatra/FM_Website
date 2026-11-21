/* =====================================================================
   db.js: every read and write the site does with Supabase.

   Pages never talk to Supabase directly; they call Data.something().
   That keeps all table and column names in one file, so if a column is
   renamed in Supabase, this is the only file to update.

   Tables used: vehicles, categories, matches, votes, bets, settings.
   Who may write what is decided in Supabase itself (see supabase/security.sql):
   visitors can vote, offer bets and take open bets, and the admin page can
   change races, cars and settings (it has no login).
   ===================================================================== */

// One Supabase client for the whole page. `supabase` is the global created by
// the supabase-js <script> tag; the URL and key come from config.js.
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


/* ---------- low-level helpers ---------- */

/**
 * Read every row of a table.
 * `shape` receives the query and can add ordering or filters before it runs,
 * e.g. (q) => q.order("name"). Throws if Supabase reports an error, so the
 * caller (usually refreshEvery) can show a message.
 */
async function readTable(table, shape = (query) => query) {
  const { data, error } = await shape(supabaseClient.from(table).select("*"));
  if (error) throw error;
  return data;
}

/**
 * Await a Supabase insert/update and turn its { data, error } result into
 * a normal promise: returns data, or throws the error.
 */
async function write(promise) {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}

/**
 * Like write(), for admin updates: asks Supabase to return the changed rows
 * and throws if none changed. Supabase doesn't report an error when the
 * database rules block an update; it just changes nothing. Without this
 * check the admin page would say "Saved" when nothing was saved.
 */
async function writeChecked(query) {
  const rows = await write(query.select());
  if (!rows.length) throw new Error("Nothing was saved. The database refused the change (check the rules in supabase/security.sql).");
  return rows;
}

/** Which column of the next match a winner goes into, from matches.next_slot ('a' or 'b'). */
function slotColumn(nextSlot) {
  return nextSlot === "b" ? "vehicle_b_id" : "vehicle_a_id";
}


/* ---------- the Data object used by all pages ---------- */

const Data = {

  /* ----- reading ----- */

  vehicles:   () => readTable("vehicles",   (q) => q.order("name")),
  categories: () => readTable("categories", (q) => q.order("id")),
  // Ordered by round, then position, so the bracket can draw them in order.
  matches:    () => readTable("matches",    (q) => q.order("round").order("position")),
  votes:      () => readTable("votes"),
  // Newest bets first.
  bets:       () => readTable("bets",       (q) => q.order("created_at", { ascending: false })),

  /** The settings table has a single row; return it (or {} if it's missing). */
  async settings() {
    const rows = await readTable("settings", (q) => q.limit(1));
    return rows[0] || {};
  },


  /* ----- voting and betting (anyone can do these) ----- */

  /** Save one vote. created_at is filled in by Supabase. */
  addVote: (categoryId, vehicleId) =>
    write(supabaseClient.from("votes").insert({ category_id: categoryId, vehicle_id: vehicleId })),

  /** Save a new, open bet (taker_name stays empty until someone takes it). */
  addBet: (bet) =>
    write(supabaseClient.from("bets").insert(bet)),

  /**
   * Take an open bet.
   * The extra .is("taker_name", null) filter makes this safe if two people
   * press "take" at the same moment: only the first update matches the row,
   * the second updates nothing and gets the error below.
   */
  async takeBet(betId, takerName, takerStake) {
    const rows = await write(
      supabaseClient.from("bets")
        .update({ taker_name: takerName, taker_stake: takerStake })
        .eq("id", betId)
        .is("taker_name", null)
        .select() // return the updated rows so we can see if anything changed
    );
    if (!rows.length) throw new Error("Someone else already took this bet.");
  },


  /* ----- admin page ----- */

  updateMatch: (id, changes) =>
    writeChecked(supabaseClient.from("matches").update(changes).eq("id", id)),

  updateVehicle: (id, changes) =>
    writeChecked(supabaseClient.from("vehicles").update(changes).eq("id", id)),

  /** `settingsRow` is the row returned by Data.settings(); we update it by its id. */
  updateSettings: (settingsRow, changes) =>
    writeChecked(supabaseClient.from("settings").update(changes).eq("id", settingsRow.id)),

  /**
   * Record a race result:
   *   1. set winner_id on the match
   *   2. copy the winner into the next match (slot a or b)
   *   3. if there is no next match, this was the final, so the tournament is over
   */
  async setWinner(match, winnerId, settingsRow) {
    await Data.updateMatch(match.id, { winner_id: winnerId });
    if (match.next_match_id) {
      await Data.updateMatch(match.next_match_id, { [slotColumn(match.next_slot)]: winnerId });
    } else {
      await Data.updateSettings(settingsRow, { tournament_over: true });
    }
  },

  /**
   * Undo a result: the exact reverse of setWinner.
   * The admin page only offers this while the next match has no winner yet,
   * otherwise the bracket further up would point at a car that "didn't win".
   */
  async clearWinner(match, settingsRow) {
    await Data.updateMatch(match.id, { winner_id: null });
    if (match.next_match_id) {
      await Data.updateMatch(match.next_match_id, { [slotColumn(match.next_slot)]: null });
    } else {
      await Data.updateSettings(settingsRow, { tournament_over: false });
    }
  },
};
