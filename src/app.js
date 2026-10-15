import { STAT_KEYS, NATURES, calculateStats } from "./stats.js";
import { mountGames } from "./games.js";

const icons = {
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  arrow: '<path d="M4 12h16m-5-5 5 5-5 5"/>',
  compare: '<path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  list: '<path d="M8 5h13M8 12h13M8 19h13M3 5h.01M3 12h.01M3 19h.01"/>',
  globe:
    '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  type: '<path d="m13 2-8 12h6l-1 8 9-13h-7z"/>',
  sliders:
    '<path d="M4 7h4m4 0h8M4 17h8m4 0h4"/><circle cx="10" cy="7" r="2"/><circle cx="14" cy="17" r="2"/>',
  shuffle:
    '<path d="m3 5 4 0 10 14h4m-4-4 4 4-4 3M3 19h4L17 5h4m-4-3 4 3-4 4"/>',
};
const svg = (name) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.plus}</svg>`;
const typeThemes = {
  grass: ["#e8f1df", "#eaf3e1", "#6a9251", "✦"],
  fire: ["#fbece2", "#fce8db", "#c77a50", "♨"],
  water: ["#e7f0f5", "#e3eff7", "#6694b3", "◈"],
  electric: ["#f7f1d9", "#faf0ca", "#b59a38", "ϟ"],
  normal: ["#f0eee6", "#eeeee7", "#90907a", "●"],
  fighting: ["#f6e5df", "#f6e6dd", "#b4826d", "✧"],
  flying: ["#ececf5", "#edeaf7", "#9990b5", "⌁"],
  poison: ["#f1e5f3", "#efe0f2", "#aa79b1", "◆"],
  ground: ["#f2e9dd", "#f2e5d2", "#a78b60", "▰"],
  rock: ["#eeeada", "#efead4", "#9d945f", "⬡"],
  bug: ["#edf1dc", "#edf1d8", "#929e55", "✤"],
  ghost: ["#eee8f3", "#e9e4f1", "#8c7fa8", "✧"],
  steel: ["#e5ecee", "#e3ebed", "#7a969e", "⬡"],
  psychic: ["#f8e6ed", "#f8e4ed", "#bd7a9a", "◉"],
  ice: ["#e6f3f1", "#def1ee", "#6eaaa5", "❋"],
  dragon: ["#e8e8f2", "#e5e3f3", "#8b80b3", "◆"],
  dark: ["#eae8e8", "#e8e5e5", "#8a7e7e", "☾"],
  fairy: ["#f7e8f0", "#f9e8f2", "#bd8baa", "✧"],
};
const regions = [
  "All regions",
  "Kanto",
  "Johto",
  "Hoenn",
  "Sinnoh",
  "Unova",
  "Kalos",
  "Alola",
  "Galar & Hisui",
  "Paldea",
];
const shortStats = {
  hp: "HP",
  attack: "Attack",
  defense: "Defense",
  specialAttack: "Sp. Atk",
  specialDefense: "Sp. Def",
  speed: "Speed",
};
const main = document.querySelector("main");
let pokemon = [],
  byId = new Map(),
  cleanupGame = null,
  visibleCount = 12,
  toastTimeout;
let filters = {
  query: "",
  generation: 0,
  type: "",
  sort: "featured",
  view: "grid",
};
let selected = [];
try {
  selected = JSON.parse(localStorage.getItem("rotom-compare") || "[]")
    .filter(Number.isInteger)
    .slice(0, 2);
} catch {}
let builds = [freshBuild(), freshBuild()];
let includeIVs = true,
  includeEVs = true;
function freshBuild() {
  return {
    level: 50,
    nature: "Hardy",
    ivs: Object.fromEntries(STAT_KEYS.map((k) => [k, 31])),
    evs: Object.fromEntries(STAT_KEYS.map((k) => [k, 0])),
  };
}
function esc(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
function searchKey(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/♀/g, "female")
    .replace(/♂/g, "male")
    .replace(/[^a-z0-9]/g, "");
}
function sumStats(p) {
  return STAT_KEYS.reduce((n, k) => n + p.stats[k], 0);
}
function art(p) {
  return (
    p.artwork ||
    `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${p.id}.png`
  );
}
function badges(p) {
  return `<div class="type-badges">${p.types.map((t) => `<span class="type-badge" style="--type-bg:${typeThemes[t]?.[1]};--type-color:${typeThemes[t]?.[2]};--type-icon:'${typeThemes[t]?.[3] || "•"}'">${esc(t)}</span>`).join("")}</div>`;
}
function remember() {
  try {
    localStorage.setItem("rotom-compare", JSON.stringify(selected));
  } catch {}
}
function notify(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("visible"), 2800);
}
function rotomDevice() {
  return `<div class="dex-device" aria-label="A cheerful Rotom Dex with the three Paldea starters" role="img"><svg viewBox="0 0 400 300" aria-hidden="true"><path d="m78 128-57-28 19 51-29 4 64 24 11-25m236-26 57-28-19 51 29 4-64 24-11-25" fill="#71d5df" stroke="#57bcc9" stroke-width="3" stroke-linejoin="round"/><path d="m122 56 19-20 44 13 49-7 42 27 20 186-28 22-128-6-29-27z" fill="#b84e4e"/><path d="m116 48 28-17 44 14 50-9 44 27 11 179-29 24-125-5-30-25z" fill="#ef7061" stroke="#d85b54" stroke-width="3" stroke-linejoin="round"/><path d="m116 48 28-17 44 14 50-9 44 27-7 10-40-20-47 9-45-14-25 13z" fill="#fa8a74"/><path d="m129 77 48 15-30 23zM264 76l-49 18 33 21z" fill="#a54449"/><path d="m134 78 42 15-28 15zM258 78l-42 16 30 14z" fill="#a8ebec" stroke="#d0fbef" stroke-width="2"/><path d="m186 107 7 6 11-7" fill="none" stroke="#af4847" stroke-width="4" stroke-linecap="round"/><rect x="121" y="124" width="160" height="115" rx="14" fill="#be4e4e"/><rect x="126" y="129" width="150" height="104" rx="11" fill="#254c51"/><rect x="132" y="135" width="138" height="92" rx="7" fill="#c4e4d6"/><path d="M134 184h134M134 166h134M165 136v90M202 136v90M238 136v90" stroke="#9bcdbd" stroke-opacity=".4"/><circle cx="251" cy="146" r="3" fill="#6faaa2"/><path d="M180 249h40" stroke="#b8494b" stroke-width="4" stroke-linecap="round"/><circle cx="251" cy="247" r="4" fill="#9ee8dc"/><path d="m143 30 12-16 9 21m67 2 13-18 10 27" fill="#ef7061" stroke="#d85b54" stroke-width="3" stroke-linejoin="round"/></svg><div class="dex-screen"><img src="public/artwork/906.png" alt=""><img src="public/artwork/909.png" alt=""><img src="public/artwork/912.png" alt=""></div></div>`;
}
function renderDex() {
  main.innerHTML = `<div class="page-wrap"><section class="hero"><div class="hero-copy"><div class="eyebrow"><span class="eyebrow-line"></span>YOUR FIELD COMPANION, REIMAGINED</div><h1>A little spark.<br>A world to <em>discover.</em></h1><p>Every Pokémon. Every possibility. Explore the Pokédex, get to know your favorites, and find your next adventure.</p><div class="hero-actions"><button class="button button-primary" data-action="paldea">Explore Paldea ${svg("arrow")}</button><a class="button button-secondary" href="#compare">${svg("compare")} Compare Pokémon</a></div></div><div class="hero-art"><div class="hero-badge"><span></span>PALDEA UPDATE</div><div class="speech">BZZT! LET’S MEET SOME POKÉMON!</div>${rotomDevice()}<span class="spark" aria-hidden="true">ϟ</span><span class="spark s2" aria-hidden="true">✦</span><p class="hero-art-caption">All 9 generations. One curious little companion.</p></div></section><div class="dex-metrics"><div class="metric"><strong>1,025</strong><span>Pokémon to discover</span></div><div class="metric"><strong>9</strong><span>Generations</span></div><div class="metric"><strong>18</strong><span>Unique types</span></div><div class="sync-status"><span class="status-dot"></span>NATIONAL DEX · GEN IX</div></div><section id="explore" aria-labelledby="explore-title"><div class="section-heading"><div><h2 id="explore-title">Find your next favorite.</h2><p>A whole world of Pokémon, just a search away.</p></div><a class="section-small-link" href="#compare">Better together. Compare two Pokémon ${svg("arrow")}</a></div><div class="filter-toolbar"><label class="search-field">${svg("search")}<input id="pokemon-search" type="search" placeholder="Search by name or Pokédex number…" aria-label="Search Pokémon by name or Pokédex number" autocomplete="off" value="${esc(filters.query)}"><kbd aria-hidden="true">/</kbd></label><label class="filter-select">${svg("globe")}<select id="generation-filter" aria-label="Filter by generation"><option value="0">All generations</option>${regions
    .slice(1)
    .map(
      (r, i) =>
        `<option value="${i + 1}" ${filters.generation === i + 1 ? "selected" : ""}>Gen ${i + 1} · ${r}</option>`,
    )
    .join(
      "",
    )}</select></label><label class="filter-select">${svg("type")}<select id="type-filter" aria-label="Filter by type"><option value="">All types</option>${Object.keys(
    typeThemes,
  )
    .sort()
    .map(
      (t) =>
        `<option value="${t}" ${filters.type === t ? "selected" : ""}>${t[0].toUpperCase() + t.slice(1)}</option>`,
    )
    .join(
      "",
    )}</select></label></div><div class="region-tabs" role="group" aria-label="Filter by region">${regions.map((r, i) => `<button class="region-tab ${filters.generation === i ? "active" : ""}" data-generation="${i}" aria-pressed="${filters.generation === i}">${r}${i === 9 ? '<span class="new-tag">NEW</span>' : ""}</button>`).join("")}</div><div class="results-toolbar"><span id="result-count" role="status"></span><div class="results-tools"><select id="sort-select" class="sort-select" aria-label="Sort Pokémon"><option value="featured">Sort: Featured</option><option value="number">Sort: Dex number</option><option value="name">Sort: Name A–Z</option><option value="total">Sort: Base total ↓</option></select><div class="view-buttons" aria-label="Display style"><button class="view-button ${filters.view === "grid" ? "active" : ""}" aria-label="Grid view" aria-pressed="${filters.view === "grid"}" data-view="grid">${svg("grid")}</button><button class="view-button ${filters.view === "list" ? "active" : ""}" aria-label="List view" aria-pressed="${filters.view === "list"}" data-view="list">${svg("list")}</button></div></div></div><div id="pokemon-grid" class="pokemon-grid"></div><div id="load-more" class="load-more-wrap"></div></section><aside class="rotom-note"><img src="public/favicon.svg" alt=""><div><h3>Curious about who comes out on top?</h3><p>Go beyond base stats. Compare your favorites with custom IVs, EVs, and natures.</p></div><a href="#compare">Open the comparison lab ${svg("arrow")}</a></aside></div>`;
  main.querySelector("#sort-select").value = filters.sort;
  renderCards();
  main.querySelector("#pokemon-search").addEventListener("input", (e) => {
    filters.query = e.target.value;
    visibleCount = 12;
    renderCards();
  });
  main
    .querySelector("#generation-filter")
    .addEventListener("change", (e) => setGeneration(Number(e.target.value)));
  main.querySelector("#type-filter").addEventListener("change", (e) => {
    filters.type = e.target.value;
    visibleCount = 12;
    renderCards();
  });
  main.querySelector("#sort-select").addEventListener("change", (e) => {
    filters.sort = e.target.value;
    visibleCount = 12;
    renderCards();
  });
}
function filteredPokemon() {
  let query = searchKey(filters.query);
  let list = pokemon.filter(
    (p) =>
      (!filters.generation || p.generation === filters.generation) &&
      (!filters.type || p.types.includes(filters.type)) &&
      (!query ||
        searchKey(p.name).includes(query) ||
        searchKey(p.slug).includes(query) ||
        String(p.id).padStart(4, "0") === query ||
        String(p.id) === query),
  );
  const featured = [906, 909, 912, 25, 1007, 1008, 133, 479, 448, 778, 1, 4];
  list.sort((a, b) =>
    filters.sort === "name"
      ? a.name.localeCompare(b.name)
      : filters.sort === "total"
        ? sumStats(b) - sumStats(a) || a.id - b.id
        : filters.sort === "featured"
          ? (featured.includes(a.id)
              ? featured.indexOf(a.id)
              : -1 + 10000 + a.id) -
            (featured.includes(b.id)
              ? featured.indexOf(b.id)
              : -1 + 10000 + b.id)
          : a.id - b.id,
  );
  return list;
}
function renderCards() {
  const list = filteredPokemon(),
    display = list.slice(0, visibleCount);
  const grid = document.getElementById("pokemon-grid");
  if (!grid) return;
  grid.className = `pokemon-grid ${filters.view === "list" ? "list-view" : ""}`;
  document.getElementById("result-count").textContent =
    `Showing ${display.length} of ${list.length.toLocaleString()} Pokémon${filters.generation ? " · " + regions[filters.generation] : ""}`;
  grid.innerHTML = display.length
    ? display
        .map(
          (p) =>
            `<article class="pokemon-card" style="--tint:${typeThemes[p.types[0]]?.[0]}"><button class="card-visual" data-detail="${p.id}" aria-label="View ${esc(p.name)} details"><span class="card-number">#${String(p.id).padStart(4, "0")}</span><span class="card-gen">GEN ${["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"][p.generation]}</span><img src="${art(p)}" alt="${esc(p.name)}" loading="lazy" width="150" height="150"></button><div class="card-body"><button class="card-title" data-detail="${p.id}">${esc(p.name)}</button>${badges(p)}<div class="card-bottom"><span>BASE TOTAL <strong>${sumStats(p)}</strong></span><button class="card-compare ${selected.includes(p.id) ? "selected" : ""}" data-add="${p.id}" aria-label="${selected.includes(p.id) ? "Remove" : "Add"} ${esc(p.name)} ${selected.includes(p.id) ? "from" : "to"} comparison" aria-pressed="${selected.includes(p.id)}">${svg(selected.includes(p.id) ? "check" : "plus")} ${selected.includes(p.id) ? "Added" : "Compare"}</button></div></div></article>`,
        )
        .join("")
    : `<div class="empty-state"><span>⌕</span><h3>No Pokémon found, bzzzt!</h3><p>Try another name, number, or a different filter.</p><button class="button button-secondary" data-action="reset-filters">Reset filters</button></div>`;
  document.getElementById("load-more").innerHTML =
    list.length > visibleCount
      ? `<button class="button button-secondary" data-action="load-more">Load more Pokémon ${svg("plus")}</button><p>There’s always someone new to meet.</p>`
      : "";
  updateTray();
}
function setGeneration(gen) {
  filters.generation = gen;
  visibleCount = 12;
  document.querySelector("#generation-filter").value = gen;
  document.querySelectorAll("[data-generation]").forEach((b) => {
    b.classList.toggle("active", Number(b.dataset.generation) === gen);
    b.setAttribute(
      "aria-pressed",
      String(Number(b.dataset.generation) === gen),
    );
  });
  renderCards();
}
function addCompare(id) {
  if (selected.includes(id)) {
    selected = selected.filter((x) => x !== id);
    notify(`${byId.get(id).name} removed from comparison`);
  } else if (selected.length < 2) {
    selected.push(id);
    notify(`${byId.get(id).name} added to comparison`);
  } else {
    notify("Your comparison has two Pokémon. Remove one to add another.");
    return;
  }
  remember();
  renderCards();
  updateTray();
}
function updateTray() {
  const count = document.getElementById("nav-compare-count");
  count.textContent = selected.length;
  count.hidden = !selected.length;
  const tray = document.getElementById("compare-tray");
  tray.innerHTML =
    selected.length && location.hash !== "#compare"
      ? `<div class="compare-tray"><div class="tray-pokemon">${selected.map((id) => `<div class="tray-slot"><img src="${art(byId.get(id))}" alt=""><span>${esc(byId.get(id).name)}</span><button data-remove="${id}" aria-label="Remove ${esc(byId.get(id).name)}">×</button></div>`).join("")}${selected.length < 2 ? '<div class="tray-slot tray-empty">Choose a second Pokémon</div>' : ""}</div><a href="#compare" class="button button-primary">Compare ${svg("arrow")}</a></div>`
      : "";
}
function getPair() {
  return [byId.get(selected[0] || 6), byId.get(selected[1] || 445)];
}
function natureLabel(name) {
  const n = NATURES[name];
  return n?.increase
    ? `${name} (+${shortStats[n.increase]}, −${shortStats[n.decrease]})`
    : `${name} (neutral)`;
}
function natureEntries() {
  return Array.isArray(NATURES)
    ? NATURES.map((n) => (typeof n === "string" ? [n, n] : [n.name, n.name]))
    : Object.keys(NATURES).map((n) => [n, n]);
}
function comparePanel(p, i) {
  const b = builds[i];
  return `<article class="compare-panel" data-panel="${i}"><div class="compare-pokemon-hero" style="--tint:${typeThemes[p.types[0]]?.[0]}"><div><span class="card-number">POKÉMON ${i ? "B" : "A"} · #${String(p.id).padStart(4, "0")}</span><h2>${esc(p.name)}</h2>${badges(p)}</div><img src="${art(p)}" alt="${esc(p.name)}"></div><div class="compare-panel-controls"><label class="pokemon-picker-label" for="picker-${i}">Choose a Pokémon</label><form class="pokemon-picker-row" data-picker-form="${i}"><input class="pokemon-picker" id="picker-${i}" data-picker="${i}" list="pokemon-options" value="${esc(p.name)}" autocomplete="off" aria-label="Choose Pokémon ${i ? "B" : "A"}"><button class="picker-apply" type="submit" aria-label="Set Pokémon ${i ? "B" : "A"}">Set ${svg("arrow")}</button></form><div class="build-settings"><label>Level<input type="number" data-build="level" data-side="${i}" min="1" max="100" value="${b.level}" aria-label="${esc(p.name)} level"></label><label>Nature<select data-build="nature" data-side="${i}" aria-label="${esc(p.name)} nature">${natureEntries()
    .map(
      ([name]) =>
        `<option ${b.nature === name ? "selected" : ""} value="${name}">${natureLabel(name)}</option>`,
    )
    .join(
      "",
    )}</select></label><label>Quick build<select data-preset="${i}" aria-label="${esc(p.name)} training preset"><option value="">Custom build</option><option value="physical">Physical sweeper</option><option value="special">Special sweeper</option><option value="bulky">Bulky defender</option><option value="reset">Untrained · reset</option></select></label></div><div class="training-head"><span>Fine-tune your Pokémon</span><button data-reset="${i}">Reset training ↺</button></div><table class="training-table"><thead><tr><th>STAT</th><th>BASE</th><th><abbr title="Individual values: 0 to 31">IV</abbr> / 31</th><th><abbr title="Effort values: 0 to 252 per stat">EV</abbr> / 252</th></tr></thead><tbody>${STAT_KEYS.map((k) => `<tr><td>${shortStats[k]}</td><td class="base-cell">${p.stats[k]}</td><td><input type="number" min="0" max="31" value="${b.ivs[k]}" data-stat="${k}" data-kind="ivs" data-side="${i}" aria-label="${esc(p.name)} ${shortStats[k]} IV" ${includeIVs ? "" : "disabled"}></td><td><input type="number" min="0" max="252" value="${b.evs[k]}" data-stat="${k}" data-kind="evs" data-side="${i}" aria-label="${esc(p.name)} ${shortStats[k]} EV" ${includeEVs ? "" : "disabled"}></td></tr>`).join("")}</tbody></table><div class="ev-budget"><span>EV investment ${includeEVs ? "" : "· excluded"}</span><span><strong id="ev-total-${i}">${Object.values(b.evs).reduce((a, c) => a + c, 0)}</strong> / 510</span></div><div class="ev-budget-bar"><span id="ev-bar-${i}" style="width:${(Object.values(b.evs).reduce((a, c) => a + c, 0) / 510) * 100}%"></span></div></div></article>`;
}
function renderCompare() {
  const pair = getPair();
  main.innerHTML = `<div class="page-wrap"><section class="compare-intro"><div><div class="eyebrow"><span class="eyebrow-line"></span>THE COMPARISON LAB</div><h1>Two Pokémon. All the possibilities.</h1><p>Find the differences that matter. Fine-tune each build and see your stats change in real time.</p></div><img src="public/favicon.svg" alt=""></section><div class="comparison-settings"><span>${svg("sliders")} Calculation settings</span><label class="toggle-control"><input type="checkbox" id="include-ivs" ${includeIVs ? "checked" : ""}><span class="toggle-track"></span>Include IVs</label><label class="toggle-control"><input type="checkbox" id="include-evs" ${includeEVs ? "checked" : ""}><span class="toggle-track"></span>Include EVs</label><span class="settings-note">Your training values stay saved when switched off.</span><button class="button button-quiet" data-action="swap-pair">${svg("compare")} Swap</button></div><datalist id="pokemon-options">${pokemon.map((p) => `<option value="${esc(p.name)}">#${String(p.id).padStart(4, "0")} · ${p.types.join(" / ")}</option>`).join("")}</datalist><div class="compare-pair"><span class="versus-badge" aria-hidden="true">VS</span>${pair.map(comparePanel).join("")}</div><section class="compare-results" id="compare-results" aria-label="Calculated stat comparison" aria-live="polite"></section><p class="compare-footnote">Calculated stats use the standard main-series formula, with rounding at each step. IVs: 0–31. EVs: 0–252 per stat, 510 total. Nature modifiers: ×1.1 / ×0.9. Abilities, items, battle boosts, and alternate forms are not included.</p><aside class="comparison-help"><img src="public/favicon.svg" alt=""><p><strong>A little training goes a long way, bzzzt!</strong> IVs are a Pokémon’s natural potential; EVs are the result of training. Switch either off to see their effect. You can even choose the same species twice to compare different builds.</p></aside></div>`;
  main.querySelectorAll("[data-picker-form]").forEach((form) =>
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = form.querySelector("[data-picker]");
      const match = pokemon.find(
        (p) =>
          searchKey(p.name) === searchKey(input.value) ||
          searchKey(p.slug) === searchKey(input.value) ||
          String(p.id) === input.value.trim().replace("#", ""),
      );
      if (match) {
        const index = Number(input.dataset.picker);
        selected = getPair().map((p) => p.id);
        selected[index] = match.id;
        remember();
        renderCompare();
        updateTray();
        notify(`${match.name} is ready to compare`);
      } else {
        input.setAttribute("aria-invalid", "true");
        input.focus();
        notify("Choose a Pokémon name or National Dex number.");
      }
    }),
  );
  main
    .querySelectorAll("[data-picker]")
    .forEach((input) =>
      input.addEventListener("input", () =>
        input.removeAttribute("aria-invalid"),
      ),
    );
  main.querySelectorAll("[data-stat],[data-build]").forEach((input) => {
    input.addEventListener("input", handleBuildInput);
    if (input.type === "number")
      input.addEventListener("blur", () => {
        const b = builds[Number(input.dataset.side)];
        input.value =
          input.dataset.build === "level"
            ? b.level
            : b[input.dataset.kind][input.dataset.stat];
      });
  });
  main
    .querySelectorAll("[data-preset]")
    .forEach((select) =>
      select.addEventListener("change", () =>
        applyPreset(Number(select.dataset.preset), select.value),
      ),
    );
  main.querySelector("#include-ivs").addEventListener("change", (e) => {
    includeIVs = e.target.checked;
    main
      .querySelectorAll('[data-kind="ivs"]')
      .forEach((input) => (input.disabled = !includeIVs));
    updateComparison();
  });
  main.querySelector("#include-evs").addEventListener("change", (e) => {
    includeEVs = e.target.checked;
    main
      .querySelectorAll('[data-kind="evs"]')
      .forEach((input) => (input.disabled = !includeEVs));
    main
      .querySelectorAll(".ev-budget>span:first-child")
      .forEach(
        (el) =>
          (el.textContent = `EV investment ${includeEVs ? "" : "· excluded"}`),
      );
    updateComparison();
  });
  updateComparison();
  updateTray();
}
function handleBuildInput(e) {
  const input = e.target,
    i = Number(input.dataset.side),
    b = builds[i];
  if (input.dataset.build === "nature") {
    b.nature = input.value;
  } else if (input.dataset.build === "level") {
    b.level = Math.max(1, Math.min(100, Math.trunc(Number(input.value) || 1)));
    if (input.value !== "" && Number(input.value) !== b.level)
      input.value = b.level;
  } else {
    const { kind, stat } = input.dataset;
    let value = Math.max(
      0,
      Math.min(kind === "ivs" ? 31 : 252, Math.trunc(Number(input.value) || 0)),
    );
    if (kind === "evs") {
      let remaining =
        510 -
        STAT_KEYS.filter((k) => k !== stat).reduce((s, k) => s + b.evs[k], 0);
      if (value > remaining) {
        value = remaining;
        notify("EVs are limited to 510 total per Pokémon.");
      }
    }
    b[kind][stat] = value;
    if (input.value !== "" && Number(input.value) !== value)
      input.value = value;
    main.querySelector(`[data-preset="${i}"]`).value = "";
  }
  updateBudget(i);
  updateComparison();
}
function updateBudget(i) {
  const total = STAT_KEYS.reduce((n, k) => n + builds[i].evs[k], 0);
  document.getElementById(`ev-total-${i}`).textContent = total;
  document.getElementById(`ev-bar-${i}`).style.width =
    `${(total / 510) * 100}%`;
}
function applyPreset(i, preset) {
  if (!preset) return;
  const b = builds[i];
  b.ivs = Object.fromEntries(STAT_KEYS.map((k) => [k, 31]));
  b.evs = Object.fromEntries(STAT_KEYS.map((k) => [k, 0]));
  if (preset === "physical") {
    b.evs.attack = 252;
    b.evs.speed = 252;
    b.evs.hp = 4;
    b.nature = "Adamant";
  }
  if (preset === "special") {
    b.evs.specialAttack = 252;
    b.evs.speed = 252;
    b.evs.hp = 4;
    b.nature = "Modest";
  }
  if (preset === "bulky") {
    b.evs.hp = 252;
    b.evs.defense = 252;
    b.evs.specialDefense = 4;
    b.nature = "Bold";
  }
  if (preset === "reset") b.nature = "Hardy";
  renderCompare();
  main.querySelector(`[data-preset="${i}"]`).value = preset;
  notify("Training build applied");
}
function radar(a, b, pair) {
  const cx = 150,
    cy = 131,
    r = 90,
    max = Math.max(250, ...Object.values(a), ...Object.values(b));
  function points(values, scale = 1) {
    return STAT_KEYS.map((k, i) => {
      let angle = -Math.PI / 2 + (i * Math.PI) / 3,
        ratio = values ? values[k] / max : scale;
      return `${cx + Math.cos(angle) * r * ratio},${cy + Math.sin(angle) * r * ratio}`;
    }).join(" ");
  }
  return `<svg class="radar-chart" viewBox="0 0 300 263" role="img" aria-label="Radar chart comparing ${esc(pair[0].name)} and ${esc(pair[1].name)} calculated stats">${[
    0.25, 0.5, 0.75, 1,
  ]
    .map(
      (s) =>
        `<polygon points="${points(null, s)}" fill="${s === 1 ? "#f9fbf7" : "none"}" stroke="#e4eadd" stroke-width="1"/>`,
    )
    .reverse()
    .join("")}${STAT_KEYS.map((k, i) => {
    let angle = -Math.PI / 2 + (i * Math.PI) / 3;
    return `<line x1="${cx}" y1="${cy}" x2="${cx + Math.cos(angle) * r}" y2="${cy + Math.sin(angle) * r}" stroke="#e4eadd"/><text x="${cx + Math.cos(angle) * (r + 27)}" y="${cy + Math.sin(angle) * (r + 20) + 4}" text-anchor="middle">${shortStats[k]}</text>`;
  }).join(
    "",
  )}<polygon points="${points(a)}" fill="#ed625c25" stroke="#ed625c" stroke-width="2"/><polygon points="${points(b)}" fill="#5fabb825" stroke="#5fabb8" stroke-width="2"/>${[
    a,
    b,
  ]
    .map((v, n) =>
      STAT_KEYS.map((k, i) => {
        let angle = -Math.PI / 2 + (i * Math.PI) / 3;
        return `<circle cx="${cx + (Math.cos(angle) * r * v[k]) / max}" cy="${cy + (Math.sin(angle) * r * v[k]) / max}" r="2.7" fill="${n ? "#5fabb8" : "#ed625c"}"/>`;
      }).join(""),
    )
    .join("")}</svg>`;
}
function updateComparison() {
  const pair = getPair();
  const [a, b] = pair.map((p, i) =>
    calculateStats(p, builds[i], { includeIVs, includeEVs }),
  );
  let totalA = STAT_KEYS.reduce((s, k) => s + a[k], 0),
    totalB = STAT_KEYS.reduce((s, k) => s + b[k], 0);
  document.getElementById("compare-results").innerHTML =
    `<div class="result-card"><h3>The bigger picture</h3><p class="result-card-subtitle">Calculated stats · Levels ${builds.map((x) => x.level).join(" / ")} · ${includeIVs ? "IVs on" : "IVs off"} · ${includeEVs ? "EVs on" : "EVs off"}</p><div class="stat-legend"><span><i></i>${esc(pair[0].name)}</span><span><i></i>${esc(pair[1].name)}</span></div>${radar(a, b, pair)}</div><div class="result-card"><h3>Stat by stat</h3><p class="result-card-subtitle">Higher values highlighted. Every point counts.</p><table class="stat-comparison"><thead><tr><th>CALCULATED STAT</th><th>${esc(pair[0].name)}</th><th>${esc(pair[1].name)}</th><th>A − B</th></tr></thead><tbody>${STAT_KEYS.map((k) => `<tr><td>${shortStats[k]}</td><td class="${a[k] > b[k] ? "winner-left" : ""}">${a[k]}</td><td class="${b[k] > a[k] ? "winner-right" : ""}">${b[k]}</td><td class="stat-diff">${a[k] === b[k] ? "—" : (a[k] > b[k] ? "+" : "") + (a[k] - b[k])}</td></tr>`).join("")}<tr><td>Stat total</td><td class="${totalA > totalB ? "winner-left" : ""}">${totalA}</td><td class="${totalB > totalA ? "winner-right" : ""}">${totalB}</td><td class="stat-diff">${totalA === totalB ? "—" : (totalA > totalB ? "+" : "") + (totalA - totalB)}</td></tr></tbody></table></div>`;
}
function showDetail(id) {
  const p = byId.get(Number(id));
  if (!p) return;
  const dialog = document.getElementById("pokemon-dialog");
  dialog.innerHTML = `<div class="dialog-visual" style="--tint:${typeThemes[p.types[0]]?.[0]}"><button class="dialog-close" aria-label="Close details" autofocus>×</button><img src="${art(p)}" alt="${esc(p.name)}"></div><div class="dialog-body"><div class="dialog-title"><h2>${esc(p.name)}</h2><span>#${String(p.id).padStart(4, "0")}</span></div>${badges(p)}<div class="dialog-meta"><div><span>HEIGHT</span>${p.height} m</div><div><span>WEIGHT</span>${p.weight} kg</div><div><span>GENERATION</span>${p.generation} · ${regions[p.generation]}</div><div><span>ABILITIES</span>${esc(p.abilities?.join(", ") || "—")}</div></div><h3>Base stats</h3>${STAT_KEYS.map((k, i) => `<div class="base-stat"><span>${shortStats[k]}</span><strong>${p.stats[k]}</strong><div class="base-stat-track"><span style="width:${(p.stats[k] / 255) * 100}%;--bar-color:${["#87ab76", "#e3a36d", "#c5b068", "#85b3bc", "#9b9bc0", "#bc91ac"][i]}"></span></div></div>`).join("")}<div class="dialog-actions"><span>BASE TOTAL <strong>${sumStats(p)}</strong></span><button class="button button-primary" data-dialog-add="${p.id}">${svg("compare")} ${selected.includes(p.id) ? "Open comparison" : "Add to comparison"}</button></div></div>`;
  dialog.querySelector(".dialog-close").onclick = () => dialog.close();
  dialog.querySelector("[data-dialog-add]").onclick = () => {
    dialog.close();
    if (!selected.includes(p.id)) {
      if (selected.length === 2) selected = [p.id, selected[1]];
      else selected.push(p.id);
      remember();
    }
    if (location.hash === "#compare") route();
    else location.hash = "compare";
  };
  if (!dialog.open) dialog.showModal();
}
function route() {
  const openDialog = document.getElementById("pokemon-dialog");
  if (openDialog.open) openDialog.close();
  if (cleanupGame) {
    cleanupGame();
    cleanupGame = null;
  }
  let hash = location.hash.slice(1) || "pokedex";
  let page = hash.split("/")[0];
  if (!["pokedex", "compare", "games", "pokemon"].includes(page))
    page = "pokedex";
  document.querySelectorAll("[data-nav]").forEach((a) => {
    let active = a.dataset.nav === (page === "pokemon" ? "pokedex" : page);
    a.classList.toggle("active", active);
    if (active) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  document.title = `${page === "compare" ? "Compare Pokémon" : page === "games" ? "Play & discover" : "Your field companion"} — Rotom Dex`;
  if (page === "compare") renderCompare();
  else if (page === "games") {
    main.innerHTML = '<div class="page-wrap"><div id="games-root"></div></div>';
    cleanupGame = mountGames(document.getElementById("games-root"), pokemon);
  } else {
    renderDex();
    if (page === "pokemon") {
      const idOrName = decodeURIComponent(hash.split("/")[1] || "");
      const p = pokemon.find(
        (p) =>
          String(p.id) === idOrName ||
          p.name.toLowerCase() === idOrName.toLowerCase() ||
          p.slug === idOrName.toLowerCase(),
      );
      if (p) showDetail(p.id);
    }
  }
  updateTray();
}
main.addEventListener("click", (e) => {
  let b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.detail) showDetail(b.dataset.detail);
  if (b.dataset.add) addCompare(Number(b.dataset.add));
  if (b.dataset.generation !== undefined)
    setGeneration(Number(b.dataset.generation));
  if (b.dataset.view) {
    filters.view = b.dataset.view;
    main.querySelectorAll("[data-view]").forEach((x) => {
      x.classList.toggle("active", x.dataset.view === filters.view);
      x.setAttribute("aria-pressed", String(x.dataset.view === filters.view));
    });
    renderCards();
  }
  if (b.dataset.reset !== undefined) {
    builds[Number(b.dataset.reset)] = freshBuild();
    renderCompare();
    notify("Training reset to perfect IVs and zero EVs");
  }
  if (b.dataset.action === "paldea") {
    setGeneration(9);
    document.getElementById("explore").scrollIntoView({ behavior: "smooth" });
  }
  if (b.dataset.action === "reset-filters") {
    filters = { ...filters, query: "", type: "", generation: 0 };
    visibleCount = 12;
    renderDex();
  }
  if (b.dataset.action === "load-more") {
    visibleCount += 24;
    renderCards();
  }
  if (b.dataset.action === "swap-pair") {
    selected = getPair()
      .map((p) => p.id)
      .reverse();
    builds.reverse();
    remember();
    renderCompare();
  }
});
document.getElementById("compare-tray").addEventListener("click", (e) => {
  const b = e.target.closest("[data-remove]");
  if (b) {
    selected = selected.filter((id) => id !== Number(b.dataset.remove));
    remember();
    renderCards();
    updateTray();
  }
});
document.getElementById("pokemon-dialog").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) {
    const r = e.currentTarget.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      e.currentTarget.close();
  }
});
document.addEventListener("click", (e) => {
  const link = e.target.closest('a[href="#main"]');
  if (link) {
    e.preventDefault();
    main.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
});
document.addEventListener("keydown", (e) => {
  if (
    e.key === "/" &&
    !["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName)
  ) {
    const input = document.getElementById("pokemon-search");
    if (input) {
      e.preventDefault();
      input.focus();
    }
  }
});
document.addEventListener(
  "error",
  (e) => {
    if (e.target.tagName === "IMG" && !e.target.dataset.failed) {
      e.target.dataset.failed = "1";
      e.target.src = "public/favicon.svg";
      e.target.style.opacity = ".55";
    }
  },
  true,
);
window.addEventListener("hashchange", () => {
  route();
  window.scrollTo({ top: 0, behavior: "instant" });
});
try {
  const response = await fetch(
    new URL("../public/data/pokemon.json", import.meta.url),
  );
  if (!response.ok) throw new Error("Catalog could not be loaded");
  pokemon = await response.json();
  byId = new Map(pokemon.map((p) => [p.id, p]));
  selected = selected.filter((id) => byId.has(id));
  route();
} catch (error) {
  console.error(error);
  main.innerHTML =
    '<div class="page-wrap"><div class="empty-state" style="margin-top:60px"><span>ϟ</span><h3>Rotom needs a moment.</h3><p>The Pokémon catalog couldn’t load. Please refresh to try again.</p><button class="button button-primary" onclick="location.reload()">Try again</button></div></div>';
}
