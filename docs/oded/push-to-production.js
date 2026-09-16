/* עודד — הלבנה בעברית, כפי שאושרה.
   הדבק בקונסול של האדמין החי. לא צריך שעודד יהיה פתוח — הוא מוצא אותו לבד. */
(async () => {
  const call = async (body) => {
    const r = await fetch(adminApiUrl("/api/client-program"), {
      method: "POST",
      headers: adminAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };

  const list = await call({ action: "list" });
  if (list.status !== 200 || !list.body.ok) return console.log("❌ לא הצלחתי לקרוא את רשימת הלקוחות: " + list.status);
  const rows = (list.body.rows || []).filter((x) => /עודד/.test(x.clientName || ""));
  if (rows.length !== 1) return console.log("נמצאו " + rows.length + " לקוחות בשם עודד — עצרתי.", rows.map((x) => x.clientName));
  const pid = rows[0].programId;

  const read = await call({ action: "read", programId: pid });
  if (read.status !== 200 || !read.body.ok) return console.log("❌ לא הצלחתי לקרוא את התוכנית: " + read.status);
  const p = read.body.program;
  console.log("נמצא: " + p.clientName + " · " + (p.weeks || []).length + " שבועות · גרסה " + p.version);

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

  const save = await call({ action: "save", programId: pid, expectedVersion: p.version, program: { weeks } });
  console.log(save.status === 200 && save.body.ok
    ? "✅ נשמר. רענן את הדף — הלבנה בעברית אצל עודד."
    : "❌ " + save.status + " " + JSON.stringify(save.body).slice(0, 200));
})();
