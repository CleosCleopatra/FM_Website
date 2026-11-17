/* =====================================================================
   betting.js: the Betting page (betting.html).

   How a bet works, in terms of the bets table:
     - Someone offers a bet → a new row with creator_name + creator_stake.
       taker_name is empty, so the bet is "open" (waiting for a taker).
     - Someone else takes it → taker_name + taker_stake are filled in,
       and the bet is "on".
     - A bet is about either one vehicle (vehicle_id) or a whole
       makerspace (makerspace). The other column stays empty.
     - "Wins their race" bets also store which match they're about (match_id).
   Bet types and their sentences come from BET_TYPES in config.js.
   ===================================================================== */

// Everything the page needs between refreshes, in one place.
const state = {
  vehicles: [],
  matches: [],
  settings: {},
  bets: [],
  betOn: "vehicle",   // what the offer form bets on: "vehicle" or "makerspace"
  showList: "open",   // which list is shown: "open" (waiting) or "taken" (bet is on)
  takingBetId: null,  // id of the bet whose "take" form is open, or null
};


/* ---------- loading ---------- */

/** Fetch all data, then refresh the form's dropdown (first time only) and the bet list. */
async function loadBetting() {
  const [vehicles, matches, settings, bets] = await Promise.all([
    Data.vehicles(),
    Data.matches(),
    Data.settings(),
    Data.bets(),
  ]);
  const firstLoad = !state.vehicles.length;
  Object.assign(state, { vehicles, matches, settings, bets });

  // Fill the vehicle dropdown once; refilling it every refresh would reset the user's choice.
  if (firstLoad) fillSubjectList();

  // Skip redrawing while someone is typing into a "take" form, or their text would vanish.
  if (!state.takingBetId) showBets();
}


/* ---------- the offer form ---------- */

/** Unique makerspace names from the vehicles table, sorted A–Z. */
function makerspaces() {
  return [...new Set(state.vehicles.map((v) => v.makerspace).filter(Boolean))].sort();
}

