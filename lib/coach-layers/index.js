/**
 * The router: which layers light up, for whom, and when.
 *
 * Not wired into api/personal-coach.js yet — the owner reviews each prompt first. When it is
 * wired, it replaces nothing: it sits beside coach-foundation-brief / coach-layer2-ops-brief
 * until those two are retired into these files.
 *
 * DECISION ORDER (POL-030, approved by the owner 2026-09-01):
 *   1 safety  2 a manual edit by the owner or the client  3 the intake  4 HARD policy
 *   5 layer 1 methodology  6 layer 2 construction  7 layer 3 discipline
 * Everything below only decides what the coach READS. The ladder decides who WINS.
 *
 * SELECTION IS PER BLOCK, NOT PER DAY. A brick is written in one or two calls, so paying for a
 * discipline layer once per block costs a fraction of paying per day, and the coach needs the
 * whole week in view anyway. Set opts.perDay to switch if that ever proves wrong.
 */

const COACH_CRAFT = require("./coach-craft.js");
const LAYER1_METHODOLOGY = require("./layer1-methodology.js");
const LAYER1_INJURIES = require("./layer1-injuries.js");
const LAYER2_GENERAL = require("./layer2-general.js");
const LAYER2_INDIVIDUAL = require("./layer2-individual.js");
const LAYER2_SESSION_COUNT = require("./layer2-session-count.js");
const LAYER2_DAYS_STUDIO = require("./layer2-days-studio.js");
const LAYER2_DAYS_INDIVIDUAL = require("./layer2-days-individual.js");
const EQUIVALENCE = require("../coach-equivalence-table.js");

const LAYER3 = {
  gymnastics: require("./layer3-gymnastics.js"),
  weightlifting: require("./layer3-weightlifting.js"),
  endurance: require("./layer3-endurance.js"),
  partner: require("./layer3-partner.js"),
};
/* Gated on a declaration, not on keywords — see competitorDeclared(). */
const COMPETITORS = require("./layer3-competitors.js");

/* At most this many discipline layers in one call. A brick that claims to specialise in four
   things specialises in none, and the token bill is real. Highest-signal ones win. */
const MAX_LAYER3 = 2;

/**
 * Discipline triggers.
 *
 * EVERY ALTERNATIVE IS WORD-BOUNDED, and that is not fussiness. The first version of this table
 * used bare substrings and the result was that almost every athlete lit up two wrong layers:
 *   "SKILLS"    -> ski      -> endurance     (a heading in every single intake packet)
 *   "preparing" -> ring     -> gymnastics    ("during", "bringing", "spring" too)
 *   "impression"-> press    -> weightlifting ("depress", "cleanliness" -> clean)
 *   "open gym"  -> open     -> competitors
 * With MAX_LAYER3 = 2 those false hits outranked the real ones. Do not remove a \b here.
 */
/**
 * HEBREW IS A FIRST-CLASS INPUT HERE, not an afterthought. The intake says so in its own header —
 * "Answers may be in any language" — and the owner fills the studio session boxes in Hebrew:
 * "תחנות אירובי", "כוח ומטקון קצר", "מטקון ארוך בלבד". With an English-only table those four
 * sessions selected NO discipline layer at all, while the same four in English selected endurance.
 *
 * \b does not work as a boundary for Hebrew in JS — Hebrew letters are not \w — so the guard is an
 * explicit "not surrounded by another Hebrew letter". It matters: מתח (pull-up) is a substring of
 * מתחיל (beginner) and מתחרה (competitor).
 */
