import { dom, state } from './config.js';
import { updateCollectionIntro, navigateToCollection, normalizeTitleKey } from './collections.js';
import { updateAuthorIntro } from './authors.js';
import { updateURL, getURLParams } from './urlManager.js';
import { loadMoreBooks, renderNoResults, resetPagination } from './uiRenderer.js';
import { t } from './i18n.js';

export function applyFiltersAndReset() {
    const searchTerm = dom.searchInput.value.toLowerCase().trim();
    const langVal = dom.langFilter.value;
    const formatVal = dom.formatFilter.value;
    const priceVal = dom.priceFilter.value;
    const collectionVal = dom.collectionFilter.value;
    const sortVal = dom.sortSelect.value;

    state.filteredBooks = state.allBooks.filter(book => {
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
        if (collectionVal !== "all" &&
            normalizeTitleKey(book.collectionTitle) !== normalizeTitleKey(collectionVal)) {
            return false;
        }
        if (state.themaFilter && book.themaCode !== state.themaFilter) return false;
        if (state.authorFilter) {
            const authorMatch = book.authors && book.authors.some(a => a === state.authorFilter);
            if (!authorMatch) return false;
        }
        return true;
    });

    // ─── Ordenación ─────────────────────────────────────
    //
    // Prioridad:
    //   1. Si hay colección seleccionada → número de colección
    //      inverso (más reciente primero).
    //   2. En cualquier caso → criterio del <select> de ordenación.
    //   3. Como ÚLTIMO desempate → papel antes que digital, para
    //      que dos formatos del mismo título salgan juntos y con el
    //      papel primero.
    //
    // El desempate 3 se aplica tras el 1 y el 2, así que solo entra
    // cuando dos libros empatan en número de colección (o no hay
    // colección) y empatan también en el criterio del <select>.
    const inCollection = collectionVal && collectionVal !== "all";

    const applySelectSort = (a, b) => {
        switch (sortVal) {
            case "title-asc":
                return a.titleText.localeCompare(b.titleText, "ca");
            case "title-desc":
                return b.titleText.localeCompare(a.titleText, "ca");
            case "author-asc":
                return a.authorDisplay.localeCompare(b.authorDisplay, "ca");
            case "author-desc":
                return b.authorDisplay.localeCompare(a.authorDisplay, "ca");
            case "date-desc":
                if (b.sortDate !== a.sortDate) return b.sortDate - a.sortDate;
                return (a.titleText || "").localeCompare(b.titleText || "", "ca");
            case "date-asc":
                return a.sortDate - b.sortDate;
            case "collection-num-desc":
                return compareCollectionNumber(b, a);
            case "collection-num-asc":
                return compareCollectionNumber(a, b);
            default:
                if (b.sortDate !== a.sortDate) return b.sortDate - a.sortDate;
                return (a.titleText || "").localeCompare(b.titleText || "", "ca");
        }
    };

    // Papel primero, digital después. Se aplica como desempate final
    // solo cuando los títulos normalizados coinciden: para títulos
    // distintos no fuerza nada, porque el orden lo decide el criterio
    // principal.
    const paperBeforeDigital = (a, b) => {
        if (a.normalizedTitle !== b.normalizedTitle) return 0;
        if (a.isDigital === b.isDigital) return 0;
        return a.isDigital ? 1 : -1;
    };

    if (inCollection) {
        state.filteredBooks.sort((a, b) => {
            const byNum = compareCollectionNumber(b, a);
            if (byNum !== 0) return byNum;
            const bySelect = applySelectSort(a, b);
            if (bySelect !== 0) return bySelect;
            return paperBeforeDigital(a, b);
        });
    } else {
        state.filteredBooks.sort((a, b) => {
            const bySelect = applySelectSort(a, b);
            if (bySelect !== 0) return bySelect;
            return paperBeforeDigital(a, b);
        });
    }

    resetPagination();
    updateURL();
    updateCollectionIntro();
    updateAuthorIntro();
    updateFilterActiveState();

    const count = state.filteredBooks.length;
    dom.resultsCount.textContent = count + " " + t('results_count');

    if (count === 0) {
        renderNoResults();
    } else {
        loadMoreBooks();
    }
}

function compareCollectionNumber(a, b) {
    const na = parseFloat(a.collectionNumber) || 0;
    const nb = parseFloat(b.collectionNumber) || 0;
    if (na !== nb) return na - nb;
    return 0;
}

function updateFilterActiveState() {
    if (dom.searchInput.value.trim()) {
        dom.searchInput.classList.add('filter-active');
    } else {
        dom.searchInput.classList.remove('filter-active');
    }
    const selects = [dom.langFilter, dom.formatFilter, dom.priceFilter, dom.collectionFilter];
    selects.forEach(select => {
        if (select.value !== 'all') {
            select.classList.add('filter-active');
        } else {
            select.classList.remove('filter-active');
        }
    });
}

export function resetAllFilters() {
    dom.searchInput.value = "";
    dom.sortSelect.value = "date-desc";
    dom.langFilter.value = "all";
    dom.formatFilter.value = "all";
    dom.priceFilter.value = "all";
    dom.collectionFilter.value = "all";
    state.themaFilter = null;
    state.authorFilter = null;
    applyFiltersAndReset();
}

export function navigateToLanguage(langCode) {
    dom.langFilter.value = langCode;
    state.themaFilter = null;
    state.authorFilter = null;
    applyFiltersAndReset();
    dom.controlsBar.scrollIntoView({ behavior: "smooth" });
}

export function navigateToFormat(formatLabel) {
    let formatValue;
    if (formatLabel === "paper" || formatLabel === "Paper" || formatLabel === "Papel") {
        formatValue = "paper";
    } else if (formatLabel === "digital" || formatLabel === "Digital") {
        formatValue = "digital";
    } else {
        return;
    }
    dom.formatFilter.value = formatValue;
    state.themaFilter = null;
    state.authorFilter = null;
    applyFiltersAndReset();
    dom.controlsBar.scrollIntoView({ behavior: "smooth" });
}

export function navigateToThema(themaCode) {
    state.themaFilter = themaCode;
    state.authorFilter = null;
    dom.searchInput.value = "";
    dom.langFilter.value = "all";
    dom.formatFilter.value = "all";
    dom.priceFilter.value = "all";
    dom.collectionFilter.value = "all";
    applyFiltersAndReset();
    dom.controlsBar.scrollIntoView({ behavior: "smooth" });
}

export function navigateToAuthor(authorName) {
    if (!authorName) return;
    state.authorFilter = authorName;
    state.themaFilter = null;
    dom.searchInput.value = "";
    dom.langFilter.value = "all";
    dom.formatFilter.value = "all";
    dom.priceFilter.value = "all";
    dom.collectionFilter.value = "all";
    updateURL();
    applyFiltersAndReset();
    dom.controlsBar.scrollIntoView({ behavior: 'smooth' });
}
