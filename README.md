# Rotom Dex

A modernized version of the original Pokémon website, with a Rotom Dex inspired interface, a National Pokédex, and a two-Pokémon stat comparison lab. Built with HTML, CSS, and native JavaScript modules; no framework, API key, or runtime packages are required.

## Run locally

Use Node.js 18 or newer:

```sh
npm run dev
```

Open http://localhost:5173. Set `PORT` to use a different port. Opening `index.html` directly with `file://` is unsupported because browsers restrict module and catalog loading.

```sh
npm test       # Meaningful stat-formula and catalog checks
npm run build # Generate a static dist/ directory
```

The source is also a ready-to-serve static site. All application paths are relative, including the catalog request, so it works at a GitHub Pages repository subpath. To deploy, publish the repository root with GitHub Pages, or deploy the contents of `dist/` to a static host. The local server is for development.

## Features

- Responsive Rotom Dex interface, custom vector mascot, and Paldea starter artwork.
- All 1,025 released National Dex species through Generation IX, including The Teal Mask and The Indigo Disk.
- Instant search by name or National Dex number, generation and type filters, sorting, grid/list views, and detailed base stats.
- Pick two Pokémon from the catalog or search directly in the comparison lab. The same species can be selected twice to compare different training builds.
- Independent levels, all 25 natures, and six IV/EV inputs for each Pokémon.
- Separate **Include IVs** and **Include EVs** toggles. Switching them off ignores their contributions without deleting entered values.
- Immediate calculated stats, differences, highlighted values, and a shared-scale radar chart.
- Legal training limits: 0–31 IVs, 0–252 EVs per stat, 510 EVs total; nature rounding and Shedinja’s fixed HP are handled.
- Quick training presets, reset, and swap controls.
- Modernized Who’s That Pokémon (10 rounds) and Pokémon Blitz (two-minute type challenge), with generation filters through Gen IX.

## Data and calculation scope

The catalog is stored locally in `public/data/pokemon.json`; search, filters, comparison, and game answer matching do not need a live API. Artwork is from PokéAPI’s official-artwork sprite collection. Featured artwork is local; other species images load from the sprite host and have an image fallback. Optional Google Fonts use system fallbacks if unavailable.

The comparison uses the standard modern main-series stat formula. It compares the default National Dex species forms. Alternate forms, Mega Evolutions, battle boosts, held items, abilities, and game-specific systems such as Legends effort levels are outside its calculation scope. Future announced Pokémon without published base stats are not assigned speculative stats.

Data: [PokéAPI](https://pokeapi.co/), [PokéAPI database](https://github.com/PokeAPI/pokeapi), and [PokéAPI sprites](https://github.com/PokeAPI/sprites). Pokémon, names, and artwork belong to Nintendo, Creatures Inc., and GAME FREAK. This is an unofficial fan project.

## Project layout

- `index.html` — application shell
- `src/app.js` — Pokédex, comparison UI, and hash navigation
- `src/stats.js` — pure stat calculation and validation helpers
- `src/games.js` — quiz and Blitz game lifecycle
- `style/rotom.css` / `style/games-modern.css` — responsive styles
- `public/` — static catalog, artwork, and favicon
- `server.mjs` — dependency-free development server
- `scripts/build.mjs` — static site build

The original assignment’s supporting pages, scripts, and assets are retained. The homepage, comparison, and current game experiences use the new application.

## Original project

Originally an Interactive Development assignment by Wei Chong and Aung, with Pokémon search, Who’s That Pokémon, and Pokémon Blitz. The original implementation used jQuery, Bootstrap, AnyChart, and Lottie; the modern application has no JavaScript CDN dependencies.
