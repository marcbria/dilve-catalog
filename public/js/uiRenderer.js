import { dom, state, BOOKS_PER_PAGE } from './config.js';
import { navigateToCollection } from './collections.js';
import { navigateToLanguage, navigateToFormat, navigateToAuthor, applyFiltersAndReset } from './filters.js';
import { escapeHTML, getCleanIsbn } from './utils.js';

// ─── Crear targeta ──────────────────────────────────────
export function createBookCard(book) {
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
    if (book.year) metaEl.innerHTML += `<span>📅 ${book.year}</span>`;
    cardBody.appendChild(titleEl);
    cardBody.appendChild(authorEl);
    cardBody.appendChild(metaEl);

    const priceDiv = document.createElement("div");
    priceDiv.className = "card-price";
    const cleanIsbnValue = getCleanIsbn(book.isbn);
    const link = document.createElement("a");
    link.target = "_blank";
    if (book.isFree) {
        link.href = `https://doi.org/10.5565/lib/${cleanIsbnValue}`;
        link.textContent = "En obert";
        link.classList.add("btn-free");
    } else if (book.displayPrice) {
        link.href = `https://www.unebook.es/?isbn=${cleanIsbnValue}`;
        link.textContent = book.displayPrice;
        link.classList.add("btn-buy");
    }
    priceDiv.appendChild(link);
    cardBody.appendChild(priceDiv);
    priceDiv.addEventListener("click", e => e.stopPropagation());

    card.appendChild(coverWrapper);
    card.appendChild(cardBody);
    return card;
}

// ─── Càrrega de més llibres (infinite scroll) ──────────
export function loadMoreBooks() {
    if (state.displayedCount >= state.filteredBooks.length) {
        dom.scrollSentinel.style.display = "none";
        dom.loadingIndicator.classList.remove("active");
        return;
    }
    dom.loadingIndicator.classList.add("active");
    const nextBatch = state.filteredBooks.slice(state.displayedCount, state.displayedCount + BOOKS_PER_PAGE);
    const fragment = document.createDocumentFragment();
    nextBatch.forEach(book => fragment.appendChild(createBookCard(book)));
    dom.booksGrid.insertBefore(fragment, dom.scrollSentinel);
    state.displayedCount += nextBatch.length;
    dom.loadingIndicator.classList.remove("active");
    dom.scrollSentinel.style.display = (state.displayedCount >= state.filteredBooks.length) ? "none" : "block";
}

export function resetPagination() {
    state.displayedCount = 0;
    document.querySelectorAll(".book-card").forEach(c => c.remove());
    dom.noResults.style.display = "none";
    dom.booksGrid.style.display = "grid";
    dom.scrollSentinel.style.display = "block";
    dom.loadingIndicator.classList.remove("active");
}

export function renderNoResults() {
    dom.booksGrid.style.display = "none";
    dom.noResults.style.display = "block";
    dom.scrollSentinel.style.display = "none";
}

export function setupIntersectionObserver() {
    if (state.observer) state.observer.disconnect();
    state.observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting && state.displayedCount < state.filteredBooks.length) {
                loadMoreBooks();
            }
        });
    }, { rootMargin: "200px" });
    if (dom.scrollSentinel) state.observer.observe(dom.scrollSentinel);
}

