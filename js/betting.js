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
       The person offering the bet picks the race in the "Which race" list,
       which only shows undecided races that the car (or a car from the
       makerspace) is actually in.
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
  saving: false,      // true while a bet is being saved, so a double click can't save it twice
};


/* ---------- loading ---------- */

/** Fetch all data into `state` without redrawing anything. */
async function loadData() {
  const [vehicles, matches, settings, bets] = await Promise.all([
    Data.vehicles(),
    Data.matches(),
    Data.settings(),
    Data.bets(),
  ]);
  Object.assign(state, { vehicles, matches, settings, bets });
}

/** Fetch all data, then refresh the form's dropdowns and the bet list. */
async function loadBetting() {
  await loadData();

  // Refill the dropdowns (they keep the user's choice), so new cars and races show up.
  fillSubjectList();

  // If the bet someone is about to take was taken or decided in the meantime,
  // close their form and tell them, instead of leaving an out-of-date form on screen.
  if (state.takingBetId && !state.saving && !canStillBeTaken(findBet(state.takingBetId))) {
    state.takingBetId = null;
    showMessage("That bet was just taken by someone else or decided, so it can't be taken any more.", true);
  }

  // Skip redrawing while someone is typing into a "take" form, or their text would vanish.
  if (!state.takingBetId) showBets();
}


/* ---------- small helpers ---------- */

/** A bet from state.bets by id, or null. */
function findBet(id) {
  return state.bets.find((b) => String(b.id) === String(id)) || null;
}

/** An open bet can be taken while nobody has taken it and its result isn't in yet. */
function canStillBeTaken(bet) {
  return Boolean(bet && !bet.taker_name && !betResult(bet));
}

/** The vehicle ids a bet is about: one car, or every car of a makerspace. */
function subjectIds(bet) {
  if (bet.makerspace) {
    return state.vehicles.filter((v) => v.makerspace === bet.makerspace).map((v) => String(v.id));
  }
  return bet.vehicle_id == null ? [] : [String(bet.vehicle_id)];
}

/** True when a car has lost a race (so it's out of the tournament). */
function isOut(vehicleId) {
  return state.matches.some((m) =>
    m.winner_id != null &&
    String(m.winner_id) !== String(vehicleId) &&
    [String(m.vehicle_a_id), String(m.vehicle_b_id)].includes(String(vehicleId)));
}

/** "Round of 16: Betongsuggan vs El mini bike", used in the "Which race" list. */
function raceTitle(match) {
  const vehicles = makeLookup(state.vehicles);
  const name = (id) => findIn(vehicles, id)?.name || "To be decided";
  const inRound = state.matches.filter((m) => m.round === match.round).length;
  return `${roundName(inRound)}: ${name(match.vehicle_a_id)} vs ${name(match.vehicle_b_id)}`;
}


/* ---------- the offer form ---------- */

/** Unique makerspace names from the vehicles table, sorted A–Z. */
function makerspaces() {
  return [...new Set(state.vehicles.map((v) => v.makerspace).filter(Boolean))].sort();
}

/**
 * Fill the "Vehicle" / "Makerspace" dropdown depending on which chip is selected.
 * Keeps the current choice when it's still in the list, so the 10-second
 * refresh never changes what someone picked.
 */
function fillSubjectList() {
  const select = $("#betSubject");
  if (document.activeElement !== select) {
    const before = select.value;
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
    if ([...select.options].some((o) => o.value === before)) select.value = before;
  }
  updatePreview();
}

/**
 * The races a "wins their race" bet can be about: undecided matches that the
 * chosen car is in, or (for a makerspace) that any of its cars is in.
 */
function raceChoices() {
  const draft = state.betOn === "vehicle"
    ? { vehicle_id: $("#betSubject").value }
    : { makerspace: $("#betSubject").value };
  const ids = subjectIds(draft);
  return state.matches.filter((m) =>
    m.winner_id == null &&
    (ids.includes(String(m.vehicle_a_id)) || ids.includes(String(m.vehicle_b_id))));
}

