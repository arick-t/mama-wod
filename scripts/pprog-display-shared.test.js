/**
 * Shared brick display (admin + app) — T1/T2 Budget 2026-08-13.
 * Run: node scripts/pprog-display-shared.test.js
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const PprogDisplay = require("../lib/pprog-display.js");
const NormalizePprogBlock = require("../lib/normalize-pprog-block.js");

const root = path.join(__dirname, "..");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const admin = fs.readFileSync(path.join(root, "admin.html"), "utf8");

function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok —", name);
}

ok("lib exports renderBrickView", typeof PprogDisplay.renderBrickView === "function");
ok("lib exports renderCalHtml", typeof PprogDisplay.renderCalHtml === "function");
ok("lib exports renderDayCardHtml", typeof PprogDisplay.renderDayCardHtml === "function");
ok("lib exports renderDayPartsHtml", typeof PprogDisplay.renderDayPartsHtml === "function");

const raw = {
  summaryLine: "Test brick",
  weeks: [
    {
      weekIndex: 1,
      phase: "build",
      theme: "Squat",
      overview: [
        { day: "sun", focus: "Rest" },
        { day: "mon", focus: "Squat" },
      ],
      days: {
        sun: { parts: [{ title: "REST DAY", lines: ["Rest"] }] },
        mon: {
          parts: [
            {
              title: "Strength",
              lines: ["Intent: squat pattern", "5x5 Back Squat:", "5 x 80kg"],
            },
          ],
        },
      },
    },
  ],
};
const block = NormalizePprogBlock.normalize(raw, raw);
ok("normalize fills blockStart", /^\d{4}-\d{2}-\d{2}$/.test(block.blockStart));
ok("normalize has 5 weeks", block.weeks.length === 5);

const cal = PprogDisplay.renderCalHtml(block, 0, "mon", {
  calMode: "month",
  readOnly: true,
  hooks: { setDay: "adminPprogSetDay", shift: "adminPprogCalShift", toggleMode: "adminPprogToggleCalMode", jumpToday: "adminPprogJumpToday" },
});
ok("cal is 5-week brick", /pprog-cal-month-grid/.test(cal) && /W1/.test(cal) && /W5/.test(cal));
ok("cal has rest + training cells", /pprog-cal-cell/.test(cal));
ok("cal does not call personal-coach", !/personal-coach|generate_block|week_detail|revise_/.test(cal));

const week = block.weeks[0];
const card = PprogDisplay.renderDayCardHtml(block, week, 0, "mon", {
  readOnly: true,
  showFooter: false,
  israelTodayIso: block.blockStart,
});
ok("day card uses pprog-day-card", /pprog-day-card/.test(card));
ok("day card has format line", /pprog-part-format/.test(card) || /5x5|Back Squat/.test(card));
ok("read-only hides Done button", !/openPprogFinishFeedback/.test(card));
ok("read-only hides day chat footer", !/pprog-session-box/.test(card));

const restCard = PprogDisplay.renderDayCardHtml(block, week, 0, "sun", {
  readOnly: true,
  showFooter: false,
  israelTodayIso: block.blockStart,
});
ok("rest day title", /REST DAY/.test(restCard));

const brick = PprogDisplay.renderBrickView({
  block: block,
  activeWeekIndex: 0,
  activeDay: "mon",
  calMode: "month",
  readOnly: true,
  showFooter: false,
});
ok("brick view combines cal + card", /pprog-cal/.test(brick) && /pprog-day-card/.test(brick));

ok("app loads pprog-display.js", /pprog-display\.js/.test(index));
ok("app cal wrapper uses PprogDisplay", /PprogDisplay\.renderCalHtml/.test(index));
ok("app day card wrapper uses PprogDisplay", /PprogDisplay\.renderDayCardHtml/.test(index));
ok("admin loads pprog-display.js", /pprog-display\.js/.test(admin));
ok("admin uses renderBrickView", /PprogDisplay\.renderBrickView/.test(admin));
ok("admin normalizes on load", /NormalizePprogBlock\.normalize/.test(admin));
ok("T3 debounce helper", /function pprogPushAdminSnapshotDebounced/.test(index));
ok("T3 after DONE", /pprogPushAdminSnapshotDebounced\(store, "finish_done"\)/.test(index));
ok("T3 after Terms", /pprogPushAdminSnapshotDebounced\(store, "legal_terms"\)/.test(index));
ok("T3 snapshot URL uses API base", /function pprogAdminSnapshotUrl/.test(index) && !/fetch\("\/api\/admin-snapshot"/.test(index));
ok("T4 pendingAdminDayEdit wired", /pendingAdminDayEdit/.test(admin) && /pprogApplyPendingAdminDayEdit/.test(index) && !/adminPprogReviseDay/.test(admin));
ok("admin local day edit UI", /allowEdit:\s*true/.test(admin) && /adminPprogStartEdit/.test(admin) && /pprog-edit-btn/.test(admin));
ok("admin save day hook no LLM", /function adminPprogEditSave/.test(admin) && /admin_save_day/.test(admin) && !/generate_week_detail|revise_day/.test(admin.slice(admin.indexOf("function adminPprogEditSave"), admin.indexOf("function changeBlockMonth"))));
ok("pending parts copy has a space after Session pending", /Session pending\.<\/strong> Overview/.test(fs.readFileSync(path.join(root, "lib", "pprog-display.js"), "utf8")));
ok("edit pencil only when allowEdit", /pprog-edit-btn/.test(PprogDisplay.renderDayCardHtml(block, block.weeks[0], 0, "mon", { allowEdit: true, readOnly: true, showFooter: false, israelTodayIso: block.blockStart })) && !/pprog-edit-btn/.test(PprogDisplay.renderDayCardHtml(block, block.weeks[0], 0, "mon", { readOnly: true, showFooter: false })));
ok("no pencil on rest day", !/pprog-edit-btn/.test(PprogDisplay.renderDayCardHtml(block, block.weeks[0], 0, "sun", { allowEdit: true, readOnly: true, showFooter: false, israelTodayIso: block.blockStart })));
ok("no pencil on past day", !/pprog-edit-btn/.test(PprogDisplay.renderDayCardHtml(block, block.weeks[0], 0, "mon", { allowEdit: true, readOnly: true, showFooter: false, israelTodayIso: NormalizePprogBlock.addDaysIso(block.blockStart, 3) })));
ok("edit mode has Note and Work line chips", /＋ Note/.test(PprogDisplay.renderDayCardHtml(block, block.weeks[0], 0, "mon", { allowEdit: true, editing: true, editDraft: { rest: false, parts: [{ title: "Part A", notes: [""], format: "", work: [""] }] }, readOnly: true, showFooter: false, israelTodayIso: block.blockStart })) && /＋ Work line/.test(PprogDisplay.renderDayCardHtml(block, block.weeks[0], 0, "mon", { allowEdit: true, editing: true, editDraft: { rest: false, parts: [{ title: "Part A", notes: [""], format: "", work: [""] }] }, readOnly: true, showFooter: false, israelTodayIso: block.blockStart })));
ok("coach updated banner", /pprog-coach-updated-banner/.test(PprogDisplay.renderDayCardHtml(block, block.weeks[0], 0, "mon", { readOnly: true, showFooter: false, israelTodayIso: block.blockStart })) === false);
ok("coach updated banner when notice set", /המאמן עדכן את האימון/.test(PprogDisplay.renderDayCardHtml(block, Object.assign({}, block.weeks[0], { days: Object.assign({}, block.weeks[0].days, { mon: Object.assign({}, block.weeks[0].days.mon, { coachUpdatedNotice: "המאמן עדכן את האימון" }) }) }), 0, "mon", { readOnly: true, showFooter: false, israelTodayIso: block.blockStart })));
ok("default cal has no admin done dots", !/pprog-done-dot/.test(PprogDisplay.renderCalHtml(block, 0, "mon", { calMode: "month" })));

console.log("All shared pprog-display checks passed.");
