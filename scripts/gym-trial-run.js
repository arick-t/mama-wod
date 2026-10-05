#!/usr/bin/env node
/**
 * A BENCH RUN: several different athletes through the gym brain, first block and continuation.
 *
 * NOT A TEST and deliberately not in `npm test` — it calls a provider and spends real money
 * (about two agorot a block). It exists so the owner can see how the brain answers a beginner,
 * a six-day athlete in a half-equipped room and someone training around a shoulder, instead of
 * judging the product off one generation.
 *
 * Usage:  node scripts/gym-trial-run.js [profiles.json] [--continue]
 * Reads GEMINI_API_KEY / PERSONAL_COACH_MODEL from .env.local, the same as the server.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const Brief = require("../lib/gym-brief.js");
const Build = require("../lib/gym-block-build.js");
const Check = require("../lib/gym-brick-check.js");
const Intake = require("../lib/gym-intake.js");
const Handoff = require("../lib/gym-handoff.js");

/* .env.local, read the plain way — this script is run by hand, never by the server. */
try {
  const env = fs.readFileSync(path.join(root, ".env.local"), "utf8");
  env.split(/\r?\n/).forEach(function (line) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  });
} catch (e) {}

const KEY = String(process.env.GEMINI_API_KEY || "").trim();
const MODEL = String(process.env.PERSONAL_COACH_MODEL || "gemini-2.5-flash").trim();

async function ask(system, text) {
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    encodeURIComponent(MODEL) +
    ":generateContent?key=" +
    encodeURIComponent(KEY);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: text }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 16384 },
    }),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error("provider " + res.status + ": " + raw.slice(0, 200));
  const json = JSON.parse(raw);
  const cand = (json.candidates || [])[0] || {};
  const out = ((cand.content || {}).parts || []).map(function (p) {
    return p.text || "";
  }).join("");
  return { text: out, usage: json.usageMetadata || {}, finish: cand.finishReason || "" };
}

/** What the block looks like, in the terms the doctrine is written in. */
function describe(block, answers) {
  const lines = Check.walkLines(block);
  const perMuscle = {};
  const perDay = {};
  lines.forEach(function (l) {
    if (!l.exercise || !l.sets) return;
    const core = l.exercise.muscle === "core";
    perMuscle[l.exercise.muscle] = (perMuscle[l.exercise.muscle] || 0) + l.sets;
    perDay[l.day] = perDay[l.day] || { work: 0, core: 0 };
    if (core) perDay[l.day].core += l.sets;
    else perDay[l.day].work += l.sets;
  });
  const found = Check.checkGymBlock(block, {
    equipment: Intake.gearList(answers),
    answers: answers,
  });
  return { perMuscle: perMuscle, perDay: perDay, found: found, lines: lines };
}

function printBlock(title, block, answers, usage) {
  const d = describe(block, answers);
  console.log("\n" + "=".repeat(78));
  console.log(title);
  console.log("=".repeat(78));
  const first = (block.weeks || []).find(function (w) {
    return Handoff.DAY_KEYS.some(function (k) {
      return (((w.days || {})[k] || {}).parts || []).length;
    });
  }) || { days: {} };
  Handoff.DAY_KEYS.forEach(function (k) {
    const parts = ((first.days || {})[k] || {}).parts || [];
    if (!parts.length) return;
    parts.forEach(function (p) {
      console.log("\n  " + k.toUpperCase() + "  " + (p.title || ""));
      (p.lines || []).forEach(function (l, i) {
        const isNote = i < (p.noteLines || 0);
        console.log("      " + (isNote ? "↳ " : "• ") + l);
      });
    });
    const n = d.perDay[k] || { work: 0, core: 0 };
    console.log("      → " + n.work + " working sets (+" + n.core + " core)" + (n.work >= 18 && n.work <= 24 ? "  ok" : "  OUTSIDE 18-24"));
  });
  console.log("\n  weekly sets per muscle:");
  Object.keys(d.perMuscle).sort().forEach(function (m) {
    console.log("      " + m.padEnd(10) + String(d.perMuscle[m]).padStart(3));
  });
  console.log("\n  BLOCKING: " + d.found.blocking.length);
  d.found.blocking.forEach(function (b) {
    console.log("      X " + b);
  });
  console.log("  FLAGS: " + d.found.flags.length);
  d.found.flags.forEach(function (f) {
    console.log("      ! " + f);
  });
  if (usage) {
    const inTok = usage.promptTokenCount || 0;
    const outTok = usage.candidatesTokenCount || 0;
    const usd = (inTok / 1e6) * 0.3 + (outTok / 1e6) * 2.5;
    console.log(
      "\n  cost: in " + inTok + " / out " + outTok + " tokens = $" + usd.toFixed(5) +
        " (" + (usd * 3.7 * 100).toFixed(2) + " agorot)"
    );
  }
  return d;
}

