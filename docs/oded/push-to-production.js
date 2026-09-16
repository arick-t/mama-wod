/* עודד — הלבנה בעברית, כפי שאושרה. הדבק בקונסול של האדמין החי, כשעודד פתוח. */
(async () => {
  const p = (typeof S !== "undefined" && S.program) || null;
  if (!p) return console.log("פתח קודם את עודד ברשימת הלקוחות, ואז הרץ שוב.");
  if (!/עודד/.test(p.clientName || "")) return console.log("זה לא עודד — פתוח: " + p.clientName);
  const src = "https://raw.githubusercontent.com/arick-t/mama-wod/feature/oded-round-2/docs/oded/approved-hebrew-block.json";
  const B = await (await fetch(src)).json();
  let hit = 0, miss = 0;
  const weeks = JSON.parse(JSON.stringify(p.weeks || []));
  B.forEach((days, wi) => Object.keys(days).forEach((dk) => {
    const live = ((weeks[wi] || {}).days || {})[dk];
    if (!live || !Array.isArray(live.parts)) { miss += days[dk].length; return; }
    days[dk].forEach((s, pi) => {
      const t = live.parts[pi];
      if (!t) { miss++; return; }
      t.title = s.title; t.lines = s.lines.slice();
      t.noteLines = s.noteLines; t.formatLine = s.formatLine;
      t.titleEn = s.titleEn; t.linesEn = s.linesEn.slice();
      hit++;
    });
  }));
  console.log("חלקים שיוחלפו: " + hit + (miss ? " · לא נמצאו: " + miss : ""));
  if (!hit || miss) return console.log("המבנה לא תואם — לא נגעתי בכלום.");
  const r = await fetch(adminApiUrl("/api/client-program"), {
    method: "POST",
    headers: adminAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ action: "save", programId: p.programId, expectedVersion: p.version, program: { weeks } }),
  });
  const j = await r.json().catch(() => ({}));
  console.log(r.status === 200 && j.ok ? "✅ נשמר. רענן — הלבנה בעברית אצל עודד." : "❌ " + r.status + " " + JSON.stringify(j).slice(0, 200));
})();
