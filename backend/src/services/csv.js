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
    let quoted = false;
    let afterQuote = false;
    const pushRow = () => {
        row.push(cur);
        if (row.length > 1 || row[0] !== "")
            rows.push(row);
        row = [];
        cur = "";
        afterQuote = false;
    };
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (quoted) {
            if (ch === '"') {
                if (text[i + 1] === '"') {
                    cur += '"';
                    i++;
                }
                else {
                    quoted = false;
                    afterQuote = true;
                }
            }
            else
                cur += ch;
        }
        else if (afterQuote) {
            if (ch === ",") {
                row.push(cur);
                cur = "";
                afterQuote = false;
            }
            else if (ch === "\n" || ch === "\r") {
                if (ch === "\r" && text[i + 1] === "\n")
                    i++;
                pushRow();
            }
            else {
                throw new SyntaxError("Unexpected character after a quoted CSV field");
            }
        }
        else if (ch === '"') {
            if (cur !== "")
                throw new SyntaxError("Unexpected quote in an unquoted CSV field");
            quoted = true;
        }
        else if (ch === ",") {
            row.push(cur);
            cur = "";
        }
        else if (ch === "\n" || ch === "\r") {
            if (ch === "\r" && text[i + 1] === "\n")
                i++;
            pushRow();
        }
        else
            cur += ch;
    }
    if (quoted)
        throw new SyntaxError("Unclosed quoted CSV field");
    if (cur !== "" || row.length || afterQuote) {
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
