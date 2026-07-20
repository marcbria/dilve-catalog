import { dom, state, BOOKS_PER_PAGE } from './config.js';
import { navigateToCollection } from './collections.js';
import { navigateToLanguage, navigateToFormat, navigateToAuthor, applyFiltersAndReset } from './filters.js';
import { escapeHTML, getCleanIsbn } from './utils.js';
import { updateURL } from './urlManager.js';

// ─── Crear tarjeta ──────────────────────────────────────
export function createBookCard(book) {
    const card = document.createElement("div");
    card.className = "book-card";
    card.setAttribute("data-isbn", book.isbn);
    card.addEventListener("click", () => openDetailModal(book));

    // Wrapper de la cubierta (contenedor de la imagen)
    const coverWrapper = document.createElement("div");
    coverWrapper.className = "card-cover-wrapper";
    if (book.coverLink) {
        const img = document.createElement("img");
        img.src = book.coverLink;
        img.alt = book.titleText || "Portada";
        img.loading = "lazy";
        img.onerror = function () {
            img.style.display = "none";
            const ph = document.createElement("div");
            ph.className = "card-cover-placeholder";
            ph.textContent = (book.titleText || "?").substring(0, 60);
            coverWrapper.appendChild(ph);
        };
        coverWrapper.appendChild(img);
    } else {
        const ph = document.createElement("div");
        ph.className = "card-cover-placeholder";
        ph.textContent = (book.titleText || "?").substring(0, 60);
        coverWrapper.appendChild(ph);
    }
    card.appendChild(coverWrapper);

    // Cuerpo de la tarjeta
    const cardBody = document.createElement("div");
    cardBody.className = "card-body";

    // Título
    const titleEl = document.createElement("div");
    titleEl.className = "card-title";
    titleEl.textContent = book.titleText || "Sin título";
    cardBody.appendChild(titleEl);

    // Autor
    const authorEl = document.createElement("div");
    authorEl.className = "card-author";
    authorEl.textContent = book.authorDisplay || "Autor desconocido";
    cardBody.appendChild(authorEl);

    // Meta (año - idioma)
    const metaEl = document.createElement("div");
    metaEl.className = "card-meta";
    if (book.year) {
        const yearSpan = document.createElement("span");
        yearSpan.textContent = book.year;
        metaEl.appendChild(yearSpan);
    }
    const langSpan = document.createElement("span");
    const dot = document.createElement("span");
    dot.className = `card-language-dot lang-${book.languageCode || 'other'}`;
    langSpan.appendChild(dot);
    langSpan.appendChild(document.createTextNode(` ${book.languageLabel || ''}`));
    metaEl.appendChild(langSpan);

    if (book.collectionNumber) {
        const numSpan = document.createElement("span");
        numSpan.textContent = `📚 ${book.collectionNumber}`;
        metaEl.appendChild(numSpan);
    }
    cardBody.appendChild(metaEl);

    // Contenedor para formato y precio en la misma línea
    const formatPriceContainer = document.createElement("div");
    formatPriceContainer.className = "card-format-price";

    // Pastilla de formato (Digital/Papel)
    const formatBadge = document.createElement("span");
    formatBadge.className = `card-format-badge ${book.isDigital ? 'digital' : 'paper'}`;
    formatBadge.textContent = book.isDigital ? 'Digital' : 'Papel';
    formatPriceContainer.appendChild(formatBadge);

    // Precio o "En obert"
    const priceEl = document.createElement("span");
    priceEl.className = `card-price-text ${book.isFree ? 'free' : ''}`;
    if (book.isFree) {
        priceEl.textContent = "En obert";
    } else if (book.priceAmount > 0) {
        const priceFormatted = book.priceAmount.toFixed(2).replace('.', ',') + ' €';
        priceEl.textContent = priceFormatted;
    }
    formatPriceContainer.appendChild(priceEl);

    cardBody.appendChild(formatPriceContainer);
    card.appendChild(cardBody);
    return card;
}

