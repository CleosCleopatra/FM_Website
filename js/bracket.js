/* =====================================================================
   bracket.js: the Bracket page (bracket.html).

   Draws the matches table as a tournament tree. Read only: winners are
   recorded on the admin page.

   How the layout works (see css/bracket.css):
     The bracket is a CSS grid with 2 columns per first-round match
     (8 matches → 16 columns). A match in a later round spans the columns
     of the two matches that feed into it, so each box sits centred above
     its two "children" without any position maths.
     Rows are drawn top to bottom: champion, final, semis, quarters, round 1.
   ===================================================================== */

/** Fetch vehicles and matches, then build the whole bracket as one HTML string. */
async function loadBracket() {
  const [vehicles, matches] = await Promise.all([Data.vehicles(), Data.matches()]);
  const vehicleById = makeLookup(vehicles);

  if (!matches.length) {
    $("#bracket").innerHTML = `<div class="empty-note" style="grid-column:1/-1">No matches yet. Add them in the Supabase matches table.</div>`;
    return;
  }

  // Group matches by round number: { 1: [8 matches], 2: [4], 3: [2], 4: [1] }
  const rounds = {};
  for (const match of matches) {
    (rounds[match.round] ||= []).push(match);
  }
  const roundNumbers = Object.keys(rounds).map(Number).sort((a, b) => a - b);
  const firstRound = roundNumbers[0];
  const lastRound = roundNumbers.at(-1);

  // Two grid columns per first-round match (one per car).
  const columns = rounds[firstRound].length * 2;

  // The champion is the winner of the only match in the last round.
  const final = rounds[lastRound][0];
  const champion = final && findIn(vehicleById, final.winner_id);

  // Top row: the champion box, spanning the full width, with a single line down to the final.
  let html = `
    <div class="round-label">Champion</div>
    <div class="bracket-cell" style="grid-column: 1 / -1">
      <div class="champion ${champion ? "has-winner" : ""}">${champion ? "🏆 " + escapeHtml(champion.name) : "Champion"}</div>
      <div class="join join--single"></div>
    </div>`;

  // Then one row per round, from the final (top) down to the first round (bottom).
  for (const round of [...roundNumbers].reverse()) {
    const list = rounds[round].sort((a, b) => a.position - b.position);
    const span = columns / list.length; // how many columns each match box covers in this round
    const isFirst = round === firstRound;

    html += `<div class="round-label">${roundName(list.length)}</div>`;

    list.forEach((match, index) => {
      // grid-column: start / span N → e.g. the 2nd quarterfinal covers columns 5–8.
      // Every round except the first gets the forked lines ("join") down to its two children.
      html += `
        <div class="bracket-cell" style="grid-column: ${index * span + 1} / span ${span}">
          ${matchBox(match, vehicleById, isFirst)}
          ${isFirst ? "" : `<div class="join"></div>`}
        </div>`;
    });
  }

  $("#bracket").innerHTML = html;
}

/**
 * HTML for one match: a row for car A and a row for car B.
 * Each row gets a state class used by the CSS:
 *   is-empty  → slot not filled yet (winner of an earlier race not known)
 *   is-winner → highlighted yellow
 *   is-loser  → greyed out and struck through
 * First-round matches also show the vehicle pictures side by side.
 */
function matchBox(match, vehicleById, isFirstRound) {
  const cars = [match.vehicle_a_id, match.vehicle_b_id].map((id) => {
    const vehicle = findIn(vehicleById, id);

    let state = "";
    if (!vehicle) state = "is-empty";
    else if (match.winner_id != null) state = String(match.winner_id) === String(id) ? "is-winner" : "is-loser";

    const name = escapeHtml(vehicle ? vehicle.name : "—");
    if (isFirstRound) {
      return `<div class="match-car ${state}">${vehiclePicture(vehicle)}<span>${name}</span></div>`;
    }
    return `<div class="match-car ${state}">${name}</div>`;
  });

  return `<div class="match ${isFirstRound ? "match--first" : ""}">${cars.join("")}</div>`;
}

// Reload now and every REFRESH_MS, so results from /admin appear by themselves.
refreshEvery(loadBracket);
