/**
 * THE GYM REQUEST — everything the gym brain is sent, and nothing else.
 *
 * THIS IS WHERE THE TWO BRAINS COULD MOST EASILY HAVE LEAKED INTO ONE, so it is worth saying
 * plainly what this file does NOT do. It does not import api/personal-coach.js. It does not send
 * the functional system prompt, the functional policy book, or the functional foundation brief.
 * A gym request carries four things and they are all written here or in lib/gym-layers/:
 *
 *   1. safety — the same legal floor every product of ours stands on, in this product's words
 *   2. the cost ceiling — the same money, enforced by the same server-side caps
 *   3. the gym knowledge layers
 *   4. the JSON contract for a six-week block
 *
 * WHY NOT SHARE THE FUNCTIONAL SAFETY TEXT. Because the two products do not say the same thing.
 * There, the coach IS the product. Here a human coach stands between us and the athlete and
 * carries the responsibility, and the safety paragraph has to say so. Sharing the string would
 * have been the tidier-looking mistake.
 *
 * THE ONE WEEK. A gym block is written ONCE and repeated for six weeks — one call, not four,
 * which is also why it costs a quarter of what a functional brick costs. The contract below
 * states that in the strongest terms available, because a model trained on the other product
 * will reach for four different weeks if allowed to.
 *
 * 0 LLM in this file. It assembles text.
 */

"use strict";

const GymLayers = require("./gym-layers");
const GymIntake = require("./gym-intake.js");
const GymHandoff = require("./gym-handoff.js");

/** The legal floor. Same obligation as everywhere else, said for THIS product. */
const GYM_SAFETY =
  "MANDATORY LEGAL & SAFETY DIRECTIVE (HARD):\n" +
  "1. You are software, not a certified trainer and not a physician. A HUMAN COACH reads\n" +
  "   everything you write before an athlete sees it, and that coach carries the responsibility.\n" +
  "   Write for them, not past them.\n" +
  "2. If the intake reports pain, an injury or a restriction: design AROUND it and say plainly\n" +
  "   that it was designed around. Never write rehabilitation programming and never imply that a\n" +
  "   programme treats an injury — that is a different profession and not this product.\n" +
  "3. Never prescribe a load as a number of kilos. Effort out of ten, and the coach in the room\n" +
  "   turns that into weight for the person in front of them.\n" +
  "4. If an athlete's answers are missing something you would need to program safely, say which\n" +
  "   answer is missing. Do not fill the gap yourself.\n";

/** The money. The caps are the product's, and the server enforces them either way. */
const GYM_COST =
  "COST (HARD — the same monthly envelope as everything else, POL-COST-001..010):\n" +
  "- ONE call writes the block. There is no week-by-week fill here, because there is only one\n" +
  "  week to write. Do not ask for more calls and do not split the work.\n" +
  "- Never regenerate a whole block to change one line. A correction is a correction.\n" +
  "- After the monthly cap the server refuses programming outright: say so briefly and stop.\n";

