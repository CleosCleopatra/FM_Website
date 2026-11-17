/* =====================================================================
   vote.js: the Vote page (vote.html).

   One box per row in the categories table. Each box shows the top 3
   vehicles by votes, and a list of all vehicles to vote for.

   There is no login, so the votes table doesn't know who voted. To stop
   people voting over and over, this browser remembers which categories it
   has voted in (localStorage key "fm-vote-<category id>") and hides the
   choices afterwards. Someone could still vote again from another browser.
   ===================================================================== */

// Kept so categoryBox() can list every vehicle as a choice.
let vehicleList = [];


/* ---------- loading ---------- */

/** Fetch categories, votes and vehicles, then draw one box per category. */
async function loadVotes() {
  const [categories, votes, vehicles] = await Promise.all([
    Data.categories(),
    Data.votes(),
    Data.vehicles(),
  ]);
  vehicleList = vehicles;
  const vehicleById = makeLookup(vehicles);

  if (!categories.length) {
    $("#categories").innerHTML = `<div class="empty-note">No categories yet. Add them in the Supabase categories table.</div>`;
    return;
  }
  $("#categories").innerHTML = categories
    .map((category) => categoryBox(category, votes, vehicleById))
    .join("");
}


/* ---------- one category ---------- */

/**
 * HTML for one category box:
 *   1. count this category's votes per vehicle and sort, most votes first
 *   2. draw the top 3 as bars (the leader's bar is full width)
 *   3. show either "You voted for X" or the list of vehicles to vote for
 */
function categoryBox(category, votes, vehicleById) {
  // Step 1: tally. counts = { vehicleId: numberOfVotes }
  const counts = {};
  for (const vote of votes) {
    if (String(vote.category_id) === String(category.id)) {
      counts[vote.vehicle_id] = (counts[vote.vehicle_id] || 0) + 1;
    }
  }
  const ranking = Object.entries(counts).sort((a, b) => b[1] - a[1]); // [[vehicleId, count], ...]
  const total = ranking.reduce((sum, [, count]) => sum + count, 0);
  const most = ranking.length ? ranking[0][1] : 1; // the leader's count, used to scale the bars

  // Step 2: top-3 bars. Bars never go below 8% wide so the name stays readable.
  const topThree = ranking.slice(0, 3).map(([vehicleId, count], index) => {
    const vehicle = findIn(vehicleById, vehicleId);
    const width = Math.max(8, (count / most) * 100);
    return `
      <div class="standing">
        <b>${index + 1}</b>
        <div class="standing-bar">
          <div class="standing-fill" style="width:${width}%"></div>
          <span class="standing-name">${escapeHtml(vehicle ? vehicle.name : "Unknown")}</span>
        </div>
        <span class="standing-count">${count}</span>
      </div>`;
  }).join("") || `<div class="empty-note">No votes yet. Be the first.</div>`;

  // Step 3: has this browser already voted in this category?
  const myVote = findIn(vehicleById, Remember.get("vote-" + category.id));
  const choices = myVote
    ? `<p class="your-vote">You voted for <b>${escapeHtml(myVote.name)}</b>.</p>`
    : `<div class="choices">${vehicleList.map((v) =>
        `<button class="choice" data-category="${escapeHtml(category.id)}" data-vehicle="${escapeHtml(v.id)}">${escapeHtml(v.name)}</button>`
      ).join("")}</div>`;

  return `
    <section class="box">
      <div class="box-bar"><h2>${escapeHtml(category.name)}</h2><span>${total} vote${total === 1 ? "" : "s"}</span></div>
      <div class="box-body">${topThree}${choices}</div>
    </section>`;
}


/* ---------- casting a vote ---------- */

// One click listener for the whole page (event delegation): the choice buttons
// are re-created on every refresh, so listening on each button wouldn't last.
document.addEventListener("click", async (event) => {
  const button = event.target.closest(".choice");
  if (!button) return;

  const { category, vehicle } = button.dataset;
  button.disabled = true; // stop double clicks while saving

  try {
    await Data.addVote(category, vehicle);
    Remember.set("vote-" + category, vehicle); // remember so the choices hide
    await loadVotes();                          // redraw with the new count
  } catch (error) {
    console.error(error);
    button.disabled = false;
    showMessage("Your vote didn't go through. Try again.", true);
  }
});


/* ---------- start ---------- */

refreshEvery(loadVotes);
