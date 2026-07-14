// ─── Parser CSV amb detecció de delimitador ──────────────
export function detectDelimiter(firstLine) {
    if (!firstLine) return ",";
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    return commaCount >= semicolonCount ? "," : ";";
}

export function parseCSVText(csvText) {
    if (csvText.charCodeAt(0) === 0xfeff) csvText = csvText.slice(1);
    const lines = csvText.split(/\r?\n/);
    const firstLine = lines[0] || "";
    const delim = detectDelimiter(firstLine);
    console.log("Delimitador detectat:", delim);

    const rows = [];
    let currentRow = [];
    let currentField = "";
    let inQuotes = false;
    const len = csvText.length;

    for (let i = 0; i < len; i++) {
        const char = csvText[i];
        const nextChar = csvText[i + 1];
        if (inQuotes) {
            if (char === '"') {
                if (nextChar === '"') {
                    currentField += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                currentField += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === delim) {
                currentRow.push(currentField);
                currentField = "";
            } else if (char === "\n") {
                currentRow.push(currentField);
                currentField = "";
                rows.push(currentRow);
                currentRow = [];
            } else if (char === "\r") {
                if (nextChar === "\n") i++;
                currentRow.push(currentField);
                currentField = "";
                rows.push(currentRow);
                currentRow = [];
            } else {
                currentField += char;
            }
        }
    }
    if (currentField || currentRow.length > 0) {
        currentRow.push(currentField);
        rows.push(currentRow);
    }

    if (rows.length === 0) {
        console.warn("El fitxer CSV no té files.");
        return [];
    }

    const headers = rows[0].map(h => h.trim());
    console.log("Capçaleres:", headers);
    const data = [];
    for (let i = 1; i < rows.length; i++) {
        const obj = {};
        headers.forEach((header, index) => {
            obj[header] = rows[i][index] || "";
        });
        if (Object.values(obj).some(v => v !== "")) data.push(obj);
    }
    console.log(`Files parseades: ${data.length}`);
    return data;
}