// ─── Carga de más libros (infinite scroll) ──────────
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
    console.log("openDetailModal called with book:", book);
    if (!book) {
        console.error("El libro es undefined o null");
        return;
    }

    if (!dom.modalBody) {
        console.error("No se encontró el elemento modalBody");
        return;
    }

    // Actualizar URL con el ISBN
    updateURL(book.isbn);

    try {
        const cleanIsbnValue = getCleanIsbn(book.isbn);
        const shareUrl = encodeURIComponent(window.location.href);
        const shareTitle = encodeURIComponent(book.titleText || "Libro");
        const shareText = encodeURIComponent(`📖 ${book.titleText} - ${book.authorDisplay || ''}`);

        // Construir la portada
        let coverHTML = '';
        if (book.coverLink) {
            coverHTML = `<img src="${escapeHTML(book.coverLink)}" alt="${escapeHTML(book.titleText || 'Portada')}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';this.nextElementSibling.classList.add('active');"><div class="modal-cover-placeholder">${escapeHTML((book.titleText || '?').substring(0,80))}</div>`;
        } else {
            coverHTML = `<div class="modal-cover-placeholder active">${escapeHTML((book.titleText || '?').substring(0,80))}</div>`;
        }

        let priceHTML = "";
        let actionHTML = "";
        if (book.isFree) {
            actionHTML = `<div class="detail-action"><a href="https://doi.org/10.5565/lib/${cleanIsbnValue}" target="_blank" class="btn-free">Accesible en abierto</a></div>`;
        } else if (book.priceAmount > 0) {
            const priceFormatted = book.priceAmount.toFixed(2).replace('.', ',') + ' €';
            priceHTML = `<span class="detail-price-big">${priceFormatted}</span><span class="iva-inclosit">(IVA incluido)</span>`;
            actionHTML = `<div class="detail-action"><a href="https://www.unebook.es/?isbn=${cleanIsbnValue}" target="_blank" class="btn-buy">Comprar en UNEBook</a></div>`;
        }

        const related = getRelatedBooks(book);
        const otherFormatsHTML = createRelatedFormatsHTML(related.otherFormats, "Otros formatos");
        const translationsHTML = createRelatedTranslationsHTML(related.translations, "Traducciones");

        const collectionLinkHTML = book.collectionTitle ?
            `<div class="detail-section"><button class="collection-link" data-collection="${escapeHTML(book.collectionTitle)}">Ver todos los libros de «${escapeHTML(book.collectionTitle)}»</button></div>` :
            "";

        // Botones de compartir en el modal (orden: email, Mastodon, Instagram, Bluesky, Copiar URL)
        // Ahora el botón de copiar usa la misma clase que los enlaces y tiene estilos CSS específicos
        const shareHTML = `
            <div class="detail-section share-section">
                <h4>Compartir</h4>
                <div class="share-icons">
                    <a href="mailto:?subject=${shareTitle}&body=${shareUrl}" target="_blank" rel="noopener" aria-label="Compartir por email">
                        <i class="fa-solid fa-envelope"></i>
                    </a>
                    <a href="https://mastodon.social/share?text=${shareText}%20${shareUrl}" target="_blank" rel="noopener" aria-label="Compartir en Mastodon">
                        <i class="fa-brands fa-mastodon"></i>
                    </a>
                    <a href="https://www.instagram.com/" target="_blank" rel="noopener" aria-label="Compartir en Instagram (copia el enlace)">
                        <i class="fa-brands fa-instagram"></i>
                    </a>
                    <a href="https://bsky.app/intent/compose?text=${shareText}%20${shareUrl}" target="_blank" rel="noopener" aria-label="Compartir en Bluesky">
                        <i class="fa-brands fa-bluesky"></i>
                    </a>
                    <button class="copy-url-btn" aria-label="Copiar URL" title="Copiar enlace al portapapeles">
                        <i class="fa-solid fa-link"></i>
                    </button>
                </div>
            </div>
        `;

        let digitalFormatsHTML = "";
        if (book.digitalFormats && book.digitalFormats.length > 1) {
            digitalFormatsHTML = `<div class="detail-section"><h4>Formatos digitales</h4><div class="detail-row"><span class="value">${book.digitalFormats.join(", ")}</span></div></div>`;
        }

        let collectionDisplay = "";
        if (book.collectionTitle) {
            collectionDisplay = escapeHTML(book.collectionTitle);
            if (book.collectionNumber) {
                collectionDisplay += ` — Núm. ${escapeHTML(book.collectionNumber)}`;
            }
        }

        const authorLinks = (book.authors || []).map(a => {
            return `<span class="modal-link" data-author="${escapeHTML(a)}">${escapeHTML(a)}</span>`;
        }).join(', ');

        const langDisplay = book.languageLabel || '';
        const langCode = book.languageCode || 'other';
        const formatDisplay = book.formatLabel || 'Papel';
        const isDigital = book.isDigital || false;

        let publisherDisplay = book.publisherName || '';
        if (publisherDisplay === "Servei de Publicacions de la Universitat Autònoma de Barcelona") {
            publisherDisplay = `<a href="https://publicacions.uab.cat" target="_blank" style="text-decoration:none;color:#007e11;">Servei de Publicacions de la UAB</a>`;
        }

        // Dimensiones (si existen)
        let dimensionsHTML = "";
        if (book.width && book.height) {
            dimensionsHTML = `<div class="detail-row"><span class="label">Formato:</span><span class="value">${book.width} x ${book.height} cm</span></div>`;
        }

        const modalHTML = `
        <div class="modal-cover-col">
            ${coverHTML}
            ${priceHTML ? `<div style="text-align:center; margin-top:4px;">${priceHTML}</div>` : ''}
            ${actionHTML}
            <div class="detail-tags">
                <span class="detail-tag ${isDigital ? 'digital' : 'paper'} modal-link" data-format="${formatDisplay}">${formatDisplay}</span>
                <span class="detail-tag lang-${langCode} modal-link" data-lang="${langCode}">${langDisplay}</span>
            </div>
        </div>
        <div class="modal-details-col">
            <h2>${escapeHTML(book.titleText || 'Sin título')}</h2>
            ${book.subtitle ? `<div class="subtitle">${escapeHTML(book.subtitle)}</div>` : ''}
            <div class="detail-section">
                <h4>Información general</h4>
                <div class="detail-row"><span class="label">Autor/es:</span><span class="value">${authorLinks || '—'}</span></div>
                <div class="detail-row"><span class="label">ISBN:</span><span class="value">${escapeHTML(book.isbn || '—')}</span></div>
                ${book.productIDAlternative ? `<div class="detail-row"><span class="label">ISBN alternativo:</span><span class="value">${escapeHTML(book.productIDAlternative)}</span></div>` : ''}
                <div class="detail-row"><span class="label">Editorial:</span><span class="value">${publisherDisplay || '—'}</span></div>
                <div class="detail-row"><span class="label">Publicación:</span><span class="value">${book.displayDate || '—'}</span></div>
                <div class="detail-row"><span class="label">Idioma:</span><span class="value"><span class="modal-link" data-lang="${langCode}">${escapeHTML(langDisplay)}</span></span></div>
                <div class="detail-row"><span class="label">Formato:</span><span class="value"><span class="modal-link" data-format="${formatDisplay}">${escapeHTML(formatDisplay)}</span></span></div>
                ${dimensionsHTML}
                ${book.extentLabel ? `<div class="detail-row"><span class="label">Extensión:</span><span class="value">${book.extentLabel}</span></div>` : ''}
                ${book.collectionTitle ? `<div class="detail-row"><span class="label">Colección:</span><span class="value"><span class="modal-link" data-collection="${escapeHTML(book.collectionTitle)}">${collectionDisplay}</span></span></div>` : ''}
            </div>
            ${digitalFormatsHTML}
            ${book.abstractText ? `<div class="detail-section"><h4>Descripción</h4><div class="detail-description">${escapeHTML(book.abstractText)}</div></div>` : ''}
            ${otherFormatsHTML}
            ${translationsHTML}
            ${shareHTML}
            ${collectionLinkHTML}
        </div>
        `;

        dom.modalBody.innerHTML = modalHTML;
        console.log("Modal HTML insertado correctamente");

        // Forzar estilos inline para el contenedor principal
        const modalContainer = document.querySelector('.catalog-modal');
        if (modalContainer) {
            modalContainer.style.display = 'block';
            modalContainer.style.maxWidth = '900px';
            modalContainer.style.width = '100%';
            modalContainer.style.maxHeight = '88vh';
            modalContainer.style.overflowY = 'auto';
            modalContainer.style.background = '#fff';
            modalContainer.style.boxShadow = '0 20px 48px rgba(0,0,0,0.2)';
        }

        // Ajustar display del body del modal
        const modalBodyEl = dom.modalBody;
        if (modalBodyEl) {
            modalBodyEl.style.display = 'flex';
            modalBodyEl.style.gap = '32px';
            modalBodyEl.style.padding = '24px 28px 32px';
            modalBodyEl.style.flexWrap = 'wrap';
        }

        // Asegurar tamaño de la columna de cubierta
        const coverCol = document.querySelector('.modal-cover-col');
        if (coverCol) {
            coverCol.style.flex = '0 0 260px';
            coverCol.style.display = 'flex';
            coverCol.style.flexDirection = 'column';
            coverCol.style.alignItems = 'center';
            coverCol.style.gap = '16px';
        }

        // Imagen de cubierta
        const coverImg = document.querySelector('.modal-cover-col img');
        if (coverImg) {
            coverImg.style.width = '100%';
            coverImg.style.height = 'auto';
            coverImg.style.maxHeight = '100%';
            coverImg.style.objectFit = 'contain';
        }

        // Asignar eventos para enlaces
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

        // Eventos para las etiquetas de formatos relacionados
        dom.modalBody.querySelectorAll('.related-format-tag').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const format = el.dataset.format;
                if (format) {
                    closeModal();
                    navigateToFormat(format);
                }
            });
        });

        // Eventos para las etiquetas de traducciones (idiomas)
        dom.modalBody.querySelectorAll('.related-lang-tag').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const lang = el.dataset.lang;
                if (lang) {
                    closeModal();
                    navigateToLanguage(lang);
                }
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

        // Evento para copiar URL
        const copyBtn = dom.modalBody.querySelector('.copy-url-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const url = window.location.href;
                navigator.clipboard.writeText(url).then(() => {
                    // Feedback visual: cambiar icono temporalmente
                    const icon = copyBtn.querySelector('i');
                    if (icon) {
                        icon.className = 'fa-solid fa-check';
                        setTimeout(() => {
                            icon.className = 'fa-solid fa-link';
                        }, 2000);
                    }
                }).catch(err => {
                    console.error('Error al copiar URL:', err);
                    // Fallback: seleccionar y copiar manualmente
                    const textArea = document.createElement('textarea');
                    textArea.value = url;
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                });
            });
        }

        dom.modalOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        const modalContent = document.getElementById('catalogModalContent');
        if (modalContent) modalContent.scrollTop = 0;
        console.log("Modal abierto correctamente");

    } catch (error) {
        console.error("Error al abrir el modal:", error);
        dom.modalBody.innerHTML = `<div class="error-message"><p>Error al cargar la información del libro.</p><p style="font-size:0.8rem;color:#888;">${error.message}</p></div>`;
        dom.modalOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

export function closeModal() {
    // Limpiar el ISBN de la URL al cerrar el modal
    const params = new URLSearchParams(window.location.search);
    params.delete('isbn');
    const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
    history.replaceState(null, '', newUrl);
    
    dom.modalOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

// ─── Relacionados ──────────────────────────────────────────
function getRelatedBooks(book) {
    const sameTitleBooks = state.allBooks.filter(b => 
        b.normalizedTitle && book.normalizedTitle && 
        b.normalizedTitle === book.normalizedTitle && 
        b.isbn !== book.isbn
    );
    return {
        otherFormats: sameTitleBooks.filter(b => b.isDigital !== book.isDigital),
        translations: sameTitleBooks.filter(b => b.languageCode !== book.languageCode)
    };
}

// Otros formatos: mostrar solo el formato con el color correspondiente
function createRelatedFormatsHTML(books, label) {
    if (!books || books.length === 0) return "";
    let html = `<div class="detail-section"><h4>${label}</h4><div class="related-formats">`;
    books.forEach((b) => {
        const isDigital = b.isDigital || false;
        const formatLabel = isDigital ? 'Digital' : 'Papel';
        const cssClass = isDigital ? 'digital' : 'paper';
        html += `<span class="related-format-tag ${cssClass}" data-format="${formatLabel}">${formatLabel}</span>`;
    });
    html += `</div></div>`;
    return html;
}

// Traducciones: mostrar solo el idioma con el color correspondiente
function createRelatedTranslationsHTML(books, label) {
    if (!books || books.length === 0) return "";
    let html = `<div class="detail-section"><h4>${label}</h4><div class="related-formats">`;
    books.forEach((b) => {
        const langCode = b.languageCode || 'other';
        const langLabel = b.languageLabel || 'Idioma';
        html += `<span class="related-format-tag lang-${langCode}" data-lang="${langCode}">${langLabel}</span>`;
    });
    html += `</div></div>`;
    return html;
}
