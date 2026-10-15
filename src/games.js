const GENERATIONS = [
  [1, "Kanto"],
  [2, "Johto"],
  [3, "Hoenn"],
  [4, "Sinnoh"],
  [5, "Unova"],
  [6, "Kalos"],
  [7, "Alola"],
  [8, "Galar & Hisui"],
  [9, "Paldea"],
];
const GENERATION_ENDS = [151, 251, 386, 493, 649, 721, 809, 905, 1025];
const TYPES = [
  "normal",
  "fire",
  "water",
  "electric",
  "grass",
  "ice",
  "fighting",
  "poison",
  "ground",
  "flying",
  "psychic",
  "bug",
  "rock",
  "ghost",
  "dragon",
  "dark",
  "steel",
  "fairy",
];
const FALLBACK_ART = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><circle cx="100" cy="100" r="74" fill="#edf0ec" stroke="#9aa7a8" stroke-width="8"/><path d="M26 100h148" stroke="#9aa7a8" stroke-width="8"/><circle cx="100" cy="100" r="24" fill="#fff" stroke="#9aa7a8" stroke-width="8"/></svg>')}`;

const escapeHTML = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
const titleCase = (value) => value.charAt(0).toUpperCase() + value.slice(1);
const nationalNumber = (pokemon) => `#${String(pokemon.id).padStart(4, "0")}`;
const generationOf = (pokemon) =>
  Number(pokemon.generation) ||
  GENERATION_ENDS.findIndex((last) => Number(pokemon.id) <= last) + 1;
const typeName = (type) =>
  typeof type === "string" ? type : type?.name || type?.type?.name || "";

/** Accept accents, punctuation, spacing and common Nidoran gender spellings. */
export function normalizePokemonName(value) {
  return String(value)
    .toLowerCase()
    .replace(/♀/g, "female")
    .replace(/♂/g, "male")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function aliasesFor(pokemon) {
  const aliases = new Set([
    normalizePokemonName(pokemon.name),
    normalizePokemonName(pokemon.slug || pokemon.name),
  ]);
  if (Number(pokemon.id) === 29)
    ["nidoranf", "nidoranfemale"].forEach((alias) => aliases.add(alias));
  if (Number(pokemon.id) === 32)
    ["nidoranm", "nidoranmale"].forEach((alias) => aliases.add(alias));
  return aliases;
}

function shuffledSample(pokemon, size) {
  const result = [...pokemon];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
  }
  return result.slice(0, size);
}

