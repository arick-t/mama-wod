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
ok("T3 push on coach open", /pprogPushAdminSnapshotDebounced\(loadPprogStore\(\), "pprog_open"\)/.test(index));
ok("T4 pendingAdminDayEdit wired", /pendingAdminDayEdit/.test(admin) && /pprogApplyPendingAdminDayEdit/.test(index) && !/adminPprogReviseDay/.test(admin));
ok("admin local day edit UI", /allowEdit:\s*true/.test(admin) && /adminPprogStartEdit/.test(admin) && /pprog-edit-btn/.test(admin));
ok("admin save day hook no LLM", /function adminPprogEditSave/.test(admin) && /admin_save_day/.test(admin) && !/generate_week_detail|revise_day/.test(admin.slice(admin.indexOf("function adminPprogEditSave"), admin.indexOf("function changeBlockMonth"))));
ok("pending parts copy has a space after Session pending", /Session pending\.<\/strong> Overview/.test(fs.readFileSync(path.join(root, "lib", "pprog-display.js"), "utf8")));
ok("edit pencil only when allowEdit", /pprog-edit-btn/.test(PprogDisplay.renderDayCardHtml(block, block.weeks[0], 0, "mon", { allowEdit: true, readOnly: true, showFooter: false, israelTodayIso: block.blockStart })) && !/pprog-edit-btn/.test(PprogDisplay.renderDayCardHtml(block, block.weeks[0], 0, "mon", { readOnly: true, showFooter: false })));
/* This assertion used to say "no pencil on rest day" — it pinned exactly the bug the
 * owner reported: a rest day could not be edited, so it could not be turned into a
 * session. 21.7 reverses it. Inverted rather than deleted, so re-locking rest days
 * fails the suite and says why. */
ok("pencil IS shown on a rest day (21.7)", /pprog-edit-btn/.test(PprogDisplay.renderDayCardHtml(block, block.weeks[0], 0, "sun", { allowEdit: true, readOnly: true, showFooter: false, israelTodayIso: block.blockStart })));
ok("no pencil on past day", !/pprog-edit-btn/.test(PprogDisplay.renderDayCardHtml(block, block.weeks[0], 0, "mon", { allowEdit: true, readOnly: true, showFooter: false, israelTodayIso: NormalizePprogBlock.addDaysIso(block.blockStart, 3) })));
ok("edit mode has Note and Work line chips", /＋ Note/.test(PprogDisplay.renderDayCardHtml(block, block.weeks[0], 0, "mon", { allowEdit: true, editing: true, editDraft: { rest: false, parts: [{ title: "Part A", notes: [""], format: "", work: [""] }] }, readOnly: true, showFooter: false, israelTodayIso: block.blockStart })) && /＋ Work line/.test(PprogDisplay.renderDayCardHtml(block, block.weeks[0], 0, "mon", { allowEdit: true, editing: true, editDraft: { rest: false, parts: [{ title: "Part A", notes: [""], format: "", work: [""] }] }, readOnly: true, showFooter: false, israelTodayIso: block.blockStart })));
ok("coach updated banner", /pprog-coach-updated-banner/.test(PprogDisplay.renderDayCardHtml(block, block.weeks[0], 0, "mon", { readOnly: true, showFooter: false, israelTodayIso: block.blockStart })) === false);
ok("coach updated banner when notice set", /המאמן עדכן את האימון/.test(PprogDisplay.renderDayCardHtml(block, Object.assign({}, block.weeks[0], { days: Object.assign({}, block.weeks[0].days, { mon: Object.assign({}, block.weeks[0].days.mon, { coachUpdatedNotice: "המאמן עדכן את האימון" }) }) }), 0, "mon", { readOnly: true, showFooter: false, israelTodayIso: block.blockStart })));
ok("default cal has no admin done dots", !/pprog-done-dot/.test(PprogDisplay.renderCalHtml(block, 0, "mon", { calMode: "month" })));

/* --- one icon, one share format, one flag with two directions ------- */

