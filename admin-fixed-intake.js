/**
 * Admin «+ מתאמן» — same fixed intake as the athlete app (HARD parity).
 * Depends on global CoachIntakeSync from lib/coach-intake-sync-contract.js
 */
(function () {
  "use strict";

  function C() {
    if (!window.CoachIntakeSync) {
      throw new Error("CoachIntakeSync missing — load lib/coach-intake-sync-contract.js first");
    }
    return window.CoachIntakeSync;
  }

  /* --- the equipment checklist ---------------------------------------------------------
   * Drawn from lib/equipment-catalog.js, the same list the studio questionnaire ticks and the
   * post-check measures a brick against. Added 2026-09-14, replacing one free-text box and one
   * "heaviest implement" number.
   *
   * NO NEW STYLING, ON PURPOSE. The owner approved this popup's design and asked that the intake
   * change leave it alone, so every row here reuses the classes the step already uses:
   * .pprog-location-picker for the rows, .pprog-skills-all for the one line that answers all of
   * them, .pprog-fixed-num for a number. Nothing new to look at, only new questions.
   *
   * A count is a ROOM's question and is not asked here — one athlete either owns a kettlebell or
   * does not. A CEILING is asked of everyone: "dumbbells to 8 kg" at home is the same bug as
   * 22.5 kg in a 15 kg studio (owner, 2026-09-14).
   */
  function equipCatalog() {
    return window.EquipmentCatalog && window.EquipmentCatalog.ITEMS
      ? window.EquipmentCatalog.ITEMS
      : [];
  }

  function equipCapUnit(item) {
    if (item.metric === "distance") return "metres";
    if (item.ceiling === "kg") return "max kg";
    if (item.ceiling === "cm") return "height cm";
    return "";
  }

  /**
   * One list, drawn twice when it has to be.
   *
   * An athlete who trains in two places used to describe the second one in a sentence —
   * the very shape that swallowed "dumbbells up to 15 kg" in a studio's paragraph and
   * started this whole round. A second place is a second inventory, ticked the same way,
   * with ceilings of its own (owner, 2026-09-15).
   *
   * @param {object} place  { list, attr, allId, title, note, allLabel }
   */
  function equipmentSectionHtml(place) {
    var items = equipCatalog().filter(function (it) {
      return it.group !== "always";
    });
    if (!items.length) return "";
    var o = place || {};
    var attr = o.attr || "data-fx-eq";
    var allId = o.allId || "adm-fx-eq-all";
    var list = o.list || {};
    var allOn =
      items.length > 0 &&
      items.every(function (it) {
        return list[it.id] && list[it.id].have;
      });
    /* The one answer that replaces all the others stands in a box of its own, above the
       list rather than as its first line: a gym with nothing missing is not one more
       item to tick, it is the whole question answered (owner, 2026-09-15). Two pickers,
       no new styling — the gap between them is the separation. */
    var html =
      '<p class="pprog-fixed-title" style="margin-top:18px">' +
      esc(o.title || "Available equipment") +
      "</p>" +
      '<p class="pprog-fixed-note">' +
      esc(
        o.note ||
          "Floor, wall and bodyweight work are always available and are never asked about — " +
            "the coach keeps using them whatever you tick here."
      ) +
      "</p>" +
      '<div class="pprog-location-picker">' +
      '<label class="pprog-skills-all"><input type="checkbox" id="' +
      esc(allId) +
      '"' +
      (allOn ? " checked" : "") +
      " onchange=\"adminFixedEquipAll(this,'" +
      esc(attr) +
      "')\"> " +
      esc(o.allLabel || "Fully equipped gym — no equipment limits, running route included") +
      "</label></div>" +
      '<div class="pprog-location-picker">';
    items.forEach(function (it) {
      var row = list[it.id] || {};
      var unit = equipCapUnit(it);
      html +=
        "<label><input type=\"checkbox\" " +
        esc(attr) +
        '="' +
        esc(it.id) +
        '"' +
        (row.have ? " checked" : "") +
        " onchange=\"adminFixedEquipPicked('" +
        esc(attr) +
        "')\"> " +
        '<span style="flex:1">' +
        esc(it.en || it.id) +
        "</span>" +
        (unit
          ? '<input type="number" min="1" class="pprog-fixed-num" ' +
            esc(attr) +
            '-cap="' +
            esc(it.id) +
            '" style="width:76px;padding:4px 6px"' +
            (row.have ? "" : " hidden") +
            ' value="' +
            esc(row.cap > 0 ? row.cap : "") +
            '" placeholder="' +
            esc(unit) +
            '" onclick="event.preventDefault();event.stopPropagation()">'
          : "") +
        "</label>";
    });
    return html + "</div>";
  }

  function allIdFor(attr) {
    return attr === "data-fx-eq2" ? "adm-fx-eq2-all" : "adm-fx-eq-all";
  }

  function equipmentFromForm(attr) {
    var key = attr || "data-fx-eq";
    var out = {};
    var boxes = document.querySelectorAll("[" + key + "]");
    for (var i = 0; i < boxes.length; i++) {
      var id = boxes[i].getAttribute(key);
      var row = { have: !!boxes[i].checked, qty: null, cap: null };
      var capBox = document.querySelector("[" + key + '-cap="' + CSS.escape(id) + '"]');
      if (capBox && boxes[i].checked) {
        var n = parseInt(capBox.value, 10);
        if (n > 0) row.cap = n;
      }
      out[id] = row;
    }
    return out;
  }

  /* A number about something the athlete does not have is not an answer. */
  function syncEquipRowsFixed(attr) {
    var key = attr || "data-fx-eq";
    var boxes = document.querySelectorAll("[" + key + "]");
    for (var i = 0; i < boxes.length; i++) {
      var id = boxes[i].getAttribute(key);
      var capBox = document.querySelector("[" + key + '-cap="' + CSS.escape(id) + '"]');
      if (capBox) capBox.hidden = !boxes[i].checked;
    }
    var all = document.getElementById(allIdFor(key));
    if (all && boxes.length) {
      all.checked = Array.prototype.every.call(boxes, function (b) {
        return b.checked;
      });
    }
  }

  window.adminFixedEquipPicked = function (attr) {
    syncEquipRowsFixed(attr);
  };
  window.adminFixedEquipAll = function (box, attr) {
    var key = attr || "data-fx-eq";
    var boxes = document.querySelectorAll("[" + key + "]");
    for (var i = 0; i < boxes.length; i++) boxes[i].checked = !!(box && box.checked);
    syncEquipRowsFixed(key);
  };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function normalizeLiftInput(raw, kind) {
    var s = String(raw || "")
      .trim()
      .replace(/,/g, ".");
    if (!s) return "";
    if (kind === "run" && s.indexOf(":") >= 0) {
      var parts = s.split(":");
      var mm = parseFloat(parts[0]);
      var ss = parseFloat(parts[1] || "0");
      if (!isFinite(mm) || !isFinite(ss) || ss < 0 || ss >= 60) return "";
      return String(Math.round((mm + ss / 60) * 100) / 100);
    }
    if (!/^\d+(\.\d+)?$/.test(s)) return "";
    var n = parseFloat(s);
    if (!isFinite(n) || n <= 0) return "";
    if (kind === "kg" && (n < 5 || n > 500)) return "";
    if (kind === "run" && (n < 4 || n > 40)) return "";
    return String(n);
  }

  function refreshFabVisibility() {
    try {
      if (typeof setAdminIntakeModalOpen === "function" && isAdminIntakeModalOpen()) {
        setAdminIntakeModalOpen(true);
        return;
      }
      var a =
        typeof athletes !== "undefined" && Array.isArray(athletes)
          ? athletes.find(function (x) {
              return x.athleteId === currentAthleteId;
            })
          : null;
      if (typeof syncAthleteChatFab === "function") syncAthleteChatFab(a || null);
    } catch (eFab) {}
  }

  function setIntakeModalOpen(isOpen) {
    if (typeof setAdminIntakeModalOpen === "function") {
      setAdminIntakeModalOpen(isOpen);
      return;
    }
    var m = document.getElementById("intake-modal");
    if (m) m.classList.toggle("open", !!isOpen);
    document.body.classList.toggle("admin-intake-open", !!isOpen);
    refreshFabVisibility();
  }

  window.resetIntakeState = function resetIntakeState() {
    window.intakeState = {
      busy: false,
      started: false,
      fixedActive: false,
      fixedStep: 0,
      messages: [],
      email: "",
      displayName: "",
      gender: "",
      preferredLanguage: "en",
      age: "",
      bodyweight: "",
      experience: "",
      trainingLocations: {},
      trainingLocationOther: "",
      trainingSetup: "",
      trainingDays: [],
      scheduleNotes: "",
      activeRecoveryPref: "no",
      activeRecoveryDay: "",
      skills: {},
      lifts: {},
      sessionLimits: "",
      /* Minutes per session. 0 = not answered. */
      sessionMinutes: 0,
      sessionTimesDiffer: false,
      competitor: false,
      /* What this athlete pays. Asked here for the same reason a studio is asked in
         its first tab: it is the owner's record of the client, and it never reaches
         the athlete (owner, 2026-09-03). */
      trainsMultipleLocations: false,
      secondaryLocationDays: [],
      secondaryLocationEquipment: "",
      secondaryHeaviestImplementKg: 0,
      sessionMinutesByDay: {},
      /* Nobody has asked for a deload yet, because nobody has been asked. */
      deloadEveryWeeks: 0,
      monthlyAmount: 0,
      paymentMethod: "",
      /* What this athlete pays. Asked here for the same reason a studio is asked in
         its first tab: it is the owner's record of the client, and it never reaches
         the athlete (owner, 2026-09-03). */
      monthlyAmount: 0,
      paymentMethod: "",
      improveFocus: {},
      improveFocusOther: "",
      avoidMovements: {},
      avoidMovementsOther: "",
      equipmentList: {},
      secondaryEquipmentList: {},
      avoidInProgram: "",
      injuries: "",
      goals: "",
      fixedIntakePacket: "",
      profileNotes: "",
      intakeComplete: false,
      athleteId: "",
      costCaps: null,
      intakeBuildId: "",
      buildAttempted: false,
    };
  };

  window.openIntakeWorkspace = function openIntakeWorkspace() {
    resetIntakeState();
    setIntakeModalOpen(true);
    var email = document.getElementById("intake-email");
    if (email) email.value = "";
    var startBar = document.getElementById("intake-start-bar");
    if (startBar) startBar.style.display = "flex";
    var fixed = document.getElementById("intake-fixed");
    if (fixed) {
      fixed.style.display = "none";
      fixed.innerHTML = "";
      fixed.classList.add("pprog-fixed-intake");
    }
    var log = document.getElementById("intake-chat-log");
    if (log) {
      log.style.display = "flex";
      /* No "press start" instruction: choosing "מתאמן קצה" already IS that decision
         and startIntakeChat runs straight after this. The line only ever showed when
         the start had FAILED — so word it as what it is. */
      log.innerHTML = '<div class="intake-msg system">פותח תחקור…</div>';
    }
    var compose = document.getElementById("intake-compose");
    if (compose) compose.style.display = "none";
    var buildBtn = document.getElementById("intake-build-btn");
    if (buildBtn) buildBtn.style.display = "none";
    var building = document.getElementById("intake-building");
    if (building) building.classList.remove("visible");
    var overlay = document.getElementById("adminIntakeBuildOverlay");
    if (overlay) {
      overlay.classList.remove("open");
      overlay.hidden = true;
    }
    var status = document.getElementById("intake-status");
    if (status) status.textContent = "";
    if (typeof hideIntakePickers === "function") hideIntakePickers();
  };

  window.closeIntakeWorkspace = function closeIntakeWorkspace() {
    if (intakeState.busy) {
      if (!confirm("תחקור בתהליך — לסגור בכל זאת?")) return;
    } else if (intakeState.fixedActive && !intakeState.intakeComplete) {
      /* Everything typed goes with it, so it is worth one question. A click beside the
         box used to do this silently (owner, 2026-09-03). */
      if (!confirm("לצאת מהתחקור? מה שהוקלד יימחק.")) return;
    }
    setIntakeModalOpen(false);
    resetIntakeState();
    refreshFabVisibility();
  };

  /** Set style/text only when the node is really there. */
  function hideEl(id) {
    var n = document.getElementById(id);
    if (n) n.style.display = "none";
  }

  /* Every status write goes through here. The unguarded reads this replaces had the
     same shape as the bug that killed the intake: one removed field away from a hard
     throw, in the one file whose job is to stay standing while a form is filled. */
  function writeIntakeStatus(text) {
    var n = document.getElementById("intake-status");
    if (n) n.textContent = String(text == null ? "" : text);
  }

  window.startIntakeChat = function startFixedIntake() {
    if (intakeState.busy) return;
    setIntakeModalOpen(true);
    /* The email field was REMOVED on the owner's instruction (a.3.1) — he reaches
     * clients over WhatsApp and wanted less responsibility for their data. This line
     * still read it unguarded, so every click on "מתאמן קצה" threw
     *   Cannot read properties of null (reading 'value')
     * before the intake could start. Nothing downstream needs a real address, so the
     * value is simply empty now, and every other node here is guarded too — this
     * function must not be one deleted field away from a dead button again. */
    intakeState.email = "";
    intakeState.started = true;
    intakeState.fixedActive = true;
    intakeState.fixedStep = 0;
    intakeState.preferredLanguage = "en";
    hideEl("intake-start-bar");
    hideEl("intake-chat-log");
    hideEl("intake-compose");
    if (typeof hideIntakePickers === "function") hideIntakePickers();
    var status = document.getElementById("intake-status");
    if (status) {
      status.textContent = "תחקור זהה לאפליקציה · שלב 1/" + C().FIXED_STEPS.length;
    }
    syncAdminFixedIntakeUi();
  };

  function setFixedErr(msg) {
    var err = document.getElementById("adminFixedErr");
    if (err) err.textContent = msg || "";
  }

  function navHtml(step, isLast) {
    var html = '<div class="pprog-fixed-nav">';
    if (step > 0) {
      html +=
        '<button type="button" class="btn pprog-fixed-back" onclick="adminFixedBack()">Back</button>';
    }
    html +=
      '<button type="button" class="btn pprog-fixed-next" onclick="adminFixedNext()">' +
      (isLast ? "Build my plan" : "Next") +
      "</button></div><p class=\"pprog-fixed-err\" id=\"adminFixedErr\"></p>";
    return html;
  }

  function renderStep(step) {
    var S = C();
    var total = S.FIXED_STEPS.length;
    var key = S.FIXED_STEPS[step] || "profile";
    var st = intakeState;
    var html =
      '<p class="pprog-fixed-step">Step ' +
      (step + 1) +
      " / " +
      total +
      "</p>";

    if (key === "profile") {
      html +=
        '<p class="pprog-fixed-title">Your profile</p>' +
        '<p class="pprog-fixed-note">Age &amp; bodyweight open a number keypad. Experience stays a normal keyboard.</p>';
      for (var i = 0; i < S.PROFILE_DEFS.length; i++) {
        var def = S.PROFILE_DEFS[i];
        var val = "";
        if (def.id === "display_name") val = st.displayName || "";
        else if (def.id === "gender") val = st.gender || "";
        else if (def.id === "age") val = st.age || "";
        else if (def.id === "bodyweight") val = st.bodyweight || "";
        else if (def.id === "experience") val = st.experience || "";
        html +=
          '<div class="pprog-profile-row"><label for="adm-fx-' +
          esc(def.id) +
          '">' +
          esc(def.label) +
          "</label>";
        if (def.kind === "select") {
          html += '<select id="adm-fx-' + esc(def.id) + '" data-fx-id="' + esc(def.id) + '">';
          html += '<option value="">Select…</option>';
          for (var oi = 0; oi < def.options.length; oi++) {
            var ov = def.options[oi];
            html +=
              '<option value="' +
              esc(ov) +
              '"' +
              (String(val) === String(ov) ? " selected" : "") +
              ">" +
              esc(ov) +
              "</option>";
          }
          html += "</select>";
        } else {
          html += S.renderFixedProfileInputHtml(def, val, {
            idPrefix: "adm-fx-",
            dataAttr: "data-fx-id",
          });
        }
        html += "</div>";
      }
      /* Money sits with the profile, where a studio's does - and it stays with the
         owner: nothing here ever reaches the athlete (owner, 2026-09-03). */
      html +=
        '<div class="pprog-profile-row"><label for="adm-fx-amount">Monthly amount (ILS)</label>' +
        '<input id="adm-fx-amount" type="number" min="0" max="99999" inputmode="numeric" value="' +
        esc(parseInt(st.monthlyAmount, 10) > 0 ? parseInt(st.monthlyAmount, 10) : "") +
        '" placeholder="e.g. 900"></div>' +
        '<div class="pprog-profile-row"><label for="adm-fx-paymethod">Payment method</label>' +
        '<input id="adm-fx-paymethod" type="text" maxlength="200" value="' +
        esc(st.paymentMethod || "") +
        '" placeholder="Bit, 1st of the month"></div>';
    } else if (key === "setup") {
      /* "Where do you usually train?" — a well-equipped gym, or home / limited — stood
         here until 2026-09-15. It asked, in two words, the question the checklist below
         now answers item by item, and the two could disagree: a box ticked "well-equipped
         gym" with no rower under it said both things at once. One question, one answer
         (owner, 2026-09-15).
         "Heaviest implement you have (kg)" went the day before, for its own reason: one
         number for a whole setup could not say "dumbbells to 15 but a 40 kg sandbag". The
         checklist carries a ceiling PER implement. */
      html +=
        equipmentSectionHtml({ list: st.equipmentList || {} }) +
        /* One athlete, two settings. A box on weekdays and a garage on Saturday was being
           described as "limited equipment", which threw away four maxima in kilograms and
           then forbade kilograms underneath them (coach agent, 2026-09-03).
           Until 2026-09-15 the second place was a sentence and one "heaviest implement"
           number — the same unreadable shape the first place had just been rescued from,
           and one the post-check cannot measure a brick against. It is a second list now. */
        '<label class="pprog-fixed-inline" style="margin-top:14px">' +
        '<input type="checkbox" id="adm-fx-multiplace"' +
        (st.trainsMultipleLocations === true ? " checked" : "") +
        ' onchange="adminFixedMultiPlaceChanged()"> I train in more than one place</label>' +
        '<div id="adm-fx-second-wrap"' + (st.trainsMultipleLocations === true ? "" : " hidden") + ">" +
        /* The days come first, and they are what tells the coach where every OTHER day
           happens: whatever is not marked here belongs to the first place. The training
           week itself is asked on the next step, so these are the days to expect there. */
        '<p class="pprog-fixed-note" style="margin-top:10px">Which days are you in the OTHER place? ' +
        "Every training day you do not mark here happens in the first one.</p>" +
        '<div class="pprog-fixed-days">' +
        S.DAY_KEYS.map(function (dk) {
          return '<label><input type="checkbox" data-fx-second-day="' + esc(dk) + '"' +
            ((st.secondaryLocationDays || []).indexOf(dk) >= 0 ? " checked" : "") +
            "> " + esc(S.DAY_LABELS[dk] || dk) + "</label>";
        }).join("") +
        "</div>" +
        equipmentSectionHtml({
          list: st.secondaryEquipmentList || {},
          attr: "data-fx-eq2",
          allId: "adm-fx-eq2-all",
          title: "Available equipment — the OTHER place",
          note:
            "The same question again, about the second place. Floor, wall and bodyweight " +
            "work are always available there too.",
        }) +
        "</div>";
    } else if (key === "schedule") {
      var days = Array.isArray(st.trainingDays) ? st.trainingDays : [];
      html +=
        '<p class="pprog-fixed-title">Weekly schedule</p>' +
        '<p class="pprog-fixed-note">Mark training days. Optional notes for rest / session length.</p>' +
        '<div class="pprog-fixed-days">';
      for (var di = 0; di < S.DAY_KEYS.length; di++) {
        var dk = S.DAY_KEYS[di];
        html +=
          '<label><input type="checkbox" data-fx-day="' +
          esc(dk) +
          '"' +
          (days.indexOf(dk) >= 0 ? " checked" : "") +
          "> " +
          esc(S.DAY_LABELS[dk] || dk) +
          "</label>";
      }
      var mins = parseInt(st.sessionMinutes, 10);
      var differs = st.sessionTimesDiffer === true || !!String(st.sessionLimits || "").trim();
      html +=
        "</div>" +
        /* The length of a session, as a number — the same question a studio answers,
           asked the same way (owner, 2026-09-02). */
        '<div class="pprog-fixed-row">' +
        /* Hidden the moment he says the days differ: one number and "they are all
           different" cannot both be the answer, and showing both invites him to
           believe the number still means something (owner, 2026-09-02). */
        '<span class="pprog-fixed-len" id="adm-fx-len-wrap"' + (differs ? ' hidden' : "") + ">" +
        '<label class="pprog-fixed-inline" for="adm-fx-minutes">Session length (minutes)</label>' +
        '<input id="adm-fx-minutes" type="number" min="20" max="120" class="pprog-fixed-num" value="' +
        esc(mins > 0 ? mins : "") +
        '" placeholder="—">' +
        "</span>" +
        '<label class="pprog-fixed-inline"><input type="checkbox" id="adm-fx-times-differ"' +
        (differs ? " checked" : "") +
        ' onchange="adminFixedToggleTimes()"> Different times on different days</label>' +
        "</div>" +
        /* Only when a single number cannot say it: "45 minutes, but Friday can be an
           hour and a half". */
        '<textarea id="adm-fx-limits" maxlength="600" placeholder="e.g. 45 min most days, Friday can be 90"' +
        (differs ? "" : " hidden") +
        ">" +
        esc(st.sessionLimits || "") +
        "</textarea>" +
        /* One number per training day, and only when he says they differ - prefilled
           with the main number so he changes the one day that is different. A note in a
           free box ("weekends can reach 60") survived as prose and the coach flattened the
           week to 45 (coach agent, 2026-09-03). */
        '<div id="adm-fx-perday-wrap"' + (differs ? "" : " hidden") + ">" +
        '<p class="pprog-fixed-note" style="margin-top:4px">How long is each day?</p>' +
        '<div class="pprog-fixed-days">' +
        days
          .map(function (dk) {
            var byDay = st.sessionMinutesByDay || {};
            var val = parseInt(byDay[dk], 10) > 0 ? parseInt(byDay[dk], 10) : mins > 0 ? mins : "";
            return '<label><span>' + esc(S.DAY_LABELS[dk] || dk) + "</span>" +
              '<input type="number" min="20" max="180" class="pprog-fixed-num" data-fx-day-mins="' +
              esc(dk) + '" value="' + esc(val) + '"></label>';
          })
          .join("") +
        "</div></div>" +
        /* NO DELOAD UNLESS THEY ASK FOR ONE.
           The question used to be the other way round: a number field standing open at four,
           a "No deload" box to switch it off, and a fallback to four if neither was touched -
           so an athlete nobody asked still got a deload. Off by default, and ticking it opens
           the only question that follows: how often (owner, 2026-09-22, POL-032). The studio
           questionnaire has asked it this way since the start; this is the same shape. */
        '<div class="pprog-fixed-row">' +
        '<label class="pprog-fixed-inline"><input type="checkbox" id="adm-fx-deload-on"' +
        (parseInt(st.deloadEveryWeeks, 10) > 0 ? " checked" : "") +
        ' onchange="adminFixedDeloadToggled()"> Include a deload week</label>' +
        '</div>' +
        '<div class="pprog-fixed-row" id="admFxDeloadWrap"' +
        (parseInt(st.deloadEveryWeeks, 10) > 0 ? "" : ' style="display:none"') +
        ' aria-hidden="' + (parseInt(st.deloadEveryWeeks, 10) > 0 ? "false" : "true") + '">' +
        '<label class="pprog-fixed-inline" for="adm-fx-deload">Under Yes — one deload week every</label>' +
        '<input id="adm-fx-deload" type="number" min="4" max="12" class="pprog-fixed-num" value="' +
        esc(parseInt(st.deloadEveryWeeks, 10) > 0 ? parseInt(st.deloadEveryWeeks, 10) : "") +
        '" placeholder="5">' +
        '<label class="pprog-fixed-inline">weeks — counted continuously, month after month</label>' +
        "</div>" +
        '<textarea id="adm-fx-schedule-notes" maxlength="500" placeholder="Optional: e.g. rest Thu+Sun">' +
        esc(st.scheduleNotes || "") +
        "</textarea>";
    } else if (key === "recovery") {
      var pref = st.activeRecoveryPref || "";
      var prefDay = st.activeRecoveryDay || "";
      var showAr = pref === "yes";
      html +=
        '<p class="pprog-fixed-title">Active recovery day?</p>' +
        '<p class="pprog-fixed-note">Optional lighter day inside the training week (technique + easy engine). Not a full rest day.</p>' +

        '<div class="pprog-fixed-radios">' +
        '<label><input type="radio" name="admFxRecovery" value="no"' +
        (pref === "no" || !pref ? " checked" : "") +
        ' onchange="adminFixedRecoveryPrefChanged()"> <span><strong>No</strong> — do not include a weekly active recovery day. All training days are full sessions.</span></label>' +
        '<label><input type="radio" name="admFxRecovery" value="yes"' +
        (pref === "yes" ? " checked" : "") +
        ' onchange="adminFixedRecoveryPrefChanged()"> <span><strong>Yes</strong> — include one lighter active recovery day each training week. It is not a deload; a deload is a whole week.</span></label>' +
        '</div><div id="admFxRecoveryDayWrap" class="pprog-fixed-recovery-branch"' +
        (showAr ? "" : ' style="display:none"') +
        ' aria-hidden="' +
        (showAr ? "false" : "true") +
        '"><p class="pprog-fixed-note" style="margin-top:0">Under Yes — which day?</p><div class="pprog-fixed-days">';
      for (var rdi = 0; rdi < S.DAY_KEYS.length; rdi++) {
        var rdk = S.DAY_KEYS[rdi];
        html +=
          '<label><input type="radio" name="admFxRecoveryDay" value="' +
          esc(rdk) +
          '"' +
          (prefDay && prefDay === rdk ? " checked" : "") +
          "> " +
          esc(S.DAY_LABELS[rdk] || rdk) +
          "</label>";
      }
      html += "</div></div>";
    } else if (key === "lifts") {
      html +=
        '<p class="pprog-fixed-title">Lifts &amp; run</p>' +
        '<p class="pprog-lifts-picker-note">Enter weight (kg) and run time. Leave blank = unknown / skip — the coach will estimate.</p>' +
        S.renderFixedLiftsRowsHtml(st.lifts, { idPrefix: "adm-lift-" });
    } else if (key === "skills") {
      var sk = st.skills || {};
      html +=
        '<p class="pprog-fixed-title">Skills</p>' +
        '<p class="pprog-skills-picker-note">Mark skills you control. Unmarked = scale. Missing/partial skills can be noted in Goals or Injuries.</p>' +
        '<p class="pprog-skills-picker-note"><strong>Mark at least one</strong> — or tick <strong>All skills</strong>. A plan cannot be scaled to someone whose skills are unknown.</p>' +
        '<div class="pprog-skills-picker">';
      for (var si = 0; si < S.SKILL_DEFS.length; si++) {
        var sd = S.SKILL_DEFS[si];
        var checked = sd.allToggle ? !!sk.all_skills : !!sk[sd.id];
        if (!sd.allToggle && sk.all_skills) checked = true;
        html +=
          '<label class="' +
          (sd.allToggle ? "pprog-skills-all" : "") +
          '"><input type="checkbox" data-skill-id="' +
          esc(sd.id) +
          '" ' +
          (sd.allToggle ? 'data-skill-all="1" ' : "") +
          (checked ? "checked " : "") +
          'onchange="adminFixedSkillAllChange(this)"><span>' +
          esc(sd.label) +
          "</span></label>";
      }
      html += "</div>";
    } else if (key === "injuries") {
      /* "No injuries" is the answer for almost everyone, so it is the answer the step
         opens on: a healthy athlete taps Next and is done (owner, 2026-09-15). */
      var noInj = injuriesAreNone(st.injuries);
      html +=
        '<p class="pprog-fixed-title">Injuries &amp; limitations</p>' +
        '<p class="pprog-fixed-note">Nothing to report? Leave the button on and carry on. ' +
        "If there is something, switch it off and mark what to program around.</p>" +
        '<div class="pprog-fixed-chips">' +
        '<button type="button" class="pprog-fixed-chip' +
        (noInj ? " active" : "") +
        '" id="adm-fx-no-injuries-btn" aria-pressed="' +
        (noInj ? "true" : "false") +
        '" onclick="adminFixedToggleNoInjuries()">No injuries</button></div>' +
        /* A free-text box under that button stood here until 2026-09-15. It asked for a
           diagnosis the coach is FORBIDDEN to reason from, and an athlete who had just
           tapped "No injuries" was looking at an empty box inviting him to write anyway —
           correspondence with nowhere to go. What the coach may act on is the marks
           below, and the note beside them is where anything else belongs.
           Seven families, mapped one-to-one onto the coach substitution matrix
           (coach agent, 2026-09-02). */
        '<p class="pprog-fixed-title" style="margin-top:14px">Movements to avoid or limit</p>' +
        '<div class="pprog-skills-picker">' +
        S.AVOID_MOVEMENT_DEFS.map(function (d) {
          return '<label><input type="checkbox" data-avoid-id="' + esc(d.id) + '"' +
            ((st.avoidMovements || {})[d.id] === true ? " checked" : "") +
            "><span>" + esc(d.label) + "</span></label>";
        }).join("") +
        "</div>" +
        '<textarea id="adm-fx-avoid-other" maxlength="200" placeholder="Anything else to program around — e.g. left knee, no deep squats under fatigue">' +
        esc(st.avoidMovementsOther || "") +
        "</textarea>";
    } else if (key === "goals") {
      /* Goals were one free-text box until 2026-09-15. The reason to mark them is not
         enforcement — no code checks whether a month made someone stronger — but routing:
         "I want to get stronger" in prose reached the coach as nothing at all.
         "Maintaining a healthy lifestyle" leads, in a box of its own, and clears the rest:
         it is the answer most people give, and it is an answer (owner, 2026-09-15). */
      var goalMap = st.improveFocus || {};
      var lifestyleOn = goalMap.healthy_lifestyle === true;
      var skillOn = goalMap.specific_skill === true;
      html +=
        '<p class="pprog-fixed-title">Goals</p>' +
        '<p class="pprog-fixed-note">What should this month be for? Pick at most ' +
        S.MAX_GOALS +
        " — three pull the plan in three directions and it serves none of them. " +
        "The next block can be for something else.</p>" +
        '<div class="pprog-location-picker">' +
        '<label class="pprog-skills-all"><input type="checkbox" data-goal-id="healthy_lifestyle"' +
        (lifestyleOn ? " checked" : "") +
        ' onchange="adminFixedGoalPicked(this)"> ' +
        esc(S.GOAL_DEFS[0].label) +
        "</label></div>" +
        '<div class="pprog-location-picker">' +
        S.GOAL_DEFS.slice(1)
          .map(function (d) {
            return '<label><input type="checkbox" data-goal-id="' + esc(d.id) + '"' +
              (goalMap[d.id] === true ? " checked" : "") +
              ' onchange="adminFixedGoalPicked(this)"><span>' + esc(d.label) + "</span></label>";
          })
          .join("") +
        "</div>" +
        /* Which skill, and only then. Eight names rather than a box to type one into:
           the coach acts on the name, and a name it does not recognise is no answer. */
        '<div id="adm-fx-goal-skill-wrap"' + (skillOn ? "" : " hidden") + ">" +
        '<div class="pprog-profile-row"><label for="adm-fx-improve-other">Which skill?</label>' +
        '<select id="adm-fx-improve-other">' +
        S.GOAL_SKILL_DEFS.map(function (name) {
          return '<option value="' + esc(name) + '"' +
            (String(st.improveFocusOther || "") === name ? " selected" : "") +
            ">" + esc(name) + "</option>";
        }).join("") +
        "</select></div></div>" +
        /* A calorie-deficit tick and a free line under it lasted an afternoon. Neither
           belongs here: this product does not deal in nutrition, and a box that invites
           prose invites prose nobody can act on. The marks above are the answer, and the
           coach reads them (owner, 2026-09-15). */
        /* Competing changes what a block is for — peaking, testing, and how heavy a
           week may get. The coach is told in as many words (owner, 2026-09-02). */
        '<label class="pprog-fixed-inline" style="margin-top:12px">' +
        '<input type="checkbox" id="adm-fx-competitor"' +
        (st.competitor === true ? " checked" : "") +
        ' onchange="adminFixedCompetitorChanged()"> I am training for a competition / actively competing</label>' +
        /* "What do you want to improve?" — six boxes shown only to a competitor — stood
           here until 2026-09-15. It is the same question the goals above now ask of
           everyone, with a better list, so keeping it would have put two overlapping
           questions on one screen. The marks still travel in the same field. */
        /* Three edits of the same kind is what POL-005 needs before it learns a
           preference, and every edit is a paid call. One box here saves three months
           of them (coach agent, 2026-09-02). */
        '<p class="pprog-fixed-title" style="margin-top:16px">Anything you do NOT want to see in the plan?</p>' +
        '<textarea id="adm-fx-avoid-program" maxlength="400" placeholder="e.g. no burpees, no running on concrete">' +
        esc(st.avoidInProgram || "") +
        "</textarea>";
    }

    html += navHtml(step, step >= total - 1);
    return html;
  }

  window.syncAdminFixedIntakeUi = function syncAdminFixedIntakeUi() {
    var el = document.getElementById("intake-fixed");
    if (!el) return;
    el.classList.add("pprog-fixed-intake");
    if (!intakeState.fixedActive || intakeState.intakeComplete) {
      el.style.display = "none";
      el.innerHTML = "";
      return;
    }
    el.style.display = "block";
    el.setAttribute("lang", "en");
    el.setAttribute("dir", "ltr");
    el.innerHTML = renderStep(intakeState.fixedStep | 0);
    /* S is a local alias for the shared contract inside renderStep — it never existed
       here, so every render threw "S is not defined" and the intake could not start
       (owner, 2026-09-02). */
    C().bindIntakeNumericKeyboards(el);
    writeIntakeStatus("תחקור זהה לאפליקציה · שלב " +
      ((intakeState.fixedStep | 0) + 1) +
      "/" +
      C().FIXED_STEPS.length);
  };

  window.adminFixedSkillAllChange = function adminFixedSkillAllChange(inp) {
    if (!inp) return;
    var root =
      (inp.closest && inp.closest("#intake-fixed")) ||
      document.getElementById("intake-fixed");
    if (!root) return;
    var cbs = root.querySelectorAll('input[type="checkbox"][data-skill-id]');
    if (inp.getAttribute("data-skill-all")) {
      var on = !!inp.checked;
      for (var i = 0; i < cbs.length; i++) {
        if (cbs[i].getAttribute("data-skill-all")) continue;
        cbs[i].checked = on;
      }
      return;
    }
    if (!inp.checked) {
      for (var j = 0; j < cbs.length; j++) {
        if (cbs[j].getAttribute("data-skill-all")) cbs[j].checked = false;
      }
    }
  };

  window.adminFixedBack = function adminFixedBack() {
    if (intakeState.busy) return;
    if ((intakeState.fixedStep | 0) <= 0) return;
    intakeState.fixedStep = (intakeState.fixedStep | 0) - 1;
    syncAdminFixedIntakeUi();
  };

  /**
   * Nothing to report — the state the step opens in.
   *
   * An empty answer counts as "none" so a fresh intake starts on it; anything the athlete
   * actually reported reads as the opposite. Hebrew and English both, because intakes
   * were answered in both before the button existed.
   */
  function injuriesAreNone(raw) {
    var t = String(raw || "").trim();
    if (!t) return true;
    return /^no injuries\.?$/i.test(t) || t === "אין פציעות";
  }

  function noInjuriesChipOn() {
    var btn = document.getElementById("adm-fx-no-injuries-btn");
    return !!(btn && btn.getAttribute("aria-pressed") === "true");
  }

  /* Ticking "different times" is what makes the free text exist. Untick and it goes
     away rather than sitting there as an answer nobody meant to give. */
  function adminFixedToggleTimes() {
    var box = document.getElementById("adm-fx-times-differ");
    var text = document.getElementById("adm-fx-limits");
    if (!box || !text) return;
    text.hidden = !box.checked;
    /* The single number goes away with it — see the comment where it is rendered. */
    var lenWrap = document.getElementById("adm-fx-len-wrap");
    if (lenWrap) lenWrap.hidden = !!box.checked;
    /* And one number per day appears in its place. */
    var perDay = document.getElementById("adm-fx-perday-wrap");
    if (perDay) perDay.hidden = !box.checked;
    if (box.checked) {
      try { text.focus(); } catch (e) {}
    }
  }
  if (typeof window !== "undefined") window.adminFixedToggleTimes = adminFixedToggleTimes;

  /* Competing still changes what a block is for — peaking, testing, how heavy a week may
     get — but it no longer gates a list of its own: the goals above are asked of everyone
     (owner, 2026-09-15). */
  window.adminFixedCompetitorChanged = function () {};

  /**
   * At most two, and one of them clears the rest.
   *
   * "Maintaining a healthy lifestyle" is not one goal among nine: it is the answer that
   * replaces them, so ticking it empties the list and ticking anything else lets it go.
   * A third pick is refused rather than silently swapping one out — the athlete chose
   * three things and deserves to be told only two travel (owner, 2026-09-15).
   */
  window.adminFixedGoalPicked = function (inp) {
    var S = C();
    var root = document.getElementById("intake-fixed");
    if (!root || !inp) return;
    var boxes = root.querySelectorAll("input[data-goal-id]");
    var id = inp.getAttribute("data-goal-id");
    var i;
    if (id === "healthy_lifestyle" && inp.checked) {
      for (i = 0; i < boxes.length; i++) {
        if (boxes[i] !== inp) boxes[i].checked = false;
      }
    } else if (inp.checked) {
      var lifestyle = root.querySelector('input[data-goal-id="healthy_lifestyle"]');
      if (lifestyle) lifestyle.checked = false;
      var picked = 0;
      for (i = 0; i < boxes.length; i++) {
        if (boxes[i].checked && boxes[i].getAttribute("data-goal-id") !== "healthy_lifestyle") picked++;
      }
      if (picked > S.MAX_GOALS) {
        inp.checked = false;
        setFixedErr("Pick at most " + S.MAX_GOALS + " goals — untick one first.");
        return;
      }
    }
    var wrap = document.getElementById("adm-fx-goal-skill-wrap");
    var skill = root.querySelector('input[data-goal-id="specific_skill"]');
    if (wrap) {
      if (skill && skill.checked) wrap.removeAttribute("hidden");
      else wrap.setAttribute("hidden", "");
    }
    setFixedErr("");
  };

  /* A switch, not a shortcut into a box: there is no box any more. On means nothing to
     report; off means the marks below carry it (owner, 2026-09-15). */
  window.adminFixedToggleNoInjuries = function () {
    var btn = document.getElementById("adm-fx-no-injuries-btn");
    if (!btn) return;
    var on = !noInjuriesChipOn();
    btn.classList.toggle("active", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    setFixedErr("");
  };

  /* The cadence question exists only once a deload is asked for - same shape as the
     recovery day above it (owner, 2026-09-22, POL-032). */
  window.adminFixedDeloadToggled = function () {
    var wrap = document.getElementById("admFxDeloadWrap");
    var box = document.getElementById("adm-fx-deload-on");
    if (!wrap || !box) return;
    var on = !!box.checked;
    wrap.style.display = on ? "" : "none";
    wrap.setAttribute("aria-hidden", on ? "false" : "true");
    if (on) {
      var num = document.getElementById("adm-fx-deload");
      if (num && !num.value) num.focus();
    }
    setFixedErr("");
  };

  window.adminFixedRecoveryPrefChanged = function () {
    var wrap = document.getElementById("admFxRecoveryDayWrap");
    if (!wrap) return;
    var prefEl = document.querySelector('input[name="admFxRecovery"]:checked');
    var yes = !!(prefEl && prefEl.value === "yes");
    wrap.style.display = yes ? "" : "none";
    wrap.setAttribute("aria-hidden", yes ? "false" : "true");
  };

  /**
   * Ticking one place unticks the other.
   *
   * They are checkboxes rather than radios on purpose: he can leave both empty and the
   * step will tell him to choose, which a radio group cannot do once touched.
   */
  /* The second place opens with the tick, and closes with it. */
  window.adminFixedMultiPlaceChanged = function () {
    var box = document.getElementById("adm-fx-multiplace");
    var wrap = document.getElementById("adm-fx-second-wrap");
    if (!box || !wrap) return;
    if (box.checked) wrap.removeAttribute("hidden");
    else wrap.setAttribute("hidden", "");
  };

  window.adminFixedNext = function adminFixedNext() {
    if (intakeState.busy) return;
    var box = document.getElementById("intake-fixed");
    if (!box) return;
    var S = C();
    var step = intakeState.fixedStep | 0;
    var key = S.FIXED_STEPS[step] || "profile";
    setFixedErr("");

    if (key === "profile") {
      var vals = {};
      var fields = box.querySelectorAll("[data-fx-id]");
      for (var i = 0; i < fields.length; i++) {
        vals[fields[i].getAttribute("data-fx-id")] = String(fields[i].value || "").trim();
      }
      if (!vals.display_name || !vals.gender || !vals.age || !vals.bodyweight || !vals.experience) {
        setFixedErr("Please fill all profile fields.");
        return;
      }
      var ageN = parseInt(vals.age, 10);
      var bwN = parseFloat(String(vals.bodyweight).replace(",", "."));
      if (!isFinite(ageN) || ageN < 12 || ageN > 80) {
        setFixedErr("Age should be a number between 12 and 80.");
        return;
      }
      if (!isFinite(bwN) || bwN < 35 || bwN > 200) {
        setFixedErr("Bodyweight should be between 35 and 200 kg.");
        return;
      }
      var amountEl = document.getElementById("adm-fx-amount");
      var methodEl = document.getElementById("adm-fx-paymethod");
      var amountN = amountEl ? parseInt(amountEl.value, 10) : 0;
      intakeState.monthlyAmount = amountN > 0 && amountN <= 99999 ? amountN : 0;
      intakeState.paymentMethod = methodEl ? String(methodEl.value || "").trim().slice(0, 200) : "";
      intakeState.displayName = vals.display_name.slice(0, 80);
      intakeState.gender = vals.gender.slice(0, 16).toLowerCase();
      intakeState.preferredLanguage = "en";
      intakeState.age = String(ageN);
      intakeState.bodyweight = String(bwN);
      intakeState.experience = vals.experience.slice(0, 120);
    } else if (key === "setup") {
      /* Nothing to validate. Ticking nothing is a real answer — an athlete with a floor
         and a wall and no kit at all — and the packet says so item by item rather than
         falling back on "full gym" (see inventoryFor, which is told the list was
         answered even when every row is a no).
         The free-text box that stood here for one day is gone too (owner, 2026-09-15):
         prose cannot be measured against a brick, and anything worth saying about the
         equipment is a row on the list. If something real is missing from the list, the
         list is what should grow. */
      intakeState.trainingLocations = {};
      intakeState.trainingLocationOther = "";
      /* One ceiling for a whole setup is gone (owner, 2026-09-14). It could not say "dumbbells
         to 15 but a 40 kg sandbag", it was only ever asked of the home athlete, and for anyone
         else its absence told the coach to write no kilograms at all. The checklist carries a
         ceiling per implement instead. */
      intakeState.equipmentList = equipmentFromForm("data-fx-eq");
      var multiEl = document.getElementById("adm-fx-multiplace");
      intakeState.trainsMultipleLocations = !!(multiEl && multiEl.checked);
      var secondDays = [];
      var secondBoxes = box.querySelectorAll("input[data-fx-second-day]");
      for (var sd = 0; sd < secondBoxes.length; sd++) {
        if (secondBoxes[sd].checked) secondDays.push(secondBoxes[sd].getAttribute("data-fx-second-day"));
      }
      /* Nothing is kept from a second place he unticked. */
      intakeState.secondaryLocationDays = intakeState.trainsMultipleLocations ? secondDays : [];
      intakeState.secondaryEquipmentList = intakeState.trainsMultipleLocations
        ? equipmentFromForm("data-fx-eq2")
        : {};
      intakeState.secondaryLocationEquipment = "";
      intakeState.secondaryHeaviestImplementKg = 0;
      intakeState.trainingSetup = (intakeState.trainsMultipleLocations
        ? "Equipment answered item by item, for two places"
        : "Equipment answered item by item"
      ).slice(0, 800);
    } else if (key === "schedule") {
      var days = [];
      var dayCbs = box.querySelectorAll("input[data-fx-day]");
      for (var d = 0; d < dayCbs.length; d++) {
        if (dayCbs[d].checked) days.push(dayCbs[d].getAttribute("data-fx-day"));
      }
      var schEl = document.getElementById("adm-fx-schedule-notes");
      var minEl = document.getElementById("adm-fx-minutes");
      var diffEl = document.getElementById("adm-fx-times-differ");
      var limEl = document.getElementById("adm-fx-limits");
      intakeState.trainingDays = days;
      intakeState.scheduleNotes = schEl ? String(schEl.value || "").trim().slice(0, 500) : "";
      var minsIn = parseInt(minEl && minEl.value, 10);
      intakeState.sessionTimesDiffer = !!(diffEl && diffEl.checked);
      /* If the days differ there is no single length, so we keep none. */
      intakeState.sessionMinutes =
        !intakeState.sessionTimesDiffer && minsIn >= 20 && minsIn <= 120 ? minsIn : 0;
      var byDay = {};
      if (intakeState.sessionTimesDiffer) {
        var dayMinBoxes = box.querySelectorAll("input[data-fx-day-mins]");
        for (var dm = 0; dm < dayMinBoxes.length; dm++) {
          var dmKey = dayMinBoxes[dm].getAttribute("data-fx-day-mins");
          var dmVal = parseInt(dayMinBoxes[dm].value, 10);
          if (days.indexOf(dmKey) >= 0 && dmVal >= 20 && dmVal <= 180) byDay[dmKey] = dmVal;
        }
      }
      intakeState.sessionMinutesByDay = byDay;
      var deloadOnEl = document.getElementById("adm-fx-deload-on");
      var deloadEl = document.getElementById("adm-fx-deload");
      var deloadN = deloadEl ? parseInt(deloadEl.value, 10) : 0;
      /* NOT ASKED FOR IS ZERO. This used to fall back to four whenever the box was empty,
         which handed a deload to an athlete who never mentioned one (owner, 2026-09-22). */
      intakeState.deloadEveryWeeks =
        deloadOnEl && deloadOnEl.checked && deloadN >= 4 && deloadN <= 12 ? deloadN : 0;
      /* The free text is only kept while the tick box says the times differ — leftover
         text under an unticked box is an answer nobody gave. */
      intakeState.sessionLimits = intakeState.sessionTimesDiffer && limEl
        ? String(limEl.value || "").trim().slice(0, 600)
        : "";
      if (!days.length && !intakeState.scheduleNotes) {
        setFixedErr("Mark at least one training day, or add a short schedule note.");
        return;
      }
      /* A session with no length is a guess with a stopwatch attached — the same rule
         the studio intake follows. */
      if (!intakeState.sessionMinutes && !intakeState.sessionLimits) {
        setFixedErr("How long is a session? 20–120 minutes, or tick the box and describe it.");
        return;
      }
    } else if (key === "recovery") {
      var prefEl = box.querySelector('input[name="admFxRecovery"]:checked');
      var dayEl = box.querySelector('input[name="admFxRecoveryDay"]:checked');
      intakeState.activeRecoveryPref = prefEl && prefEl.value === "yes" ? "yes" : "no";
      if (intakeState.activeRecoveryPref === "yes") {
        if (!dayEl || !dayEl.value) {
          setFixedErr("Pick which day is the active recovery day (under Yes).");
          return;
        }
        intakeState.activeRecoveryDay = String(dayEl.value).slice(0, 8);
      } else {
        intakeState.activeRecoveryDay = "";
      }
    } else if (key === "lifts") {
      var lifts = {};
      var lines = [];
      var bad = false;
      var inputs = box.querySelectorAll("input[data-lift-id]");
      for (var li = 0; li < inputs.length; li++) {
        var lid = inputs[li].getAttribute("data-lift-id");
        var kind = inputs[li].getAttribute("data-lift-kind") || "kg";
        var raw = inputs[li].value;
        var normalized = normalizeLiftInput(raw, kind);
        if (String(raw || "").trim() && !normalized) {
          bad = true;
          inputs[li].style.borderColor = "#E8451A";
          continue;
        }
        inputs[li].style.borderColor = "";
        var defLabel = lid;
        for (var lj = 0; lj < S.LIFT_DEFS.length; lj++) {
          if (S.LIFT_DEFS[lj].id === lid) defLabel = S.LIFT_DEFS[lj].label;
        }
        if (normalized) {
          lifts[lid] = normalized;
          lines.push(defLabel + ": " + normalized + (kind === "run" ? " min" : " kg"));
        } else {
          lifts[lid] = "";
          lines.push(defLabel + ": unknown");
        }
      }
      if (bad) {
        setFixedErr("Fix highlighted lift/run values (or leave blank).");
        return;
      }
      intakeState.lifts = lifts;
      intakeState.pendingIntakeLiftsLines = lines;
    } else if (key === "skills") {
      var skills = {};
      var scbs = box.querySelectorAll('input[type="checkbox"][data-skill-id]');
      var allOn = false;
      for (var si = 0; si < scbs.length; si++) {
        var sid = scbs[si].getAttribute("data-skill-id");
        if (scbs[si].getAttribute("data-skill-all")) {
          allOn = !!scbs[si].checked;
          skills.all_skills = allOn;
          continue;
        }
        if (allOn || scbs[si].checked) skills[sid] = true;
      }
      if (allOn) {
        for (var sk = 0; sk < S.SKILL_DEFS.length; sk++) {
          if (!S.SKILL_DEFS[sk].allToggle) skills[S.SKILL_DEFS[sk].id] = true;
        }
      }
      /* Walking past this step untouched used to be allowed, and it produced an
         athlete whose whole skill profile was "nothing marked" — indistinguishable
         from a beginner who controls nothing (owner, 2026-09-02). */
      var markedAny = Object.keys(skills).some(function (k) { return skills[k] === true; });
      if (!markedAny) {
        setFixedErr("Mark at least one skill, or tick All skills.");
        return;
      }
      intakeState.skills = skills;
    } else if (key === "injuries") {
      /* One of two answers, and never a diagnosis: either there is nothing to report, or
         there is, and what the coach may act on is the marks below. */
      intakeState.injuries = noInjuriesChipOn()
        ? "No injuries"
        : "Reported — program around the movements marked below.";
      var avoidMap = {};
      var avoidBoxes = box.querySelectorAll("input[data-avoid-id]");
      for (var av = 0; av < avoidBoxes.length; av++) {
        if (avoidBoxes[av].checked) avoidMap[avoidBoxes[av].getAttribute("data-avoid-id")] = true;
      }
      intakeState.avoidMovements = avoidMap;
      var avoidOtherEl = document.getElementById("adm-fx-avoid-other");
      intakeState.avoidMovementsOther = avoidOtherEl
        ? String(avoidOtherEl.value || "").trim().slice(0, 200)
        : "";
    } else if (key === "goals") {
      var compEl = document.getElementById("adm-fx-competitor");
      intakeState.competitor = !!(compEl && compEl.checked);
      /* No free line to read: what this month is for is the marks (owner, 2026-09-15). */
      intakeState.goals = "";
      var improveMap = {};
      var goalBoxes = box.querySelectorAll("input[data-goal-id]");
      for (var im = 0; im < goalBoxes.length; im++) {
        if (goalBoxes[im].checked) improveMap[goalBoxes[im].getAttribute("data-goal-id")] = true;
      }
      intakeState.improveFocus = improveMap;
      /* The named skill only travels with the goal that asks for it. */
      var improveOtherEl = document.getElementById("adm-fx-improve-other");
      intakeState.improveFocusOther =
        improveMap.specific_skill === true && improveOtherEl
          ? String(improveOtherEl.value || "").trim().slice(0, 200)
          : "";
      var avoidProgEl = document.getElementById("adm-fx-avoid-program");
      intakeState.avoidInProgram = avoidProgEl
        ? String(avoidProgEl.value || "").trim().slice(0, 400)
        : "";
      if (!intakeState.goals) {
        setFixedErr("Add at least a short goal (or write unknown).");
        return;
      }
    }

    if (step < S.FIXED_STEPS.length - 1) {
      intakeState.fixedStep = step + 1;
      syncAdminFixedIntakeUi();
      return;
    }

    finishAdminFixedIntakeAndBuild();
  };

  function restoreAdminFixedGoals(errMsg) {
    showIntakeBuilding(false);
    setIntakeBusy(false);
    intakeState.fixedActive = true;
    intakeState.fixedStep = C().FIXED_STEPS.length - 1;
    syncAdminFixedIntakeUi();
    var compose = document.getElementById("intake-compose");
    if (compose) compose.style.display = "none";
    var log = document.getElementById("intake-chat-log");
    if (log) log.style.display = "none";
    if (errMsg) {
      writeIntakeStatus(errMsg);
      setFixedErr(errMsg);
    }
  }

  /**
   * OFF until production (owner, 2026-09-02).
   *
   * True means finishing the intake asks Gemini for a four-week block — real money, on
   * every rehearsal. It also puts a plan in front of the athlete that the owner has not
   * read, which is the opposite of the procedure he set: he writes, he approves, he
   * sends. Turn this on when the product goes live, not before.
   */
  var ATHLETE_AI_BUILD_ENABLED = false;

  /**
   * The individual, created the same way a studio client is: an empty month shaped by
   * the days they train, waiting for the owner to write it.
   */
  function createAthleteAsClient() {
    var S = C();
    var prof = S.normalizeIntakeProfile(Object.assign({}, intakeState, { intakeComplete: true }));
    var dayMap = {};
    (Array.isArray(intakeState.trainingDays) ? intakeState.trainingDays : []).forEach(function (d) {
      dayMap[String(d)] = true;
    });
    setIntakeBusy(true);
    showIntakeBuilding(true, "<strong>Coach</strong> — saving the athlete…");
    writeIntakeStatus("שומר מתאמן…");
    fetch(adminApiUrl("/api/client-program"), {
      method: "POST",
      headers: typeof adminAuthHeaders === "function" ? adminAuthHeaders() : { "Content-Type": "application/json" },
      body: JSON.stringify(
        typeof withAdminPassword === "function"
          ? withAdminPassword(athleteCreateBody(prof, dayMap))
          : athleteCreateBody(prof, dayMap)
      ),
    })
      .then(function (r) { return r.json().then(function (j) { return { status: r.status, j: j }; }); })
      .then(function (res) {
        if (res.status === 401) {
          restoreAdminFixedGoals("פג תוקף ההתחברות לאדמין — התחבר מחדש ואז נסה שוב.");
          return;
        }
        if (res.status !== 200 || !res.j || !res.j.ok || !res.j.program) {
          restoreAdminFixedGoals((res.j && res.j.error) || "לא הצלחתי לשמור את המתאמן.");
          return;
        }
        intakeState.intakeComplete = true;
        showIntakeBuilding(false);
        setIntakeBusy(false);
        if (typeof window.closeIntakeWorkspace === "function") window.closeIntakeWorkspace();
        /* Straight to his card, where he writes the month and then issues the link. */
        if (window.ClientScreen && window.ClientScreen.reload) {
          window.ClientScreen.reload().then(function () {
            window.ClientScreen.open(res.j.program.programId);
          });
        }
      })
      .catch(function (e) {
        restoreAdminFixedGoals("שגיאת רשת בשמירת המתאמן: " + String((e && e.message) || e).slice(0, 160));
      });
  }

  function athleteCreateBody(prof, dayMap) {
    return {
      action: "create",
      clientKind: "athlete",
      clientName: prof.displayName || "מתאמן",
      monthlyAmount: intakeState.monthlyAmount || 0,
      paymentMethod: intakeState.paymentMethod || "",
      athleteIntake: {
        displayName: prof.displayName || "",
        gender: prof.gender || "",
        age: intakeState.age || "",
        bodyweight: intakeState.bodyweight || "",
        experience: intakeState.experience || "",
        trainingSetup: prof.trainingSetup || "",
        /* The raw answers, not only the sentence built from them: the next block asks
           these questions again, and reading them back out of prose is how it came to
           show a well-equipped box to someone who had described a garage
           (owner, 2026-09-03). */
        trainingLocations: prof.trainingLocations || {},
        trainingLocationOther: intakeState.trainingLocationOther || "",
        trainingDays: prof.trainingDays || [],
        scheduleNotes: prof.scheduleNotes || "",
        trainingDaysMap: dayMap,
        sessionMinutes: parseInt(intakeState.sessionMinutes, 10) || 0,
        sessionTimesDiffer: intakeState.sessionTimesDiffer === true,
        sessionLimits: intakeState.sessionLimits || "",
        activeRecoveryPref: intakeState.activeRecoveryPref || "",
        lifts: prof.lifts || {},
        skills: prof.skills || {},
        skillsSummary: prof.skillsSummary || "",
        injuries: intakeState.injuries || "",
        goals: intakeState.goals || "",
        competitor: intakeState.competitor === true,
        trainsMultipleLocations: prof.trainsMultipleLocations === true,
        secondaryLocationDays: prof.secondaryLocationDays || [],
        secondaryLocationEquipment: prof.secondaryLocationEquipment || "",
        secondaryHeaviestImplementKg: prof.secondaryHeaviestImplementKg || 0,
        sessionMinutesByDay: prof.sessionMinutesByDay || {},
        deloadEveryWeeks: prof.deloadEveryWeeks || 0,
        improveFocus: prof.improveFocus || {},
        improveFocusOther: prof.improveFocusOther || "",
        avoidMovements: prof.avoidMovements || {},
        avoidMovementsOther: prof.avoidMovementsOther || "",
        equipmentList: prof.equipmentList || {},
        secondaryEquipmentList: prof.secondaryEquipmentList || {},
        avoidInProgram: prof.avoidInProgram || "",
        /* The packet the coach will read on the day he is reconnected. */
        fixedIntakePacket: String(prof.fixedIntakePacket || "").slice(0, 6000),
        profileNotes: String(prof.profileNotes || "").slice(0, 2000),
      },
    };
  }

  function finishAdminFixedIntakeAndBuild() {
    var S = C();
    var prompt = S.buildFixedIntakePrompt(intakeState);
    var notes = S.buildProfileNotes(intakeState);
    intakeState.fixedIntakePacket = String(prompt).slice(0, 6000);
    intakeState.profileNotes = notes;
    intakeState.fixedActive = false;
    syncAdminFixedIntakeUi();
    var compose = document.getElementById("intake-compose");
    if (compose) compose.style.display = "none";
    var log = document.getElementById("intake-chat-log");
    if (log) log.style.display = "none";
    intakeState.messages = [
      {
        role: "model",
        text:
          "You can reply in any language — keep it simple. I will still coach you in English.\n\n" +
          "Fill the short questionnaire below. When you finish, I build your 4-week plan in one shot.",
      },
      { role: "user", text: prompt },
    ];
    intakeState.buildAttempted = true;
    if (!ATHLETE_AI_BUILD_ENABLED) {
      createAthleteAsClient();
      return;
    }
    generateIntakeBlockFromFixedPacket();
  }

  window.intakeAthleteProfile = function intakeAthleteProfile(opts) {
    ensureAdminAthleteBilling();
    return C().athleteProfileForGenerateBlock(intakeState, {
      forceIntakeComplete: !!(opts && opts.forceIntakeComplete),
      athleteId: intakeState.athleteId,
      costCaps: intakeState.costCaps,
    });
  };

  function ensureAdminAthleteBilling() {
    if (!intakeState.athleteId) intakeState.athleteId = C().newAthleteId();
    if (!intakeState.costCaps || typeof intakeState.costCaps !== "object") {
      intakeState.costCaps = C().emptyCostCaps();
    }
    if (!intakeState.intakeBuildId) {
      intakeState.intakeBuildId = "ib_" + intakeState.athleteId + "_" + Date.now();
    }
    return intakeState;
  }

  function generateIntakeBlockFromFixedPacket(retryLeft) {
    if (intakeState.busy && retryLeft == null) return;
    /* One automatic retry only for clear 5xx — never abort/timeout (duplicate Gemini). */
    if (retryLeft == null) retryLeft = 1;
    /* A session token IS being logged in. Asking for the password instead refused every
       build after an ordinary login, and logging in again could not help — the login is
       what clears the password (owner, 2026-09-02). */
    var authed =
      typeof adminIsAuthed === "function"
        ? adminIsAuthed()
        : !!(
            (typeof adminSessionToken !== "undefined" && adminSessionToken) ||
            (typeof adminPw !== "undefined" && String(adminPw || "").trim())
          );
    if (!authed) {
      restoreAdminFixedGoals(
        "פג תוקף ההתחברות לאדמין — צא מ+מתאמן, התחבר מחדש, ואז Build plan."
      );
      return;
    }
    ensureAdminAthleteBilling();
    setIntakeBusy(true);
    showIntakeBuilding(
      true,
      "<strong>Coach</strong> is building your 4-week block…"
    );
    writeIntakeStatus("בונה לבנה אמיתית (generate_block) · " + intakeState.athleteId + "…");

    var profile = intakeAthleteProfile({ forceIntakeComplete: true });
    var payloadMsgs = [
      { role: "user", text: String(intakeState.fixedIntakePacket || "").slice(0, 6000) },
    ];

    var pcHeaders =
      typeof adminAuthHeaders === "function"
        ? adminAuthHeaders()
        : { "Content-Type": "application/json" };
    var payload = {
      action: "generate_block",
      messages: payloadMsgs,
      athleteProfile: profile,
      athleteId: intakeState.athleteId,
      costCaps: intakeState.costCaps,
      intakeBuildId: intakeState.intakeBuildId,
      intakeComplete: true,
      forceJson: true,
      adminProgramming: true,
    };
    /* Last month, when this athlete has one. Read from the snapshot on the page rather
       than from the intake state: the intake is about who they are, the handoff is
       about what they just did (coach agent, 2026-09-08). */
    if (typeof coachBlockHandoffFor === "function" && typeof adminCurrentAthlete === "function") {
      var handoff = coachBlockHandoffFor(adminCurrentAthlete());
      if (handoff) payload.blockHandoff = handoff;
    }
    if (typeof withAdminPassword === "function") payload = withAdminPassword(payload);

    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = null;
    if (controller) {
      timer = setTimeout(function () {
        try {
          controller.abort();
        } catch (eAbort) {}
      }, 180000);
    }

    fetch(adminApiUrl("/api/personal-coach"), {
      method: "POST",
      headers: pcHeaders,
      body: JSON.stringify(payload),
      signal: controller ? controller.signal : undefined,
    })
      .then(function (r) {
        return r.text().then(function (raw) {
          var j = null;
          try {
            j = raw ? JSON.parse(raw) : null;
          } catch (eParse) {
            j = null;
          }
          return { ok: r.ok, status: r.status, j: j, raw: raw };
        });
      })
      .then(function (x) {
        var j = x.j || {};
        if (!x.ok || !j.ok) {
          var err =
            typeof friendlyCoachError === "function"
              ? friendlyCoachError(j, x.status)
              : String((j && (j.message || j.error)) || (x.raw ? "bad response" : "empty response"));
          var retry5xx = retryLeft > 0 && x.status >= 500 && x.status < 600;
          if (retry5xx) {
            writeIntakeStatus("שגיאת שרת — מנסה פעם נוספת…");
            setIntakeBusy(false);
            return generateIntakeBlockFromFixedPacket(retryLeft - 1);
          }
          restoreAdminFixedGoals(
            "בניית הלבנה נכשלה: " + err + " — לחץ Build my plan שוב רק אם לא נשמר מתאמן."
          );
          return;
        }
        /* Whatever the brain noticed about this block — notes to the owner, not errors,
           and a cut answer gets its own "try again" (coach agent, 2026-09-08). */
        if (typeof showBrickFlags === "function") showBrickFlags(j);
        var block =
          typeof parseBlockFromText === "function" ? parseBlockFromText(j.text, j) : j.block;
        if (!block || !block.weeks || !block.weeks.length) {
          restoreAdminFixedGoals(
            "המאמן לא החזיר BLOCK_JSON תקין — לחץ Build my plan שוב רק אם לא נשמר מתאמן."
          );
          return;
        }
        intakeState.costCaps = C().recordBrickFill(intakeState.costCaps);
        finalizeNewAthlete(block);
      })
      .catch(function (e) {
        var msg = String((e && e.message) || e || "");
        var aborted = /aborted|abort|timeout/i.test(msg);
        var network = /load failed|failed to fetch|networkerror/i.test(msg) && !aborted;
        if (retryLeft > 0 && network) {
          writeIntakeStatus("חיבור נקטע לפני תשובה — מנסה פעם נוספת…");
          setIntakeBusy(false);
          return generateIntakeBlockFromFixedPacket(retryLeft - 1);
        }
        var friendly = aborted
          ? "החיבור נקטע באמצע בניית הלבנה. אל תלחץ Build שוב מיד — ייתכן שהלבנה כבר נבנתה בשרת. בדוק את רשימת המתאמנים, ורק אז Build שוב."
          : "שגיאת רשת בבניית לבנה: " +
            msg.slice(0, 160) +
            " — לחץ Build my plan שוב רק אם לא נשמר מתאמן.";
        restoreAdminFixedGoals(friendly);
      })
      .finally(function () {
        if (timer) clearTimeout(timer);
      });
  }

  window.generateIntakeBlock = function generateIntakeBlock() {
    if (!intakeState.fixedIntakePacket) {
      writeIntakeStatus("יש להשלים את התחקור הקבוע לפני בניית לבנה.");
      return;
    }
    if (intakeState.buildAttempted) {
      var okAgain =
        typeof window.confirm === "function"
          ? window.confirm(
              "כבר ניסינו לבנות לבנה למתאמן הזה. לבנות שוב? (עלול לחייב שוב על אותו UID)"
            )
          : true;
      if (!okAgain) return;
      intakeState.intakeBuildId = "";
    }
    intakeState.buildAttempted = true;
    if (!ATHLETE_AI_BUILD_ENABLED) {
      createAthleteAsClient();
      return;
    }
    generateIntakeBlockFromFixedPacket();
  };

  window.finalizeNewAthlete = function finalizeNewAthlete(block) {
    /* 22.0: a block that comes back is proof the pipe works, and nothing more. See
       COACH_BUILD_MAY_SAVE in admin.html for why it is not saved. */
    if (window.COACH_BUILD_MAY_SAVE !== true) {
      showIntakeBuilding(false);
      setIntakeBusy(false);
      writeIntakeStatus(
        "המאמן החזיר לבנה — והיא לא נשמרה. בגרסה הזו החיבור למאמן הוא בדיקת צינור בלבד."
      );
      return;
    }
    if (window.NormalizePprogBlock && block && typeof block === "object") {
      block = NormalizePprogBlock.normalize(block, null);
    }
    intakeState.intakeComplete = true;
    showIntakeBuilding(
      true,
      "<strong>Coach</strong> — saving athlete + one-time handoff link…"
    );
    writeIntakeStatus("שומר מתאמן + לינק מסירה…");

    var intakeProfile = C().normalizeIntakeProfile(
      Object.assign({}, intakeState, { intakeComplete: true })
    );

    fetch(adminApiUrl("/api/admin-handoff"), {
      method: "POST",
      headers: typeof adminAuthHeaders === "function" ? adminAuthHeaders() : { "Content-Type": "application/json" },
      body: JSON.stringify(
        typeof withAdminPassword === "function"
          ? withAdminPassword({
              action: "create_athlete",
              displayName: intakeProfile.displayName,
              email: intakeState.email || "",
              gender: intakeProfile.gender,
              preferredLanguage: "en",
              intakeSummary: String(intakeProfile.profileNotes || "").slice(0, 800),
              skillsSummary: intakeProfile.skillsSummary,
              intakeProfile: intakeProfile,
              fixedIntakePacket: intakeProfile.fixedIntakePacket,
              skills: intakeProfile.skills,
              lifts: intakeProfile.lifts,
              coachDirectives: "",
              currentBlock: block,
              athleteId: intakeState.athleteId,
              costCaps: intakeState.costCaps,
              autoCreateLink: true,
            })
          : {
              action: "create_athlete",
              displayName: intakeProfile.displayName,
              intakeProfile: intakeProfile,
              currentBlock: block,
              athleteId: intakeState.athleteId,
              costCaps: intakeState.costCaps,
              autoCreateLink: true,
            }
      ),
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (d) {
        if (!d || !d.ok) {
          showIntakeBuilding(false);
          writeIntakeStatus("שגיאה ביצירת מתאמן: " + ((d && (d.message || d.error)) || "?"));
          setIntakeBusy(false);
          return;
        }
        if (typeof currentAthleteId !== "undefined") {
          window.currentAthleteId = d.snapshot && d.snapshot.athleteId;
        }
        var linkPath =
          (d.handoff && d.handoff.path) ||
          (d.snapshot && d.snapshot.lastHandoffPath) ||
          "";
        var abs =
          linkPath && typeof pagesAbsoluteUrl === "function"
            ? pagesAbsoluteUrl(linkPath)
            : linkPath && typeof location !== "undefined"
              ? location.origin + linkPath
              : linkPath || "";
        if (typeof lastHandoffUrl !== "undefined") {
          window.lastHandoffUrl = abs || "";
        }
        if (typeof athletes !== "undefined" && Array.isArray(athletes) && d.snapshot) {
          var snap = d.snapshot;
          var idx = athletes.findIndex(function (x) {
            return x.athleteId === snap.athleteId;
          });
          var row = Object.assign({}, snap, {
            lastHandoffPath: linkPath || snap.lastHandoffPath || "",
          });
          if (idx >= 0) athletes[idx] = Object.assign({}, athletes[idx], row);
          else athletes.unshift(row);
        }
        writeIntakeStatus(abs
          ? "נוצר ✓ לינק מסירה בכרטיס המתאמן"
          : "נוצר בהצלחה ✓");
        setTimeout(function () {
          setIntakeModalOpen(false);
          resetIntakeState();
          refreshFabVisibility();
          if (typeof loadAthletes === "function") loadAthletes();
        }, 700);
      })
      .catch(function () {
        showIntakeBuilding(false);
        writeIntakeStatus("שגיאת רשת בשמירת מתאמן");
        setIntakeBusy(false);
      });
  };
})();
