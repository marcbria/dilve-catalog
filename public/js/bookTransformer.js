export function invertirNombre(nombre) {
    if (!nombre) return "";
    if (nombre.includes(',')) {
        const parts = nombre.split(',').map(s => s.trim());
        return parts.reverse().join(' ');
    }
    return nombre;
}

export function transformBook(row) {
    const isbn = row["isbn13"] || "";
    const titleText = row["titulo"] || "";
    const subtitle = row["subtitulo"] || "";
    const authorsRaw = row["autor"] || "";
    const collectionTitle = row["coleccion"] || "";
    const collectionNumber = row["num_en_coleccion"] || "";
    const languageRaw = (row["idioma"] || "").toLowerCase();
    const pages = row["num_pags"] || "";
    const editorial = row["editorial"] || "Servei de Publicacions de la UAB";
    const sello = row["sello"] || "";
    const formato = (row["formato_libro_3.0"] || "").toUpperCase();
    const formatoDigital = row["formato_edicion_digital"] || "";
    const fechaPublic = row["fecha_public"] || "";
    const fechaPublicDMA = row["fecha_public_dma"] || "";
    const year = row["año_public"] || "";
    const precioVenta = row["precio_venta_publico"] || "";
    const iva = row["iva"] || "";
    const resumen = row["texto_resumen"] || "";
    const imagen = row["imagen_cubierta"] || "";
    const isbnDigital = row["isbn13_edicion_digital"] || "";
    const isbnImpreso = row["isbn13_edicion_impresa"] || "";
    const productosRelacionados = row["productos_relacionados"] || "";
    const alto = row["alto_cm"] || row["alto"] || "";
    const ancho = row["ancho_cm"] || row["ancho"] || "";
    const publico = row["publico_objetivo"] || "";
    const editorialCode = row["editorial_code"] || "";
    
    // Nuevos campos
    const digitalFormat = row["formato_edicion_digital"] || "";
    const themaCode = row["codigo_thema_materia"] || "";
    const themaDesc = row["codigo_thema_cargada"] || "";
    const editionNumber = row["num_edic"] || "";
    const binding = row["encuad"] || "";
    const isHardcover = binding === "HB" || binding === "BB" || binding === "BC" || binding === "BD";

    let isDigital = false;
    if (formato === "EC" || formato === "ED" || formatoDigital.trim() !== "") {
        isDigital = true;
    }
    const formatLabel = isDigital ? "Digital" : "Papel";

    const authorList = authorsRaw.split(';').map(a => a.trim()).filter(a => a);
    const authors = authorList.map(a => invertirNombre(a));
    const authorDisplay = authors.length > 0 ? authors.join('; ') : "Autor desconocido";

    let displayDate = "";
    let sortDate = 0;
    if (fechaPublicDMA && fechaPublicDMA.includes("/")) {
        const parts = fechaPublicDMA.split("/");
        if (parts.length === 3) {
            const d = parts[0].padStart(2, "0");
            const m = parts[1].padStart(2, "0");
            const y = parts[2];
            displayDate = `${d}-${m}-${y}`;
            sortDate = parseInt(y + m + d) || 0;
        }
    } else if (fechaPublic && /^\d{8}$/.test(fechaPublic)) {
        const y = fechaPublic.substring(0, 4);
        const m = fechaPublic.substring(4, 6);
        const d = fechaPublic.substring(6, 8);
        displayDate = `${d}-${m}-${y}`;
        sortDate = parseInt(fechaPublic) || 0;
    } else if (fechaPublic && /^\d{4}$/.test(fechaPublic)) {
        displayDate = fechaPublic;
        sortDate = parseInt(fechaPublic + "0000") || 0;
    } else if (fechaPublic) {
        displayDate = fechaPublic;
        sortDate = 0;
    }

    const langMap = { cat: "Catalán", spa: "Castellano", eng: "Inglés" };
    const languageLabel = langMap[languageRaw] || languageRaw.toUpperCase();
    const languageCode = ["cat", "spa", "eng"].includes(languageRaw) ? languageRaw : "other";

    const numericPrice = parseFloat(precioVenta) || 0;
    const isFree = precioVenta === "" || numericPrice === 0;
    const displayPrice = isFree ? "" : numericPrice.toFixed(2) + " EUR";

    let digitalFormats = [];
    if (isDigital) {
        digitalFormats.push(formato);
    }

    // Dimensiones en cm
    let width = "";
    let height = "";
    if (alto) {
        const num = parseFloat(alto);
        if (!isNaN(num)) height = num.toFixed(1);
        else height = alto;
    }
    if (ancho) {
        const num = parseFloat(ancho);
        if (!isNaN(num)) width = num.toFixed(1);
        else width = ancho;
    }

    return {
        isbn,
        titleText,
        subtitle,
        authors,
        authorDisplay,
        collectionTitle,
        collectionNumber,
        languageCode,
        languageLabel,
        displayDate,
        sortDate,
        year: year || (displayDate ? displayDate.slice(-4) : ""),
        extentLabel: pages ? pages + " páginas" : "",
        isDigital,
        formatLabel,
        publisherName: editorial,
        imprintName: sello,
        displayPrice,
        priceAmount: numericPrice,
        isFree,
        iva,
        abstractText: resumen,
        coverLink: imagen ? `data/covers/${imagen}` : "",
        productIDAlternative: isDigital ? isbnImpreso : isbnDigital,
        normalizedTitle: titleText.toLowerCase().trim(),
        digitalFormats: digitalFormats,
        relatedProducts: productosRelacionados ? productosRelacionados.split("|") : [],
        width: width,
        height: height,
        targetAudience: publico,
        editorialCode: editorialCode,
        publisherDisplay: editorial,
        // Nuevos campos
        digitalFormat: digitalFormat,
        themaCode: themaCode,
        themaDesc: themaDesc,
        editionNumber: editionNumber,
        binding: binding,
        isHardcover: isHardcover
    };
}

export function mergeBooks(books) {
    const map = new Map();
    books.forEach(book => {
        const key = book.isbn;
        if (map.has(key)) {
            const existing = map.get(key);
            if (book.digitalFormats && book.digitalFormats.length > 0) {
                existing.digitalFormats = [...new Set([...existing.digitalFormats, ...book.digitalFormats])];
            }
            if (book.isDigital && !existing.isDigital) {
                existing.isDigital = true;
                existing.formatLabel = "Digital";
            }
            if (book.coverLink && !existing.coverLink) {
                existing.coverLink = book.coverLink;
            }
            if (book.priceAmount > 0 && (existing.priceAmount === 0 || book.priceAmount < existing.priceAmount)) {
                existing.priceAmount = book.priceAmount;
                existing.displayPrice = book.displayPrice;
                existing.isFree = book.isFree;
            }
            if (book.width && !existing.width) existing.width = book.width;
            if (book.height && !existing.height) existing.height = book.height;
            // Fusionar nuevos campos
            if (book.digitalFormat && !existing.digitalFormat) existing.digitalFormat = book.digitalFormat;
            if (book.themaCode && !existing.themaCode) existing.themaCode = book.themaCode;
            if (book.themaDesc && !existing.themaDesc) existing.themaDesc = book.themaDesc;
            if (book.editionNumber && !existing.editionNumber) existing.editionNumber = book.editionNumber;
            if (book.binding && !existing.binding) existing.binding = book.binding;
            if (book.isHardcover && !existing.isHardcover) existing.isHardcover = book.isHardcover;
        } else {
            map.set(key, { ...book });
        }
    });
    return Array.from(map.values());
}