// ─── Modal ──────────────────────────────────────────────
export function openDetailModal(book) {
    const cleanIsbnValue = getCleanIsbn(book.isbn);
    let coverHTML = book.coverLink ?
        `<img src="${escapeHTML(book.coverLink)}" alt="${escapeHTML(book.titleText)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"><div class="modal-cover-placeholder" style="display:none;">${escapeHTML(book.titleText.substring(0,80))}</div>` :
        `<div class="modal-cover-placeholder">${escapeHTML(book.titleText.substring(0,80))}</div>`;

    let priceHTML = "";
    if (book.isFree) {
        priceHTML = `<span class="detail-price-big"><a href="https://doi.org/10.5565/lib/${cleanIsbnValue}" target="_blank">En obert</a></span>`;
    } else if (book.displayPrice) {
        priceHTML = `<span class="detail-price-big"><a href="https://www.unebook.es/?isbn=${cleanIsbnValue}" target="_blank">${book.displayPrice}</a></span>${book.iva ? ` <span style="font-size:0.8rem;color:#888;">(IVA ${book.iva}%)</span>` : ""}`;
    }

    let actionHTML = "";
    if (book.isFree) {
        actionHTML = `<div class="detail-action"><a href="https://doi.org/10.5565/lib/${cleanIsbnValue}" target="_blank" class="btn-free">Llibres en obert</a></div>`;
    } else if (book.displayPrice) {
        actionHTML = `<div class="detail-action"><a href="https://www.unebook.es/?isbn=${cleanIsbnValue}" target="_blank" class="btn-buy">Comprar en UNEBook</a></div>`;
    }

    const related = getRelatedBooks(book);
    const otherFormatsHTML = createRelatedLinksHTML(related.otherFormats, "Altres formats disponibles");
    const translationsHTML = createRelatedLinksHTML(related.translations, "Traduccions");

    const collectionLinkHTML = book.collectionTitle ?
        `<div class="detail-section"><button class="collection-link" data-collection="${escapeHTML(book.collectionTitle)}">Veure tots els llibres de «${escapeHTML(book.collectionTitle)}»</button></div>` :
        "";

    let digitalFormatsHTML = "";
    if (book.digitalFormats && book.digitalFormats.length > 1) {
        digitalFormatsHTML = `<div class="detail-section"><h4>Formats digitals</h4><div class="detail-row"><span class="value">${book.digitalFormats.join(", ")}</span></div></div>`;
    }

    let collectionDisplay = "";
    if (book.collectionTitle) {
        collectionDisplay = escapeHTML(book.collectionTitle);
        if (book.collectionNumber) {
            collectionDisplay += ` — Núm. ${escapeHTML(book.collectionNumber)}`;
        }
    }

    const authorLinks = book.authors.map(a => {
        return `<span class="modal-link" data-author="${escapeHTML(a)}">${escapeHTML(a)}</span>`;
    }).join(', ');

    const langDisplay = book.languageLabel;
    const formatDisplay = book.formatLabel;

    dom.modalBody.innerHTML = `
    <div class="modal-cover-col">
        ${coverHTML}
        ${priceHTML ? '<div style="text-align:center;">' + priceHTML + '</div>' : ''}
        ${actionHTML}
        <div class="detail-tags">
            <span class="detail-tag highlight modal-link" data-format="${formatDisplay}">${formatDisplay}</span>
            <span class="detail-tag highlight modal-link" data-lang="${book.languageCode}">${langDisplay}</span>
        </div>
    </div>
    <div class="modal-details-col">
        <h2>${escapeHTML(book.titleText)}</h2>
        ${book.subtitle ? `<div class="subtitle">${escapeHTML(book.subtitle)}</div>` : ''}
        <div class="detail-section">
            <h4>Informació general</h4>
            <div class="detail-row"><span class="label">Autor/s:</span><span class="value">${authorLinks}</span></div>
            <div class="detail-row"><span class="label">ISBN:</span><span class="value">${escapeHTML(book.isbn)}</span></div>
            ${book.productIDAlternative ? `<div class="detail-row"><span class="label">ISBN alternatiu:</span><span class="value">${escapeHTML(book.productIDAlternative)}</span></div>` : ''}
            <div class="detail-row"><span class="label">Editorial:</span><span class="value">${escapeHTML(book.publisherName)}</span></div>
            <div class="detail-row"><span class="label">Data publicació:</span><span class="value">${book.displayDate || '—'}</span></div>
            <div class="detail-row"><span class="label">Idioma:</span><span class="value"><span class="modal-link" data-lang="${book.languageCode}">${escapeHTML(langDisplay)}</span></span></div>
            <div class="detail-row"><span class="label">Format:</span><span class="value"><span class="modal-link" data-format="${formatDisplay}">${escapeHTML(formatDisplay)}</span></span></div>
            ${book.extentLabel ? `<div class="detail-row"><span class="label">Extensió:</span><span class="value">${book.extentLabel}</span></div>` : ''}
            ${book.collectionTitle ? `<div class="detail-row"><span class="label">Col·lecció:</span><span class="value"><span class="modal-link" data-collection="${escapeHTML(book.collectionTitle)}">${collectionDisplay}</span></span></div>` : ''}
        </div>
        ${digitalFormatsHTML}
        ${book.abstractText ? `<div class="detail-section"><h4>Descripció</h4><div class="detail-description">${escapeHTML(book.abstractText)}</div></div>` : ''}
        ${otherFormatsHTML}
        ${translationsHTML}
        ${collectionLinkHTML}
    </div>
    `;

    // Asignar eventos a los enlaces del modal
    dom.modalBody.querySelectorAll('.modal-link[data-author]').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            closeModal();
            navigateToAuthor(el.dataset.author);
        });
    });
    dom.modalBody.querySelectorAll('.modal-link[data-lang]').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            closeModal();
            navigateToLanguage(el.dataset.lang);
        });
    });
    dom.modalBody.querySelectorAll('.modal-link[data-format]').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            closeModal();
            navigateToFormat(el.dataset.format);
        });
    });
    dom.modalBody.querySelectorAll('.modal-link[data-collection]').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            closeModal();
            navigateToCollection(el.dataset.collection);
        });
    });

    dom.modalBody.querySelectorAll('.related-button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isbn = btn.getAttribute('data-isbn');
            const relatedBook = state.allBooks.find(b => b.isbn === isbn);
            if (relatedBook) openDetailModal(relatedBook);
        });
    });

    const collectionLink = dom.modalBody.querySelector('.collection-link');
    if (collectionLink) {
        collectionLink.addEventListener('click', (e) => {
            e.stopPropagation();
            const colTitle = collectionLink.getAttribute('data-collection');
            closeModal();
            navigateToCollection(colTitle);
        });
    }

    dom.modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    document.getElementById('modalContent').scrollTop = 0;
}

export function closeModal() {
    dom.modalOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

// ─── Relacionats ──────────────────────────────────────────
function getRelatedBooks(book) {
    const sameTitleBooks = state.allBooks.filter(b => b.normalizedTitle === book.normalizedTitle && b.isbn !== book.isbn);
    return {
        otherFormats: sameTitleBooks.filter(b => b.isDigital !== book.isDigital),
        translations: sameTitleBooks.filter(b => b.languageCode !== book.languageCode)
    };
}

function createRelatedLinksHTML(books, label) {
    if (!books.length) return "";
    let html = `<div class="detail-section"><h4>${label}</h4><div class="detail-row" style="flex-wrap:wrap;">`;
    books.forEach((b, i) => {
        let text = "";
        if (b.titleText === books[0]?.titleText) {
            text = `${b.formatLabel} (${b.languageLabel})`;
        } else {
            text = `${b.titleText} (${b.formatLabel}, ${b.languageLabel})`;
        }
        html += `<button class="related-button" data-isbn="${b.isbn}">${text}</button>`;
    });
    html += `</div></div>`;
    return html;
}
