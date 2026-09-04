import { BINDING_MAP } from './dictionaries/binding.js';
import { DIGITAL_FORMAT_MAP } from './dictionaries/digitalFormat.js';

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
    const fechaPublicDMA = row["fecha_public_dma"] || "";
    const year = row["año_public"] || "";
    const precioVenta = row["precio_venta_publico"] || "";
    const iva = row["iva"] || "";
    const resumen = row["texto_resumen"] || "";
    const imagen = row["imagen_cubierta"] || "";
    const isbnDigital = row["isbn13_edicion_digital"] || "";
    const isbnImpreso = row["isbn13_edicion_impresa"] || "";
    const productosRelacionados = row["productos_relacionados"] || "";
    const altoCm = row["alto_cm"] || "";
    const anchoCm = row["ancho_cm"] || "";
    const publico = row["publico_objetivo"] || "";
    const editorialCode = row["editorial_code"] || "";
    
    const digitalFormatRaw = row["formato_edicion_digital"] || "";
    const themaCode = row["codigo_thema_materia"] || "";
    const themaDesc = row["codigo_thema_cargada"] || "";
    const editionNumber = row["num_edic"] || "";
    const binding = row["encuad"] || "";

    // Determinar si es digital (códigos EB, EC, ED, EA)
    const digitalCodes = ["EB", "EC", "ED", "EA"];
    let isDigital = false;
    if (digitalCodes.includes(formato) || digitalFormatRaw.trim() !== "") {
        isDigital = true;
    }
    const formatLabel = isDigital ? "Digital" : "Papel";

    const bindingName = BINDING_MAP[binding] || "";
    const digitalFormatName = DIGITAL_FORMAT_MAP[digitalFormatRaw] || digitalFormatRaw;

    const authorList = authorsRaw.split(';').map(a => a.trim()).filter(a => a);
    const authors = authorList.map(a => invertirNombre(a));
    const authorDisplay = authors.length > 0 ? authors.join('; ') : "Autor desconocido";

    // Fechas: usar fecha_public_dma y año_public
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
    } else if (fechaPublicDMA) {
        displayDate = fechaPublicDMA;
        sortDate = 0;
    } else if (year && /^\d{4}$/.test(year)) {
        displayDate = year;
        sortDate = parseInt(year + "0000") || 0;
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

    // Dimensiones: usar valores en cm (como strings)
    let width = anchoCm ? parseFloat(anchoCm).toFixed(1) : "";
    let height = altoCm ? parseFloat(altoCm).toFixed(1) : "";

    // 🔧 Asegurar que coverLink sea una ruta relativa, no file://
    let coverLink = imagen ? `data/covers/${imagen}` : "";
    // Si por alguna razón empieza con file://, eliminar ese prefijo
    if (coverLink.startsWith('file://')) {
        coverLink = coverLink.replace('file://', '');
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
        coverLink: coverLink,
        productIDAlternative: isDigital ? isbnImpreso : isbnDigital,
        normalizedTitle: titleText.toLowerCase().trim(),
        digitalFormats: digitalFormats,
        relatedProducts: productosRelacionados ? productosRelacionados.split("|") : [],
        width: width,
        height: height,
        targetAudience: publico,
        editorialCode: editorialCode,
        publisherDisplay: editorial,
        digitalFormat: digitalFormatName,
        digitalFormatRaw: digitalFormatRaw,
        themaCode: themaCode,
        themaDesc: themaDesc,
        editionNumber: editionNumber,
        binding: binding,
        bindingName: bindingName,
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
            if (book.digitalFormat && !existing.digitalFormat) existing.digitalFormat = book.digitalFormat;
            if (book.digitalFormatRaw && !existing.digitalFormatRaw) existing.digitalFormatRaw = book.digitalFormatRaw;
            if (book.themaCode && !existing.themaCode) existing.themaCode = book.themaCode;
            if (book.themaDesc && !existing.themaDesc) existing.themaDesc = book.themaDesc;
            if (book.editionNumber && !existing.editionNumber) existing.editionNumber = book.editionNumber;
            if (book.binding && !existing.binding) existing.binding = book.binding;
            if (book.bindingName && !existing.bindingName) existing.bindingName = book.bindingName;
        } else {
            map.set(key, { ...book });
        }
    });
    return Array.from(map.values());
}
