/**
 * A spreadsheet file, written by hand.
 *
 * CSV carries no formatting at all — no column widths, no wrapping, no row heights —
 * so a session of eight lines arrives in a cell one line tall and he cannot read a
 * word of it (owner, 2026-09-30). A real .xlsx can say "this column is wide, this cell
 * wraps, this row is as tall as it needs to be", and both Excel and Google Sheets
 * honour it.
 *
 * WHY BY HAND. An xlsx is a zip of small XML files, and a zip may store its entries
 * uncompressed — which means the whole format is reachable with a CRC and some string
 * building, and no 500KB library in a page that is already large. Everything here is
 * pure: it takes rows and returns bytes.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.XlsxLite = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* The three ways a cell can look. Their order is the order of cellXfs below, and the
     numbers are what a cell's `s` attribute points at. */
  const STYLE_PLAIN = 0;
  const STYLE_BOLD = 1;
  const STYLE_WRAP = 2;

  function esc(s) {
    return String(s === undefined || s === null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      /* Control characters are not allowed in XML and Excel refuses the whole file for
         one of them. Tabs and newlines are kept: they are the point. */
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  }

  /** 1 → A, 27 → AA. Columns are named, not numbered, inside the file. */
  function colName(n) {
    let s = "";
    let i = n;
    while (i > 0) {
      const r = (i - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      i = Math.floor((i - 1) / 26);
    }
    return s;
  }

  const CRC_TABLE = (function () {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })();

  function crc32(bytes) {
    let c = -1;
    for (let i = 0; i < bytes.length; i += 1) {
      c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ -1) >>> 0;
  }

  function utf8(str) {
    if (typeof TextEncoder === "function") return new TextEncoder().encode(String(str));
    /* Node before TextEncoder was global. */
    const buf = Buffer.from(String(str), "utf8");
    return new Uint8Array(buf);
  }

  function u16(n) {
    return [n & 0xff, (n >>> 8) & 0xff];
  }

  function u32(n) {
    return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
  }

  /**
   * A zip, with every entry STORED rather than deflated.
   *
   * Uncompressed is a legal zip and Excel reads it without complaint. It costs file
   * size, which for a month of training is a few tens of kilobytes — a price worth
   * paying not to carry a compression library.
   */
  function zip(files) {
    const chunks = [];
    const central = [];
    let offset = 0;

    files.forEach(function (file) {
      const nameBytes = utf8(file.name);
      const data = file.bytes;
      const sum = crc32(data);
      const local = [].concat(
        u32(0x04034b50),
        u16(20), // version needed
        u16(0x0800), // UTF-8 names
        u16(0), // stored
        u16(0), u16(0), // time, date
        u32(sum),
        u32(data.length),
        u32(data.length),
        u16(nameBytes.length),
        u16(0)
      );
      chunks.push(new Uint8Array(local), nameBytes, data);
      central.push({ name: nameBytes, crc: sum, size: data.length, offset: offset });
      offset += local.length + nameBytes.length + data.length;
    });

    const dirStart = offset;
    central.forEach(function (e) {
      const head = [].concat(
        u32(0x02014b50),
        u16(20), u16(20),
        u16(0x0800),
        u16(0),
        u16(0), u16(0),
        u32(e.crc),
        u32(e.size),
        u32(e.size),
        u16(e.name.length),
        u16(0), u16(0), u16(0), u16(0),
        u32(0),
        u32(e.offset)
      );
      chunks.push(new Uint8Array(head), e.name);
      offset += head.length + e.name.length;
    });

    const end = [].concat(
      u32(0x06054b50),
      u16(0), u16(0),
      u16(central.length), u16(central.length),
      u32(offset - dirStart),
      u32(dirStart),
      u16(0)
    );
    chunks.push(new Uint8Array(end));

    let total = 0;
    chunks.forEach(function (c) { total += c.length; });
    const out = new Uint8Array(total);
    let at = 0;
    chunks.forEach(function (c) { out.set(c, at); at += c.length; });
    return out;
  }

  const CONTENT_TYPES =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    "</Types>";

  const ROOT_RELS =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    "</Relationships>";

  const WORKBOOK_RELS =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    "</Relationships>";

  function workbookXml(sheetName) {
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      "<sheets><sheet name=\"" + esc(sheetName || "Sheet1").slice(0, 31) +
      '" sheetId="1" r:id="rId1"/></sheets></workbook>'
    );
  }

  /* Three cell formats and nothing else: plain, bold, and the one that makes a whole
     session readable — wrapped text pinned to the top of its cell. */
  const STYLES =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>' +
    '<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="2"><fill><patternFill patternType="none"/></fill>' +
    '<fill><patternFill patternType="gray125"/></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="3">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1">' +
    '<alignment vertical="top" wrapText="1"/></xf>' +
    "</cellXfs>" +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    "</styleSheet>";

  /**
   * The sheet itself.
   *
   * @param {Array<Array<{v: string, style?: number}|string>>} rows
   * @param {{colWidth?: number, columns?: number, rightToLeft?: boolean}} opts
   */
  function sheetXml(rows, opts) {
    const o = opts && typeof opts === "object" ? opts : {};
    const width = Math.max(1, Number(o.columns) || 1);
    const colWidth = Number(o.colWidth) || 34;
    let xml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<sheetViews><sheetView workbookViewId="0"' +
      (o.rightToLeft === false ? "" : ' rightToLeft="1"') +
      "/></sheetViews>" +
      '<cols><col min="1" max="' + width + '" width="' + colWidth + '" customWidth="1"/></cols>' +
      "<sheetData>";

    rows.forEach(function (row, ri) {
      const cells = Array.isArray(row) ? row : [];
      xml += '<row r="' + (ri + 1) + '">';
      cells.forEach(function (cell, ci) {
        const value = cell && typeof cell === "object" ? cell.v : cell;
        const style = cell && typeof cell === "object" && cell.style ? cell.style : STYLE_PLAIN;
        const text = String(value === undefined || value === null ? "" : value);
        if (!text) return;
        xml +=
          '<c r="' + colName(ci + 1) + (ri + 1) + '" t="inlineStr" s="' + style + '">' +
          '<is><t xml:space="preserve">' + esc(text) + "</t></is></c>";
      });
      xml += "</row>";
    });

    return xml + "</sheetData></worksheet>";
  }

  /** The whole file, as bytes. */
  function build(rows, opts) {
    const o = opts && typeof opts === "object" ? opts : {};
    return zip([
      { name: "[Content_Types].xml", bytes: utf8(CONTENT_TYPES) },
      { name: "_rels/.rels", bytes: utf8(ROOT_RELS) },
      { name: "xl/workbook.xml", bytes: utf8(workbookXml(o.sheetName)) },
      { name: "xl/_rels/workbook.xml.rels", bytes: utf8(WORKBOOK_RELS) },
      { name: "xl/styles.xml", bytes: utf8(STYLES) },
      { name: "xl/worksheets/sheet1.xml", bytes: utf8(sheetXml(rows, o)) },
    ]);
  }

  return {
    build: build,
    sheetXml: sheetXml,
    zip: zip,
    crc32: crc32,
    colName: colName,
    utf8: utf8,
    STYLE_PLAIN: STYLE_PLAIN,
    STYLE_BOLD: STYLE_BOLD,
    STYLE_WRAP: STYLE_WRAP,
    MIME: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
});
