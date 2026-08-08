/**
 * Lightweight append-only audit for admin mutations (Blob or FS).
 * Cost: 0 ₪ — same Hobby Blob store, tiny JSON lines.
 */
const { putJson, getJson, useBlob } = require("./admin-json-store");

const AUDIT_KEY = "admin-audit/log.jsonl";
const MAX_LINES = 400;
const MAX_BYTES = 120 * 1024;

async function appendAdminAudit(event) {
  try {
    const row = {
      t: new Date().toISOString(),
      action: String((event && event.action) || "unknown").slice(0, 64),
      athleteId: String((event && event.athleteId) || "").slice(0, 80),
      actor: String((event && event.actor) || "unknown").slice(0, 32),
      ok: event && event.ok !== false,
      detail: String((event && event.detail) || "").slice(0, 160),
    };
    let prev = "";
    try {
      const existing = await getJson(AUDIT_KEY);
      if (typeof existing === "string") prev = existing;
      else if (existing && typeof existing.raw === "string") prev = existing.raw;
      else if (existing && Array.isArray(existing.lines)) prev = existing.lines.join("\n");
    } catch (e) {}
    // JSON store expects objects — store wrapper
    let lines = [];
    if (prev) {
      lines = String(prev)
        .split("\n")
        .filter(Boolean);
    } else {
      // try wrapper format
      try {
        const wrap = await getJson(AUDIT_KEY);
        if (wrap && typeof wrap.text === "string") {
          lines = wrap.text.split("\n").filter(Boolean);
        }
      } catch (e2) {}
    }
    lines.push(JSON.stringify(row));
    if (lines.length > MAX_LINES) lines = lines.slice(-MAX_LINES);
    let text = lines.join("\n");
    if (text.length > MAX_BYTES) {
      text = text.slice(text.length - MAX_BYTES);
      const cut = text.indexOf("\n");
      if (cut > 0) text = text.slice(cut + 1);
    }
    await putJson(AUDIT_KEY, { text: text, updatedAt: row.t, backend: useBlob() ? "blob" : "fs" });
  } catch (e) {
    /* never fail the main request because audit failed */
  }
}

module.exports = { appendAdminAudit };
