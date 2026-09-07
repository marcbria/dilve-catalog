import { dom, state } from './config.js';
import { updateCollectionIntro, navigateToCollection } from './collections.js';
import { updateAuthorIntro } from './authors.js';
import { updateURL, getURLParams } from './urlManager.js';
import { loadMoreBooks, renderNoResults, resetPagination } from './uiRenderer.js';

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
        if (collectionVal !== "all" && book.collectionTitle !== collectionVal) return false;
        if (state.themaFilter && book.themaCode !== state.themaFilter) return false;
        if (state.authorFilter) {
            const authorMatch = book.authors && book.authors.some(a => a === state.authorFilter);
            if (!authorMatch) return false;
        }
        return true;
    });

    console.log(`Filtrados ${state.filteredBooks.length} libros. Ordenando por: ${sortVal}`);

    switch (sortVal) {
        case "title-asc":
            state.filteredBooks.sort((a, b) => a.titleText.localeCompare(b.titleText, "ca"));
            break;
        case "title-desc":
            state.filteredBooks.sort((a, b) => b.titleText.localeCompare(a.titleText, "ca"));
            break;
        case "author-asc":
            state.filteredBooks.sort((a, b) => a.authorDisplay.localeCompare(b.authorDisplay, "ca"));
            break;
        case "author-desc":
            state.filteredBooks.sort((a, b) => b.authorDisplay.localeCompare(a.authorDisplay, "ca"));
            break;
        case "date-desc":
            state.filteredBooks.sort((a, b) => b.sortDate - a.sortDate);
            break;
        case "date-asc":
            state.filteredBooks.sort((a, b) => a.sortDate - b.sortDate);
            break;
        default:
            state.filteredBooks.sort((a, b) => b.sortDate - a.sortDate);
    }

    resetPagination();
    updateCollectionIntro();
    updateAuthorIntro();
    updateURL();
    updateFilterActiveState();

    const count = state.filteredBooks.length;
    dom.resultsCount.textContent = count + " llibre" + (count !== 1 ? "s" : "");

    if (count === 0) {
        renderNoResults();
    } else {
        loadMoreBooks();
    }
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
    applyFiltersAndReset();
    dom.controlsBar.scrollIntoView({ behavior: "smooth" });
}

export function navigateToFormat(formatLabel) {
    let value = null;
    const lower = formatLabel.toLowerCase();
    if (lower === "paper" || lower === "papel") {
        value = "paper";
    } else if (lower === "digital") {
        value = "digital";
    } else {
        return;
    }
    dom.formatFilter.value = value;
    applyFiltersAndReset();
    dom.controlsBar.scrollIntoView({ behavior: "smooth" });
}

export function navigateToThema(themaCode) {
    state.themaFilter = themaCode;
    applyFiltersAndReset();
    dom.controlsBar.scrollIntoView({ behavior: "smooth" });
}

export function navigateToAuthor(authorName) {
    if (!authorName) return;
    state.authorFilter = authorName;
    applyFiltersAndReset();
    dom.controlsBar.scrollIntoView({ behavior: 'smooth' });
}
