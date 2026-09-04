// ─── Parser CSV robusto (RFC 4180) ─────────────────────
export function detectDelimiter(firstLine) {
    if (!firstLine) return ",";
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    return commaCount >= semicolonCount ? "," : ";";
}

export function parseCSVText(csvText) {
    // Eliminar BOM si existe
    if (csvText.charCodeAt(0) === 0xfeff) csvText = csvText.slice(1);

    // Detectar delimitador basado en la primera línea
    const firstLineEnd = csvText.indexOf('\n');
    const firstLine = firstLineEnd !== -1 ? csvText.slice(0, firstLineEnd) : csvText;
    const delim = detectDelimiter(firstLine);

    const rows = [];
    let currentRow = [];
    let currentField = "";
    let inQuotes = false;
    let i = 0;
    const len = csvText.length;

    while (i < len) {
        const char = csvText[i];
        const nextChar = csvText[i + 1] || '';

        if (inQuotes) {
            if (char === '"') {
                if (nextChar === '"') {
                    // Comillas dobles escapadas
                    currentField += '"';
                    i += 2;
                } else {
                    // Fin de comillas
                    inQuotes = false;
                    i++;
                }
            } else {
                currentField += char;
                i++;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
                i++;
            } else if (char === delim) {
                currentRow.push(currentField.trim());
                currentField = "";
                i++;
            } else if (char === '\n') {
                // Fin de línea
                currentRow.push(currentField.trim());
                currentField = "";
                if (currentRow.some(field => field !== "")) {
                    rows.push(currentRow);
                }
                currentRow = [];
                i++;
            } else if (char === '\r') {
                // Ignorar \r, pero si va seguido de \n, saltarlo
                if (nextChar === '\n') {
                    i++;
                }
                // Forzar fin de línea
                currentRow.push(currentField.trim());
                currentField = "";
                if (currentRow.some(field => field !== "")) {
                    rows.push(currentRow);
                }
                currentRow = [];
                i++;
            } else {
                currentField += char;
                i++;
            }
        }
    }

    // Último campo y fila
    if (currentField || currentRow.length > 0) {
        currentRow.push(currentField.trim());
        if (currentRow.some(field => field !== "")) {
            rows.push(currentRow);
        }
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
        const row = rows[i];
        headers.forEach((header, index) => {
            obj[header] = row[index] || "";
        });
        // Solo agregar si al menos un valor no está vacío
        if (Object.values(obj).some(v => v !== "")) {
            data.push(obj);
        }
    }
    console.log(`Files parseades: ${data.length}`);
    return data;
}
