function csvCell(value) {
    let text = value == null ? "" : String(value);
    if (/[",\r\n]/.test(text))
        text = `"${text.replace(/"/g, '""')}"`;
    return text;
}

export function worksheetToCsv(worksheet) {
    const rows = [];
    worksheet.eachRow({ includeEmpty: false }, (row) => {
        const cells = [];
        for (let column = 1; column <= worksheet.columnCount; column++) {
            const cell = row.getCell(column);
            const value = cell.value;
            if (value && typeof value === "object" && "formula" in value) {
                cells.push(csvCell(`=${value.formula}`));
            } else if (value && typeof value === "object" && "richText" in value) {
                cells.push(csvCell(value.richText.map((part) => part.text).join("")));
            } else {
                cells.push(csvCell(cell.text));
            }
        }
        rows.push(cells.join(","));
    });
    return rows.join("\n");
}
