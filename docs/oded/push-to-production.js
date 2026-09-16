/* Oded's block, in Hebrew, as approved. Paste into the live admin console.
   ASCII only on purpose: Hebrew inside the snippet broke on copy out of a chat window,
   so the one Hebrew string it needs (the client's name) is written as escapes. */
(async () => {
  const NAME = "עודד"; /* Oded */
  const call = async (body) => {
    const r = await fetch(adminApiUrl("/api/client-program"), {
      method: "POST",
      headers: adminAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };

  const list = await call({ action: "list" });
  if (list.status !== 200 || !list.body.ok) return console.log("FAILED to read the client list: " + list.status);
  const rows = (list.body.rows || []).filter((x) => String(x.clientName || "").indexOf(NAME) >= 0);
  if (rows.length !== 1) return console.log("Found " + rows.length + " clients matching Oded - stopped.", rows.map((x) => x.clientName));
  const pid = rows[0].programId;

  const read = await call({ action: "read", programId: pid });
  if (read.status !== 200 || !read.body.ok) return console.log("FAILED to read the program: " + read.status);
  const p = read.body.program;
  console.log("Found: " + p.clientName + " | weeks: " + (p.weeks || []).length + " | version: " + p.version);

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
  console.log("parts to replace: " + hit + (miss ? " | not found: " + miss : ""));
  if (!hit || miss) return console.log("Shape does not match - nothing was touched.");

  const save = await call({ action: "save", programId: pid, expectedVersion: p.version, program: { weeks } });
  console.log(save.status === 200 && save.body.ok
    ? "SAVED. Refresh the page - Oded's block is in Hebrew."
    : "FAILED " + save.status + " " + JSON.stringify(save.body).slice(0, 200));
})();
