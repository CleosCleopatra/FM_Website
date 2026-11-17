/* =====================================================================
   admin.js: the admin page (admin/index.html, opened at /admin).

   Sections on the page, in order:
     1. Races to decide   - matches with both cars and no winner: "X won" buttons
     2. Current race      - which match the home page shows, and its start time
     3. Breakdowns        - toggle vehicles.broken
     4. Fastest lap       - settings.best_lap_vehicle_id / best_lap_time
     5. Event details     - settings.event_name / event_place / laps
     6. Results so far    - decided matches, with Undo
   Every change is written straight to Supabase through db.js, then the
   page reloads its data so all sections stay in sync.
   ===================================================================== */

// Latest data from Supabase. formsFilled makes sure the forms (sections 4 and 5)
// are filled only once, so a refresh never overwrites something being typed.
const admin = { vehicles: [], matches: [], settings: {}, formsFilled: false };


/* ---------- loading ---------- */

/** Fetch vehicles, matches and settings, then redraw every section. */
async function loadAdmin() {
  const [vehicles, matches, settings] = await Promise.all([
    Data.vehicles(),
    Data.matches(),
    Data.settings(),
  ]);
  Object.assign(admin, { vehicles, matches, settings });

  showOpenMatches();
  showResults();
  showBreakdowns();
  fillCurrentRaceList();
  if (!admin.formsFilled) {
    fillForms();
    admin.formsFilled = true;
  }
}


/* ---------- small helpers ---------- */

/** A vehicle's name from its id, or "—" for an empty slot. */
const vehicleName = (id) => findIn(makeLookup(admin.vehicles), id)?.name || "—";

/** How many matches a round has (used to name it: 8 → "Round of 16"). */
const matchesInRound = (round) => admin.matches.filter((m) => m.round === round).length;

/** "Quarterfinals: car_name_1 vs car_name_3" - used in the current-race dropdown. */
const matchTitle = (m) =>
  `${roundName(matchesInRound(m.round))}: ${vehicleName(m.vehicle_a_id)} vs ${vehicleName(m.vehicle_b_id)}`;

/** A match is ready to be decided when both cars are known and there's no winner yet. */
const isReady = (m) => m.vehicle_a_id != null && m.vehicle_b_id != null && m.winner_id == null;

/**
 * Convert a timestamp from Supabase into the "YYYY-MM-DDTHH:MM" text that
 * <input type="datetime-local"> expects, in the visitor's local time.
 * toISOString() is always UTC, so we shift by the timezone offset first.
 */
function toInputTime(value) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

/**
 * Run a save action, show a success or error message, and reload.
 * Every button and form on this page goes through here, so error handling
 * lives in one place.
 */
async function save(action, successText) {
  try {
    await action();
    showMessage(successText);
    await loadAdmin();
  } catch (error) {
    console.error(error);
    showMessage(`Couldn't save: ${error.message || "unknown problem"}`, true);
  }
}


/* ---------- 1. races to decide ---------- */

/** List every ready match with a "won" button per car and a "Show on home page" button. */
function showOpenMatches() {
  const ready = admin.matches.filter(isReady);

  if (!ready.length) {
    const text = admin.settings.tournament_over ? "The tournament is over." : "No races waiting for a result.";
    $("#openMatches").innerHTML = `<div class="empty-note">${text}</div>`;
    return;
  }

  // The buttons carry the ids they need in data-attributes; the click handler at the bottom reads them.
  $("#openMatches").innerHTML = ready.map((m) => `
    <div class="decide">
      <span class="round-name">${roundName(matchesInRound(m.round))}</span>
      <p><b>${escapeHtml(vehicleName(m.vehicle_a_id))}</b> vs <b>${escapeHtml(vehicleName(m.vehicle_b_id))}</b></p>
      <div class="decide-buttons">
        <button class="button" data-winner="${escapeHtml(m.vehicle_a_id)}" data-match="${escapeHtml(m.id)}">${escapeHtml(vehicleName(m.vehicle_a_id))} won</button>
        <button class="button" data-winner="${escapeHtml(m.vehicle_b_id)}" data-match="${escapeHtml(m.id)}">${escapeHtml(vehicleName(m.vehicle_b_id))} won</button>
        <button class="button button--ghost" data-make-current="${escapeHtml(m.id)}">Show on home page</button>
      </div>
    </div>`).join("");
}


/* ---------- 2. current race ---------- */

/**
 * Fill the "Race shown on the home page" dropdown with the ready matches.
 * The currently chosen match is always kept in the list, even once it has
 * a winner, so the dropdown never jumps to a different race by itself.
 */
function fillCurrentRaceList() {
  const select = $("#currentMatch");
  if (document.activeElement === select) return; // don't rebuild it while it's open

  const chosen = select.value || String(admin.settings.current_match ?? "");
  const choices = admin.matches.filter((m) => isReady(m) || String(m.id) === chosen);

  select.innerHTML = `<option value="">No race</option>` +
    choices.map((m) => `<option value="${escapeHtml(m.id)}">${escapeHtml(matchTitle(m))}</option>`).join("");
  select.value = chosen;
}

/** Save which match is current (settings) and when it starts (matches.starts_at). */
function saveCurrentRace(event) {
  event.preventDefault();
  const matchId = $("#currentMatch").value || null;
  const timeText = $("#startsAt").value;
  const startsAt = timeText ? new Date(timeText).toISOString() : null; // local time → UTC timestamp

  save(async () => {
    await Data.updateSettings(admin.settings, { current_match: matchId });
    if (matchId) await Data.updateMatch(matchId, { starts_at: startsAt });
  }, "Current race saved.");
}


