import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  STAT_KEYS,
  NATURES,
  calculateStats,
  normalizeIVs,
  normalizeEVs,
  totalEVs,
  clampLevel,
} from "./stats.js";

const catalog = JSON.parse(
  await readFile(
    new URL("../public/data/pokemon.json", import.meta.url),
    "utf8",
  ),
);
const pikachu = catalog.find((p) => p.id === 25);
const zeros = Object.fromEntries(STAT_KEYS.map((key) => [key, 0]));

test("catalog covers every National Dex species through Pecharunt with usable data", () => {
  assert.equal(catalog.length, 1025);
  assert.equal(catalog.at(-1).name, "Pecharunt");
  assert.equal(catalog.at(-1).generation, 9);
  for (const [index, p] of catalog.entries()) {
    assert.equal(p.id, index + 1);
    assert.ok(p.types.length >= 1 && p.types.length <= 2);
    assert.ok(p.generation >= 1 && p.generation <= 9);
    assert.ok(
      STAT_KEYS.every(
        (key) => Number.isInteger(p.stats[key]) && p.stats[key] > 0,
      ),
    );
    assert.ok(p.artwork.endsWith(".png"));
  }
  assert.equal(catalog.find((p) => p.id === 906).name, "Sprigatito");
  assert.equal(catalog.find((p) => p.id === 669).name, "Flabébé");
});

test("level 50 Pikachu with perfect IVs and no EVs matches main-series stats", () => {
  assert.deepEqual(calculateStats(pikachu), {
    hp: 110,
    attack: 75,
    defense: 60,
    specialAttack: 70,
    specialDefense: 70,
    speed: 110,
  });
});

test("Jolly Garchomp applies the nature after flooring the level-scaled result", () => {
  const garchomp = catalog.find((p) => p.id === 445);
  const result = calculateStats(garchomp, {
    level: 50,
    nature: "Jolly",
    evs: { hp: 4, attack: 252, speed: 252 },
  });
  assert.deepEqual(result, {
    hp: 184,
    attack: 182,
    defense: 115,
    specialAttack: 90,
    specialDefense: 105,
    speed: 169,
  });
});

test("EV and IV switches remove their contributions independently without changing the build", () => {
  const build = {
    level: 50,
    ivs: { hp: 31 },
    evs: { hp: 252 },
    nature: "Hardy",
  };
  const before = structuredClone(build);
  assert.equal(calculateStats(pikachu, build).hp, 142);
  assert.equal(calculateStats(pikachu, build, { includeEVs: false }).hp, 110);
  assert.equal(calculateStats(pikachu, build, { includeIVs: false }).hp, 126);
  assert.equal(
    calculateStats(pikachu, build, { includeIVs: false, includeEVs: false }).hp,
    95,
  );
  assert.deepEqual(build, before);
});

test("EVs are divided by four before level scaling; natures never affect HP", () => {
  const sample = {
    id: 0,
    stats: {
      hp: 1,
      attack: 3,
      defense: 3,
      specialAttack: 3,
      specialDefense: 3,
      speed: 3,
    },
  };
  assert.equal(
    calculateStats(sample, { level: 99, ivs: zeros, evs: { hp: 3 } }).hp,
    110,
  );
  assert.equal(
    calculateStats(sample, { level: 50, ivs: zeros, nature: "Adamant" }).attack,
    8,
  );
  assert.equal(
    calculateStats(pikachu, { nature: "Adamant" }).hp,
    calculateStats(pikachu, { nature: "Modest" }).hp,
  );
});

test("all 25 natures include five neutral and 20 unique boosted/reduced pairs", () => {
  assert.equal(Object.keys(NATURES).length, 25);
  const altered = Object.values(NATURES).filter((n) => n.increase);
  assert.equal(altered.length, 20);
  assert.equal(
    new Set(altered.map((n) => `${n.increase}/${n.decrease}`)).size,
    20,
  );
  assert.ok(
    altered.every(
      (n) =>
        n.increase !== n.decrease && n.increase !== "hp" && n.decrease !== "hp",
    ),
  );
  assert.deepEqual(
    calculateStats(pikachu, { nature: "adamant" }),
    calculateStats(pikachu, { nature: "Adamant" }),
  );
});

test("Shedinja always has exactly 1 HP at every level and training setting", () => {
  const shedinja = catalog.find((p) => p.id === 292);
  for (const level of [1, 50, 100]) {
    assert.equal(calculateStats(shedinja, { level, evs: { hp: 252 } }).hp, 1);
    assert.equal(
      calculateStats(
        shedinja,
        { level },
        { includeIVs: false, includeEVs: false },
      ).hp,
      1,
    );
  }
});

test("training helpers enforce integer IVs, EV per-stat and total limits, and levels", () => {
  assert.deepEqual(normalizeIVs({ hp: -2, attack: 99, defense: 5.9 }), {
    hp: 0,
    attack: 31,
    defense: 5,
    specialAttack: 31,
    specialDefense: 31,
    speed: 31,
  });
  const evs = normalizeEVs(
    Object.fromEntries(STAT_KEYS.map((key) => [key, 999])),
  );
  assert.deepEqual(evs, {
    hp: 252,
    attack: 252,
    defense: 6,
    specialAttack: 0,
    specialDefense: 0,
    speed: 0,
  });
  assert.equal(totalEVs(evs), 510);
  assert.equal(clampLevel(0), 1);
  assert.equal(clampLevel(1000), 100);
  assert.equal(clampLevel(NaN), 50);
  assert.equal(calculateStats(pikachu, { level: 100, ivs: zeros }).hp, 180);
});
