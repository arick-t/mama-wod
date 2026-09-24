/**
 * THE GYM BRAIN — the router, and the wall between it and the CrossFit brain.
 *
 * FROM 2026-09-24 THERE ARE TWO BRAINS. One writes functional training; this one writes
 * commercial-gym resistance work. The owner's instruction, in his words: "אסור בתכלית האיסור
 * שמשהו ממנוע הקרוספיט שבנינו יפגע".
 *
 * SO THE SEPARATION IS STRUCTURAL, NOT A PROMISE:
 *   - every file here is new. Nothing in lib/coach-layers/ is touched, read, or imported.
 *   - this pack never contains a line of the functional doctrine, and that pack never contains a
 *     line of this one. buildGymLayerPack and buildLayerPack do not know about each other.
 *   - the equipment worlds are separate too: lib/equipment-catalog.js is rings, rig and erg;
 *     lib/gym-exercise-library.js is machines, cables and a Smith.
 *   - the check is separate. A gym week run through the functional check comes back with eight
 *     blocking violations, which is the clearest possible proof that one cannot judge the other.
 *   - scripts/two-brains-separate.test.js asserts all of it, and asserts that what the functional
 *     brain sends has not moved.
 *
 * A CLIENT IS ONE OR THE OTHER. There is no client that gets both, and no request that mixes
 * them. If you are ever unsure which brain a client belongs to, that is a bug in the caller,
 * not something to resolve by sending both.
 */

"use strict";

const BASE = require("./base.js");
const LAYER1 = require("./layer1-methodology.js");
const LAYER2 = require("./layer2-construction.js");
const LAYER3 = require("./layer3-methods.js");

/** Splits the questionnaire may hand us, and how many sessions each one needs. */
const SPLITS = {
  full_body: { sessions: [2, 3], he: "FULL BODY" },
  ab_full_body: { sessions: [3], he: "A+B+FULL BODY" },
  push_pull_legs: { sessions: [3, 6], he: "PUSH / PULL / LEGS" },
  ab_muscle_1: { sessions: [4], he: "A+B — לפי גודל שריר, זיווג א׳" },
  ab_muscle_2: { sessions: [4], he: "A+B — לפי גודל שריר, זיווג ב׳" },
  upper_lower: { sessions: [4], he: "A+B — עליון / תחתון" },
};

/** What the tree offers for a given number of sessions, the default first. */
function splitsFor(sessionsPerWeek) {
  const n = parseInt(sessionsPerWeek, 10) || 0;
  if (n <= 2) return ["full_body"];
  if (n === 3) return ["full_body", "ab_full_body", "push_pull_legs"];
  if (n === 4) return ["ab_muscle_1", "ab_muscle_2", "upper_lower"];
  if (n >= 5) return ["push_pull_legs"];
  return ["full_body"];
}

/**
 * Everything the gym brain reads, in one string.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.methods] inject layer 3 — only when variety was asked for
 * @returns {{text:string, layers:string[], chars:number}}
 */
function buildGymLayerPack(opts) {
  const o = opts && typeof opts === "object" ? opts : {};
  const parts = [BASE, LAYER1, LAYER2];
  const names = ["base", "layer1-methodology", "layer2-construction"];
  if (o.methods === true) {
    parts.push(LAYER3);
    names.push("layer3-methods");
  }
  const text = parts.join("\n---\n");
  return { text: text, layers: names, chars: text.length };
}

module.exports = {
  buildGymLayerPack,
  splitsFor,
  SPLITS,
  BASE,
  LAYER1,
  LAYER2,
  LAYER3,
};