/* ---------- 3. breakdowns ---------- */

/** One toggle button per vehicle. aria-pressed="true" (red) means broken down. */
function showBreakdowns() {
  $("#breakdowns").innerHTML = admin.vehicles.map((v) =>
    `<button class="toggle" data-broken="${escapeHtml(v.id)}" aria-pressed="${Boolean(v.broken)}">${escapeHtml(v.name)}${v.broken ? " · broken" : ""}</button>`
  ).join("");
}


/* ---------- 4 and 5. fastest lap and event details ---------- */

/** Fill the forms with the saved values. Runs once, on the first load. */
function fillForms() {
  const s = admin.settings;

  // Fastest lap
  $("#lapVehicle").innerHTML = admin.vehicles
    .map((v) => `<option value="${escapeHtml(v.id)}">${escapeHtml(v.name)}</option>`)
    .join("");
  if (s.best_lap_vehicle_id != null) $("#lapVehicle").value = String(s.best_lap_vehicle_id);
  $("#lapTime").value = s.best_lap_time || "";

  // Event details (empty fields show the placeholder hints from the HTML)
  $("#eventName").value = s.event_name || "";
  $("#eventPlace").value = s.event_place || "";
  $("#eventLaps").value = s.laps || "";

  // Start time of the current race
  const current = findIn(makeLookup(admin.matches), s.current_match);
  $("#startsAt").value = toInputTime(current?.starts_at);
}

/** Save the fastest lap. The time must look like 1:12.487 (minutes:seconds.thousandths). */
function saveFastestLap(event) {
  event.preventDefault();
  const time = $("#lapTime").value.trim();
  if (!/^\d{1,2}:\d{2}\.\d{1,3}$/.test(time)) {
    return showMessage("Write the lap time like 1:12.487.", true);
  }
  save(() => Data.updateSettings(admin.settings, {
    best_lap_vehicle_id: $("#lapVehicle").value,
    best_lap_time: time,
  }), "Fastest lap saved.");
}

/** Save event name, place and laps. Empty fields are stored as null (→ placeholder on the site). */
function saveEvent(event) {
  event.preventDefault();
  save(() => Data.updateSettings(admin.settings, {
    event_name: $("#eventName").value.trim() || null,
    event_place: $("#eventPlace").value.trim() || null,
    laps: parseInt($("#eventLaps").value, 10) || null,
  }), "Event details saved.");
}


/* ---------- 6. results so far ---------- */

/**
 * List every decided match as "winner beat loser" with an Undo button.
 * Undo is disabled when the winner has already raced (and got a result)
 * in the next match: that later result must be undone first.
 */
function showResults() {
  const decided = admin.matches.filter((m) => m.winner_id != null);
  if (!decided.length) {
    $("#results").innerHTML = `<div class="empty-note">No results yet.</div>`;
    return;
  }

  const matchById = makeLookup(admin.matches);
  $("#results").innerHTML = decided.map((m) => {
    const loserId = String(m.winner_id) === String(m.vehicle_a_id) ? m.vehicle_b_id : m.vehicle_a_id;
    const next = findIn(matchById, m.next_match_id);
    const locked = next && next.winner_id != null;
    return `
      <div class="result">
        <span><span class="round-name">${roundName(matchesInRound(m.round))}</span><br><b>${escapeHtml(vehicleName(m.winner_id))}</b> beat ${escapeHtml(vehicleName(loserId))}</span>
        <button class="button button--ghost" data-undo="${escapeHtml(m.id)}" ${locked ? `disabled title="Undo the next race first"` : ""}>Undo</button>
      </div>`;
  }).join("");
}


/* ---------- buttons and forms ---------- */

// One click listener for every button on the page. Each button type is
// recognised by its data-attribute (data-winner, data-undo, ...).
document.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const matchById = makeLookup(admin.matches);

  // "X won": record the result and move X into the next match
  if (button.dataset.winner) {
    const match = findIn(matchById, button.dataset.match);
    save(() => Data.setWinner(match, button.dataset.winner, admin.settings),
      `Saved: ${vehicleName(button.dataset.winner)} won.`);
  }

  // "Undo": remove the result again
  if (button.dataset.undo) {
    const match = findIn(matchById, button.dataset.undo);
    save(() => Data.clearWinner(match, admin.settings), "Result removed.");
  }

  // Breakdown toggle: flip vehicles.broken
  if (button.dataset.broken) {
    const vehicle = findIn(makeLookup(admin.vehicles), button.dataset.broken);
    save(() => Data.updateVehicle(vehicle.id, { broken: !vehicle.broken }),
      vehicle.broken ? `${vehicle.name} is running again.` : `${vehicle.name} marked as broken down.`);
  }

  // "Show on home page": pre-select this match in section 2 (still needs Save)
  if (button.dataset.makeCurrent) {
    $("#currentMatch").value = button.dataset.makeCurrent;
    $("#currentRaceForm").scrollIntoView({ behavior: "smooth", block: "start" });
    $("#startsAt").focus();
    showMessage("Set the start time, then press Save current race.");
  }
});

$("#currentRaceForm").addEventListener("submit", saveCurrentRace);
$("#fastestLapForm").addEventListener("submit", saveFastestLap);
$("#eventForm").addEventListener("submit", saveEvent);


/* ---------- start ---------- */

refreshEvery(loadAdmin);