ok("the WhatsApp mark lives in the library", typeof PprogDisplay.waIconSvg === "function" && PprogDisplay.waIconSvg().indexOf("<svg") === 0);
ok("so does the shared-day message", typeof PprogDisplay.dayShareText === "function");

const shareBlock = {
  blockStart: "2026-08-30",
  weeks: [
    {
      weekIndex: 1,
      overview: [{ day: "mon", focus: "Strength" }],
      days: { mon: { parts: [{ title: "Part A", lines: ["Every 2:00 x 5", "1 Clean"] }] } },
    },
  ],
};
const shared = PprogDisplay.dayShareText(shareBlock, 0, "mon", { title: "DUCK-WOD", footer: "Train with DUCK-WOD" });
ok("the message names the day", /Mon . 31 August/.test(shared));
ok("it carries the focus", /Strength/.test(shared));
ok("it carries the part title", /Part A/.test(shared));
ok("work lines are bulleted", /. 1 Clean/.test(shared));
ok("a day with nothing in it shares nothing", PprogDisplay.dayShareText(shareBlock, 0, "tue", {}).indexOf("Part") < 0);

/* The flag field is the page's choice: the owner watches the client's edits, the
   client watches the coach's. Same renderer, two directions. */
const coachSide = PprogDisplay.renderDayCardHtml(shareBlock, shareBlock.weeks[0], 0, "mon", {
  allowEdit: true,
  dayModifiedField: "coachModified",
  dayModifiedLabel: "COACH UPDATED",
});
ok("no flag when the field is not set", coachSide.indexOf("COACH UPDATED") < 0);

const flaggedBlock = JSON.parse(JSON.stringify(shareBlock));
flaggedBlock.weeks[0].days.mon.coachModified = true;
const flagged = PprogDisplay.renderDayCardHtml(flaggedBlock, flaggedBlock.weeks[0], 0, "mon", {
  allowEdit: true,
  dayModifiedField: "coachModified",
  dayModifiedLabel: "COACH UPDATED",
});
ok("the named field raises the flag", flagged.indexOf("COACH UPDATED") >= 0);

/* A page can put its own control beside the date, but only while editing. */
const withAction = PprogDisplay.renderDayCardHtml(shareBlock, shareBlock.weeks[0], 0, "mon", {
  allowEdit: true,
  editing: true,
  editDraft: { wi: 0, day: "mon", parts: [] },
  editHeaderActionsHtml: '<button class="rest-inline">Rest day</button>',
});
ok("the header slot renders while editing", withAction.indexOf("rest-inline") >= 0);
const noAction = PprogDisplay.renderDayCardHtml(shareBlock, shareBlock.weeks[0], 0, "mon", {
  allowEdit: true,
  editHeaderActionsHtml: '<button class="rest-inline">Rest day</button>',
});
ok("and not when the day is merely being read", noAction.indexOf("rest-inline") < 0);

/* Sharing on an editable surface is an explicit opt-in, never a widened condition. */
const noShare = PprogDisplay.renderDayCardHtml(shareBlock, shareBlock.weeks[0], 0, "mon", {
  allowEdit: true,
});
ok("an editable card has no share button by default", noShare.indexOf("pprog-share-wa") < 0);
const withShare = PprogDisplay.renderDayCardHtml(shareBlock, shareBlock.weeks[0], 0, "mon", {
  allowEdit: true, showShare: true,
});
ok("showShare turns it on", withShare.indexOf("pprog-share-wa") >= 0);
const editingShare = PprogDisplay.renderDayCardHtml(shareBlock, shareBlock.weeks[0], 0, "mon", {
  allowEdit: true, showShare: true,
  editing: true, editDraft: { wi: 0, day: "mon", parts: [] },
});
ok("it steps out of the way while editing", editingShare.indexOf("pprog-share-wa") < 0);


/* --- what counts as "typed" ----------------------------------------
 * A session whose TITLE the coach wrote — "Strength — heavy singles" — was refused with
 * "nothing typed", because only lines were counted. He had typed; we were not looking
 * there (owner, 2026-09-02). A generated heading is still not content.
 */
