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
        // Comparación normalizada: variantes tipográficas del mismo
        // nombre de colección (con/sin guion, con/sin diacríticos)
        // cuentan como la misma colección.
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
    // Regla general: manda el <select> de ordenación.
    //
    // Regla especial: si hay una colección seleccionada, se aplica
    // primero el criterio del <select> y, como criterio secundario,
    // el número de colección en orden inverso (más reciente primero).
    // Así, dentro de una colección, las obras quedan ordenadas por
    // su número, que es lo que el usuario espera al filtrar por
    // colección, sin perder el orden principal elegido.
    const inCollection = collectionVal && collectionVal !== "all";

    const applyPrimarySort = (a, b) => {
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
                return compareCollectionNumber(b, a); // inverso: más reciente primero
            case "collection-num-asc":
                return compareCollectionNumber(a, b);
            default:
                if (b.sortDate !== a.sortDate) return b.sortDate - a.sortDate;
                return (a.titleText || "").localeCompare(b.titleText || "", "ca");
        }
    };

    if (inCollection) {
        // Dentro de una colección: criterio principal del <select>,
        // criterio secundario por número de colección inverso.
        state.filteredBooks.sort((a, b) => {
            const primary = applyPrimarySort(a, b);
            if (primary !== 0) return primary;
            return compareCollectionNumber(b, a); // inverso: número alto primero
        });
    } else {
        // Fuera de una colección: solo criterio del <select>.
        state.filteredBooks.sort(applyPrimarySort);
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

// Compara dos libros por su número de colección. Los valores no
// numéricos o ausentes se tratan como 0 (van al final en el orden
// inverso, que es lo deseable: los "sin número" no son "los más
// recientes"). Si ambos tienen el mismo número, se desempata por
// título para que el orden sea estable.
function compareCollectionNumber(a, b) {
    const na = parseFloat(a.collectionNumber) || 0;
    const nb = parseFloat(b.collectionNumber) || 0;
    if (na !== nb) return na - nb;
    return (a.titleText || "").localeCompare(b.titleText || "", "ca");
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
