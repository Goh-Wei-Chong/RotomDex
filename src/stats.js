// Modern main-series (Generation III onwards) stats, before battle modifiers.
export const STAT_KEYS = [
  "hp",
  "attack",
  "defense",
  "specialAttack",
  "specialDefense",
  "speed",
];
export const STAT_LABELS = {
  hp: "HP",
  attack: "Attack",
  defense: "Defense",
  specialAttack: "Sp. Atk",
  specialDefense: "Sp. Def",
  speed: "Speed",
};

const nature = (increase = null, decrease = null) =>
  Object.freeze({ increase, decrease });
export const NATURES = Object.freeze({
  Hardy: nature(),
  Lonely: nature("attack", "defense"),
  Brave: nature("attack", "speed"),
  Adamant: nature("attack", "specialAttack"),
  Naughty: nature("attack", "specialDefense"),
  Bold: nature("defense", "attack"),
  Docile: nature(),
  Relaxed: nature("defense", "speed"),
  Impish: nature("defense", "specialAttack"),
  Lax: nature("defense", "specialDefense"),
  Timid: nature("speed", "attack"),
  Hasty: nature("speed", "defense"),
  Serious: nature(),
  Jolly: nature("speed", "specialAttack"),
  Naive: nature("speed", "specialDefense"),
  Modest: nature("specialAttack", "attack"),
  Mild: nature("specialAttack", "defense"),
  Quiet: nature("specialAttack", "speed"),
  Bashful: nature(),
  Rash: nature("specialAttack", "specialDefense"),
  Calm: nature("specialDefense", "attack"),
  Gentle: nature("specialDefense", "defense"),
  Sassy: nature("specialDefense", "speed"),
  Careful: nature("specialDefense", "specialAttack"),
  Quirky: nature(),
});
export const GENERATION_NAMES = [
  "",
  "Kanto",
  "Johto",
  "Hoenn",
  "Sinnoh",
  "Unova",
  "Kalos",
  "Alola",
  "Galar / Hisui",
  "Paldea",
];

export function clampInteger(value, min, max, fallback = min) {
  const number = Number(value);
  return Math.max(
    min,
    Math.min(max, Number.isFinite(number) ? Math.trunc(number) : fallback),
  );
}
export const clampIV = (value) => clampInteger(value, 0, 31);
export const clampEV = (value) => clampInteger(value, 0, 252);
export const clampLevel = (value) => clampInteger(value, 1, 100, 50);
export function normalizeIVs(values = {}) {
  return Object.fromEntries(
    STAT_KEYS.map((key) => [key, clampInteger(values[key] ?? 31, 0, 31, 31)]),
  );
}
// Preserve earlier fields when trimming an over-budget imported spread.
export function normalizeEVs(values = {}) {
  let remaining = 510;
  return Object.fromEntries(
    STAT_KEYS.map((key) => {
      const value = Math.min(clampEV(values[key] ?? 0), remaining);
      remaining -= value;
      return [key, value];
    }),
  );
}
export const totalEVs = (values = {}) =>
  STAT_KEYS.reduce((sum, key) => sum + (Number(values[key]) || 0), 0);
export function calculateStats(
  pokemon,
  build = {},
  { includeIVs = true, includeEVs = true } = {},
) {
  const level = clampLevel(build.level ?? 50);
  const ivs = normalizeIVs(build.ivs);
  const evs = normalizeEVs(build.evs);
  const natureName = Object.keys(NATURES).find(
    (name) =>
      name.toLowerCase() === String(build.nature ?? "Hardy").toLowerCase(),
  );
  const modifiers = NATURES[natureName] ?? NATURES.Hardy;
  return Object.fromEntries(
    STAT_KEYS.map((key) => {
      const base = Number(pokemon.stats[key]);
      const iv = includeIVs ? ivs[key] : 0;
      const ev = includeEVs ? evs[key] : 0;
      const scaled = Math.floor(
        ((2 * base + iv + Math.floor(ev / 4)) * level) / 100,
      );
      if (key === "hp")
        return [
          key,
          pokemon.id === 292 || pokemon.slug === "shedinja"
            ? 1
            : scaled + level + 10,
        ];
      const factor =
        modifiers.increase === key
          ? 110
          : modifiers.decrease === key
            ? 90
            : 100;
      // Integer percentages avoid floating-point errors such as 110 * 1.1.
      return [key, Math.floor(((scaled + 5) * factor) / 100)];
    }),
  );
}
