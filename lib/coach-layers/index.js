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
const EQUIVALENCE = require("../coach-equivalence-table.js");

const LAYER3 = {
  gymnastics: require("./layer3-gymnastics.js"),
  weightlifting: require("./layer3-weightlifting.js"),
  endurance: require("./layer3-endurance.js"),
  competitors: require("./layer3-competitors.js"),
  partner: require("./layer3-partner.js"),
};

/* At most this many discipline layers in one call. A brick that claims to specialise in four
   things specialises in none, and the token bill is real. Highest-signal ones win. */
const MAX_LAYER3 = 2;

const LAYER3_TRIGGERS = {
  gymnastics: /gymnast|handstand|hspu|muscle[- ]?up|pull[- ]?up|chest.to.bar|toes.to.bar|ttb|c2b|rope climb|pistol|ring|lever|kip|bar muscle|strict/i,
  weightlifting: /snatch|clean|jerk|olympic|oly|barbell|1rm|one rep max|back squat|front squat|overhead squat|deadlift|lift heavier|add .*kg|press/i,
  endurance: /endurance|engine|aerobic|zone ?2|vo2|cardio|running|row(ing)?|ski|bike|conditioning base|gas out|breath|5k|10k|marathon/i,
  competitors: /compet|open\b|quarterfinal|semifinal|games|throwdown|qualifier|podium|team comp/i,
  partner: /partner|pairs|teams? workout|buddy|זוגות/i,
};

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

/** Everything the athlete or the studio told us that could name a discipline. */
function signalText(profile, studioIntake) {
  const p = profile && typeof profile === "object" ? profile : {};
  const s = studioIntake && typeof studioIntake === "object" ? studioIntake : {};
  return [
    textOf(p.goals),
    textOf(p.profileNotes),
    textOf(p.fixedIntakePacket),
    textOf(p.coachDirectives),
    textOf(p.coachPrefs),
    textOf(s.goals),
    textOf(s.population),
    textOf(s.dayEmphasis),
    textOf(s.sessionTypes),
  ].join("\n");
}

/**
 * A restriction must be NAMED. "no injuries", "none", an empty string — none of those switch the
 * injury layer on. The owner's rule: an injury changes what is written; it does not decorate
 * every line with alternatives, and it must not switch on speculatively.
 */
function hasNamedRestriction(profile, studioIntake) {
  const raw = [
    textOf((profile || {}).injuries),
    textOf((studioIntake || {}).population),
  ]
    .join(" ")
    .trim();
  if (!raw) return false;
  if (/^(none|no|n\/a|na|-|אין|ללא)\b/i.test(raw.trim())) return false;
  return /injur|pain|surger|rehab|tendin|impinge|hernia|slap|acl|meniscus|shoulder|knee|back|wrist|elbow|hip|ankle|limitation|restrict|פציע|כאב|ניתוח|מגבל/i.test(
    raw
  );
}

function pickLayer3(profile, studioIntake, explicit) {
  if (Array.isArray(explicit) && explicit.length) {
    return explicit.filter(function (k) {
      return LAYER3[k];
    });
  }
  const text = signalText(profile, studioIntake);
  const scored = Object.keys(LAYER3_TRIGGERS)
    .map(function (key) {
      const m = text.match(new RegExp(LAYER3_TRIGGERS[key].source, "gi"));
      return { key: key, hits: m ? m.length : 0 };
    })
    .filter(function (r) {
      return r.hits > 0;
    })
    .sort(function (a, b) {
      return b.hits - a.hits;
    });
  return scored.slice(0, MAX_LAYER3).map(function (r) {
    return r.key;
  });
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
    if (o.agent !== "studio") add("layer2-individual", LAYER2_INDIVIDUAL);
    pickLayer3(o.profile, o.studioIntake, o.layer3).forEach(function (k) {
      add("layer3-" + k, LAYER3[k]);
    });
  }

  const text = parts.join("\n---\n");
  return { text: text, layers: names, chars: text.length };
}

module.exports = {
  buildLayerPack: buildLayerPack,
  hasNamedRestriction: hasNamedRestriction,
  pickLayer3: pickLayer3,
  MAX_LAYER3: MAX_LAYER3,
  LAYER3_KEYS: Object.keys(LAYER3),
};