/** Mount both arcade games. Call the returned function before changing routes. */
export function mountGames(container, pokemonList) {
  const pokemon = Array.isArray(pokemonList) ? pokemonList : [];
  let screen = "menu";
  let generation = "all";
  let selectedType = "electric";
  let quizDeck = [];
  let quizIndex = 0;
  let quizScore = 0;
  let quizAnswered = false;
  let quizCorrect = false;
  let quizGuess = "";
  let quizSkipped = false;
  let blitzPool = [];
  let blitzAliases = new Map();
  let found = [];
  let foundIds = new Set();
  let deadline = 0;
  let secondsLeft = 120;
  let timer = null;
  let feedback = "";
  let feedbackTone = "";
  let endedEarly = false;
  let disposed = false;

  const scopedPokemon = () =>
    pokemon.filter(
      (entry) =>
        generation === "all" || generationOf(entry) === Number(generation),
    );
  const typePokemon = () =>
    scopedPokemon().filter((entry) =>
      (entry.types || []).some(
        (type) => typeName(type).toLowerCase() === selectedType,
      ),
    );
  const scopeLabel = () =>
    generation === "all"
      ? "All 9 generations"
      : `Generation ${generation} · ${GENERATIONS[Number(generation) - 1]?.[1] || ""}`;
  const artwork = (entry, classes = "", hidden = false) =>
    `<img class="game-artwork ${classes}" src="${escapeHTML(entry?.artwork || FALLBACK_ART)}" alt="${escapeHTML(hidden ? "Mystery Pokémon silhouette" : entry?.name || "Poké Ball")}" draggable="false" ${hidden ? "" : 'loading="lazy"'}>`;

  function stopTimer() {
    if (timer !== null) window.clearInterval(timer);
    timer = null;
  }

  function generationSelect() {
    return `<label class="game-field"><span>Pokédex range</span><select name="game-generation" aria-label="Pokédex generation"><option value="all" ${generation === "all" ? "selected" : ""}>All generations · 1–9</option>${GENERATIONS.map(([number, region]) => `<option value="${number}" ${generation === String(number) ? "selected" : ""}>Gen ${number} · ${region}</option>`).join("")}</select></label>`;
  }

  function backButton() {
    return '<button class="game-back" type="button" data-game-action="menu"><span aria-hidden="true">←</span> Back to arcade</button>';
  }

  function renderMenu() {
    const gengar =
      pokemon.find((entry) => Number(entry.id) === 94) || pokemon[0];
    const pikachu =
      pokemon.find((entry) => Number(entry.id) === 25) ||
      pokemon[1] ||
      pokemon[0];
    return `<div class="game-heading"><div><p class="game-eyebrow">THE ROTOM ARCADE</p><h1>Put your Pokédex<br>knowledge to the test.</h1><p>Take a break from the research. A little friendly competition is good for a Trainer.</p></div><div class="game-live-badge"><span></span> TRAINING MODE</div></div>
      <div class="game-picker">
        <article class="game-pick-card game-pick-quiz"><div class="game-pick-top"><span class="game-pill">01 / THE CLASSIC</span><span class="game-pick-glyph" aria-hidden="true">?</span></div><div class="game-pick-art">${artwork(gengar, "game-card-silhouette", true)}<span class="game-art-orbit"></span></div><div class="game-pick-copy"><p class="game-eyebrow">A FAMILIAR SHADOW</p><h2>Who’s that Pokémon?</h2><p>One silhouette. One guess. Ten rounds to prove you know your Pokémon.</p><div class="game-pick-meta"><span>10 rounds</span><span>All 9 generations</span></div><button class="button button-primary" type="button" data-game-action="quiz-setup">Take the challenge <span aria-hidden="true">↗</span></button></div></article>
        <article class="game-pick-card game-pick-blitz"><div class="game-pick-top"><span class="game-pill">02 / THINK FAST</span><span class="game-pick-glyph" aria-hidden="true">ϟ</span></div><div class="game-pick-art">${artwork(pikachu)}<span class="game-art-orbit"></span></div><div class="game-pick-copy"><p class="game-eyebrow">AGAINST THE CLOCK</p><h2>Pokémon Blitz</h2><p>Pick a type and name as many Pokémon as you can. The clock is ticking.</p><div class="game-pick-meta"><span>2 minutes</span><span>18 types</span></div><button class="button button-secondary" type="button" data-game-action="blitz-setup">Start a Blitz <span aria-hidden="true">↗</span></button></div></article>
      </div><p class="game-footer-note"><span aria-hidden="true">✦</span> From Bulbasaur to Pecharunt. Every generation is invited.</p>`;
  }

  function renderQuizSetup() {
    return `${backButton()}<section class="game-setup game-setup-quiz"><div class="game-setup-icon" aria-hidden="true">?</div><p class="game-eyebrow">SILHOUETTE CHALLENGE</p><h1>Who’s that Pokémon?</h1><p>Identify 10 Pokémon from their silhouettes. You get one guess per round, so make it count.</p><div class="game-setup-options">${generationSelect()}</div><p class="game-small-print">Names ignore accents, spaces and punctuation. No timer — take your time.</p><button class="button button-primary" type="button" data-game-action="start-quiz" ${scopedPokemon().length ? "" : "disabled"}>Start 10 rounds <span aria-hidden="true">→</span></button></section>`;
  }

  function renderQuiz() {
    const current = quizDeck[quizIndex];
    const progress = Math.round(
      ((quizIndex + (quizAnswered ? 1 : 0)) / quizDeck.length) * 100,
    );
    return `${backButton()}<section class="game-arena"><div class="game-arena-head"><div><p class="game-eyebrow">WHO’S THAT POKÉMON?</p><h1>${quizAnswered ? "Mystery, solved." : "Know this silhouette?"}</h1></div><div class="game-scoreboard"><div><span>ROUND</span><strong>${quizIndex + 1}<small> / ${quizDeck.length}</small></strong></div><div><span>CORRECT</span><strong>${quizScore.toString().padStart(2, "0")}</strong></div></div></div><div class="game-round-track" role="progressbar" aria-label="Quiz progress" aria-valuemin="0" aria-valuemax="${quizDeck.length}" aria-valuenow="${quizIndex + (quizAnswered ? 1 : 0)}"><span style="width:${progress}%"></span></div><div class="game-quiz-grid"><div class="game-mystery-stage ${quizAnswered ? "game-revealed" : ""}"><span class="game-stage-dots" aria-hidden="true"></span><span class="game-stage-number" aria-hidden="true">${quizAnswered ? nationalNumber(current) : "????"}</span>${artwork(current, quizAnswered ? "" : "game-silhouette", !quizAnswered)}<span class="game-stage-label">${quizAnswered ? escapeHTML(current.name) : "POKÉMON SIGNAL DETECTED"}</span></div><div class="game-answer-panel"><p class="game-eyebrow">${escapeHTML(scopeLabel())}</p>${quizAnswered ? `<div class="game-quiz-feedback ${quizCorrect ? "game-correct" : "game-incorrect"}" role="status"><span class="game-feedback-symbol" aria-hidden="true">${quizCorrect ? "✓" : quizSkipped ? "↪" : "×"}</span><h2>${quizCorrect ? "You got it!" : quizSkipped ? "Now you know." : "A tricky one."}</h2><p>It’s <strong>${escapeHTML(current.name)}</strong>!${!quizCorrect && !quizSkipped ? ` Your guess: ${escapeHTML(quizGuess)}.` : ""}</p></div><button class="button button-primary" type="button" data-game-action="next-quiz" data-game-focus>${quizIndex === quizDeck.length - 1 ? "See my results" : "Next Pokémon"} <span aria-hidden="true">→</span></button>` : `<h2>Who’s that Pokémon?</h2><p>Trust your Trainer instincts. Type a name to reveal the answer.</p><form data-game-form="quiz"><label class="game-field"><span>Your guess</span><input name="answer" type="text" placeholder="Enter a Pokémon name" autocomplete="off" autocapitalize="off" spellcheck="false" required maxlength="80" data-game-focus></label><button class="button button-primary" type="submit">Lock in my guess <span aria-hidden="true">→</span></button></form><button class="game-text-button" type="button" data-game-action="skip-quiz">I don’t know · reveal answer</button>`}<p class="game-round-note">ONE GUESS. NO PRESSURE.</p></div></div></section>`;
  }

  function renderQuizResults() {
    const perfect = quizScore === quizDeck.length;
    const good = quizScore >= quizDeck.length / 2;
    return `${backButton()}<section class="game-results"><div class="game-result-icon" aria-hidden="true">${perfect ? "★" : "✦"}</div><p class="game-eyebrow">SILHOUETTE CHALLENGE COMPLETE</p><h1>${perfect ? "A perfect Pokédex memory." : good ? "You know your Pokémon." : "Every Trainer starts somewhere."}</h1><div class="game-result-score"><strong>${quizScore}</strong><span>/ ${quizDeck.length}</span></div><p>${perfect ? "Every silhouette identified. Rotom is impressed!" : `${quizScore} correct ${quizScore === 1 ? "answer" : "answers"}. There’s always another Pokémon to discover.`}</p><p class="game-result-scope">${escapeHTML(scopeLabel())}</p><div class="game-result-actions"><button class="button button-primary" type="button" data-game-action="start-quiz" data-game-focus>Play again <span aria-hidden="true">↻</span></button><button class="button button-secondary" type="button" data-game-action="quiz-setup">Change generation</button></div><div class="game-result-gallery">${quizDeck.map((entry) => `<div>${artwork(entry)}<span>${escapeHTML(entry.name)}</span></div>`).join("")}</div></section>`;
  }

  function renderBlitzSetup() {
    return `${backButton()}<section class="game-setup game-setup-blitz"><div class="game-setup-icon" aria-hidden="true">ϟ</div><p class="game-eyebrow">TWO MINUTES. AS MANY AS YOU CAN.</p><h1>Ready for a Pokémon Blitz?</h1><p>Choose a type, then name as many unique Pokémon of that type as you can in 120 seconds. Dual types count, too.</p><div class="game-setup-options">${generationSelect()}<fieldset class="game-types"><legend>Pick your type</legend><div>${TYPES.map((type) => `<label class="game-type-choice game-type-${type}"><input type="radio" name="game-type" value="${type}" ${selectedType === type ? "checked" : ""}><span>${titleCase(type)}</span></label>`).join("")}</div></fieldset></div><p class="game-small-print" data-game-pool-size>${typePokemon().length} ${titleCase(selectedType)}-type Pokémon in your selected range.</p><button class="button button-primary" type="button" data-game-action="start-blitz" ${typePokemon().length ? "" : "disabled"}>Start the clock <span aria-hidden="true">→</span></button></section>`;
  }

  function renderBlitz() {
    return `${backButton()}<section class="game-arena"><div class="game-arena-head"><div><p class="game-eyebrow">POKÉMON BLITZ · ${escapeHTML(scopeLabel())}</p><h1>Think ${titleCase(selectedType)}. Think fast.</h1></div><div class="game-scoreboard"><div><span>TIME LEFT</span><strong class="game-timer" data-game-timer aria-label="2 minutes remaining">2:00</strong></div><div><span>FOUND</span><strong data-game-found-count>00<small> / ${blitzPool.length}</small></strong></div></div></div><div class="game-round-track game-clock-track"><span data-game-clock-bar style="width:100%"></span></div><div class="game-blitz-layout"><div class="game-blitz-input"><span class="game-blitz-type game-type-${selectedType}">${titleCase(selectedType)}</span><h2>Name ${/^[aeiou]/.test(selectedType) ? "an" : "a"} ${selectedType}-type Pokémon.</h2><p>Both single and dual types count. Every unique Pokémon earns a point.</p><form data-game-form="blitz"><label class="game-field"><span>Pokémon name</span><input name="answer" type="text" placeholder="Quick, name a Pokémon…" autocomplete="off" autocapitalize="off" spellcheck="false" required maxlength="80" aria-describedby="game-blitz-feedback" data-game-focus></label><button class="button button-primary" type="submit">Add Pokémon <span aria-hidden="true">+</span></button></form><p class="game-blitz-feedback" id="game-blitz-feedback" role="status" aria-live="polite">Your first Pokémon is waiting.</p><button class="game-text-button" type="button" data-game-action="stop-blitz">Finish this round early</button></div><div class="game-catches"><div class="game-catches-head"><h2>Your discoveries</h2><span data-game-discovery-count>0 found</span></div><div class="game-found-grid" data-game-found-grid><div class="game-empty-catches"><span aria-hidden="true">◎</span><p>The Pokédex is listening.<br>Your correct answers appear here.</p></div></div></div></div></section>`;
  }

  function foundCard(entry) {
    return `<div class="game-found-card">${artwork(entry)}<div><span>${nationalNumber(entry)}</span><strong>${escapeHTML(entry.name)}</strong></div><span class="game-found-check" aria-hidden="true">✓</span></div>`;
  }

  function renderBlitzResults() {
    const allFound = found.length === blitzPool.length;
    const missed = blitzPool.filter((entry) => !foundIds.has(entry.id));
    return `${backButton()}<section class="game-results game-blitz-results"><div class="game-result-icon" aria-hidden="true">ϟ</div><p class="game-eyebrow">POKÉMON BLITZ COMPLETE</p><h1>${allFound ? "You named them all!" : endedEarly ? "That’s a wrap, Trainer." : "Time’s up, Trainer."}</h1><div class="game-result-score"><strong>${found.length}</strong><span>/ ${blitzPool.length}</span></div><p>${titleCase(selectedType)}-type Pokémon named. ${allFound ? "A complete collection. Incredible memory!" : "Ready to beat your score?"}</p><p class="game-result-scope">${escapeHTML(scopeLabel())}${endedEarly ? " · Finished early" : ""}</p><div class="game-result-actions"><button class="button button-primary" type="button" data-game-action="start-blitz" data-game-focus>Play again <span aria-hidden="true">↻</span></button><button class="button button-secondary" type="button" data-game-action="blitz-setup">Change type</button></div>${found.length ? `<div class="game-result-discoveries"><h2>Your discoveries</h2><div class="game-found-grid">${found.map(foundCard).join("")}</div></div>` : ""}${missed.length ? `<details class="game-missed"><summary>Discover the ${missed.length} Pokémon you missed</summary><div class="game-missed-list">${missed.map((entry) => `<span>${escapeHTML(entry.name)}</span>`).join("")}</div></details>` : ""}</section>`;
  }

  function render(focus = false) {
    if (disposed) return;
    const screens = {
      menu: renderMenu,
      "quiz-setup": renderQuizSetup,
      quiz: renderQuiz,
      "quiz-results": renderQuizResults,
      "blitz-setup": renderBlitzSetup,
      blitz: renderBlitz,
      "blitz-results": renderBlitzResults,
    };
    container.innerHTML = `<div class="game-suite">${pokemon.length ? screens[screen]() : '<div class="game-setup"><h1>The arcade is warming up.</h1><p>The Pokémon catalogue needs to load before you can play. Please try again in a moment.</p></div>'}</div>`;
    if (focus) {
      const target =
        container.querySelector("[data-game-focus]") ||
        container.querySelector("h1");
      if (target?.tagName === "H1") target.tabIndex = -1;
      target?.focus({ preventScroll: true });
    }
  }

  function startQuiz() {
    stopTimer();
    quizDeck = shuffledSample(scopedPokemon(), 10);
    if (!quizDeck.length) return;
    quizIndex = 0;
    quizScore = 0;
    quizAnswered = false;
    quizSkipped = false;
    screen = "quiz";
    render(true);
  }

  function answerQuiz(answer, skipped = false) {
    if (screen !== "quiz" || quizAnswered) return;
    quizGuess = answer.trim();
    if (!skipped && !quizGuess) return;
    quizCorrect =
      !skipped &&
      aliasesFor(quizDeck[quizIndex]).has(normalizePokemonName(quizGuess));
    quizSkipped = skipped;
    quizAnswered = true;
    if (quizCorrect) quizScore += 1;
    render(true);
  }

  function finishBlitz(early = false) {
    if (screen !== "blitz") return;
    stopTimer();
    endedEarly = early;
    screen = "blitz-results";
    render(true);
  }

  function tick() {
    if (disposed || screen !== "blitz") return;
    secondsLeft = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    if (secondsLeft === 0) {
      finishBlitz();
      return;
    }
    const timerElement = container.querySelector("[data-game-timer]");
    if (timerElement) {
      timerElement.textContent = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;
      timerElement.setAttribute(
        "aria-label",
        `${Math.floor(secondsLeft / 60)} minutes ${secondsLeft % 60} seconds remaining`,
      );
      timerElement.classList.toggle("game-time-urgent", secondsLeft <= 15);
    }
    const bar = container.querySelector("[data-game-clock-bar]");
    if (bar) bar.style.width = `${(secondsLeft / 120) * 100}%`;
  }

  function startBlitz() {
    stopTimer();
    blitzPool = typePokemon();
    if (!blitzPool.length) return;
    blitzAliases = new Map();
    blitzPool.forEach((entry) =>
      aliasesFor(entry).forEach((alias) => blitzAliases.set(alias, entry)),
    );
    found = [];
    foundIds = new Set();
    feedback = "";
    feedbackTone = "";
    endedEarly = false;
    secondsLeft = 120;
    deadline = Date.now() + 120_000;
    screen = "blitz";
    render(true);
    timer = window.setInterval(tick, 250);
  }

  function answerBlitz(form) {
    if (screen !== "blitz") return;
    if (Date.now() >= deadline) {
      finishBlitz();
      return;
    }
    const input = form.elements.namedItem("answer");
    const guess = input.value.trim();
    if (!guess) return;
    const entry = blitzAliases.get(normalizePokemonName(guess));
    if (!entry) {
      feedback = `No match for “${guess}” in this ${selectedType}-type range. Try another name.`;
      feedbackTone = "game-incorrect";
      input.select();
    } else if (foundIds.has(entry.id)) {
      feedback = `${entry.name} is already in your discoveries. Keep going!`;
      feedbackTone = "game-duplicate";
      input.select();
    } else {
      found.push(entry);
      foundIds.add(entry.id);
      feedback = `${entry.name} — added! ${found.length} Pokémon found.`;
      feedbackTone = "game-correct";
      input.value = "";
      const grid = container.querySelector("[data-game-found-grid]");
      grid.querySelector(".game-empty-catches")?.remove();
      grid.insertAdjacentHTML("afterbegin", foundCard(entry));
      container.querySelector("[data-game-found-count]").innerHTML =
        `${String(found.length).padStart(2, "0")}<small> / ${blitzPool.length}</small>`;
      container.querySelector("[data-game-discovery-count]").textContent =
        `${found.length} found`;
      if (found.length === blitzPool.length) {
        finishBlitz();
        return;
      }
    }
    const status = container.querySelector("#game-blitz-feedback");
    status.className = `game-blitz-feedback ${feedbackTone}`;
    status.textContent = feedback;
    input.focus({ preventScroll: true });
  }

  function onClick(event) {
    const button = event.target.closest?.("[data-game-action]");
    if (!button || !container.contains(button) || button.disabled) return;
    const action = button.dataset.gameAction;
    if (
      action === "menu" ||
      action === "quiz-setup" ||
      action === "blitz-setup"
    ) {
      stopTimer();
      screen = action;
      render();
    } else if (action === "start-quiz") startQuiz();
    else if (action === "skip-quiz") answerQuiz("", true);
    else if (action === "next-quiz" && screen === "quiz" && quizAnswered) {
      if (quizIndex === quizDeck.length - 1) screen = "quiz-results";
      else {
        quizIndex += 1;
        quizAnswered = false;
        quizSkipped = false;
      }
      render(true);
    } else if (action === "start-blitz") startBlitz();
    else if (action === "stop-blitz") finishBlitz(true);
  }

  function onSubmit(event) {
    const form = event.target;
    if (!form.matches("[data-game-form]")) return;
    event.preventDefault();
    if (form.dataset.gameForm === "quiz")
      answerQuiz(form.elements.namedItem("answer").value);
    else if (form.dataset.gameForm === "blitz") answerBlitz(form);
  }

  function onChange(event) {
    const input = event.target;
    if (input.name === "game-generation") {
      generation = input.value;
    } else if (input.name === "game-type") selectedType = input.value;
    else return;
    if (screen === "blitz-setup") {
      const count = typePokemon().length;
      container.querySelector("[data-game-pool-size]").textContent =
        `${count} ${titleCase(selectedType)}-type Pokémon in your selected range.`;
      container.querySelector('[data-game-action="start-blitz"]').disabled =
        count === 0;
    } else if (screen === "quiz-setup")
      container.querySelector('[data-game-action="start-quiz"]').disabled =
        scopedPokemon().length === 0;
  }

  function onImageError(event) {
    const target = event.target;
    if (
      target.tagName === "IMG" &&
      target.classList.contains("game-artwork") &&
      !target.dataset.fallback
    ) {
      target.dataset.fallback = "true";
      target.src = FALLBACK_ART;
    }
  }

  function onVisibilityChange() {
    if (!document.hidden) tick();
  }

  container.addEventListener("click", onClick);
  container.addEventListener("submit", onSubmit);
  container.addEventListener("change", onChange);
  container.addEventListener("error", onImageError, true);
  document.addEventListener("visibilitychange", onVisibilityChange);
  render();

  return () => {
    disposed = true;
    stopTimer();
    container.removeEventListener("click", onClick);
    container.removeEventListener("submit", onSubmit);
    container.removeEventListener("change", onChange);
    container.removeEventListener("error", onImageError, true);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
}
