/**
 * Admin-only Done debrief: Hebrew template + read/unread keys.
 * 0 LLM. Does not touch coach brain or the athlete Done button.
 *
 * Browser: <script src="lib/admin-done-debrief.js"></script> → AdminDoneDebrief
 * Node: require("./admin-done-debrief")
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.AdminDoneDebrief = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var RATING_HE = {
    just_right: "בול",
    too_hard: "קשה מדי",
    too_easy: "קל מדי",
    other: "אחר",
  };

  function hasDebrief(dayData) {
    return !!(dayData && dayData.finishFeedback && dayData.finishFeedback.rating);
  }

  function ratingLabel(rating) {
    var k = String(rating || "");
    return RATING_HE[k] || "";
  }

  function formatMessage(fb) {
    if (!fb || !fb.rating) return null;
    var rating = String(fb.rating);
    var line1 = ratingLabel(rating);
    if (!line1) return null;
    var title = String(fb.part_title || "").trim();
    var part = "";
    var note = "";
    if ((rating === "too_hard" || rating === "too_easy") && title) part = title;
    if (rating === "other") {
      note = String(fb.note || "").trim();
      if (note && note.charAt(0) !== "«" && note.charAt(0) !== '"') {
        note = "«" + note + "»";
      }
    }
    var lines = [line1];
    if (part) lines.push(part);
    if (note) lines.push(note);
    return {
      rating: line1,
      part: part,
      note: note,
      lines: lines,
      safety: fb.safety_flag === true,
    };
  }

  function isUnread(readMap, dayIso) {
    var iso = String(dayIso || "").slice(0, 10);
    if (!iso) return false;
    if (!readMap || typeof readMap !== "object") return true;
    return !readMap[iso];
  }

  function markRead(readMap, dayIso, at) {
    var iso = String(dayIso || "").slice(0, 10);
    var out = {};
    var k;
    if (readMap && typeof readMap === "object") {
      for (k in readMap) {
        if (Object.prototype.hasOwnProperty.call(readMap, k) && /^\d{4}-\d{2}-\d{2}$/.test(k)) {
          out[k] = String(readMap[k] || true).slice(0, 40);
        }
      }
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      out[iso] = String(at || new Date().toISOString()).slice(0, 40);
    }
    var keys = Object.keys(out).sort();
    if (keys.length > 40) {
      var drop = keys.length - 40;
      for (var i = 0; i < drop; i++) delete out[keys[i]];
    }
    return out;
  }

  function selId(wi, day) {
    return (wi | 0) + ":" + String(day || "").slice(0, 3);
  }

  function parseSelId(id) {
    var p = String(id || "").split(":");
    return { wi: p[0] | 0, day: String(p[1] || "").slice(0, 3) };
  }

  function sortSelected(list) {
    var keys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    return (list || [])
      .slice()
      .sort(function (a, b) {
        var ia = (a.wi | 0) * 7 + keys.indexOf(a.day);
        var ib = (b.wi | 0) * 7 + keys.indexOf(b.day);
        return ia - ib;
      });
  }

  function rangeBetween(a, b) {
    var keys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    var ia = (a.wi | 0) * 7 + keys.indexOf(a.day);
    var ib = (b.wi | 0) * 7 + keys.indexOf(b.day);
    if (ia < 0 || ib < 0) return [];
    var lo = Math.min(ia, ib);
    var hi = Math.max(ia, ib);
    var out = [];
    for (var i = lo; i <= hi; i++) {
      out.push({ wi: Math.floor(i / 7), day: keys[i % 7] });
    }
    return out;
  }

  return {
    RATING_HE: RATING_HE,
    hasDebrief: hasDebrief,
    ratingLabel: ratingLabel,
    formatMessage: formatMessage,
    isUnread: isUnread,
    markRead: markRead,
    selId: selId,
    parseSelId: parseSelId,
    sortSelected: sortSelected,
    rangeBetween: rangeBetween,
  };
});