const titleOnly = { day: "sun", parts: [{ title: "Strength — heavy singles", notes: [""], format: "", work: [""] }] };
const headingOnly = { day: "sun", parts: [{ title: "Part A", notes: [""], format: "", work: [""] }] };
const withWork = { day: "sun", parts: [{ title: "Part A", notes: [""], format: "", work: ["5x5 back squat"] }] };
ok("a written title is content", PprogDisplay.draftHasContent(titleOnly) === true);
ok("a generated heading is not", PprogDisplay.draftHasContent(headingOnly) === false);
ok("and lines still count", PprogDisplay.draftHasContent(withWork) === true);


/* --- a programme is months, not one five-week brick --------------------
 * The ceiling was written as the number 5, from when a brick always was five weeks. On
 * an eight-week programme it clamped the active week to five and dropped every selected
 * day past it from the side-by-side strip (owner, 2026-09-03).
 */
function wkFull() {
  const w = { weekIndex: 1, phase: "build", overview: [], days: {} };
  ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].forEach(function (k) {
    w.days[k] = { parts: [{ title: "Part A", lines: ["work"] }] };
  });
  return w;
}
const longBlock = { blockStart: "2026-08-30", weeks: Array.from({ length: 8 }, wkFull) };
const deepCards = PprogDisplay.renderBrickView({
  block: longBlock,
  activeWeekIndex: 6,
  activeDay: "sun",
  weekRows: 8,
  calMode: "block",
  selectedDays: [{ wi: 5, day: "sun" }, { wi: 6, day: "mon" }],
});
ok("days in week 6 and 7 still render side by side", (deepCards.match(/pprog-day-card/g) || []).length === 2);
ok("and the second block is what is shown", /Block 2/.test(deepCards));


/* --- Hebrew reads right to left, English is untouched (owner, 2026-09-05) --
 * He types "פולי עליון 3X15" and the card showed "3X15פולי עליון". Each line now
 * carries dir="auto", which reads that line's FIRST STRONG letter and nothing else:
 * a line starting in English is laid out exactly as it was, and one starting in
 * Hebrew reads right to left. His rule: if it changes English, English wins.
 * ------------------------------------------------------------------------- */

const bidi = PprogDisplay.renderDayPartsHtml([
  { id: "p", title: "Part A", lines: ["12 min EMOM", "פולי עליון 3X15", "10 push-ups"] },
]);
ok("every work line decides its own direction", (bidi.match(/<li dir="auto">/g) || []).length >= 2);
ok("the Hebrew line is there whole", bidi.indexOf("פולי עליון 3X15") >= 0);
ok("and so is the English one", bidi.indexOf("10 push-ups") >= 0);
ok("nothing was forced to RTL", bidi.indexOf('dir="rtl"') < 0);

const src = fs.readFileSync(path.join(__dirname, "..", "lib", "pprog-display.js"), "utf8");
ok("notes decide too", /class="pprog-part-note" dir="auto"/.test(src));
ok("so does a format line", /class="pprog-part-format" dir="auto"/.test(src));
ok("and the part heading", /class="section-title" dir="auto"/.test(src));
ok("the fields he types into as well", /class="pprog-edit-note pprog-part-note" dir="auto"/.test(src) && /<li class="pprog-edit-work-row"><input type="text" dir="auto"/.test(src));

/* --- a note can be removed (owner, 2026-09-05) ---------------------------- */

ok("a note is rendered in a row with a remove button", /pprog-edit-note-row[\s\S]{0,600}pprog-edit-del-line/.test(src));
ok("which calls a hook of its own", /var removeNoteFn = hook\(opts, "editRemoveNote", "adminPprogEditRemoveNote"\);/.test(src));

/* --- a day can be given a name --------------------------------------------- */

ok("a named day shows the name", /var dayTitle = String\(\(dayData && dayData\.title\) \|\| ""\)\.trim\(\);/.test(src));
ok("with the automatic label kept beside it", /class="pprog-day-when"/.test(src));
ok("and the heading becomes a field only where the page allows it", /opts\.allowTitleEdit === true/.test(src));


