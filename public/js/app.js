(function () {
    // ─── DOM refs ────────────────────────────────────────────
    const booksGrid = document.getElementById("booksGrid");
    const noResults = document.getElementById("noResults");
    const resultsCount = document.getElementById("resultsCount");
    const searchInput = document.getElementById("searchInput");
    const sortSelect = document.getElementById("sortSelect");
    const langFilter = document.getElementById("langFilter");
    const formatFilter = document.getElementById("formatFilter");
    const priceFilter = document.getElementById("priceFilter");
    const collectionFilter = document.getElementById("collectionFilter");
    const collectionWrapper = document.getElementById("collectionFilterWrapper");
    const resetButton = document.getElementById("resetFilters");
    const modalOverlay = document.getElementById("modalOverlay");
    const modalBody = document.getElementById("modalBody");
    const modalClose = document.getElementById("modalClose");
    const scrollSentinel = document.getElementById("scrollSentinel");
    const loadingIndicator = document.getElementById("loadingIndicator");
    const collectionIntro = document.getElementById("collectionIntro");
    const fileFallback = document.getElementById("fileFallback");
    const csvFileInput = document.getElementById("csvFileInput");
    const controlsBar = document.getElementById("controlsBar");

    let allBooks = [];
    let filteredBooks = [];
    let collectionsData = [];
    let displayedCount = 0;
    const BOOKS_PER_PAGE = 12;
    let observer = null;

    // ─── Parser CSV amb detecció de delimitador ──────────────
    function detectDelimiter(firstLine) {
        if (!firstLine) return ",";
        const commaCount = (firstLine.match(/,/g) || []).length;
        const semicolonCount = (firstLine.match(/;/g) || []).length;
        return commaCount >= semicolonCount ? "," : ";";
    }

    function parseCSVText(csvText) {
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

    // ─── Transformació del registre ──────────────────────────
    function transformBook(row) {
        const isbn = row["isbn13"] || "";
        const titleText = row["titulo"] || "";
        const subtitle = row["subtitulo"] || "";
        const authorsRaw = row["autor"] || "";
        const collectionTitle = row["coleccion"] || "";
        const collectionNumber = row["num_en_coleccion"] || "";
        const languageRaw = (row["idioma"] || "").toLowerCase();
        const pages = row["num_pags"] || "";
        const editorial = row["editorial"] || "Servei de Publicacions de la Universitat Autònoma de Barcelona";
        const sello = row["sello"] || "";
        const formato = (row["formato_libro_3.0"] || "").toUpperCase();
        const formatoDigital = row["formato_edicion_digital"] || "";
        const fechaPublic = row["fecha_public"] || "";
        const fechaPublicDMA = row["fecha_public_dma"] || "";
        const precioVenta = row["precio_venta_publico"] || "";
        const iva = row["iva"] || "";
        const resumen = row["texto_resumen"] || "";
        const imagen = row["imagen_cubierta"] || "";
        const isbnDigital = row["isbn13_edicion_digital"] || "";
        const isbnImpreso = row["isbn13_edicion_impresa"] || "";
        const productosRelacionados = row["productos_relacionados"] || "";

        // Determinar si es digital
        let isDigital = false;
        if (formato === "EC" || formato === "ED" || formatoDigital.trim() !== "") {
            isDigital = true;
        }
        const formatLabel = isDigital ? "DIGITAL" : "PAPER";

        const authors = authorsRaw.split(",").map(a => a.trim()).filter(a => a);
        const authorDisplay = authors.length > 0 ? authors.join(", ") : "Autor desconegut";

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

        const langMap = { cat: "Català", spa: "Castellà", eng: "Anglès" };
        const languageLabel = langMap[languageRaw] || languageRaw.toUpperCase();
        const languageCode = ["cat", "spa", "eng"].includes(languageRaw) ? languageRaw : "other";

        const numericPrice = parseFloat(precioVenta) || 0;
        const isFree = precioVenta === "" || numericPrice === 0;
        const displayPrice = isFree ? "" : numericPrice.toFixed(2) + " EUR";

        // Recoger formatos digitales desde productos relacionados
        let digitalFormats = [];
        if (isDigital) {
            digitalFormats.push(formato);
        }
        if (productosRelacionados) {
            // Si hay productos relacionados, podríamos extraer formatos de ahí
            // pero por ahora no tenemos esa info
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
            extentLabel: pages ? pages + " pàgines" : "",
            isDigital,
            formatLabel,
            publisherName: editorial,
            imprintName: sello,
            displayPrice,
            priceAmount: numericPrice,
            isFree,
            iva,
            abstractText: resumen,
            coverLink: imagen ? `covers/${imagen}` : "",
            productIDAlternative: isDigital ? isbnImpreso : isbnDigital,
            normalizedTitle: titleText.toLowerCase().trim(),
            digitalFormats: digitalFormats,
            relatedProducts: productosRelacionados ? productosRelacionados.split("|") : []
        };
    }

    // ─── Fusión de libros duplicados (mismo ISBN) ──────────
    function mergeBooks(books) {
        const map = new Map();
        books.forEach(book => {
            const key = book.isbn;
            if (map.has(key)) {
                const existing = map.get(key);
                // Fusionar formatos digitales
                if (book.digitalFormats && book.digitalFormats.length > 0) {
                    existing.digitalFormats = [...new Set([...existing.digitalFormats, ...book.digitalFormats])];
                }
                // Si uno es digital y el otro no, mantener el digital
                if (book.isDigital && !existing.isDigital) {
                    existing.isDigital = true;
                    existing.formatLabel = "DIGITAL";
                }
                // Si uno tiene portada y el otro no, mantener la que tiene
                if (book.coverLink && !existing.coverLink) {
                    existing.coverLink = book.coverLink;
                }
                // Mantener el precio más bajo si hay diferencia (opcional)
                if (book.priceAmount > 0 && (existing.priceAmount === 0 || book.priceAmount < existing.priceAmount)) {
                    existing.priceAmount = book.priceAmount;
                    existing.displayPrice = book.displayPrice;
                    existing.isFree = book.isFree;
                }
            } else {
                map.set(key, { ...book });
            }
        });
        return Array.from(map.values());
    }

    // ─── Càrrega de coleccions (opcional) ────────────────────
    async function loadCollections(csvText) {
        const raw = parseCSVText(csvText);
        collectionsData = raw
            .map(row => ({
                titulo: row["titulo"] || "",
                intro: row["intro"] || ""
            }))
            .filter(c => c.titulo);
        console.log(`Col·leccions carregades: ${collectionsData.length}`);
        return collectionsData.length > 0;
    }

    async function fetchCollectionsCSV() {
        try {
            const resp = await fetch("data/collections.csv");
            if (resp.ok) {
                const text = await resp.text();
                const hasData = await loadCollections(text);
                collectionWrapper.style.display = hasData ? "block" : "none";
            } else {
                collectionWrapper.style.display = "none";
                console.log("collections.csv no trobat (no és crític)");
            }
        } catch (e) {
            collectionWrapper.style.display = "none";
            console.log("collections.csv no accessible (no és crític)");
        }
    }

    // ─── Poblar filtre de col·lecció ─────────────────────────
    function populateCollectionFilter() {
        const collections = new Set();
        allBooks.forEach(b => { if (b.collectionTitle) collections.add(b.collectionTitle); });
        const sorted = Array.from(collections).sort((a, b) => a.localeCompare(b, "ca"));
        collectionFilter.innerHTML = '<option value="all">Totes les col·leccions</option>';
        sorted.forEach(c => {
            const opt = document.createElement("option");
            opt.value = c;
            opt.textContent = c;
            collectionFilter.appendChild(opt);
        });
        if (sorted.length === 0) collectionWrapper.style.display = "none";
    }

    // ─── Càrrega del catàleg ─────────────────────────────────
    async function loadCatalog(csvText) {
        const raw = parseCSVText(csvText);
        let books = raw.map(transformBook).filter(b => b.titleText || b.isbn);
        // Fusionar duplicados por ISBN
        books = mergeBooks(books);
        allBooks = books;
        allBooks.sort((a, b) => b.sortDate - a.sortDate);
        populateCollectionFilter();
        console.log(`Total llibres: ${allBooks.length}`);
        if (allBooks.length > 0) console.log("Primer llibre:", allBooks[0]);
        applyInitialURLParams();
        applyFiltersAndReset();
    }

    // ─── URL params ──────────────────────────────────────────
    function getURLParams() {
        const params = new URLSearchParams(window.location.search);
        return {
            search: params.get("search") || "",
            sort: params.get("sort") || "date-desc",
            lang: params.get("lang") || "all",
            format: params.get("format") || "all",
            price: params.get("price") || "all",
            collection: params.get("collection") || "all"
        };
    }

    function updateURL() {
        const params = new URLSearchParams();
        const s = searchInput.value.trim();
        if (s) params.set("search", s);
        if (sortSelect.value !== "date-desc") params.set("sort", sortSelect.value);
        if (langFilter.value !== "all") params.set("lang", langFilter.value);
        if (formatFilter.value !== "all") params.set("format", formatFilter.value);
        if (priceFilter.value !== "all") params.set("price", priceFilter.value);
        if (collectionFilter.value !== "all") params.set("collection", collectionFilter.value);
        const qs = params.toString();
        history.replaceState(null, "", window.location.pathname + (qs ? "?" + qs : ""));
    }

    function applyInitialURLParams() {
        const p = getURLParams();
        if (p.search) searchInput.value = p.search;
        if (p.sort) sortSelect.value = p.sort;
        if (p.lang) langFilter.value = p.lang;
        if (p.format) formatFilter.value = p.format;
        if (p.price) priceFilter.value = p.price;
        if (p.collection && p.collection !== "all") {
            const exists = Array.from(collectionFilter.options).some(opt => opt.value === p.collection);
            if (!exists) {
                const opt = document.createElement("option");
                opt.value = p.collection;
                opt.textContent = p.collection;
                collectionFilter.appendChild(opt);
            }
            collectionFilter.value = p.collection;
        }
    }

    function updateCollectionIntro() {
        const selected = collectionFilter.value;
        if (selected && selected !== "all" && collectionsData.length > 0) {
            const found = collectionsData.find(c => c.titulo === selected);
            if (found && found.intro) {
                collectionIntro.innerHTML = found.intro;
                collectionIntro.classList.add("active");
                return;
            }
        }
        collectionIntro.innerHTML = "";
        collectionIntro.classList.remove("active");
    }

    function resetAllFilters() {
        searchInput.value = "";
        sortSelect.value = "date-desc";
        langFilter.value = "all";
        formatFilter.value = "all";
        priceFilter.value = "all";
        collectionFilter.value = "all";
        applyFiltersAndReset();
    }

    // ─── Aplicar filtres i renderitzar ──────────────────────
    function applyFiltersAndReset() {
        const searchTerm = searchInput.value.toLowerCase().trim();
        const langVal = langFilter.value;
        const formatVal = formatFilter.value;
        const priceVal = priceFilter.value;
        const collectionVal = collectionFilter.value;
        const sortVal = sortSelect.value;

        filteredBooks = allBooks.filter(book => {
            if (searchTerm) {
                const t = book.titleText.toLowerCase();
                const s = book.subtitle.toLowerCase();
                const a = book.authorDisplay.toLowerCase();
                const i = book.isbn;
                if (!t.includes(searchTerm) && !s.includes(searchTerm) &&
                    !a.includes(searchTerm) && !i.includes(searchTerm))
                    return false;
            }
            if (langVal !== "all" && book.languageCode !== langVal) return false;
            if (formatVal === "paper" && book.isDigital) return false;
            if (formatVal === "digital" && !book.isDigital) return false;
            if (priceVal === "diamond" && !book.isFree) return false;
            if (priceVal === "paid" && book.isFree) return false;
            if (collectionVal !== "all" && book.collectionTitle !== collectionVal) return false;
            return true;
        });

        // Ordenació
        switch (sortVal) {
            case "title-asc":
                filteredBooks.sort((a, b) => a.titleText.localeCompare(b.titleText, "ca"));
                break;
            case "title-desc":
                filteredBooks.sort((a, b) => b.titleText.localeCompare(a.titleText, "ca"));
                break;
            case "author-asc":
                filteredBooks.sort((a, b) => a.authorDisplay.localeCompare(b.authorDisplay, "ca"));
                break;
            case "author-desc":
                filteredBooks.sort((a, b) => b.authorDisplay.localeCompare(a.authorDisplay, "ca"));
                break;
            case "date-desc":
                filteredBooks.sort((a, b) => b.sortDate - a.sortDate);
                break;
            case "date-asc":
                filteredBooks.sort((a, b) => a.sortDate - b.sortDate);
                break;
            default:
                filteredBooks.sort((a, b) => b.sortDate - a.sortDate);
        }

        displayedCount = 0;
        document.querySelectorAll(".book-card").forEach(c => c.remove());
        noResults.style.display = "none";
        booksGrid.style.display = "grid";
        scrollSentinel.style.display = "block";
        loadingIndicator.classList.remove("active");

        const count = filteredBooks.length;
        resultsCount.textContent = count + " llibre" + (count !== 1 ? "s" : "");
        updateCollectionIntro();
        updateURL();

        if (count === 0) {
            booksGrid.style.display = "none";
            noResults.style.display = "block";
            scrollSentinel.style.display = "none";
        } else {
            loadMoreBooks();
        }
    }

    function loadMoreBooks() {
        if (displayedCount >= filteredBooks.length) {
            scrollSentinel.style.display = "none";
            loadingIndicator.classList.remove("active");
            return;
        }
        loadingIndicator.classList.add("active");
        const nextBatch = filteredBooks.slice(displayedCount, displayedCount + BOOKS_PER_PAGE);
        const fragment = document.createDocumentFragment();
        nextBatch.forEach(book => fragment.appendChild(createBookCard(book)));
        booksGrid.insertBefore(fragment, scrollSentinel);
        displayedCount += nextBatch.length;
        loadingIndicator.classList.remove("active");
        scrollSentinel.style.display = (displayedCount >= filteredBooks.length) ? "none" : "block";
    }

    function setupIntersectionObserver() {
        if (observer) observer.disconnect();
        observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting && displayedCount < filteredBooks.length) {
                    loadMoreBooks();
                }
            });
        }, { rootMargin: "200px" });
        if (scrollSentinel) observer.observe(scrollSentinel);
    }

    // ─── Crear targeta ──────────────────────────────────────
    function createBookCard(book) {
        const card = document.createElement("div");
        card.className = "book-card";
        card.setAttribute("data-isbn", book.isbn);
        card.addEventListener("click", () => openDetailModal(book));

        const coverWrapper = document.createElement("div");
        coverWrapper.className = "card-cover-wrapper";
        if (book.coverLink) {
            const img = document.createElement("img");
            img.src = book.coverLink;
            img.alt = book.titleText;
            img.loading = "lazy";
            img.onerror = function () {
                img.style.display = "none";
                const ph = document.createElement("div");
                ph.className = "card-cover-placeholder";
                ph.textContent = book.titleText.substring(0, 60);
                coverWrapper.appendChild(ph);
            };
            coverWrapper.appendChild(img);
        } else {
            const ph = document.createElement("div");
            ph.className = "card-cover-placeholder";
            ph.textContent = book.titleText.substring(0, 60);
            coverWrapper.appendChild(ph);
        }

        const badge = document.createElement("span");
        badge.className = "card-format-badge" + (book.isDigital ? " digital" : "");
        badge.textContent = book.formatLabel;
        coverWrapper.appendChild(badge);

        const cardBody = document.createElement("div");
        cardBody.className = "card-body";
        const titleEl = document.createElement("div");
        titleEl.className = "card-title";
        titleEl.textContent = book.titleText;
        const authorEl = document.createElement("div");
        authorEl.className = "card-author";
        authorEl.textContent = book.authorDisplay;
        const metaEl = document.createElement("div");
        metaEl.className = "card-meta";
        metaEl.innerHTML = `<span><span class="card-language-dot lang-${book.languageCode}"></span> ${book.languageLabel}</span>`;
        if (book.displayDate) metaEl.innerHTML += `<span>📅 ${book.displayDate}</span>`;
        if (book.extentLabel) metaEl.innerHTML += `<span>📄 ${book.extentLabel}</span>`;
        cardBody.appendChild(titleEl);
        cardBody.appendChild(authorEl);
        cardBody.appendChild(metaEl);

        const priceDiv = document.createElement("div");
        priceDiv.className = "card-price";
        const cleanIsbnValue = book.isbn.replace(/[^0-9]/g, "");
        const link = document.createElement("a");
        link.target = "_blank";
        if (book.isFree) {
            link.href = `https://doi.org/10.5565/lib/${cleanIsbnValue}`;
            link.textContent = "En obert";
            // Color del movimiento diamante (azul)
            link.style.backgroundColor = "rgb(56, 92, 169)";
            link.classList.add("btn-free");
        } else if (book.displayPrice) {
            link.href = `https://www.unebook.es/?isbn=${cleanIsbnValue}`;
            link.textContent = book.displayPrice;
        }
        priceDiv.appendChild(link);
        cardBody.appendChild(priceDiv);
        priceDiv.addEventListener("click", e => e.stopPropagation());

        card.appendChild(coverWrapper);
        card.appendChild(cardBody);
        return card;
    }

    // ─── Relacionats ──────────────────────────────────────────
    function getRelatedBooks(book) {
        const sameTitleBooks = allBooks.filter(b => b.normalizedTitle === book.normalizedTitle && b.isbn !== book.isbn);
        return {
            otherFormats: sameTitleBooks.filter(b => b.isDigital !== book.isDigital),
            translations: sameTitleBooks.filter(b => b.languageCode !== book.languageCode)
        };
    }

    function createRelatedLinksHTML(books, label) {
        if (!books.length) return "";
        let html = `<div class="detail-section"><h4>${label}</h4><div class="detail-row">`;
        books.forEach((b, i) => {
            html += `<span class="related-link" data-isbn="${b.isbn}">${b.titleText} (${b.languageLabel}, ${b.formatLabel})</span>`;
            if (i < books.length - 1) html += ", ";
        });
        html += `</div></div>`;
        return html;
    }

    function navigateToCollection(collectionTitle) {
        const exists = Array.from(collectionFilter.options).some(opt => opt.value === collectionTitle);
        if (!exists) {
            const opt = document.createElement("option");
            opt.value = collectionTitle;
            opt.textContent = collectionTitle;
            collectionFilter.appendChild(opt);
        }
        collectionFilter.value = collectionTitle;
        applyFiltersAndReset();
        controlsBar.scrollIntoView({ behavior: "smooth" });
    }

    function escapeHTML(str) { if (!str) return ""; const d = document.createElement("div"); d.textContent = str; return d.innerHTML; }

    function openDetailModal(book) {
        const cleanIsbnValue = book.isbn.replace(/[^0-9]/g, "");
        let coverHTML = book.coverLink ?
            `<img src="${escapeHTML(book.coverLink)}" alt="${escapeHTML(book.titleText)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"><div class="modal-cover-placeholder" style="display:none;">${escapeHTML(book.titleText.substring(0,80))}</div>` :
            `<div class="modal-cover-placeholder">${escapeHTML(book.titleText.substring(0,80))}</div>`;

        let priceHTML = "";
        if (book.isFree) {
            priceHTML = `<span class="detail-price-big"><a href="https://doi.org/10.5565/lib/${cleanIsbnValue}" target="_blank">En obert</a></span>`;
        } else if (book.displayPrice) {
            priceHTML = `<span class="detail-price-big"><a href="https://www.unebook.es/?isbn=${cleanIsbnValue}" target="_blank">${book.displayPrice}</a></span>${book.iva ? ` <span style="font-size:0.8rem;color:#888;">(IVA ${book.iva}%)</span>` : ""}`;
        }

        // Eliminado el botón "Accedir a Llibres en obert" (actionHTML ya no se genera)

        const related = getRelatedBooks(book);
        const otherFormatsHTML = createRelatedLinksHTML(related.otherFormats, "Altres formats disponibles");
        const translationsHTML = createRelatedLinksHTML(related.translations, "Traduccions");

        const collectionLinkHTML = book.collectionTitle ?
            `<div class="detail-section"><a class="collection-link" data-collection="${escapeHTML(book.collectionTitle)}">📚 Veure tots els llibres de «${escapeHTML(book.collectionTitle)}»</a></div>` :
            "";

        // Mostrar formatos digitales si hay más de uno
        let digitalFormatsHTML = "";
        if (book.digitalFormats && book.digitalFormats.length > 1) {
            digitalFormatsHTML = `<div class="detail-section"><h4>Formats digitals</h4><div class="detail-row"><span class="value">${book.digitalFormats.join(", ")}</span></div></div>`;
        }

        modalBody.innerHTML = `
        <div class="modal-cover-col">
            ${coverHTML}
            ${priceHTML ? '<div style="text-align:center;">' + priceHTML + '</div>' : ''}
            <div class="detail-tags">
                <span class="detail-tag highlight">${book.formatLabel}</span>
                <span class="detail-tag">${book.languageLabel}</span>
                ${book.isFree ? '<span class="detail-tag highlight">En obert</span>' : ''}
            </div>
        </div>
        <div class="modal-details-col">
            <h2>${escapeHTML(book.titleText)}</h2>
            ${book.subtitle ? `<div class="subtitle">${escapeHTML(book.subtitle)}</div>` : ''}
            <div class="detail-section">
                <h4>Informació general</h4>
                <div class="detail-row"><span class="label">Autor/s:</span><span class="value">${escapeHTML(book.authorDisplay)}</span></div>
                <div class="detail-row"><span class="label">ISBN:</span><span class="value">${escapeHTML(book.isbn)}</span></div>
                ${book.productIDAlternative ? `<div class="detail-row"><span class="label">ISBN alternatiu:</span><span class="value">${escapeHTML(book.productIDAlternative)}</span></div>` : ''}
                <div class="detail-row"><span class="label">Editorial:</span><span class="value">${escapeHTML(book.publisherName)}</span></div>
                ${book.imprintName ? `<div class="detail-row"><span class="label">Segell:</span><span class="value">${escapeHTML(book.imprintName)}</span></div>` : ''}
                <div class="detail-row"><span class="label">Data publicació:</span><span class="value">${book.displayDate || '—'}</span></div>
                <div class="detail-row"><span class="label">Idioma:</span><span class="value">${book.languageLabel}</span></div>
                <div class="detail-row"><span class="label">Format:</span><span class="value">${book.formatLabel}</span></div>
                ${book.extentLabel ? `<div class="detail-row"><span class="label">Extensió:</span><span class="value">${book.extentLabel}</span></div>` : ''}
                ${book.collectionTitle ? `<div class="detail-row"><span class="label">Col·lecció:</span><span class="value">${escapeHTML(book.collectionTitle)}${book.collectionNumber ? ' — Núm. ' + book.collectionNumber : ''}</span></div>` : ''}
            </div>
            ${digitalFormatsHTML}
            ${book.abstractText ? `<div class="detail-section"><h4>Descripció</h4><div class="detail-description">${escapeHTML(book.abstractText)}</div></div>` : ''}
            ${otherFormatsHTML}
            ${translationsHTML}
            ${collectionLinkHTML}
        </div>
        `;

        modalBody.querySelectorAll(".related-link").forEach(link => {
            link.addEventListener("click", (e) => {
                e.stopPropagation();
                const isbn = link.getAttribute("data-isbn");
                const relatedBook = allBooks.find(b => b.isbn === isbn);
                if (relatedBook) openDetailModal(relatedBook);
            });
        });

        const collectionLink = modalBody.querySelector(".collection-link");
        if (collectionLink) {
            collectionLink.addEventListener("click", (e) => {
                e.stopPropagation();
                const colTitle = collectionLink.getAttribute("data-collection");
                closeModal();
                navigateToCollection(colTitle);
            });
        }

        modalOverlay.classList.add("active");
        document.body.style.overflow = "hidden";
        document.getElementById("modalContent").scrollTop = 0;
    }

    function closeModal() {
        modalOverlay.classList.remove("active");
        document.body.style.overflow = "";
    }

    // ─── Event listeners ──────────────────────────────────────
    searchInput.addEventListener("input", applyFiltersAndReset);
    sortSelect.addEventListener("change", applyFiltersAndReset);
    langFilter.addEventListener("change", applyFiltersAndReset);
    formatFilter.addEventListener("change", applyFiltersAndReset);
    priceFilter.addEventListener("change", applyFiltersAndReset);
    collectionFilter.addEventListener("change", applyFiltersAndReset);
    resetButton.addEventListener("click", resetAllFilters);

    modalClose.addEventListener("click", closeModal);
    modalOverlay.addEventListener("click", function (e) {
        if (e.target === modalOverlay) closeModal();
    });
    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && modalOverlay.classList.contains("active")) closeModal();
    });

    csvFileInput.addEventListener("change", function (e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (ev) {
            fileFallback.classList.remove("active");
            loadCatalog(ev.target.result).then(() => {
                setupIntersectionObserver();
            });
        };
        reader.readAsText(file, "UTF-8");
    });

    // ─── Inicialització ──────────────────────────────────────
    async function init() {
        try {
            const response = await fetch("catalog.csv");
            if (!response.ok) throw new Error(`Error en carregar el fitxer: ${response.status} ${response.statusText}`);
            const csvText = await response.text();
            await fetchCollectionsCSV();
            await loadCatalog(csvText);
            setupIntersectionObserver();
        } catch (err) {
            console.error("Error carregant catalog.csv:", err);
            fileFallback.classList.add("active");
            await fetchCollectionsCSV();
            booksGrid.innerHTML =
                '<div class="error-message"><div class="icon">⚠️</div><p>No s\'ha pogut carregar automàticament el catàleg.</p><p style="font-size:0.9rem;">Selecciona el fitxer <strong>catalog.csv</strong> mitjançant el selector superior.</p></div>';
            booksGrid.style.display = "grid";
            noResults.style.display = "none";
            resultsCount.textContent = "";
        }
    }

    init();
})();