function heb(term) {
  return "(?<![א-ת])" + term + "(?![א-ת])";
}
const HEB = {
  gymnastics: [
    "ג'ימנסטיק\\w*", "גימנסטיק\\w*", "מאסל[ -]?אפ", "עמידת ידיים", "הליכת ידיים",
    "טבעות", "פיסטול\\w*", "קיפינג", "מתח", "כפיפות מתח", "חבל",
  ],
  weightlifting: ["הרמות אולימפיות", "אולימפי\\w*", "הנפות", "סנאץ'?", "קלין", "ג'רק"],
  endurance: ["אירובי\\w*", "סיבולת", "מנוע", "ריצה", "חתירה", "אופניים", "סקי", "קרדיו", "אופני אוויר"],
  partner: ["זוגות", "בזוגות", "זוגי", "פרטנר"],
};
function withHebrew(source, key) {
  return new RegExp(source + "|" + HEB[key].map(heb).join("|"), "i");
}

const LAYER3_TRIGGERS = {
  gymnastics: withHebrew(
    "\\bgymnast\\w*|\\bhandstands?\\b|\\bhspu\\b|\\bmuscle[- ]?ups?\\b|\\bpull[- ]?ups?\\b|\\bchest[- ]to[- ]bar\\b|\\btoes[- ]to[- ]bar\\b|\\bttb\\b|\\bc2b\\b|\\brope climbs?\\b|\\bpistols?\\b|\\brings?\\b|\\bfront lever\\b|\\bback lever\\b|\\bkip(ping)?\\b|\\bbar muscle[- ]?up\\b|\\bstrict\\b",
    "gymnastics"
  ),
  weightlifting: withHebrew(
    "\\bsnatch\\w*|\\bcleans?\\b|\\bclean and jerk\\b|\\bjerks?\\b|\\bolympic\\b|\\boly\\b|\\bbarbell\\b|\\b1rm\\b|\\bone rep max\\b|\\bback squat\\b|\\bfront squat\\b|\\boverhead squat\\b|\\bdeadlift\\w*|\\blift heavier\\b|\\bpush press\\b|\\bstrict press\\b|\\bshoulder press\\b",
    "weightlifting"
  ),
  endurance: withHebrew(
    "\\bendurance\\b|\\bengine\\b|\\baerobic\\b|\\bzone ?2\\b|\\bvo2\\b|\\bcardio\\b|\\brun(ning)?\\b|\\brow(ing|er)?\\b|\\bski ?erg\\b|\\bskierg\\b|\\bassault bike\\b|\\bbike ?erg\\b|\\bconditioning base\\b|\\bgas out\\b|\\bout of breath\\b|\\b\\d+ ?k\\b|\\bmarathon\\b",
    "endurance"
  ),
  partner: withHebrew("\\bpartner\\b|\\bpairs\\b|\\bteams? workout\\b|\\bbuddy\\b", "partner"),
};

/**
 * The competitor layer is NOT keyword-scored. The intake states it in a line of its own, in the
 * negative as well — "COMPETITOR: no — general fitness athlete" — so any substring match on
 * "compet" switched it ON for exactly the athletes it must stay off for. That is the failure the
 * owner named directly: "חשוב לשים לב שאנחנו לא הופכים את כל האינדיבידואלים למתחרים".
 */
const COMPETITOR_YES = /^\s*COMPETITOR:\s*YES\b/im;
const COMPETITOR_NO = /^\s*COMPETITOR:\s*no\b/im;
/** Fallback for a profile written before the intake had the field. */
const COMPETITOR_FREE_TEXT =
  /\bcompet(e|ing|ition|itions|itive|itor)\b|\bthe open\b(?!\s*gym)|\bquarterfinals?\b|\bsemifinals?\b|\bthrowdown\b|\bqualifiers?\b|\bpodium\b/i;

/**
 * Only the GOALS section of the packet expresses INTENT. Everything else in it is inventory:
 * LIFTS / RUN lists the athlete's numbers, SKILLS lists what they can do, TRAINING SETUP lists
 * their equipment. Scoring the whole packet made every athlete look like a weightlifter and an
 * endurance athlete at once — they had reported a back squat and a 2 km row, which says what they
 * CAN do and nothing about what they want.
 */
const PACKET_GOALS_SECTION = /^GOALS:\s*\n([\s\S]*?)(?=\n[A-Z][A-Z /-]{2,}:|\s*$)/im;