async function main() {
  if (!KEY) {
    console.error("No GEMINI_API_KEY — nothing to run.");
    process.exit(1);
  }
  const file = process.argv[2] || path.join(root, "gym-trial-profiles.json");
  const wantContinue = process.argv.indexOf("--continue") >= 0;
  const profiles = JSON.parse(fs.readFileSync(file, "utf8"));
  console.log("model: " + MODEL + " · " + profiles.length + " athletes" + (wantContinue ? " · with continuations" : ""));

  const out = [];
  for (const raw of profiles) {
    const answers = Intake.normalize(raw);
    const built = Brief.gymBlockRequestFor({ answers: raw });
    if (!built.ok) {
      console.log("\n" + raw.tag + ": REFUSED — " + built.why);
      continue;
    }
    const t0 = Date.now();
    const ans = await ask(built.system, built.body.messages[0].text);
    const made = Build.blockFromText(ans.text, { answers: answers, startWeek: 1 });
    if (!made.ok) {
      console.log("\n" + raw.tag + ": could not read a week — " + made.why);
      continue;
    }
    printBlock(
      raw.tag + " · " + (raw.clientName || "") + " · " + raw.sessionsPerWeek + " days · " + raw.split +
        "  [" + ((Date.now() - t0) / 1000).toFixed(1) + "s]",
      made.block,
      answers,
      ans.usage
    );
    out.push({ tag: raw.tag, raw: raw, answers: answers, block: made.block });

    if (!wantContinue) continue;
    const carried = Handoff.handoffFrom({ block: made.block, startWeek: 1, answers: answers });
    if (!carried.ok) continue;
    const next = Brief.gymBlockRequestFor({ answers: raw, handoff: carried.handoff });
    const t1 = Date.now();
    const ans2 = await ask(next.system, next.body.messages[0].text);
    const made2 = Build.blockFromText(ans2.text, {
      answers: answers,
      startWeek: carried.handoff.nextStartWeek,
      deloadSinceWeek: carried.handoff.lastDeloadWeek,
    });
    if (!made2.ok) {
      console.log("\n" + raw.tag + " BLOCK 2: could not read a week — " + made2.why);
      continue;
    }
    const d2 = printBlock(
      raw.tag + " · BLOCK 2 (weeks " + carried.handoff.nextStartWeek + "+)  [" + ((Date.now() - t1) / 1000).toFixed(1) + "s]",
      made2.block,
      answers,
      ans2.usage
    );
    /* The one thing a continuation exists to do. */
    const before = new Set(carried.handoff.exercises.map(function (e) {
      return e.name.toLowerCase();
    }));
    const after = Handoff.handoffFrom({ block: made2.block, startWeek: 1, answers: answers });
    const names = after.ok ? after.handoff.exercises.map(function (e) {
      return e.name.toLowerCase();
    }) : [];
    const repeated = names.filter(function (n) {
      return before.has(n);
    });
    console.log(
      "\n  CHANGED FROM BLOCK 1: " + (names.length - repeated.length) + " of " + names.length +
        " exercises are new" + (repeated.length ? " · repeated: " + repeated.join(", ") : "")
    );
    void d2;
  }
  fs.writeFileSync(path.join(require("os").tmpdir(), "gym-trial-out.json"), JSON.stringify(out));
  console.log("\ndone · " + out.length + " blocks");
}

main().catch(function (e) {
  console.error("FAILED:", e.message);
  process.exit(1);
});
