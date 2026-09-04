// ─── DOM refs ────────────────────────────────────────────
export const dom = {};

export function initDom() {
    dom.booksGrid = document.getElementById("booksGrid");
    dom.noResults = document.getElementById("noResults");
    dom.resultsCount = document.getElementById("resultsCount");
    dom.searchInput = document.getElementById("searchInput");
    dom.sortSelect = document.getElementById("sortSelect");
    dom.langFilter = document.getElementById("langFilter");
    dom.formatFilter = document.getElementById("formatFilter");
    dom.priceFilter = document.getElementById("priceFilter");
    dom.collectionFilter = document.getElementById("collectionFilter");
    dom.collectionWrapper = document.getElementById("collectionFilterWrapper");
    dom.resetButton = document.getElementById("resetFilters");
    dom.modalOverlay = document.getElementById("catalogModalOverlay");
    dom.modalBody = document.getElementById("catalogModalBody");
    dom.modalClose = document.getElementById("catalogModalClose");
    dom.scrollSentinel = document.getElementById("scrollSentinel");
    dom.loadingIndicator = document.getElementById("loadingIndicator");
    dom.collectionIntro = document.getElementById("collectionIntro");
    dom.authorIntro = document.getElementById("authorIntro");
    dom.fileFallback = document.getElementById("fileFallback");
    dom.csvFileInput = document.getElementById("csvFileInput");
    dom.controlsBar = document.getElementById("controlsBar");
}

export const BOOKS_PER_PAGE = 12;

export const state = {
    allBooks: [],
    filteredBooks: [],
    collectionsData: [],
    authorBioMap: {},
    authorFilter: null,
    displayedCount: 0,
    observer: null,
    themaFilter: null,
};