function textOf(v) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(textOf).join(" ");
  if (typeof v === "object") {
    return Object.keys(v)
      .map(function (k) {
        return k + " " + textOf(v[k]);
      })
      .join(" ");
  }
  return String(v);
}

/**
 * What the athlete or the studio said they WANT — not what they can already do.
 * A discipline layer is a decision about where to spend development time, so it may only be
 * driven by stated intent: goals, standing coach directives and preferences, and for a studio the
 * per-day emphases it published.
 */
function intentText(profile, studioIntake) {
  const p = profile && typeof profile === "object" ? profile : {};
  const s = studioIntake && typeof studioIntake === "object" ? studioIntake : {};
  const packetGoals = (textOf(p.fixedIntakePacket).match(PACKET_GOALS_SECTION) || [])[1] || "";
  return [
    textOf(p.goals),
    /* The box beside "a specific skill". The tick itself says nothing — this is the answer. */
    textOf(p.improveFocusOther),
    packetGoals,
    textOf(p.coachDirectives),
    textOf(p.coachPrefs),
    textOf(s.goals),
    /* The studio's goals field was folded INTO population on the branch — the box now reads
       "The place, the people, the limits — and what they are training for". It was left out of
       intent while it was purely descriptive; now it carries the goal, so a studio that says what
       it trains for would otherwise select no discipline layer at all. */
    textOf(s.population),
    textOf(s.dayEmphasis),
    textOf(s.sessionTypes),
  ].join("\n");
}

/**
 * Has the athlete declared they compete? Read the intake's own line first — it is explicit in both
 * directions — and only fall back to free text when the field is absent entirely.
 * @returns {boolean}
 */
function competitorDeclared(profile, studioIntake) {
  const p = profile && typeof profile === "object" ? profile : {};
  if (p.competitor === true) return true;
  if (p.competitor === false) return false;
  const packet = textOf(p.fixedIntakePacket);
  if (COMPETITOR_YES.test(packet)) return true;
  if (COMPETITOR_NO.test(packet)) return false;
  return COMPETITOR_FREE_TEXT.test(intentText(profile, studioIntake));
}

/**
 * A restriction must be NAMED. "no injuries", "none", an empty string — none of those switch the
 * injury layer on. The owner's rule: an injury changes what is written; it does not decorate
 * every line with alternatives, and it must not switch on speculatively.
 */
function hasNamedRestriction(profile, studioIntake) {
  const p = profile && typeof profile === "object" ? profile : {};

  /* avoidMovements{} — structured as of 2026-09-03, and it settles the question outright. A ticked
     movement family IS a named restriction, whatever the free text says, and it maps one-to-one
     onto the substitution matrix in layer1-injuries. Asked as movements rather than as conditions
     on purpose: the coach is limited to movements, loads and numbers, so "which movements should
     we avoid" is the in-scope form of the question and it needs no inference about severity. */
  const avoid = p.avoidMovements && typeof p.avoidMovements === "object" ? p.avoidMovements : null;
  if (avoid) {
    const marked = Object.keys(avoid).some(function (k) {
      return avoid[k] === true;
    });
    if (marked) return true;
  }
  if (String(p.avoidMovementsOther || "").trim()) return true;

  const raw = [textOf(p.injuries), textOf((studioIntake || {}).population)].join(" ").trim();
  if (!raw) return false;
  if (/^(none|no|n\/a|na|-|אין|ללא)\b/i.test(raw.trim())) return false;

  /* A bare body part is NOT a restriction. "back squat", "shoulder mobility", "hip hinge" and
     "knee sleeves" are all ordinary programming words, and the studio's population box now carries
     the goals text as well, so the chance of meeting one there went up. Only a word that actually
     signals a problem counts — and a body part counts when it sits next to one. */
  return /\binjur\w*|\bpain\w*|\bsore\b|\bsurger\w*|\bpost[- ]op\b|\brehab\w*|\btendin\w*|\bimpinge\w*|\bhernia\w*|\bslap tear\b|\btorn\b|\btear\b|\bacl\b|\bmeniscus\b|\blimitation\w*|\brestrict\w*|\bcannot do\b|\bcan't do\b|\bavoid\w*|פציע|כאב|כואב|ניתוח|מגבל|להימנע|אסור/i.test(
    raw
  );
}

