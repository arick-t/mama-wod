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

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function normalizeLiftInput(raw, kind) {
    var t = String(raw || "")
      .trim()
      .replace(",", ".");
    if (!t) return "";
    var n = parseFloat(t);
    if (!isFinite(n) || n <= 0) return "";
    if (kind === "run") {
      if (n > 60) return "";
      return String(Math.round(n * 100) / 100);
    }
    if (n > 500) return "";
    return String(Math.round(n * 10) / 10);
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
      activeRecoveryDay: "thu",
      skills: {},
      lifts: {},
      sessionLimits: "",
      injuries: "",
      goals: "",
      fixedIntakePacket: "",
      profileNotes: "",
      intakeComplete: false,
    };
  };

  window.openIntakeWorkspace = function openIntakeWorkspace() {
    resetIntakeState();
    var m = document.getElementById("intake-modal");
    if (m) m.classList.add("open");
    var email = document.getElementById("intake-email");
    if (email) email.value = "";
    var startBar = document.getElementById("intake-start-bar");
    if (startBar) startBar.style.display = "flex";
    var fixed = document.getElementById("intake-fixed");
    if (fixed) {
      fixed.style.display = "none";
      fixed.innerHTML = "";
    }
    var log = document.getElementById("intake-chat-log");
    if (log) {
      log.style.display = "flex";
      log.innerHTML =
        '<div class="intake-msg system">אותו תחקור כמו באפליקציה (9 שלבים קבועים) → לבנה אמיתית → לינק מסירה. לחץ ״התחל תחקור״.</div>';
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

  window.startIntakeChat = function startFixedIntake() {
    if (intakeState.busy) return;
    intakeState.email = (document.getElementById("intake-email").value || "").trim();
    intakeState.started = true;
    intakeState.fixedActive = true;
    intakeState.fixedStep = 0;
    intakeState.preferredLanguage = "en";
    document.getElementById("intake-start-bar").style.display = "none";
    document.getElementById("intake-chat-log").style.display = "none";
    document.getElementById("intake-compose").style.display = "none";
    if (typeof hideIntakePickers === "function") hideIntakePickers();
    document.getElementById("intake-status").textContent = "תחקור זהה לאפליקציה · שלב 1/" + C().FIXED_STEPS.length;
    syncAdminFixedIntakeUi();
  };

  function setFixedErr(msg) {
    var err = document.getElementById("adminFixedErr");
    if (err) err.textContent = msg || "";
  }

  function navHtml(step, isLast) {
    var html = '<div class="admin-fixed-nav">';
    if (step > 0) {
      html +=
        '<button type="button" class="btn-secondary" onclick="adminFixedBack()">Back</button>';
    }
    html +=
      '<button type="button" class="btn-primary" onclick="adminFixedNext()">' +
      (isLast ? "Build plan" : "Next") +
      "</button></div><p class=\"admin-fixed-err\" id=\"adminFixedErr\"></p>";
    return html;
  }

  function renderStep(step) {
    var S = C();
    var total = S.FIXED_STEPS.length;
    var key = S.FIXED_STEPS[step] || "profile";
    var st = intakeState;
    var html =
      '<p class="admin-fixed-step">Step ' +
      (step + 1) +
      " / " +
      total +
      " · same questionnaire as the athlete app</p>";

    if (key === "profile") {
      html +=
        '<p class="admin-fixed-title">Your profile</p>' +
        '<p class="admin-fixed-note">English labels match production Personal Coach intake.</p>';
      for (var i = 0; i < S.PROFILE_DEFS.length; i++) {
        var def = S.PROFILE_DEFS[i];
        var val = "";
        if (def.id === "display_name") val = st.displayName || "";
        else if (def.id === "gender") val = st.gender || "";
        else if (def.id === "age") val = st.age || "";
        else if (def.id === "bodyweight") val = st.bodyweight || "";
        else if (def.id === "experience") val = st.experience || "";
        html +=
          '<div class="admin-fixed-row"><label for="adm-fx-' +
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
          var modeAttr = "";
          if (def.id === "age") modeAttr = ' inputmode="numeric" pattern="[0-9]*"';
          else if (def.id === "bodyweight")
            modeAttr = ' inputmode="decimal" pattern="[0-9]*[.,]?[0-9]*"';
          html +=
            '<input id="adm-fx-' +
            esc(def.id) +
            '" type="text"' +
            modeAttr +
            ' autocomplete="off" data-fx-id="' +
            esc(def.id) +
            '" placeholder="' +
            esc(def.placeholder || "") +
            '" value="' +
            esc(String(val || "")) +
            '">';
        }
        html += "</div>";
      }
    } else if (key === "setup") {
      var locs = st.trainingLocations || {};
      var otherOn = !!locs.other_home;
      html +=
        '<p class="admin-fixed-title">Where do you usually train?</p>' +
        '<p class="admin-fixed-note">Select all that apply.</p><div class="admin-fixed-checks">';
      for (var li = 0; li < S.LOCATION_DEFS.length; li++) {
        var loc = S.LOCATION_DEFS[li];
        html +=
          '<label><input type="checkbox" data-fx-location="' +
          esc(loc.id) +
          '"' +
          (locs[loc.id] ? " checked" : "") +
          (loc.needsDetail ? ' onchange="adminFixedLocationOtherToggle()"' : "") +
          "> " +
          esc(loc.label) +
          "</label>";
      }
      html +=
        '</div><div id="admFxLocationOtherWrap"' +
        (otherOn ? "" : " hidden") +
        '><textarea id="adm-fx-location-other" maxlength="500" placeholder="Please specify your setup…">' +
        esc(st.trainingLocationOther || "") +
        "</textarea></div>";
    } else if (key === "schedule") {
      var days = Array.isArray(st.trainingDays) ? st.trainingDays : [];
      html +=
        '<p class="admin-fixed-title">Weekly schedule</p>' +
        '<div class="admin-fixed-checks">';
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
      html +=
        '</div><textarea id="adm-fx-schedule-notes" maxlength="500" placeholder="Optional schedule notes">' +
        esc(st.scheduleNotes || "") +
        "</textarea>";
    } else if (key === "recovery") {
      var pref = st.activeRecoveryPref || "no";
      var prefDay = st.activeRecoveryDay || "thu";
      var showAr = pref === "yes";
      html +=
        '<p class="admin-fixed-title">Active recovery day?</p>' +
        '<p class="admin-fixed-note">Preset: week 5 of each brick is a deload week.</p>' +
        '<div class="admin-fixed-radios">' +
        '<label><input type="radio" name="admFxRecovery" value="no"' +
        (pref !== "yes" ? " checked" : "") +
        ' onchange="adminFixedRecoveryPrefChanged()"> <span><strong>No</strong> — no weekly active recovery day.</span></label>' +
        '<label><input type="radio" name="admFxRecovery" value="yes"' +
        (pref === "yes" ? " checked" : "") +
        ' onchange="adminFixedRecoveryPrefChanged()"> <span><strong>Yes</strong> — one active recovery day each week.</span></label>' +
        '</div><div id="admFxRecoveryDayWrap"' +
        (showAr ? "" : ' style="display:none"') +
        '><div class="admin-fixed-checks">';
      for (var rdi = 0; rdi < S.DAY_KEYS.length; rdi++) {
        var rdk = S.DAY_KEYS[rdi];
        html +=
          '<label><input type="radio" name="admFxRecoveryDay" value="' +
          esc(rdk) +
          '"' +
          (prefDay === rdk ? " checked" : "") +
          "> " +
          esc(S.DAY_LABELS[rdk] || rdk) +
          "</label>";
      }
      html += "</div></div>";
    } else if (key === "lifts") {
      html += '<p class="admin-fixed-title">Lifts &amp; run</p>';
      for (var lfi = 0; lfi < S.LIFT_DEFS.length; lfi++) {
        var ld = S.LIFT_DEFS[lfi];
        var lv = st.lifts && st.lifts[ld.id] != null ? String(st.lifts[ld.id]) : "";
        html +=
          '<div class="lifts-row"><label>' +
          esc(ld.label) +
          '</label><input type="text" data-lift-id="' +
          esc(ld.id) +
          '" data-lift-kind="' +
          esc(ld.kind) +
          '" placeholder="' +
          esc(ld.placeholder || "") +
          '" value="' +
          esc(lv) +
          '"><span class="unit">' +
          esc(ld.unit) +
          "</span></div>";
      }
    } else if (key === "skills") {
      var allChecked = !!st.skills.all_skills;
      if (!allChecked) {
        var allMarked = true;
        for (var chk = 0; chk < S.SKILL_DEFS.length; chk++) {
          if (S.SKILL_DEFS[chk].allToggle) continue;
          if (!st.skills[S.SKILL_DEFS[chk].id]) {
            allMarked = false;
            break;
          }
        }
        if (allMarked) {
          var anySkill = false;
          for (var anyi = 0; anyi < S.SKILL_DEFS.length; anyi++) {
            if (S.SKILL_DEFS[anyi].allToggle) continue;
            if (st.skills[S.SKILL_DEFS[anyi].id]) {
              anySkill = true;
              break;
            }
          }
          allChecked = anySkill;
        }
      }
      html +=
        '<div class="admin-fixed-skills-head">' +
        '<p class="admin-fixed-title">Skills</p>' +
        '<label class="admin-fixed-skills-all">' +
        '<input type="checkbox" data-skill-id="all_skills" data-skill-all="1"' +
        (allChecked ? " checked" : "") +
        ' onchange="adminFixedSkillAllChange(this)"> All skills</label>' +
        "</div>" +
        '<div class="skills-grid" id="admin-fixed-skills-grid">';
      for (var si = 0; si < S.SKILL_DEFS.length; si++) {
        var sd = S.SKILL_DEFS[si];
        if (sd.allToggle) continue;
        var checked = allChecked || !!st.skills[sd.id];
        html +=
          '<label><input type="checkbox" data-skill-id="' +
          esc(sd.id) +
          '"' +
          (checked ? " checked" : "") +
          "> " +
          esc(sd.label) +
          "</label>";
      }
      html += "</div>";
    } else if (key === "limits") {
      html +=
        '<p class="admin-fixed-title">Scheduling limits</p>' +
        '<textarea id="adm-fx-limits" maxlength="600" placeholder="e.g. Max 50 minutes per session">' +
        esc(st.sessionLimits || "") +
        "</textarea>";
    } else if (key === "injuries") {
      var noInj =
        /^no injuries\.?$/i.test(String(st.injuries || "").trim()) ||
        String(st.injuries || "").trim() === "אין פציעות";
      html +=
        '<p class="admin-fixed-title">Injuries &amp; limitations</p>' +
        '<button type="button" class="admin-fixed-chip' +
        (noInj ? " active" : "") +
        '" id="adm-fx-no-injuries-btn" aria-pressed="' +
        (noInj ? "true" : "false") +
        '" onclick="adminFixedFillNoInjuries()">No injuries</button>' +
        '<textarea id="adm-fx-injuries" maxlength="800" placeholder="e.g. Left knee — avoid deep squats under fatigue" oninput="adminFixedInjuriesInput()">' +
        esc(st.injuries || "") +
        "</textarea>";
    } else if (key === "goals") {
      html +=
        '<p class="admin-fixed-title">Goals</p>' +
        '<textarea id="adm-fx-goals" maxlength="800" placeholder="e.g. Engine + Olympic lift consistency">' +
        esc(st.goals || "") +
        "</textarea>";
    }

    html += navHtml(step, step >= total - 1);
    return html;
  }

  window.syncAdminFixedIntakeUi = function syncAdminFixedIntakeUi() {
    var el = document.getElementById("intake-fixed");
    if (!el) return;
    if (!intakeState.fixedActive || intakeState.intakeComplete) {
      el.style.display = "none";
      el.innerHTML = "";
      return;
    }
    el.style.display = "block";
    el.innerHTML = renderStep(intakeState.fixedStep | 0);
    document.getElementById("intake-status").textContent =
      "תחקור זהה לאפליקציה · שלב " +
      ((intakeState.fixedStep | 0) + 1) +
      "/" +
      C().FIXED_STEPS.length;
  };

  window.adminFixedSkillAllChange = function adminFixedSkillAllChange(inp) {
    if (!inp || !inp.getAttribute("data-skill-all")) return;
    var on = !!inp.checked;
    var root =
      (inp.closest && inp.closest("#intake-fixed")) ||
      document.getElementById("intake-fixed");
    if (!root) return;
    var cbs = root.querySelectorAll('input[type="checkbox"][data-skill-id]');
    for (var i = 0; i < cbs.length; i++) {
      if (cbs[i].getAttribute("data-skill-all")) continue;
      cbs[i].checked = on;
    }
  };

  window.adminFixedBack = function adminFixedBack() {
    if (intakeState.busy) return;
    if ((intakeState.fixedStep | 0) <= 0) return;
    intakeState.fixedStep = (intakeState.fixedStep | 0) - 1;
    syncAdminFixedIntakeUi();
  };

  function syncAdminNoInjuriesChip() {
    var ta = document.getElementById("adm-fx-injuries");
    var btn = document.getElementById("adm-fx-no-injuries-btn");
    if (!btn) return;
    var raw = ta ? String(ta.value || "").trim() : "";
    var on = /^no injuries\.?$/i.test(raw) || raw === "אין פציעות";
    btn.classList.toggle("active", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  }

  window.adminFixedFillNoInjuries = function () {
    var ta = document.getElementById("adm-fx-injuries");
    if (ta) ta.value = "No injuries";
    syncAdminNoInjuriesChip();
    setFixedErr("");
  };

  window.adminFixedInjuriesInput = function () {
    syncAdminNoInjuriesChip();
  };

  window.adminFixedRecoveryPrefChanged = function () {
    var wrap = document.getElementById("admFxRecoveryDayWrap");
    if (!wrap) return;
    var prefEl = document.querySelector('input[name="admFxRecovery"]:checked');
    var yes = !!(prefEl && prefEl.value === "yes");
    wrap.style.display = yes ? "" : "none";
  };

  window.adminFixedLocationOtherToggle = function () {
    var wrap = document.getElementById("admFxLocationOtherWrap");
    var otherCb = document.querySelector('input[data-fx-location="other_home"]');
    if (!wrap) return;
    if (otherCb && otherCb.checked) wrap.removeAttribute("hidden");
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
      intakeState.displayName = vals.display_name.slice(0, 80);
      intakeState.gender = vals.gender.slice(0, 16).toLowerCase();
      intakeState.preferredLanguage = "en";
      intakeState.age = String(ageN);
      intakeState.bodyweight = String(bwN);
      intakeState.experience = vals.experience.slice(0, 120);
    } else if (key === "setup") {
      var locations = {};
      var labels = [];
      var cbs = box.querySelectorAll("input[data-fx-location]");
      for (var ci = 0; ci < cbs.length; ci++) {
        if (!cbs[ci].checked) continue;
        var id = cbs[ci].getAttribute("data-fx-location");
        locations[id] = true;
        for (var j = 0; j < S.LOCATION_DEFS.length; j++) {
          if (S.LOCATION_DEFS[j].id === id) labels.push(S.LOCATION_DEFS[j].label);
        }
      }
      var otherEl = document.getElementById("adm-fx-location-other");
      var otherDetail = otherEl ? String(otherEl.value || "").trim().slice(0, 500) : "";
      if (!labels.length) {
        setFixedErr("Select at least one training location.");
        return;
      }
      if (locations.other_home && !otherDetail) {
        setFixedErr("Please specify your Other / home setup.");
        return;
      }
      var parts = labels.slice();
      if (locations.other_home && otherDetail) parts.push("Other detail: " + otherDetail);
      intakeState.trainingLocations = locations;
      intakeState.trainingLocationOther = otherDetail;
      intakeState.trainingSetup = parts.join(" · ").slice(0, 800);
    } else if (key === "schedule") {
      var days = [];
      var dayCbs = box.querySelectorAll("input[data-fx-day]");
      for (var d = 0; d < dayCbs.length; d++) {
        if (dayCbs[d].checked) days.push(dayCbs[d].getAttribute("data-fx-day"));
      }
      var schEl = document.getElementById("adm-fx-schedule-notes");
      intakeState.trainingDays = days;
      intakeState.scheduleNotes = schEl ? String(schEl.value || "").trim().slice(0, 500) : "";
      if (!days.length && !intakeState.scheduleNotes) {
        setFixedErr("Mark at least one training day, or add a short schedule note.");
        return;
      }
    } else if (key === "recovery") {
      var prefEl = box.querySelector('input[name="admFxRecovery"]:checked');
      var dayEl = box.querySelector('input[name="admFxRecoveryDay"]:checked');
      intakeState.activeRecoveryPref = prefEl && prefEl.value === "yes" ? "yes" : "no";
      intakeState.activeRecoveryDay =
        intakeState.activeRecoveryPref === "yes" && dayEl
          ? String(dayEl.value || "thu")
          : "";
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
      intakeState.skills = skills;
    } else if (key === "limits") {
      var limEl = document.getElementById("adm-fx-limits");
      intakeState.sessionLimits = limEl ? String(limEl.value || "").trim().slice(0, 600) : "";
    } else if (key === "injuries") {
      var injEl = document.getElementById("adm-fx-injuries");
      intakeState.injuries = injEl ? String(injEl.value || "").trim().slice(0, 800) : "";
    } else if (key === "goals") {
      var goalEl = document.getElementById("adm-fx-goals");
      intakeState.goals = goalEl ? String(goalEl.value || "").trim().slice(0, 800) : "";
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
      document.getElementById("intake-status").textContent = errMsg;
      setFixedErr(errMsg);
    }
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
          "Fill the short questionnaire below. When you finish, I build your 5-week plan in one shot.",
      },
      { role: "user", text: prompt },
    ];
    generateIntakeBlockFromFixedPacket();
  }

  window.intakeAthleteProfile = function intakeAthleteProfile(opts) {
    return C().athleteProfileForGenerateBlock(intakeState, {
      forceIntakeComplete: !!(opts && opts.forceIntakeComplete),
    });
  };

  function generateIntakeBlockFromFixedPacket() {
    if (intakeState.busy) return;
    setIntakeBusy(true);
    showIntakeBuilding(
      true,
      "<strong>Coach</strong> is building your 5-week block…"
    );
    document.getElementById("intake-status").textContent = "בונה לבנה אמיתית (generate_block)…";

    var profile = intakeAthleteProfile({ forceIntakeComplete: true });
    var payloadMsgs = [
      { role: "user", text: String(intakeState.fixedIntakePacket || "").slice(0, 6000) },
    ];

    fetch("/api/personal-coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "generate_block",
        messages: payloadMsgs,
        athleteProfile: profile,
        intakeComplete: true,
        forceJson: true,
      }),
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, status: r.status, j: j };
        });
      })
      .then(function (x) {
        var j = x.j || {};
        if (!x.ok || !j.ok) {
          var err =
            typeof friendlyCoachError === "function"
              ? friendlyCoachError(j, x.status)
              : String((j && (j.message || j.error)) || "build failed");
          restoreAdminFixedGoals("בניית הלבנה נכשלה: " + err + " — לחץ Build plan שוב.");
          return;
        }
        var block =
          typeof parseBlockFromText === "function" ? parseBlockFromText(j.text, j) : j.block;
        if (!block || !block.weeks || !block.weeks.length) {
          restoreAdminFixedGoals(
            "המאמן לא החזיר BLOCK_JSON תקין — לחץ Build plan שוב."
          );
          return;
        }
        finalizeNewAthlete(block);
      })
      .catch(function (e) {
        restoreAdminFixedGoals(
          "שגיאת רשת בבניית לבנה: " +
            String((e && e.message) || e).slice(0, 200) +
            " — לחץ Build plan שוב."
        );
      });
  }

  window.generateIntakeBlock = function generateIntakeBlock() {
    if (!intakeState.fixedIntakePacket) {
      document.getElementById("intake-status").textContent =
        "יש להשלים את התחקור הקבוע לפני בניית לבנה.";
      return;
    }
    generateIntakeBlockFromFixedPacket();
  };

  window.finalizeNewAthlete = function finalizeNewAthlete(block) {
    intakeState.intakeComplete = true;
    showIntakeBuilding(
      true,
      "<strong>Coach</strong> — saving athlete + one-time handoff link…"
    );
    document.getElementById("intake-status").textContent = "שומר מתאמן + לינק מסירה…";

    var intakeProfile = C().normalizeIntakeProfile(
      Object.assign({}, intakeState, { intakeComplete: true })
    );

    fetch("/api/admin-handoff", {
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
              autoCreateLink: true,
            })
          : {
              action: "create_athlete",
              displayName: intakeProfile.displayName,
              intakeProfile: intakeProfile,
              currentBlock: block,
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
          document.getElementById("intake-status").textContent =
            "שגיאה ביצירת מתאמן: " + ((d && (d.message || d.error)) || "?");
          setIntakeBusy(false);
          return;
        }
        if (typeof currentAthleteId !== "undefined") {
          window.currentAthleteId = d.snapshot && d.snapshot.athleteId;
        }
        var linkPath = d.handoff && d.handoff.path;
        var abs =
          linkPath && typeof location !== "undefined"
            ? location.origin + linkPath
            : linkPath || "";
        document.getElementById("intake-status").textContent = abs
          ? "נוצר ✓ לינק מסירה מוכן"
          : "נוצר בהצלחה ✓";
        if (abs) {
          try {
            window.prompt("לינק מסירה חד־פעמי למתאמן (העתק):", abs);
          } catch (ePrompt) {}
        }
        setTimeout(function () {
          var m = document.getElementById("intake-modal");
          if (m) m.classList.remove("open");
          resetIntakeState();
          if (typeof loadAthletes === "function") loadAthletes();
        }, 700);
      })
      .catch(function () {
        showIntakeBuilding(false);
        document.getElementById("intake-status").textContent = "שגיאת רשת בשמירת מתאמן";
        setIntakeBusy(false);
      });
  };
})();
