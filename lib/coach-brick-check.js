/**
 * The mechanical check on a returned brick — what a machine can be CERTAIN about.
 *
 * WHY IT EXISTS. POL-027 already says "never invent missing machines/rigs/ropes/rings", and it
 * was sent, in full, in the prompt that produced עודד מכינה's first brick. The brick came back
 * with ring rows, single-unders, 50cm box jumps and a rower — none of which exist in that room —
 * and 22.5 kg dumbbells against a 15 kg ceiling. The doctrine was never missing. It had no teeth,
 * because the room arrived as a paragraph and a paragraph cannot be checked.
 *
 * Now it arrives as an inventory (lib/equipment-catalog.js), so the same sentence becomes a
 * testable fact, and this file is what tests it.
 *
 * TWO OUTPUTS, AND THE LINE BETWEEN THEM IS THE WHOLE DESIGN (owner, 2026-09-14):
 *
 *   blocking  things a machine is CERTAIN about. A movement whose implement was never ticked. A
 *             load above a stated ceiling. A week with no bodyweight work in it at all. A session
 *             count that is not the count that was asked for. These go back to the coach with the
 *             brick in hand and the list of violations — they are not shown to the owner as advice
 *             he has to act on, because there is nothing to weigh.
 *
 *   flags     things that need judgement. Whether a session actually matches the shape the owner
 *             described is not countable, and a warning that is sometimes wrong teaches people to
 *             ignore the ones that are right (the dosage rule, owner 2026-09-05).
 *
 * NOTHING HERE CAN BLOCK A BODYWEIGHT MOVEMENT. Equipment is additive (POL-027): the catalogue
 * says what a movement REQUIRES, never what the coach may write, and a week built with no
 * equipment-free work in it is itself a violation — the check runs in both directions. The owner
 * asked for that guard by name: "אסור בטעות שנשכח את הדברים שלא צריך ציוד בשבילם".
 *
 * NO MODEL CALL. NO COST. Pure functions over the returned JSON.
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./equipment-catalog.js"));
  } else {
    root.CoachBrickCheck = factory(root.EquipmentCatalog);
  }
})(typeof self !== "undefined" ? self : this, function (Catalog) {
  "use strict";

  var DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  /* Enough to act on, few enough to read. The same ceiling the flags use. */
  var MAX_VIOLATIONS = 12;

  function isObj(v) {
    return !!v && typeof v === "object" && !Array.isArray(v);
  }

  function partText(part) {
    var lines = (part && part.lines) || [];
    return String((part && part.title) || "") + " " + lines.join(" ");
  }

  function isRestPart(part) {
    return /rest day/i.test(String((part && part.title) || ""));
  }

  /** Every written line of the brick, each tagged with where it came from. */
  function walkLines(block) {
    var out = [];
    var weeks = (block && block.weeks) || [];
    weeks.forEach(function (w, wi) {
      var idx = w.weekIndex || w.weekNumber || wi + 1;
      var days = (w && w.days) || {};
      DAY_KEYS.forEach(function (d) {
        var parts = (days[d] || {}).parts || [];
        parts.forEach(function (p) {
          if (isRestPart(p)) return;
          var lines = (p && p.lines) || [];
          lines.forEach(function (line) {
            if (String(line || "").trim()) {
              out.push({ week: idx, day: d, text: String(line), part: p });
            }
          });
          if (!lines.length && p && p.title) {
            out.push({ week: idx, day: d, text: String(p.title), part: p });
          }
        });
      });
    });
    return out;
  }

  function available(list, id) {
    var row = isObj(list) && isObj(list[id]) ? list[id] : null;
    return !!(row && row.have);
  }

  function answered(list) {
    if (!isObj(list)) return false;
    return Object.keys(list).some(function (k) {
      return list[k] && list[k].have;
    });
  }

  /**
   * Equipment. A group from requiredFor() is satisfied when ANY of its members is ticked, so a
   * goblet squat passes in a room with dumbbells and no kettlebells.
   */
  function equipmentViolations(lines, list) {
    var out = [];
    var seen = {};
    lines.forEach(function (l) {
      var groups = Catalog.requiredFor(l.text);
      groups.forEach(function (group) {
        var ok = group.some(function (id) {
          return available(list, id);
        });
        if (ok) return;
        /* One violation per missing implement, not one per line: the coach needs to know the
           rower does not exist, not to read it nine times. */
        var key = group.join("|");
        if (seen[key]) {
          seen[key].count++;
          return;
        }
        seen[key] = {
          kind: "equipment",
          need: group,
          count: 1,
          where: "W" + l.week + " " + l.day,
          example: l.text.slice(0, 90),
        };
        out.push(seen[key]);
      });
    });
    return out;
  }

  /**
   * Ceilings. Only a number the text itself states, compared with a ceiling the owner himself
   * typed — no inference, in either direction. This is the check that would have stopped 22.5 kg
   * in a room whose dumbbells stop at 15.
   */
  function ceilingViolations(lines, list) {
    var out = [];
    var seen = {};
    lines.forEach(function (l) {
      var groups = Catalog.requiredFor(l.text);
      var kgs = [];
      var re = /(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilo|kilos)\b/gi;
      var m;
      while ((m = re.exec(l.text))) kgs.push(parseFloat(m[1]));
      if (!kgs.length) return;
      var heaviest = Math.max.apply(null, kgs);
      groups.forEach(function (group) {
        /* Ambiguous groups are skipped on purpose. "Goblet squat 20kg" may be a dumbbell or a
           kettlebell, and blocking against the lower of two ceilings would be a guess. */
        if (group.length !== 1) return;
        var item = Catalog.byId(group[0]);
        var row = isObj(list) && isObj(list[group[0]]) ? list[group[0]] : null;
        if (!item || item.ceiling !== "kg" || !row || !row.have || !row.cap) return;
        if (heaviest <= row.cap) return;
        var key = group[0];
        if (seen[key]) {
          seen[key].count++;
          return;
        }
        seen[key] = {
          kind: "ceiling",
          need: group,
          cap: row.cap,
          wrote: heaviest,
          count: 1,
          where: "W" + l.week + " " + l.day,
          example: l.text.slice(0, 90),
        };
        out.push(seen[key]);
      });
    });
    return out;
  }

  /**
   * The floor, in the other direction. A whole week with no equipment-free movement in it means
   * the coach read the inventory as a menu and forgot the pool that is always open.
   */
  function bodyweightViolations(block) {
    var out = [];
    var weeks = (block && block.weeks) || [];
    weeks.forEach(function (w, wi) {
      var idx = w.weekIndex || w.weekNumber || wi + 1;
      var days = (w && w.days) || {};
      var found = false;
      var wrote = false;
      DAY_KEYS.forEach(function (d) {
        ((days[d] || {}).parts || []).forEach(function (p) {
          if (isRestPart(p)) return;
          wrote = true;
          if (Catalog.hasBodyOnly(partText(p))) found = true;
        });
      });
      /* An empty week is a different problem and not this check's business. */
      if (wrote && !found) {
        out.push({ kind: "bodyweight", where: "W" + idx, count: 1 });
      }
    });
    return out;
  }

  /**
   * The count that was asked for. Countable, and therefore blocking — the owner asked for three
   * sessions with no weekdays attached and received four, hung on weekdays, every week.
   */
  function sessionCountViolations(block, want) {
    var out = [];
    var n = parseInt(want, 10);
    if (!(n > 0)) return out;
    var weeks = (block && block.weeks) || [];
    weeks.forEach(function (w, wi) {
      var idx = w.weekIndex || w.weekNumber || wi + 1;
      var days = (w && w.days) || {};
      var count = 0;
      DAY_KEYS.forEach(function (d) {
        var parts = (days[d] || {}).parts || [];
        var working = parts.filter(function (p) {
          return !isRestPart(p);
        });
        if (working.length) count++;
      });
      if (count !== n) {
        out.push({ kind: "sessions", where: "W" + idx, wrote: count, want: n, count: 1 });
      }
    });
    return out;
  }

  function sentence(v) {
    if (v.kind === "equipment") {
      return (
        v.need.join(" or ") +
        " is NOT available here, and was prescribed" +
        (v.count > 1 ? " " + v.count + " times" : "") +
        " (" + v.where + ": \"" + v.example + "\"). Rewrite those lines with what the place has."
      );
    }
    if (v.kind === "ceiling") {
      return (
        v.need[0] +
        " tops out at " + v.cap + " kg here, and " + v.wrote + " kg was prescribed" +
        (v.count > 1 ? " " + v.count + " times" : "") +
        " (" + v.where + ": \"" + v.example + "\"). Nothing heavier exists."
      );
    }
    if (v.kind === "bodyweight") {
      return (
        v.where +
        " contains no bodyweight or floor movement at all. Equipment ADDS to that pool, it never " +
        "replaces it (POL-027): put real bodyweight work back into the week."
      );
    }
    if (v.kind === "sessions") {
      return (
        v.where + " has " + v.wrote + " sessions, and " + v.want + " were asked for. " +
        "Write exactly " + v.want + "."
      );
    }
    return "";
  }

  /**
   * @param {object} block        the BLOCK_JSON as returned
   * @param {object} [ctx]        { equipmentList, sessionsPerWeek, sessionTypes }
   * @returns {{blocking: string[], flags: string[], violations: object[]}}
   */
  function checkBrick(block, ctx) {
    var c = isObj(ctx) ? ctx : {};
    var result = { blocking: [], flags: [], violations: [] };
    if (!block || !Array.isArray(block.weeks) || !Catalog) return result;

    var lines = walkLines(block);
    var list = c.equipmentList;
    var violations = [];

    /* Every equipment check is skipped when the checklist was never filled. An intake answered
       before the list existed must not be read as "this place owns nothing" — real clients have
       hand-written programmes and an unanswered form is not a claim about their gym. */
    if (answered(list)) {
      violations = violations.concat(equipmentViolations(lines, list));
      violations = violations.concat(ceilingViolations(lines, list));
    }
    violations = violations.concat(bodyweightViolations(block));
    violations = violations.concat(sessionCountViolations(block, c.sessionsPerWeek));

    result.violations = violations.slice(0, MAX_VIOLATIONS);
    result.blocking = result.violations.map(sentence).filter(Boolean);

    /* Judgement, and therefore never blocking: a machine can count the sessions but cannot read
       whether session three is "a long metcon with no strength piece". */
    var types = Array.isArray(c.sessionTypes)
      ? c.sessionTypes.filter(function (t) {
          return String(t || "").trim();
        })
      : [];
    if (types.length) {
      result.flags.push(
        "Check each session against the " + types.length + " shapes you described — that is the " +
          "one thing the server cannot verify for you."
      );
    }
    return result;
  }

  return {
    MAX_VIOLATIONS: MAX_VIOLATIONS,
    checkBrick: checkBrick,
    walkLines: walkLines,
  };
});
