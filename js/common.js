/* =====================================================================
   common.js: shared helpers used by every page.

   Loaded after config.js and db.js, and before the page's own script,
   so every function here is available as a global on every page.
   ===================================================================== */


/* ---------- DOM and text helpers ---------- */

/**
 * Shorthand for querySelector. `root` lets you search inside an element
 * instead of the whole document, e.g. $("#takeName", form).
 */
const $ = (selector, root = document) => root.querySelector(selector);

/**
 * Escape text before putting it into innerHTML.
 * Anything coming from Supabase (names, stakes, fun facts) was typed by a
 * person, so a name like "<img onerror=...>" must show as text, not run as HTML.
 */
function escapeHtml(text) {
  return String(text ?? "").replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}


/* ---------- looking rows up by id ---------- */

/**
 * Build a Map from a list of rows so we can find a row by id in one step
 * instead of searching the array every time.
 *
 * Keys are stored as strings because ids arrive in different forms:
 * from Supabase as numbers (3), from HTML data-attributes and <select>
 * values as strings ("3"). Converting both sides to strings makes them match.
 */
function makeLookup(rows) {
  return new Map(rows.map((row) => [String(row.id), row]));
}

/** Find a row in a lookup made by makeLookup(). Returns null if the id is empty or unknown. */
function findIn(lookup, id) {
  return id == null ? null : lookup.get(String(id)) || null;
}


/* ---------- status messages ---------- */

/**
 * Show a message in the page's <p id="message"> box.
 * Pass an empty string to hide it again. isError switches to the red style.
 */
function showMessage(text, isError = false) {
  const box = $("#message");
  if (!box) return; // page has no message box
  box.textContent = text;
  box.hidden = !text;
  box.classList.toggle("is-error", isError);
}


/* ---------- keeping pages up to date ---------- */

/**
 * Run a page's load function now, then again every REFRESH_MS (config.js).
 * This is how the site stays "live" without Supabase Realtime: each page
 * simply re-reads its data every few seconds.
 *
 * If a load fails (no internet, wrong keys) we show one error message and
 * keep trying. data-kind="load" marks the message as a loading error, so the
 * next successful load can clear it without wiping other messages
 * (like "Your bet is on the board").
 */
function refreshEvery(loadPage) {
  async function run() {
    try {
      await loadPage();
      if ($("#message")?.dataset.kind === "load") showMessage("");
    } catch (error) {
      console.error(error);
      showMessage("Can't reach the race database right now. Trying again…", true);
      const box = $("#message");
      if (box) box.dataset.kind = "load";
    }
  }
  run();
  setInterval(run, REFRESH_MS);
}


/* ---------- remembering things in this browser ---------- */

/**
 * Small wrapper around localStorage, used for the visitor's name on the
 * betting page and which categories they already voted in.
 * Keys get an "fm-" prefix so they don't clash with other sites' data.
 * The try/catch covers private browsing modes where localStorage throws.
 */
const Remember = {
  get(key) {
    try { return localStorage.getItem("fm-" + key); } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem("fm-" + key, value); } catch { /* storage unavailable: ignore */ }
  },
};


/* ---------- game rules shared by several pages ---------- */

/**
 * Bets must be objects or favours, never money.
 * Matches amounts with a currency ("20 kr", "5$", "50:-"), currency symbols,
 * and words like cash / money / swish / pengar. Case-insensitive.
 */
const MONEY_WORDS = /(\d\s*(kr|sek|:-|\$|€|£))|\b(kr|kronor|sek|money|cash|pengar|swish|dollars?|euros?)\b|[$€£]/i;

/**
 * Name a round from how many matches it contains, so the code doesn't
 * depend on how your rounds are numbered (8 matches → "Round of 16").
 */
function roundName(matchCount) {
  const names = { 1: "Final", 2: "Semifinals", 4: "Quarterfinals", 8: "Round of 16" };
  return names[matchCount] || `${matchCount * 2} cars left`;
}


/* ---------- vehicle pictures ---------- */

/**
 * HTML for a vehicle's picture.
 * Uses vehicles.image (a URL) when it's filled in; otherwise returns an
 * empty dashed box labelled "image" that marks where the photo will go.
 *
 * REPLACE: put a picture URL in vehicles.image in Supabase, e.g. a file in
 * Supabase Storage or images/cars/car_1.jpg inside this folder.
 */
function vehiclePicture(vehicle) {
  if (vehicle && vehicle.image) {
    return `<img class="picture" src="${escapeHtml(vehicle.image)}" alt="${escapeHtml(vehicle.name)}" loading="lazy">`;
  }
  return `<div class="picture picture--missing"><span>image</span></div>`;
}


/* ---------- the menu (top right on every page) ---------- */

/**
 * Wire up the MENU button and the menu panel.
 * Opens on button click; closes with the ✕ button, a click on the dark
 * backdrop, or the Escape key. aria-expanded tells screen readers whether
 * the menu is open.
 */
function setUpMenu() {
  const button = $("#menuButton");
  const panel = $("#menuPanel");
  if (!button || !panel) return; // the admin page has no menu

  function setOpen(open) {
    panel.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
  }

  button.addEventListener("click", () => setOpen(panel.hidden)); // toggle
  $("#menuClose")?.addEventListener("click", () => setOpen(false));

  // The panel element itself is the dark backdrop; the <nav> inside is the white box.
  // A click that lands on the backdrop (not inside the box) closes the menu.
  panel.addEventListener("click", (event) => { if (event.target === panel) setOpen(false); });

  document.addEventListener("keydown", (event) => { if (event.key === "Escape") setOpen(false); });
}

// Wait until the HTML is parsed so the menu elements exist.
document.addEventListener("DOMContentLoaded", setUpMenu);
