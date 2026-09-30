/**
 * THE GYM QUESTIONNAIRE — the screen.
 *
 * SAME LOOK, SEPARATE PLUMBING. That is the whole design, and it is the owner's instruction in
 * two halves. The look: a FLOATING card over the screen, like every other questionnaire in this
 * module, built out of the same classes as the studio card — .fld, .chk-row, .pick-row,
 * .sub-branch, .inline-num, .grid2. Those rules are scoped to #clientScreen, so admin.html
 * repeats them under #gymIntakeModal rather than widening the originals, which serve the studio
 * card and must not move. It was first built INSIDE #clientScreen for exactly that reason and
 * came out splitting the screen in two, looking nothing like the others (owner, 2026-09-30).
 * The plumbing: every answer lives in this file's own state and leaves through lib/gym-intake.js.
 * It never touches intakeState, never becomes a fixedIntakePacket, and never reaches the
 * functional brain.
 *
 * THE THREE RULES OF A TICK THAT OPENS A QUESTION, from the design spec:
 *   1. the sub-area is the NEXT SIBLING of the .chk-row, never inside it
 *   2. it opens and closes with the `hidden` ATTRIBUTE only — never style.display, because a
 *      class with a display of its own beats the browser's [hidden] rule and the box comes back
 *   3. CLOSING ERASES THE ANSWER. An answer nobody meant to give is a data bug, and here it
 *      would reach the planning brain as though it had been asked for.
 *
 * The same three hold for the choice tree, where the trigger is a number rather than a tick:
 * change the sessions and the split that no longer belongs to that number is erased.
 */

