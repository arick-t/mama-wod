/**
 * Admin Done debrief (dots + Hebrew chat) and width-view helpers.
 * Run: node scripts/admin-done-debrief.test.js
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const AdminDoneDebrief = require("../lib/admin-done-debrief");
const PprogDisplay = require("../lib/pprog-display");
const NormalizePprogBlock = require("../lib/normalize-pprog-block");

const root = path.join(__dirname, "..");
const admin = fs.readFileSync(path.join(root, "admin.html"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const snap = fs.readFileSync(path.join(root, "scripts/lib/admin/admin-snapshot.js"), "utf8");
const pprog = fs.readFileSync(path.join(root, "lib/pprog-display.js"), "utf8");

function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok —", name);
}

ok("just_right is בול only", (() => {
  const m = AdminDoneDebrief.formatMessage({ rating: "just_right", part_title: "Squat" });
  return m && m.lines.length === 1 && m.lines[0] === "בול" && !m.safety;
})());
ok(
  "too_hard + title",
  (() => {
    const m = AdminDoneDebrief.formatMessage({ rating: "too_hard", part_title: "סקוואט כבד" });
    return m.lines[0] === "קשה מדי" && m.lines[1] === "סקוואט כבד";
  })()
);
ok(
  "other + note + flag",
  (() => {
    const m = AdminDoneDebrief.formatMessage({
      rating: "other",
      note: "כאב חד בכתף",
      safety_flag: true,
    });
    return m.lines[0] === "אחר" && m.lines[1] === "כאב חד בכתף" && m.safety === true;
  })()
);
ok("no rating → null", AdminDoneDebrief.formatMessage({}) === null);
ok("unread without map", AdminDoneDebrief.isUnread(null, "2026-08-14") === true);
ok(
  "read after mark",
  !AdminDoneDebrief.isUnread(AdminDoneDebrief.markRead({}, "2026-08-14"), "2026-08-14")
);
ok(
  "range thu week0 to sun week1",
  AdminDoneDebrief.rangeBetween({ wi: 0, day: "thu" }, { wi: 1, day: "sun" }).length === 4
);

const raw = {
  summaryLine: "Test brick",
  weeks: [
    {
      weekIndex: 1,
      phase: "build",
      overview: [
        { day: "sun", focus: "Rest" },
        { day: "mon", focus: "Squat" },
        { day: "thu", focus: "Engine" },
      ],
      days: {
        sun: { parts: [{ title: "REST DAY", lines: ["Rest"] }] },
        mon: {
          parts: [{ title: "Strength", lines: ["5x5 Back Squat"] }],
          finishFeedback: { rating: "just_right", at: "2026-08-14T10:00:00.000Z" },
        },
        thu: { parts: [{ title: "Engine", lines: ["AMRAP 12"] }] },
      },
    },
  ],
};
const block = NormalizePprogBlock.normalize(raw, raw);

const athleteCal = PprogDisplay.renderCalHtml(block, 0, "mon", { calMode: "month" });
ok("athlete calendar has no done dots by default", !/pprog-done-dot/.test(athleteCal));
ok("athlete calendar has no width strip", !/pprog-width-strip/.test(PprogDisplay.renderBrickView({ block, activeWeekIndex: 0, activeDay: "mon" })));

const adminCal = PprogDisplay.renderCalHtml(block, 0, "mon", {
  calMode: "month",
  showDoneDots: true,
  doneDebriefRead: {},
});
ok("admin dots on Done day", /pprog-done-dot/.test(adminCal) && /done-unread/.test(adminCal));
ok(
  "admin dots weak when read",
  /done-read/.test(
    PprogDisplay.renderCalHtml(block, 0, "mon", {
      calMode: "month",
      showDoneDots: true,
      doneDebriefRead: { [block.blockStart]: true },
    })
  ) ||
    /done-read/.test(
      PprogDisplay.renderCalHtml(block, 0, "mon", {
        calMode: "month",
        showDoneDots: true,
        doneDebriefRead: { [NormalizePprogBlock.addDaysIso(block.blockStart, 1)]: true },
      })
    )
);

const width = PprogDisplay.renderBrickView({
  block,
  activeWeekIndex: 0,
  activeDay: "mon",
  selectedDays: [
    { wi: 0, day: "mon" },
    { wi: 0, day: "thu" },
  ],
  widthStatusHtml: '<div class="pprog-width-status">2 ימים נבחרו</div>',
});
ok("width strip for 2+ days", /pprog-width-strip/.test(width) && /pprog-width-status/.test(width));
ok("width cards chronological", width.indexOf("Mon") < width.indexOf("Thu") || width.indexOf("Strength") < width.indexOf("Engine"));

ok("admin loads debrief lib", /admin-done-debrief\.js/.test(admin));
ok("admin mark-read action", /admin_mark_done_read/.test(snap) && /doneDebriefRead/.test(snap));
ok("admin preserves doneDebriefRead on snapshot write", /doneDebriefRead:/.test(snap));
ok("admin chat template flag", /דגל אדום/.test(admin) && /ath-done-debrief/.test(admin));
ok("admin width helpers", /adminPprogSelectWeek/.test(admin) && /adminPprogSelectDow/.test(admin) && /adminPprogClearSelection/.test(admin));
ok("admin width CSS desktop strip", /pprog-width-strip\{[^}]*overflow-x:\s*auto/.test(admin.replace(/\s+/g, "")));
ok("admin selected cell uses coach purple not brand", /pprog-cal-cell\.selected:not\(\.active\)\{[^}]*--coach/.test(admin.replace(/\s+/g, "")));
ok("no generate from debrief/width", !/generate_block|generate_week_detail|revise_day/.test(admin.slice(admin.indexOf("function adminPprogSelectWeek"), admin.indexOf("function adminPprogStartEdit") > 0 ? admin.indexOf("function adminPprogStartEdit") : admin.length)));
ok("index Done UI untouched by admin dots", !/showDoneDots/.test(index) && !/pprog-done-dot/.test(index));
ok("pprog passCalEvent is opt-in", /passCalEvent/.test(pprog) && /showDoneDots/.test(pprog));
ok("admin save still 0 LLM", /admin_save_day/.test(snap) && !/generate_block/.test(snap.slice(snap.indexOf('action === "admin_save_day"'), snap.indexOf('action === "admin_mark_done_read"'))));

console.log("All admin done-debrief + width-view checks passed.");