/**
 * Did this studio buy a number of sessions rather than a weekly plan? The intake's own screen
 * says what that means: "No weekday attached — the coach delivers them whenever suits their
 * groups." Detect it from the mode, and also from a session count with no weekday emphases, so an
 * older or partially filled intake still routes correctly.
 * @returns {boolean}
 */
function sellsSessionsByCount(studioIntake) {
  const s = studioIntake && typeof studioIntake === "object" ? studioIntake : null;
  if (!s) return false;
  if (s.scheduleMode === "session_count") return true;
  if (s.scheduleMode === "weekly_schedule") return false;
  return parseInt(s.sessionsPerWeek, 10) > 0;
}

/**
 * improveFocus{} — the athlete's stated development focus, from the goals step. Structured as of
 * 2026-09-03, and it replaces guessing at prose for exactly the reason competitor did: a
 * checkbox is a decision, a sentence is something a model may or may not weigh.
 *
 * NARROWED the same day, by the owner: the list is shown ONLY to an athlete who ticked that they
 * compete, and clearing that tick deletes whatever was marked so a stale value cannot travel. So
 * improveFocus is empty for every general-fitness athlete, and anything set here implies a
 * competitor. Defensible — a general athlete's priority IS the balance, and offering them a focus
 * list invites the specialisation POL-018 forbids.
 *
 * The cost, named rather than hidden: the problem this field was requested for — that removing the
 * movement tiers left one free-text box deciding both the development priority and which knowledge
 * loads — is only solved for competitors. A general athlete who genuinely wants one thing still
 * depends on writing it in prose and on the trigger table catching it. That fallback is much
 * stronger than it was (word-bounded, bilingual, scored on intent only), and it fails in the safe
 * direction: a missed focus yields balanced general programming, which is the right default anyway.
 *
 * Note what is NOT mapped, and why:
 *   max_strength    — layer2-general already carries the heavy-effort and speed-effort numbers.
 *                     layer3-weightlifting is about the OLYMPIC lifts (miss caps, timed sets,
 *                     empty-bar priming); loading it for someone who wants a bigger back squat
 *                     would be the specialty drift POL-018 forbids.
 *   general_fitness — the balance itself is the priority. That needs no discipline layer.
 *   specific_skill  — the checkbox alone says nothing; the free text beside it is scored instead.
 */
const FOCUS_TO_LAYER = {
  gymnastics: "gymnastics",
  olympic_lifting: "weightlifting",
  engine: "endurance",
};

function focusLayers(profile) {
  const f = profile && typeof profile.improveFocus === "object" ? profile.improveFocus : null;
  if (!f) return [];
  return Object.keys(FOCUS_TO_LAYER).filter(function (k) {
    return f[k] === true;
  }).map(function (k) {
    return FOCUS_TO_LAYER[k];
  });
}