/** Fill the "Vehicle" / "Makerspace" dropdown depending on which chip is selected. */
function fillSubjectList() {
  const select = $("#betSubject");
  if (state.betOn === "vehicle") {
    $("#betSubjectLabel").textContent = "Vehicle";
    select.innerHTML = state.vehicles
      .map((v) => `<option value="${escapeHtml(v.id)}">${escapeHtml(v.name)}</option>`)
      .join("");
  } else {
    $("#betSubjectLabel").textContent = "Makerspace";
    select.innerHTML = makerspaces()
      .map((m) => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`)
      .join("");
  }
  updatePreview();
}

/** Show the bet as a sentence under the form, e.g. “car_name_3 breaks down”. */
function updatePreview() {
  const draft = state.betOn === "vehicle"
    ? { type: $("#betType").value, vehicle_id: $("#betSubject").value }
    : { type: $("#betType").value, makerspace: $("#betSubject").value };
  $("#betPreview").textContent = `“${describeBet(draft)}”`;
}

/**
 * Turn a bet row into its sentence using BET_TYPES from config.js.
 * Makerspace bets use the makerspace name; vehicle bets look up the vehicle name.
 */
function describeBet(bet) {
  const type = BET_TYPES.find((t) => t.id === bet.type) || BET_TYPES[0];
  if (bet.makerspace) return type.text(bet.makerspace, true);
  const vehicle = findIn(makeLookup(state.vehicles), bet.vehicle_id);
  return type.text(vehicle ? vehicle.name : "?", false);
}

/**
 * Which match a "wins their race" bet on a vehicle is about:
 * the vehicle's next undecided match, or the current race as a fallback.
 */
function matchForBet(vehicleId) {
  const open = state.matches.find((m) =>
    m.winner_id == null &&
    [String(m.vehicle_a_id), String(m.vehicle_b_id)].includes(String(vehicleId)));
  return open ? open.id : state.settings.current_match ?? null;
}

/** Submit handler for the offer form: check the input, then save the bet. */
async function offerBet(event) {
  event.preventDefault(); // handle the form in JS instead of reloading the page

  const name = $("#yourName").value.trim();
  const stake = $("#yourStake").value.trim();

  // Basic checks, with a message explaining what to fix.
  if (!name) return showMessage("Write your name so people know who to collect from.", true);
  if (stake.length < 2) return showMessage("Say what you put up, for example a screwdriver.", true);
  if (MONEY_WORDS.test(stake)) return showMessage("No money. Bet a snack, a tool or your dignity.", true);

  const type = $("#betType").value;
  const subject = $("#betSubject").value; // a vehicle id or a makerspace name
  const isVehicleBet = state.betOn === "vehicle";

  // Only "wins their race" bets are tied to a match.
  let matchId = null;
  if (type === "race_win") {
    matchId = isVehicleBet ? matchForBet(subject) : state.settings.current_match ?? null;
  }

  const bet = {
    type,
    creator_name: name,
    creator_stake: stake,
    vehicle_id: isVehicleBet ? subject : null,
    makerspace: isVehicleBet ? null : subject,
    match_id: matchId,
  };

  try {
    await Data.addBet(bet);
    Remember.set("name", name);   // pre-fill the name next time
    $("#yourStake").value = "";
    showMessage("Your bet is on the board. It counts once someone takes it.");
    state.showList = "open";      // switch to the list where the new bet appears
    await loadBetting();
  } catch (error) {
    console.error(error);
    showMessage("Couldn't save your bet. Try again.", true);
  }
}


/* ---------- the list of bets ---------- */

/** Split bets into open/taken, update the tab counts, and draw the chosen list. */
function showBets() {
  const open = state.bets.filter((b) => !b.taker_name);
  const taken = state.bets.filter((b) => b.taker_name);

  $("#countOpen").textContent = `(${open.length})`;
  $("#countTaken").textContent = `(${taken.length})`;
  document.querySelectorAll("[data-list]").forEach((tab) =>
    tab.setAttribute("aria-pressed", String(tab.dataset.list === state.showList)));

  const list = state.showList === "open" ? open : taken;
  const emptyText = state.showList === "open" ? "No open bets. Offer one above." : "No bets are on yet.";
  $("#bets").innerHTML = list.length ? list.map(betCard).join("") : `<div class="empty-note">${emptyText}</div>`;
}

/**
 * HTML for one bet card. The bottom part depends on the bet's state:
 *   - taken                    → nothing (both stakes are shown)
 *   - open, take form opened   → name + stake inputs and "Take the bet"
 *   - open                     → "I'll take that bet" button
 */
function betCard(bet) {
  const isTaken = Boolean(bet.taker_name);

  const takerSide = isTaken
    ? `<div class="stake"><small>${escapeHtml(bet.taker_name)} puts up</small>${escapeHtml(bet.taker_stake)}</div>`
    : `<div class="stake is-open"><small>Against</small>Nobody yet</div>`;

  let bottom = "";
  if (!isTaken && state.takingBetId === String(bet.id)) {
    bottom = `
      <form class="take-form" data-take="${escapeHtml(bet.id)}" novalidate>
        <div class="two-columns">
          <label class="field" for="takeName">Your name<input id="takeName" maxlength="40" value="${escapeHtml(Remember.get("name") || "")}"></label>
          <label class="field" for="takeStake">You put up<input id="takeStake" maxlength="60" placeholder="A screwdriver"></label>
        </div>
        <div class="take-actions"><button class="button button--red" type="submit">Take the bet</button><button class="button button--ghost" type="button" data-cancel>Cancel</button></div>
      </form>`;
  } else if (!isTaken) {
    bottom = `<div class="bet-actions"><button class="button button--red" data-start-take="${escapeHtml(bet.id)}">I'll take that bet</button></div>`;
  }

  return `
    <article class="bet">
      <div class="bet-top"><span>${escapeHtml(bet.creator_name)} bets</span><span class="bet-status ${isTaken ? "is-on" : ""}">${isTaken ? "Bet is on" : "Waiting"}</span></div>
      <p class="bet-claim">${escapeHtml(describeBet(bet))}</p>
      <div class="stakes">
        <div class="stake"><small>Puts up</small>${escapeHtml(bet.creator_stake)}</div>
        <span class="vs">VS</span>
        ${takerSide}
      </div>
      ${bottom}
    </article>`;
}

/** Submit handler for a "take" form: check the input, then claim the bet. */
async function takeBet(form) {
  const name = $("#takeName", form).value.trim();
  const stake = $("#takeStake", form).value.trim();
  if (!name) return showMessage("Write your name to take the bet.", true);
  if (stake.length < 2) return showMessage("Say what you put up.", true);
  if (MONEY_WORDS.test(stake)) return showMessage("No money. Bet a snack, a tool or your dignity.", true);

  try {
    // Fails with "Someone else already took this bet." if we were too late (see db.js).
    await Data.takeBet(form.dataset.take, name, stake);
    Remember.set("name", name);
    state.takingBetId = null;
    showMessage("Bet is on! Good luck.");
    await loadBetting();
  } catch (error) {
    console.error(error);
    showMessage(error.message || "Couldn't take the bet. Try again.", true);
  }
}


/* ---------- wiring up the page ---------- */

// Fill the bet-type dropdown from BET_TYPES and pre-fill a remembered name.
$("#betType").innerHTML = BET_TYPES
  .map((t) => `<option value="${t.id}">${escapeHtml(t.label.toLowerCase())}</option>`)
  .join("");
$("#yourName").value = Remember.get("name") || "";

$("#betForm").addEventListener("submit", offerBet);
$("#betType").addEventListener("change", updatePreview);
$("#betSubject").addEventListener("change", updatePreview);

// One click listener for all buttons on the page (they are re-created on every refresh).
document.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;

  // "A vehicle" / "A whole makerspace" chips
  if (target.dataset.betOn) {
    state.betOn = target.dataset.betOn;
    document.querySelectorAll("[data-bet-on]").forEach((b) => b.setAttribute("aria-pressed", String(b === target)));
    fillSubjectList();
  }
  // "Waiting for a taker" / "Bets on" tabs
  if (target.dataset.list) {
    state.showList = target.dataset.list;
    state.takingBetId = null;
    showBets();
  }
  // "I'll take that bet" opens the take form for that bet
  if (target.dataset.startTake) {
    state.takingBetId = target.dataset.startTake;
    showBets();
    $("#takeStake")?.focus();
  }
  // "Cancel" closes the take form
  if (target.hasAttribute("data-cancel")) {
    state.takingBetId = null;
    showBets();
  }
});

// Take forms are created dynamically, so catch their submit on the document too.
document.addEventListener("submit", (event) => {
  if (event.target.matches("[data-take]")) {
    event.preventDefault();
    takeBet(event.target);
  }
});


/* ---------- start ---------- */

refreshEvery(loadBetting);