/** Show the "Which race" list only for "wins their race" bets, and fill it. */
function fillRaceList() {
  const isRaceBet = $("#betType").value === "race_win";
  $("#betRaceField").hidden = !isRaceBet;
  if (!isRaceBet) return;

  const select = $("#betRace");
  if (document.activeElement === select) return; // don't rebuild it while it's open

  const before = select.value;
  const races = raceChoices();
  select.innerHTML = races.length
    ? races.map((m) => `<option value="${escapeHtml(m.id)}">${escapeHtml(raceTitle(m))}</option>`).join("")
    : `<option value="">No race coming up</option>`;
  if (races.some((m) => String(m.id) === before)) select.value = before;
}

/** Show the bet as a sentence under the form, e.g. “car_name_3 breaks down”. */
function updatePreview() {
  fillRaceList();
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
 * Why a new bet can't be offered, or null if it's fine.
 * Stops bets whose answer is already known (a car that already broke down,
 * a finished race) and bets on cars that are already out.
 */
function whyBetIsClosed(bet) {
  if (betResult(bet)) return "That's already decided, so you can't bet on it any more.";
  if (bet.type === "tournament_win") {
    const ids = subjectIds(bet);
    if (ids.length && ids.every(isOut)) {
      const car = findIn(makeLookup(state.vehicles), bet.vehicle_id);
      return bet.makerspace
        ? `Every ${bet.makerspace} car is already out of the tournament.`
        : `${car ? car.name : "That car"} is already out of the tournament.`;
    }
  }
  return null;
}

/* ---------- who won a bet ---------- */

/**
 * Work out a bet's result from data that's already there:
 *   race_win       → the bet's match has a winner (matches.winner_id)
 *   tournament_win → the final has a winner
 *   breaks         → the car (or any car of the makerspace) is marked broken;
 *                    if none broke by the end of the tournament, the taker wins
 *   fastest_lap    → decided at the end of the tournament (settings.best_lap_vehicle_id),
 *                    since the fastest lap can still be beaten until then
 * Returns "creator", "taker", or null while it's still undecided.
 */
function betResult(bet) {
  const vehicles = makeLookup(state.vehicles);
  const over = Boolean(state.settings.tournament_over);

  // Does a vehicle id match what the bet is about (one car, or a makerspace)?
  const isSubject = (vehicleId) => {
    if (vehicleId == null) return false;
    if (bet.makerspace) {
      const v = findIn(vehicles, vehicleId);
      return Boolean(v && v.makerspace === bet.makerspace);
    }
    return String(vehicleId) === String(bet.vehicle_id);
  };
  const outcome = (creatorRight) => (creatorRight ? "creator" : "taker");

  switch (bet.type) {
    case "race_win": {
      const match = state.matches.find((m) => String(m.id) === String(bet.match_id));
      return match && match.winner_id != null ? outcome(isSubject(match.winner_id)) : null;
    }
    case "tournament_win": {
      const final = state.matches.find((m) => m.next_match_id == null);
      return final && final.winner_id != null ? outcome(isSubject(final.winner_id)) : null;
    }
    case "breaks": {
      const broke = state.vehicles.some((v) => v.broken && isSubject(v.id));
      if (broke) return "creator";
      return over ? "taker" : null;
    }
    case "fastest_lap":
      return over ? outcome(isSubject(state.settings.best_lap_vehicle_id)) : null;
    default:
      return null;
  }
}


/** Submit handler for the offer form: check the input, then save the bet. */
async function offerBet(event) {
  event.preventDefault(); // handle the form in JS instead of reloading the page
  if (state.saving) return; // a double click: the first click is already saving

  const name = $("#yourName").value.trim();
  const stake = $("#yourStake").value.trim();

  // Basic checks, with a message explaining what to fix.
  if (!name) return showMessage("Write your name so people know who to collect from.", true);
  if (stake.length < 2) return showMessage("Say what you put up, for example a screwdriver.", true);
  if (MONEY_WORDS.test(stake)) return showMessage("No money. Bet a snack, a tool or your dignity.", true);

  const type = $("#betType").value;
  const subject = $("#betSubject").value; // a vehicle id or a makerspace name
  const isVehicleBet = state.betOn === "vehicle";

  // Only "wins their race" bets are tied to a match: the one picked in "Which race".
  let matchId = null;
  if (type === "race_win") {
    matchId = $("#betRace").value || null;
    if (!matchId) {
      return showMessage(isVehicleBet
        ? "That car has no race coming up, so you can't bet on it winning one."
        : "No car from that makerspace has a race coming up.", true);
    }
  }

  const bet = {
    type,
    creator_name: name,
    creator_stake: stake,
    vehicle_id: isVehicleBet ? subject : null,
    makerspace: isVehicleBet ? null : subject,
    match_id: matchId,
  };

  const closed = whyBetIsClosed(bet);
  if (closed) return showMessage(closed, true);

  // Lock the button while saving, so a double click can't put the bet up twice.
  const button = $('#betForm [type="submit"]');
  state.saving = true;
  button.disabled = true;
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
  } finally {
    state.saving = false;
    button.disabled = false;
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
  const result = betResult(bet);

  // A taken bet with a result: show who won and what they collect.
  if (isTaken && result) {
    const winner = result === "creator" ? bet.creator_name : bet.taker_name;
    const loser = result === "creator" ? bet.taker_name : bet.creator_name;
    const prize = result === "creator" ? bet.taker_stake : bet.creator_stake;
    return `
    <article class="bet is-settled">
      <div class="bet-top"><span>${escapeHtml(bet.creator_name)} bet</span><span class="bet-status is-won">${escapeHtml(winner)} won</span></div>
      <p class="bet-claim">${escapeHtml(describeBet(bet))}</p>
      <div class="bet-result">${result === "creator" ? "It happened!" : "It didn't happen."} <b>${escapeHtml(winner)}</b> collects <b>${escapeHtml(prize)}</b> from ${escapeHtml(loser)}.</div>
    </article>`;
  }

  // An open bet whose outcome is already known can't be taken any more.
  if (!isTaken && result) {
    return `
    <article class="bet is-settled">
      <div class="bet-top"><span>${escapeHtml(bet.creator_name)} bets</span><span class="bet-status">Closed</span></div>
      <p class="bet-claim">${escapeHtml(describeBet(bet))}</p>
      <div class="bet-result">Nobody took this bet before the result was in.</div>
    </article>`;
  }

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
  if (state.saving) return; // a double click: the first click is already saving

  const betId = form.dataset.take;
  const name = $("#takeName", form).value.trim();
  const stake = $("#takeStake", form).value.trim();
  if (!name) return showMessage("Write your name to take the bet.", true);
  if (stake.length < 2) return showMessage("Say what you put up.", true);
  if (MONEY_WORDS.test(stake)) return showMessage("No money. Bet a snack, a tool or your dignity.", true);

  const bet = findBet(betId);
  if (bet && name.toLowerCase() === String(bet.creator_name).trim().toLowerCase()) {
    return showMessage("You can't take your own bet. Someone else has to.", true);
  }

  const button = $('[type="submit"]', form);
  state.saving = true;
  button.disabled = true;
  try {
    // Check against fresh data first: the result might have come in since the last refresh.
    await loadData();
    const fresh = findBet(betId);
    if (!fresh) throw new Error("This bet isn't on the board any more.");
    if (fresh.taker_name) throw new Error("Someone else already took this bet.");
    if (betResult(fresh)) throw new Error("Too late: the result is already in.");

    // Fails with "Someone else already took this bet." if we were too late (see db.js).
    await Data.takeBet(betId, name, stake);
    Remember.set("name", name);
    state.takingBetId = null;
    showMessage("Bet is on! Good luck.");
  } catch (error) {
    console.error(error);
    showMessage(error.message || "Couldn't take the bet. Try again.", true);
  } finally {
    state.saving = false;
    button.disabled = false;
    // Reload, and close the form if this bet can't be taken any more, so the
    // page never gets stuck showing an out-of-date form. If it failed for another
    // reason (no internet), the form stays open with what they typed.
    try { await loadData(); } catch (error) { console.error(error); }
    if (state.takingBetId && !canStillBeTaken(findBet(state.takingBetId))) state.takingBetId = null;
    if (!state.takingBetId) showBets();
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