/* --- a note he wrote stays a note (owner, 2026-09-05) ---------------------
 * Lines are stored flat, so their shape is worked out again when they are drawn — by
 * rules that are English ("note:", "cue:", "rest between sets"). A note in Hebrew
 * matched none of them and came back as a work line the moment it was saved. A part
 * now remembers how many of its leading lines he wrote as notes.
 * ------------------------------------------------------------------------- */

const hebPart = PprogDisplay.partsFromDraft({
  day: "sun",
  parts: [{ title: "Part B", notes: ["בדיקה בדיקה"], format: "", work: ["לבחור 3 תרגילים", "bench press 3 X15"] }],
});
ok("the note is still the first line stored", hebPart[0].lines[0] === "בדיקה בדיקה");
ok("and the part records how many notes it has", hebPart[0].noteLines === 1);
const hebHtml = PprogDisplay.renderDayPartsHtml(hebPart);
ok("so it is drawn as a note", hebHtml.indexOf('class="pprog-part-note" dir="auto">בדיקה בדיקה') >= 0);
ok("and never as a work line", hebHtml.indexOf('<li dir="auto">בדיקה בדיקה') < 0);

/* English must be exactly as it was — his rule. */
const engPart = PprogDisplay.partsFromDraft({
  day: "sun",
  parts: [{ title: "Part A", notes: ["12 min duration / strength priority"], format: "EMOM 12", work: ["3 back squats"] }],
});
const engHtml = PprogDisplay.renderDayPartsHtml(engPart);
ok("an English note is still a note", engHtml.indexOf("12 min duration / strength priority") >= 0 && engHtml.indexOf("pprog-part-note") >= 0);
ok("the format is still the format", engHtml.indexOf("pprog-part-format") >= 0 && engHtml.indexOf("EMOM 12") >= 0);

/* A part written before today carries no count and must classify as it always did. */
const legacy = PprogDisplay.renderDayPartsHtml([
  { id: "x", title: "Part A", lines: ["Note: keep it light", "EMOM 12", "3 back squats"] },
]);
ok("a part with no count is read the old way", legacy.indexOf("pprog-part-note") >= 0 && legacy.indexOf("Note: keep it light") >= 0);

/* Two notes, and one of them Hebrew. */
const twoNotes = PprogDisplay.partsFromDraft({
  day: "mon",
  parts: [{ title: "Part C", notes: ["Cue: brace", "שים לב לגב"], format: "", work: ["5x5"] }],
});
ok("both are kept", twoNotes[0].noteLines === 2);
const twoHtml = PprogDisplay.renderDayPartsHtml(twoNotes);
ok("and both are drawn as notes", (twoHtml.match(/pprog-part-note/g) || []).length >= 2);
ok("the work line is still work", twoHtml.indexOf("<li dir=\"auto\">5x5</li>") >= 0);


/* --- the count is always beside the pencil (owner, 2026-09-05) ------------ */

const untouchedBlock = {
  blockStart: "2026-09-06",
  weeks: [
    {
      weekIndex: 1,
      days: { sun: { parts: [] }, mon: { parts: [] }, tue: { parts: [] }, wed: { parts: [] }, thu: { parts: [] }, fri: { parts: [] }, sat: { parts: [] } },
      overview: [],
    },
  ],
};
const editableDay = PprogDisplay.renderBrickView({
  block: untouchedBlock, activeWi: 0, activeDay: "sun", calMode: "week", allowEdit: true, showFooter: false,
});
ok("a day he has never touched still shows the count", editableDay.indexOf("pprog-day-when") >= 0);
const readOnlyDay = PprogDisplay.renderBrickView({
  block: untouchedBlock, activeWi: 0, activeDay: "sun", calMode: "week", allowEdit: false, showFooter: false,
});
ok("where there is no pencil it stays the heading instead", readOnlyDay.indexOf("pprog-day-when") < 0);
ok("so a read-only day never loses its name", /class="source-name">[^<]+/.test(readOnlyDay));
ok("it is light yellow and italic", /\.pprog-day-when\{[^}]*color:#F5D97A;font-style:italic/.test(admin));

console.log("All shared pprog-display checks passed.");
