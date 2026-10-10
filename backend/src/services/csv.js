"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FORMULA = void 0;
exports.parseCsv = parseCsv;
exports.csvCell = csvCell;
/** Minimal RFC-4180 parser (quotes, escaped quotes, CRLF). */
function parseCsv(text) {
    const rows = [];
    let row = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (q) {
            if (ch === '"') {
                if (text[i + 1] === '"') {
                    cur += '"';
                    i++;
                }
                else
                    q = false;
            }
            else
                cur += ch;
        }
        else if (ch === '"')
            q = true;
        else if (ch === ",") {
            row.push(cur);
            cur = "";
        }
        else if (ch === "\n" || ch === "\r") {
            if (ch === "\r" && text[i + 1] === "\n")
                i++;
            row.push(cur);
            cur = "";
            if (row.length > 1 || row[0] !== "")
                rows.push(row);
            row = [];
        }
        else
            cur += ch;
    }
    if (cur !== "" || row.length) {
        row.push(cur);
        rows.push(row);
    }
    return rows;
}
/** Cells starting with these can execute as formulas in Excel/Sheets (CSV/formula injection). */
exports.FORMULA = /^[=+\-@\t\r]/;
function csvCell(v) {
    let s = v == null ? "" : String(v);
    if (exports.FORMULA.test(s))
        s = "'" + s;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
