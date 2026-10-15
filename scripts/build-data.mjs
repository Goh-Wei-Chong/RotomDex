// Rebuild the local catalog directly from PokéAPI's canonical source tables.
// Source: https://github.com/PokeAPI/pokeapi/tree/master/data/v2/csv
// Run: node scripts/build-data.mjs (network access required).
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const source =
  "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/";
function parseCSV(text) {
  const rows = [];
  let row = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" && !quoted) {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const header = rows.shift();
  return rows
    .filter((row) => row.length > 1)
    .map((row) => Object.fromEntries(header.map((key, i) => [key, row[i]])));
}
async function csv(name) {
  const response = await fetch(`${source}${name}.csv`);
  if (!response.ok)
    throw new Error(`Could not fetch ${name}: ${response.status}`);
  return parseCSV(await response.text());
}
const [
  species,
  forms,
  stats,
  types,
  pokemonTypes,
  speciesNames,
  abilities,
  abilityNames,
  pokemonAbilities,
] = await Promise.all(
  [
    "pokemon_species",
    "pokemon",
    "pokemon_stats",
    "types",
    "pokemon_types",
    "pokemon_species_names",
    "abilities",
    "ability_names",
    "pokemon_abilities",
  ].map(csv),
);
const englishNames = new Map(
  speciesNames
    .filter((row) => row.local_language_id === "9")
    .map((row) => [row.pokemon_species_id, row.name]),
);
const typeNames = new Map(types.map((row) => [row.id, row.identifier]));
const abilityLabels = new Map(
  abilityNames
    .filter((row) => row.local_language_id === "9")
    .map((row) => [row.ability_id, row.name]),
);
const abilityIdentifiers = new Map(
  abilities.map((row) => [row.id, row.identifier]),
);
const statKeys = [
  "hp",
  "attack",
  "defense",
  "specialAttack",
  "specialDefense",
  "speed",
];
const canonicalForms = new Map(
  forms
    .filter((row) => row.is_default === "1")
    .map((row) => [row.species_id, row]),
);
const statsById = new Map(),
  typesById = new Map(),
  abilitiesById = new Map();
for (const row of stats) {
  if (!statsById.has(row.pokemon_id)) statsById.set(row.pokemon_id, {});
  const key = statKeys[Number(row.stat_id) - 1];
  if (key) statsById.get(row.pokemon_id)[key] = Number(row.base_stat);
}
for (const row of pokemonTypes.sort(
  (a, b) => Number(a.slot) - Number(b.slot),
)) {
  if (!typesById.has(row.pokemon_id)) typesById.set(row.pokemon_id, []);
  typesById.get(row.pokemon_id).push(typeNames.get(row.type_id));
}
for (const row of pokemonAbilities.sort(
  (a, b) => Number(a.slot) - Number(b.slot),
)) {
  if (!abilitiesById.has(row.pokemon_id)) abilitiesById.set(row.pokemon_id, []);
  const label =
    abilityLabels.get(row.ability_id) || abilityIdentifiers.get(row.ability_id);
  if (label && !abilitiesById.get(row.pokemon_id).includes(label))
    abilitiesById.get(row.pokemon_id).push(label);
}
const artworkIds = [
  1, 4, 6, 7, 25, 94, 133, 445, 448, 470, 479, 778, 906, 909, 912, 1007, 1008,
];
const artworkSource = (id) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
await mkdir(new URL("public/artwork/", root), { recursive: true });
const localArtwork = new Set();
await Promise.all(
  artworkIds.map(async (id) => {
    try {
      const response = await fetch(artworkSource(id));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await writeFile(
        new URL(`public/artwork/${id}.png`, root),
        Buffer.from(await response.arrayBuffer()),
      );
      localArtwork.add(id);
    } catch (error) {
      console.warn(`Artwork ${id} uses its remote URL: ${error.message}`);
    }
  }),
);
const catalog = species
  .map((row) => {
    const form = canonicalForms.get(row.id);
    if (!form) throw new Error(`Missing default form for ${row.id}`);
    const id = Number(row.id);
    const entry = {
      id,
      name: englishNames.get(row.id) || row.identifier,
      slug: row.identifier,
      types: typesById.get(form.id),
      stats: statsById.get(form.id),
      generation: Number(row.generation_id),
      height: Number(form.height) / 10,
      weight: Number(form.weight) / 10,
      abilities: abilitiesById.get(form.id) || [],
      artwork: localArtwork.has(id)
        ? `public/artwork/${id}.png`
        : artworkSource(form.id),
    };
    if (
      !entry.types?.length ||
      statKeys.some((key) => !Number.isFinite(entry.stats?.[key]))
    )
      throw new Error(`Incomplete data for ${id}`);
    return entry;
  })
  .sort((a, b) => a.id - b.id);
await mkdir(new URL("public/data/", root), { recursive: true });
await writeFile(
  new URL("public/data/pokemon.json", root),
  JSON.stringify(catalog),
);
console.log(
  `Saved ${catalog.length} Pokémon across ${new Set(catalog.map((p) => p.generation)).size} generations, ending with #${catalog.at(-1).id} ${catalog.at(-1).name}.`,
);
console.log(
  `Saved ${localArtwork.size} local featured illustrations. Catalog: ${fileURLToPath(new URL("public/data/pokemon.json", root))}`,
);