/** The shape of the answer. Named explicitly, because the other product's shape is four weeks. */
const GYM_CONTRACT =
  "=== WHAT YOU RETURN ===\n" +
  "\n" +
  "ONE WEEK. A single training week, and nothing else. The software repeats it across all six\n" +
  "weeks of the block for you - you do not write six, and you do not need to.\n" +
  "\n" +
  "That is not a formatting preference. The athlete gets stronger at the SAME exercises week\n" +
  "after week, and an exercise that keeps being swapped is one nobody can progress at. Variety\n" +
  "belongs BETWEEN blocks.\n" +
  "\n" +
  "Return <<<WEEK_JSON ... WEEK_JSON>>> holding that one week.\n" +
  "\n" +
  "LANGUAGE. Exercise lines, titles and every other field are ENGLISH — always, whoever reads\n" +
  "them. The checks that keep this athlete safe find equipment and movements by their ENGLISH\n" +
  "names, and a line written in another language is a line nothing can check. The reader is\n" +
  "shown Hebrew beside the English by the software, not instead of it.\n" +
  "The ONE exception is the progression notes below, which are prose a person reads and no\n" +
  "check can measure: write those in the athlete's language, named in the packet.\n" +
  "\n" +
  "Every training day is a list of exercises, and every exercise line carries, in this order:\n" +
  "  the number of sets, the number of reps, the exercise name, and the effort out of ten.\n" +
  "  e.g. \"4 x 10 Leg Press @ 7/10\"\n" +
  "NAME THE EXERCISE, NOT THE CATALOGUE. Write \"Crunch\", not \"Exercise Mat Crunches\"; write\n" +
  "  \"Cable Rear Delt Fly\", not \"Dual Adjustable Pulley Rear Delt Fly\". The equipment list is\n" +
  "  there to tell you what the room HAS, not to be copied into the name of a movement.\n" +
  "A weight in kilos is NOT written. The coach adds it by hand where they want to.\n" +
  "\n" +
  "HOW MUCH GOES IN A DAY: 18-24 working sets, AIMING AT 20. Five exercises of three sets is\n" +
  "  fifteen, which is under the floor - so a day is typically five or six exercises, with four\n" +
  "  sets on the compound work. COUNT THE SETS before you finish a day, and add work if the\n" +
  "  total is short. Sixty minutes is the ceiling on what fits, not a target to fill.\n" +
  "Core work goes at the END of a session and is NOT counted in the session's set total.\n" +
  "A day that is not a training day is a Rest day: overview focus exactly \"Rest\", parts [].\n" +
  "\n" +
  "THE SHAPE, EXACTLY. Copy these keys. Do not rename them and do not invent your own:\n" +
  "\n" +
  "{\n" +
  "  \"summaryLine\": \"what this block is for\",\n" +
  "  \"theme\": \"a short name for the week\",\n" +
  "  \"days\": {\n" +
  "    \"sun\": { \"parts\": [ { \"title\": \"Full Body A\", \"lines\": [\"4 x 10 Leg Press @ 7/10\", \"3 x 12 Lat Pulldown @ 7/10\"] } ] },\n" +
  "    \"mon\": { \"parts\": [] },\n" +
  "    \"tue\": { \"parts\": [ ... ] }, \"wed\": { \"parts\": [] },\n" +
  "    \"thu\": { \"parts\": [ ... ] }, \"fri\": { \"parts\": [] }, \"sat\": { \"parts\": [] }\n" +
  "  }\n" +
  "}\n" +
  "\n" +
  "\n" +
  "A NOTE ON EACH SESSION, ONE FOR EVERY WEEK OF THE BLOCK.\n" +
  "Every part also carries \"progression\": an array of EXACTLY " + GymIntake.BLOCK_WEEKS + " short lines, one\n" +
  "  per week in order. Line 1 is read in week 1, line 3 in week 3, and so on.\n" +
  "  DO NOT WRITE THE WEEK NUMBER INTO THE LINE. The software knows which week each one is\n" +
  "  read in and puts it there; a line that says \"Week 1\" was found sitting on week 7 of a\n" +
  "  continuation, because what you call week 1 is this BLOCK's first week and not the\n" +
  "  athlete's. Write the instruction and let the software place it.\n" +
  "\n" +
  "The sessions are identical every week ON PURPOSE — the same movements are what the load\n" +
  "rises on. These lines are the only thing that tells the athlete week 3 is not week 1.\n" +
  "  e.g. W1 \"Find the weight where the last two reps are hard. Do not chase heavy today.\"\n" +
  "       W3 \"The weight from week 1 should feel easier now. If it does, go up.\"\n" +
  "       W5 \"Top set at 8/10. If every set still feels 6, the weight is too light.\"\n" +
  "\n" +
  "LOAD AND PROGRESSION ONLY. Not technique, not form cues, not where to feel it — a human\n" +
  "coach stands in the room for that and this is not the place to compete with him.\n" +
  "NEVER a weight in kilos here either. Effort, reps and \"go up\" — the coach picks the number.\n" +
  "The seven day keys are sun mon tue wed thu fri sat, all seven present, and a day nobody\n" +
  "trains has an empty parts array. Every exercise is one string in \"lines\".\n";

function isObj(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/**
 * Everything the gym brain reads, in one string.
 *
 * @param {object} opts
 * @param {object} [opts.answers] the gym questionnaire, normalised
 * @param {boolean} [opts.methods] inject the training-methods layer
 * @returns {string}
 */
function buildGymSystem(opts) {
  const o = isObj(opts) ? opts : {};
  const pack = GymLayers.buildGymLayerPack({ methods: o.methods === true });
  const parts = [GYM_SAFETY, GYM_COST, pack.text];
  /* WHAT CAME BEFORE, when there is a before. It goes in FRONT of the contract, because the
     contract is the last thing read and must stay the last word on SHAPE. This section is
     about CONTENT: which exercises not to repeat, which muscle was short, where the deload
     count stands. Measured off the delivered block, never narrated. */
  const before = o.handoff ? GymHandoff.handoffText(o.handoff) : "";
  if (before) parts.push(before);
  parts.push(GYM_CONTRACT);
  return parts.join("\n---\n");
}

/**
 * The request that builds a gym client's block.
 *
 * Refuses rather than guesses: a questionnaire with a hole in it comes back as a list of what is
 * missing, because a split nobody chose or a room nobody described would otherwise be invented
 * by the model and look exactly like an answer.
 *
 * @param {object} o
 * @param {object} o.answers the gym questionnaire's answers
 * @param {object} [o.costCaps] the owner's spend caps, so the server can refuse
 * @param {string} [o.athleteId]
 * @param {object} [o.handoff] what the previous block left behind — see the next round
 * @returns {{ok:boolean, body?:object, why?:string, missing?:string[]}}
 */
function gymBlockRequestFor(o) {
  const src = isObj(o) ? o : {};
  const answers = GymIntake.normalize(src.answers);
  const gaps = GymIntake.missing(src.answers);
  if (gaps.length) {
    return { ok: false, why: gaps[0], missing: gaps };
  }

  const body = {
    action: "gym_generate_block",
    gymBrain: true,
    forceJson: true,
    adminProgramming: true,
    blockWeeks: GymIntake.BLOCK_WEEKS,
    gymIntake: answers,
    messages: [{ role: "user", text: GymIntake.buildGymPacket(src.answers) }],
    equipment: GymIntake.gearList(src.answers),
  };
  if (src.athleteId) body.athleteId = String(src.athleteId);
  if (isObj(src.costCaps)) body.costCaps = src.costCaps;
  /* A continuation says what CHANGED, not what happened. See the handoff round. */
  if (isObj(src.handoff)) body.gymHandoff = src.handoff;

  return {
    ok: true,
    body: body,
    system: buildGymSystem({
      answers: answers,
      methods: src.methods === true,
      handoff: isObj(src.handoff) ? src.handoff : null,
    }),
  };
}

module.exports = {
  GYM_SAFETY,
  GYM_COST,
  GYM_CONTRACT,
  buildGymSystem,
  gymBlockRequestFor,
};
