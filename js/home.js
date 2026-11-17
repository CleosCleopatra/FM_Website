/* =====================================================================
   home.js: the home page (index.html).

   What it shows:
     - the race card: settings.current_match → that match's two vehicles,
       plus a countdown to matches.starts_at
     - the best-lap bar: settings.best_lap_time + settings.best_lap_vehicle_id
   Empty values show the placeholder words from PLACEHOLDER in config.js.
   ===================================================================== */

// Start time of the current race in milliseconds, or null if not set.
// Kept outside the functions because the countdown ticks every second,
// while the data only reloads every REFRESH_MS.
let raceStartsAt = null;


/* ---------- loading ---------- */

/** Fetch everything the home page needs (in parallel) and draw it. */
async function loadHome() {
  const [vehicles, matches, settings] = await Promise.all([
    Data.vehicles(),
    Data.matches(),
    Data.settings(),
  ]);
  const vehicleById = makeLookup(vehicles);
  const matchById = makeLookup(matches);

  const currentMatch = findIn(matchById, settings.current_match);
  showRace(settings, currentMatch, vehicleById, matches);
  showBestLap(settings, vehicleById);
}


/* ---------- race card ---------- */

/**
 * Fill the race card. It has three possible states:
 *   1. tournament over → show the champion
 *   2. no current race chosen yet → short "coming soon" text
 *   3. normal → both cars, VS, and the countdown
 */
function showRace(settings, match, vehicleById, matches) {
  const content = $("#raceContent");

  // Event details, with placeholders for anything not filled in yet.
  const eventName = settings.event_name || PLACEHOLDER.eventName;
  const place = settings.event_place || PLACEHOLDER.eventPlace;
  const laps = settings.laps || PLACEHOLDER.laps;

  // Heading + place + laps: the same in all three states.
  // " laps" is only added after a real number, not after the placeholder word.
  const facts = `
    <h2 id="raceName">${escapeHtml(eventName)}</h2>
    <div class="race-facts">
      <span><img src="images/icon-pin.svg" alt="">${escapeHtml(place)}</span>
      <i class="divider" aria-hidden="true"></i>
      <span><img src="images/icon-flag.svg" alt="">${escapeHtml(laps)}${settings.laps ? " laps" : ""}</span>
    </div>`;

  // State 1: tournament over. The final is the only match without a next match.
  if (settings.tournament_over) {
    const final = matches.find((m) => !m.next_match_id && m.winner_id);
    const champion = final && findIn(vehicleById, final.winner_id);
    raceStartsAt = null;
    setTab("Champion", false);
    content.innerHTML = facts + `<div class="race-empty">🏆 ${escapeHtml(champion ? champion.name : "We have a winner")}</div>`;
    return;
  }

  // State 2: the admin hasn't picked a current race yet.
  if (!match) {
    raceStartsAt = null;
    setTab("Next race", false);
    content.innerHTML = facts + `<div class="race-empty">The next race will appear here soon.</div>`;
    return;
  }

  // State 3: normal race card.
  const carA = findIn(vehicleById, match.vehicle_a_id);
  const carB = findIn(vehicleById, match.vehicle_b_id);
  raceStartsAt = match.starts_at ? new Date(match.starts_at).getTime() : null;

  content.innerHTML = facts + `
    <div class="duel">
      ${carSide(carA)}
      <div class="versus" aria-label="versus">VS</div>
      ${carSide(carB)}
    </div>
    <div class="countdown"><small id="countdownLabel">Lights out in</small><b id="countdownTime">--:--:--</b></div>`;

  // Draw the countdown right away instead of waiting up to a second for the timer.
  updateCountdown();
}

/** One side of the duel: picture (or empty image box) and a slanted name plate. */
function carSide(vehicle) {
  // A slot can be empty in later rounds until the previous race is decided.
  const name = vehicle ? vehicle.name : "To be decided";
  return `<div class="duel-side">${vehiclePicture(vehicle)}<div class="name-plate">${escapeHtml(name)}</div></div>`;
}

/** Set the yellow tab text ("Next race" / "Current race" / "Champion"). isLive turns it red. */
function setTab(text, isLive) {
  const tab = $("#raceTab");
  tab.innerHTML = `${text} <i></i>`; // <i> is the little checker pattern
  tab.classList.toggle("is-live", isLive);
}


/* ---------- countdown ---------- */

/**
 * Update the countdown text. Called every second by setInterval below.
 * Before the start time it counts down; after it the card switches to LIVE.
 */
function updateCountdown() {
  const label = $("#countdownLabel");
  const time = $("#countdownTime");
  if (!label || !time) return; // the card is in the "champion" or "coming soon" state

  // No start time saved yet: show the placeholder.
  if (raceStartsAt == null) {
    setTab("Next race", false);
    label.textContent = "Start time";
    time.textContent = PLACEHOLDER.startTime;
    return;
  }

  const msLeft = raceStartsAt - Date.now();
  const isLive = msLeft <= 0;
  setTab(isLive ? "Current race" : "Next race", isLive);
  label.textContent = isLive ? "Live" : "Lights out in";
  label.classList.toggle("blink", isLive);
  time.textContent = isLive ? "ON TRACK" : formatDuration(msLeft);
}

/** Milliseconds → "HH:MM:SS". */
function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const twoDigits = (n) => String(n).padStart(2, "0");
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const seconds = totalSeconds % 60;
  return `${twoDigits(hours)}:${twoDigits(minutes)}:${twoDigits(seconds)}`;
}


/* ---------- best lap bar ---------- */

/** Fill the dark best-lap bar at the bottom of the page. */
function showBestLap(settings, vehicleById) {
  const holder = findIn(vehicleById, settings.best_lap_vehicle_id);
  $("#bestLap").innerHTML = `
    <img src="images/icon-stopwatch.svg" alt="">
    <div><small>Best lap so far:</small><span class="lap-time">${escapeHtml(settings.best_lap_time || PLACEHOLDER.bestLapTime)}</span></div>
    <div class="lap-holder">${escapeHtml(holder ? holder.name : PLACEHOLDER.bestLapVehicle)}</div>`;
}


/* ---------- start ---------- */

refreshEvery(loadHome);               // reload data now and every REFRESH_MS
setInterval(updateCountdown, 1000);   // tick the countdown every second