function pickLayer3(profile, studioIntake, explicit) {
  if (Array.isArray(explicit) && explicit.length) {
    return explicit.filter(function (k) {
      return LAYER3[k] || k === "competitors";
    });
  }
  const out = [];
  /* Declared, never inferred from a keyword. It is a MODE rather than a discipline, so it is not
     scored against gymnastics/endurance — but it is a large layer, so it takes one of the two
     slots. A competitor with one discipline focus alongside is enough; three at once is the
     "specialises in everything" failure MAX_LAYER3 exists to prevent. */
  const competitor = competitorDeclared(profile, studioIntake);
  if (competitor) out.push("competitors");
  const slots = competitor ? MAX_LAYER3 - 1 : MAX_LAYER3;

  /* A ticked box is a decision and outranks prose. Text scoring only fills the slots left over —
     which is where "specific_skill" and an older profile with no improveFocus land. */
  focusLayers(profile).forEach(function (k) {
    if (out.length - (competitor ? 1 : 0) < slots && out.indexOf(k) < 0) out.push(k);
  });

  const text = intentText(profile, studioIntake);
  const scored = Object.keys(LAYER3_TRIGGERS)
    .map(function (key) {
      const m = text.match(new RegExp(LAYER3_TRIGGERS[key].source, "gi"));
      return { key: key, hits: m ? m.length : 0 };
    })
    .filter(function (r) {
      return r.hits > 0 && out.indexOf(r.key) < 0;
    })
    .sort(function (a, b) {
      return b.hits - a.hits;
    });
  for (let i = 0; i < scored.length && out.length - (competitor ? 1 : 0) < slots; i++) {
    out.push(scored[i].key);
  }
  return out;
}

/**
 * Build the knowledge pack for one call.
 *
 * @param {object} opts
 * @param {"individual"|"studio"} opts.agent    which coach is writing
 * @param {object}  [opts.profile]              athlete profile (individual agent)
 * @param {object}  [opts.studioIntake]         normalised studio intake (studio agent)
 * @param {boolean} [opts.programming]          false for chat: layer 2 and the table are dropped
 * @param {string[]} [opts.layer3]              force specific discipline layers
 * @returns {{text: string, layers: string[], chars: number}}
 */
function buildLayerPack(opts) {
  const o = opts && typeof opts === "object" ? opts : {};
  const programming = o.programming !== false;
  const parts = [];
  const names = [];

  function add(name, body) {
    if (!body) return;
    names.push(name);
    parts.push(body);
  }

  /* Always: how the coach behaves, and the floor it stands on. */
  add("coach-craft", COACH_CRAFT);
  add("layer1-methodology", LAYER1_METHODOLOGY);

  if (hasNamedRestriction(o.profile, o.studioIntake)) {
    add("layer1-injuries", LAYER1_INJURIES);
  }

  /* Chat writes no prescriptions, so it needs neither the construction layer nor the arithmetic. */
  if (programming) {
    add("equivalence-table", EQUIVALENCE);
    add("layer2-general", LAYER2_GENERAL);
    /* How many days is the one rule that differs completely by product, so each side reads only
       its own half instead of both paying for the other's. */
    add(
      o.agent === "studio" ? "layer2-days-studio" : "layer2-days-individual",
      o.agent === "studio" ? LAYER2_DAYS_STUDIO : LAYER2_DAYS_INDIVIDUAL
    );
    /* A studio that bought N sessions a week has no calendar, so the weekday rules above need a
       translation and the per-session descriptions need to be read as instructions. Only that
       shape pays for it. */
    if (sellsSessionsByCount(o.studioIntake)) {
      add("layer2-session-count", LAYER2_SESSION_COUNT);
    }
    if (o.agent !== "studio") add("layer2-individual", LAYER2_INDIVIDUAL);
    pickLayer3(o.profile, o.studioIntake, o.layer3).forEach(function (k) {
      add("layer3-" + k, k === "competitors" ? COMPETITORS : LAYER3[k]);
    });
  }

  const text = parts.join("\n---\n");
  return { text: text, layers: names, chars: text.length };
}

module.exports = {
  buildLayerPack: buildLayerPack,
  hasNamedRestriction: hasNamedRestriction,
  sellsSessionsByCount: sellsSessionsByCount,
  competitorDeclared: competitorDeclared,
  focusLayers: focusLayers,
  FOCUS_TO_LAYER: FOCUS_TO_LAYER,
  pickLayer3: pickLayer3,
  MAX_LAYER3: MAX_LAYER3,
  LAYER3_KEYS: Object.keys(LAYER3).concat(["competitors"]),
};