(function () {
  "use strict";

  function L() {
    return typeof window !== "undefined" ? window.GymIntake : null;
  }
  function el(id) {
    return document.getElementById(id);
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /** Everything this questionnaire holds. Its own object, on purpose. */
  var state = {};
  var step = 0;

  function reset() {
    state = {
      clientName: "",
      gender: "",
      age: "",
      bodyweight: "",
      experience: "",
      outputLanguage: "en",
      fullyEquipped: false,
      equipment: {},
      extras: {},
      sessionsPerWeek: 0,
      split: "",
      trainingDays: [],
      /* Sixty unless he changes it — the length an ordinary gym session actually runs. */
      sessionMinutes: 60,
      deloadWeek: false,
      deloadEveryWeeks: "",
      noLimits: false,
      avoid: {},
      injuries: "",
      goalHealth: false,
      goalHypertrophy: false,
      emphasis: "",
      emphasisNote: "",
    };
    step = 0;
  }
  reset();

  /* ── the panes ───────────────────────────────────────────────────────────── */

  function paneProfile() {
    return (
      '<p class="pprog-fixed-title">Who is this athlete?</p>' +
      '<div class="grid2">' +
      fld("Name", '<input id="gxName" type="text" maxlength="120" value="' + esc(state.clientName) + '">') +
      fld("Age", '<input id="gxAge" type="number" min="12" max="90" value="' + esc(state.age) + '">') +
      "</div>" +
      '<div class="grid2">' +
      fld(
        "Gender",
        '<select id="gxGender">' +
          opt("", "—", state.gender) +
          opt("male", "Male", state.gender) +
          opt("female", "Female", state.gender) +
          "</select>"
      ) +
      fld("Bodyweight (kg)", '<input id="gxWeight" type="number" min="35" max="200" value="' + esc(state.bodyweight) + '">') +
      "</div>" +
      fld(
        "Experience in a gym",
        '<select id="gxExperience">' +
          opt("", "—", state.experience) +
          opt("new", "New to the gym", state.experience) +
          opt("returning", "Returning after a long break", state.experience) +
          opt("experienced", "Trains regularly", state.experience) +
          "</select>"
      ) +
      '<p class="pprog-fixed-note">Which language the ATHLETE reads their programme in. This card stays English either way.</p>' +
      '<div class="pick-row">' +
      chk("gxLangEn", "English", state.outputLanguage !== "he", "radio", "gxLang") +
      chk("gxLangHe", "Hebrew", state.outputLanguage === "he", "radio", "gxLang") +
      "</div>"
    );
  }

  function paneEquipment() {
    var open = !state.fullyEquipped;
    return (
      '<p class="pprog-fixed-title">What does this gym have?</p>' +
      '<label class="chk-row pprog-skills-all">' +
      '<input id="gxFullyEquipped" type="checkbox"' +
      (state.fullyEquipped ? " checked" : "") +
      ">" +
      "<span>A fully equipped commercial gym — everything standard is here</span></label>" +
      '<div id="gxEquipWrap" class="sub-branch"' +
      (open ? "" : " hidden") +
      ">" +
      '<p class="meta">Tick what this gym actually has. Anything unticked will not appear in the programme.</p>' +
      (L() ? L().EQUIPMENT : [])
        .map(function (r) {
          return chk("gxEq-" + r.id, r.label, state.equipment[r.id] === true);
        })
        .join("") +
      "</div>" +
      '<label class="chk-row"><input id="gxHasExtras" type="checkbox"' +
      (hasExtras() ? " checked" : "") +
      "><span>It also has some less common machines</span></label>" +
      '<div id="gxExtrasWrap" class="sub-branch"' +
      (hasExtras() ? "" : " hidden") +
      ">" +
      '<p class="meta">Each of these is confirmed rather than assumed, and the programme never rests on one.</p>' +
      (L() ? L().EXTRAS : [])
        .map(function (r) {
          return chk("gxEx-" + r.id, r.label, state.extras[r.id] === true);
        })
        .join("") +
      "</div>"
    );
  }

  function paneSchedule() {
    var lib = L();
    var splits = state.sessionsPerWeek ? lib.splitsFor(state.sessionsPerWeek) : [];
    return (
      '<p class="pprog-fixed-title">How often, and in what shape?</p>' +
      '<label class="chk-row" style="cursor:default"><span>Sessions a week</span>' +
      '<select id="gxSessions" class="inline-num">' +
      opt("", "—", String(state.sessionsPerWeek || "")) +
      [2, 3, 4, 5, 6]
        .map(function (n) {
          return opt(String(n), String(n), String(state.sessionsPerWeek || ""));
        })
        .join("") +
      "</select></label>" +
      '<div id="gxSplitWrap" class="sub-branch"' +
      (splits.length ? "" : " hidden") +
      ">" +
      '<p class="meta">The number of sessions decides which shapes are possible. The first is the default.</p>' +
      splits
        .map(function (s, i) {
          /* The label alone said "pairing 1", which tells a coach nothing about which muscles
             land on which day — and he has to choose between them (owner, 2026-09-30). */
          return (
            chk("gxSplit-" + s, lib.SPLITS[s].label + (i === 0 ? "  ·  default" : ""), state.split === s, "radio", "gxSplit") +
            '<p class="meta" style="margin:-4px 0 12px 30px">' + esc(lib.SPLITS[s].detail) + "</p>"
          );
        })
        .join("") +
      "</div>" +
      '<p class="pprog-fixed-note">Which days they train</p>' +
      '<div class="pick-row">' +
      (lib ? lib.DAY_KEYS : [])
        .map(function (d) {
          return chk("gxDay-" + d, lib.DAY_LABELS[d], state.trainingDays.indexOf(d) >= 0);
        })
        .join("") +
      "</div>" +
      fld("Session length (minutes)", '<input id="gxMinutes" type="number" min="20" max="120" value="' + esc(state.sessionMinutes || 60) + '">') +
      '<p class="meta">This decides how many exercises fit. It is not what makes a session good.</p>' +
      '<label class="chk-row"><input id="gxDeload" type="checkbox"' +
      (state.deloadWeek ? " checked" : "") +
      "><span>Include a deload week</span></label>" +
      '<div id="gxDeloadWrap" class="sub-branch"' +
      (state.deloadWeek ? "" : " hidden") +
      ">" +
      '<label class="chk-row" style="cursor:default"><span>One deload week every</span>' +
      '<input id="gxDeloadEvery" type="number" class="inline-num" min="' +
      (lib ? lib.MIN_DELOAD_EVERY : 6) +
      '" max="' +
      (lib ? lib.MAX_DELOAD_EVERY : 12) +
      '" value="' +
      esc(state.deloadEveryWeeks) +
      '"><span>weeks</span></label>' +
      '<p class="meta">Counted continuously across blocks. A gym block is ' +
      (lib ? lib.BLOCK_WEEKS : 6) +
      " weeks.</p>" +
      "</div>"
    );
  }

  function paneInjuries() {
    var lib = L();
    var open = !state.noLimits;
    return (
      '<p class="pprog-fixed-title">Anything to program around?</p>' +
      '<p class="pprog-fixed-note">A limit to design around — not a rehabilitation plan. This product does not write those.</p>' +
      '<label class="chk-row pprog-skills-all"><input id="gxNoLimits" type="checkbox"' +
      (state.noLimits ? " checked" : "") +
      "><span>Nothing to report</span></label>" +
      '<div id="gxLimitsWrap" class="sub-branch"' +
      (open ? "" : " hidden") +
      ">" +
      '<p class="meta">Tick a family and nothing from it is prescribed. A family can be acted on; a sentence cannot.</p>' +
      lib.AVOID_DEFS.map(function (d) {
        return chk("gxAvoid-" + d.id, d.label, state.avoid[d.id] === true);
      }).join("") +
      fld(
        "Anything else worth knowing",
        '<textarea id="gxInjuries" maxlength="400" placeholder="Right knee — pain under load after 90 degrees">' + esc(state.injuries) + "</textarea>"
      ) +
      "</div>"
    );
  }

  function paneGoals() {
    var lib = L();
    return (
      '<p class="pprog-fixed-title">What are they here for?</p>' +
      '<p class="pprog-fixed-note">Both is a normal answer.</p>' +
      '<div class="pick-row">' +
      chk("gxGoalHealth", "A healthy, active life", state.goalHealth) +
      chk("gxGoalHyper", "Muscle growth", state.goalHypertrophy) +
      "</div>" +
      '<p class="pprog-fixed-title" style="margin-top:14px">Anything to put first?</p>' +
      '<p class="pprog-fixed-note">A muscle group chosen here is trained FIRST in its sessions, while they are fresh. ' +
      "That is the whole meaning of emphasis — putting it later is not emphasis, whatever the plan calls it.</p>" +
      '<div class="pick-row">' +
      chk("gxEmphasis-", "No preference", !state.emphasis, "radio", "gxEmphasis") +
      lib.EMPHASIS_DEFS.map(function (d) {
        return chk("gxEmphasis-" + d.id, d.label, state.emphasis === d.id, "radio", "gxEmphasis");
      }).join("") +
      "</div>" +
      fld(
        "Anything else the coach should know (optional)",
        '<input id="gxEmphasisNote" type="text" maxlength="200" placeholder="Training for a wedding in March" value="' +
          esc(state.emphasisNote) +
          '">'
      )
    );
  }

  /* ── small builders, all using the classes the design spec fixed ──────────── */

  function fld(label, control) {
    return '<label class="fld"><span>' + esc(label) + "</span>" + control + "</label>";
  }
  function opt(value, label, current) {
    return '<option value="' + esc(value) + '"' + (String(current) === String(value) ? " selected" : "") + ">" + esc(label) + "</option>";
  }
  function chk(id, label, on, type, name) {
    return (
      '<label class="chk-row"><input id="' +
      id +
      '" type="' +
      (type || "checkbox") +
      '"' +
      (name ? ' name="' + name + '"' : "") +
      (on ? " checked" : "") +
      "><span>" +
      esc(label) +
      "</span></label>"
    );
  }
  function hasExtras() {
    for (var k in state.extras) {
      if (state.extras[k]) return true;
    }
    return false;
  }

  /* In the order STEPS names them: schedule before equipment (owner, 2026-09-30). */
  var PANES = [paneProfile, paneSchedule, paneEquipment, paneInjuries, paneGoals];

  /* ── render ──────────────────────────────────────────────────────────────── */

  function isOpen() {
    var m = el("gymIntakeModal");
    return !!(m && m.classList.contains("open"));
  }

  function render() {
    var lib = L();
    if (!lib || !el("gymIntakeModal")) return;
    var steps = lib.STEPS;
    if (step < 0) step = 0;
    if (step > steps.length - 1) step = steps.length - 1;

    el("gymIntakeTabs").innerHTML = steps
      .map(function (s, i) {
        return '<button type="button" data-gxstep="' + i + '"' + (i === step ? ' class="on"' : "") + ">" + esc(s.label) + "</button>";
      })
      .join("");
    el("gymIntakeStep").textContent = "Step " + (step + 1) + " of " + steps.length;
    el("gymIntakeBody").innerHTML = '<div class="ipane" data-pane="' + steps[step].id + '">' + PANES[step]() + "</div>";

    el("gxPrev").hidden = step === 0;
    var last = step === steps.length - 1;
    el("gxNext").hidden = last;
    el("gxCreate").hidden = !last;
    setErr("");
  }

  /** One row, always in the DOM so the card cannot jump when it fills. */
  function setErr(msg) {
    var box = el("gymIntakeErr");
    if (box) box.textContent = msg || "";
  }

  /* ── reading the screen back into state ──────────────────────────────────── */

  function readPane() {
    var lib = L();
    var v = function (id) {
      var n = el(id);
      return n ? n.value : "";
    };
    var c = function (id) {
      var n = el(id);
      return !!(n && n.checked);
    };
    if (el("gxName")) {
      state.clientName = v("gxName");
      state.age = v("gxAge");
      state.gender = v("gxGender");
      state.bodyweight = v("gxWeight");
      state.experience = v("gxExperience");
      state.outputLanguage = c("gxLangHe") ? "he" : "en";
    }
    if (el("gxFullyEquipped")) {
      state.fullyEquipped = c("gxFullyEquipped");
      lib.EQUIPMENT.forEach(function (r) {
        if (el("gxEq-" + r.id)) state.equipment[r.id] = c("gxEq-" + r.id);
      });
      lib.EXTRAS.forEach(function (r) {
        if (el("gxEx-" + r.id)) state.extras[r.id] = c("gxEx-" + r.id);
      });
    }
    if (el("gxSessions")) {
      state.sessionsPerWeek = parseInt(v("gxSessions"), 10) || 0;
      var picked = "";
      lib.splitsFor(state.sessionsPerWeek).forEach(function (s) {
        if (c("gxSplit-" + s)) picked = s;
      });
      state.split = picked;
      state.trainingDays = lib.DAY_KEYS.filter(function (d) {
        return c("gxDay-" + d);
      });
      state.sessionMinutes = v("gxMinutes");
      state.deloadWeek = c("gxDeload");
      state.deloadEveryWeeks = state.deloadWeek ? v("gxDeloadEvery") : "";
    }
    if (el("gxNoLimits")) {
      state.noLimits = c("gxNoLimits");
      lib.AVOID_DEFS.forEach(function (d) {
        if (el("gxAvoid-" + d.id)) state.avoid[d.id] = c("gxAvoid-" + d.id);
      });
      state.injuries = v("gxInjuries");
    }
    if (el("gxGoalHealth")) {
      state.goalHealth = c("gxGoalHealth");
      state.goalHypertrophy = c("gxGoalHyper");
      var picked = "";
      lib.EMPHASIS_DEFS.forEach(function (d) {
        if (c("gxEmphasis-" + d.id)) picked = d.id;
      });
      state.emphasis = picked;
      state.emphasisNote = v("gxEmphasisNote");
    }
  }

  /* ── the events ──────────────────────────────────────────────────────────── */

  /* LISTEN ON THE CARD ITSELF — not on the document, and not on the backdrop either.
     The card carries onclick="event.stopPropagation()" like every other modal here, so a click
     inside it never reaches the document OR the backdrop around it. Every button went dead the
     moment this became a floating card, and binding one level up did not fix it (2026-09-30).
     stopPropagation stops the climb to ancestors; it does not stop another listener on the same
     element, so the card is the one place a listener both survives every redraw of its contents
     and actually hears them. */
  function on(type, fn) {
    document.addEventListener("DOMContentLoaded", bind);
    bind();
    function bind() {
      var m = el("gymIntakeModal");
      var card = m && m.querySelector(".intake-workspace");
      if (!card || card["_gx_" + type]) return;
      card["_gx_" + type] = true;
      card.addEventListener(type, fn);
    }
  }

  on("change", function (ev) {
    var t = ev.target;
    if (!t || !t.id || !isOpen()) return;

    /* A tick that opens a question. Closing ERASES the answer — see the file header. */
    if (t.id === "gxFullyEquipped") {
      readPane();
      var wrap = el("gxEquipWrap");
      if (wrap) wrap.hidden = t.checked;
      if (t.checked) state.equipment = {};
      render();
      return;
    }
    if (t.id === "gxHasExtras") {
      readPane();
      if (!t.checked) state.extras = {};
      var ex = el("gxExtrasWrap");
      if (ex) ex.hidden = !t.checked;
      if (!t.checked) render();
      return;
    }
    if (t.id === "gxNoLimits") {
      readPane();
      /* Same rule as everywhere else in this card: closing ERASES. "Nothing to report" that
         still carried three ticked families underneath would be a lie in the packet. */
      if (t.checked) {
        state.avoid = {};
        state.injuries = "";
      }
      var lw = el("gxLimitsWrap");
      if (lw) lw.hidden = t.checked;
      if (t.checked) render();
      return;
    }
    if (t.id === "gxDeload") {
      readPane();
      if (!t.checked) state.deloadEveryWeeks = "";
      var dw = el("gxDeloadWrap");
      if (dw) dw.hidden = !t.checked;
      return;
    }
    /* The tree. A different number of sessions means the split that was chosen may no
       longer exist — and a split nobody chose must never survive into the packet. */
    if (t.id === "gxSessions") {
      readPane();
      var still = L().splitsFor(state.sessionsPerWeek);
      if (still.indexOf(state.split) < 0) state.split = "";
      render();
      return;
    }
  });

  on("click", function (ev) {
    var t = ev.target;
    if (!t) return;
    if (!isOpen()) return;

    var tab = t.closest ? t.closest("[data-gxstep]") : null;
    if (tab) {
      readPane();
      step = parseInt(tab.getAttribute("data-gxstep"), 10) || 0;
      render();
      return;
    }
    if (t.id === "gxNext") {
      readPane();
      step++;
      render();
      return;
    }
    if (t.id === "gxPrev") {
      readPane();
      step--;
      render();
      return;
    }
    if (t.id === "gxCreate") {
      readPane();
      var gaps = L().missing(state);
      if (gaps.length) {
        setErr(gaps[0]);
        return;
      }
      setErr("");
      if (typeof window.gymIntakeSubmit === "function") window.gymIntakeSubmit(L().normalize(state));
      return;
    }
  });

  /* ── the door in, and the door out ───────────────────────────────────────── */

  window.openGymIntake = function openGymIntake() {
    reset();
    var modal = el("gymIntakeModal");
    if (!modal) return;
    modal.classList.add("open");
    render();
  };
  window.closeGymIntake = function closeGymIntake() {
    var modal = el("gymIntakeModal");
    if (modal) modal.classList.remove("open");
  };
  /* For tests and for the page that will save it. */
  window.gymIntakeAnswers = function gymIntakeAnswers() {
    readPane();
    return L().normalize(state);
  };
  window.gymIntakePacket = function gymIntakePacket() {
    readPane();
    return L().buildGymPacket(state);
  };
})();
