/* =====================================================================
   grid.js: the Grid page (grid.html).

   Lists every row of the vehicles table as a card. Read only: vehicles
   are added and edited in Supabase, not on the site.
   ===================================================================== */

/** Fetch all vehicles and draw one card per vehicle. */
async function loadGrid() {
  const vehicles = await Data.vehicles();

  // Friendly note instead of a blank page when the table is still empty.
  if (!vehicles.length) {
    $("#cars").innerHTML = `<div class="empty-note">No vehicles yet. Add them in the Supabase vehicles table.</div>`;
    return;
  }
  $("#cars").innerHTML = vehicles.map(vehicleCard).join("");
}

/**
 * HTML for one vehicle card: picture (or empty image box), a "Broke down"
 * stamp when vehicles.broken is true, then name, makerspace and the facts.
 * Missing text columns show "—"; an empty fun_fact is left out entirely.
 */
function vehicleCard(vehicle) {
  return `
    <article class="car">
      <div class="car-picture">
        ${vehiclePicture(vehicle)}
        ${vehicle.broken ? `<span class="broken-stamp">Broke down</span>` : ""}
      </div>
      <div class="car-info">
        <div>
          <h3>${escapeHtml(vehicle.name)}</h3>
          <div class="car-makerspace">${escapeHtml(vehicle.makerspace)}</div>
        </div>
        <dl class="car-facts">
          <dt>Driver</dt>     <dd>${escapeHtml(vehicle.driver || "—")}</dd>
          <dt>Powered by</dt> <dd>${escapeHtml(vehicle.powered_by || "—")}</dd>
          <dt>Reg nr</dt>     <dd>${escapeHtml(vehicle.reg_nr || "—")}</dd>
        </dl>
        ${vehicle.fun_fact ? `<p class="fun-fact">${escapeHtml(vehicle.fun_fact)}</p>` : ""}
      </div>
    </article>`;
}

// Reload now and every REFRESH_MS, so a breakdown marked on /admin shows up here.
refreshEvery(loadGrid);
