/* =====================================================================
   TEMPLATE PAGE SCRIPT: copy this file for a new page (see template.html).

   The pattern every page follows:
     1. load...() fetches what it needs through Data (js/db.js)
     2. it builds HTML and puts it into an element with an id
     3. refreshEvery(load...) runs it now and again every few seconds
   ===================================================================== */

async function loadPage() {
  // ADD: fetch the data this page needs. Available readers in js/db.js:
  //   Data.vehicles()  Data.matches()  Data.categories()  Data.votes()  Data.bets()  Data.settings()
  // Need a new table? Add a reader to the Data object in js/db.js, e.g.
  //   schedule: () => readTable("schedule", (q) => q.order("starts_at")),
  const vehicles = await Data.vehicles();

  // ADD: turn the data into HTML. Always wrap database text in escapeHtml().
  $("#content").innerHTML = vehicles.length
    ? vehicles.map((v) => `<p>${escapeHtml(v.name)}</p>`).join("")
    : `<div class="empty-note">Nothing here yet.</div>`;
}

// ADD: buttons. One listener for the whole page, then check which button was clicked.
document.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-example]");
  if (!button) return;
  showMessage(`You clicked ${button.dataset.example}.`);
});

refreshEvery(loadPage);
