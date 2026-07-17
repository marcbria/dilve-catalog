// ─── DOM refs ────────────────────────────────────────────
export const dom = {
    booksGrid: document.getElementById("booksGrid"),
    noResults: document.getElementById("noResults"),
    resultsCount: document.getElementById("resultsCount"),
    searchInput: document.getElementById("searchInput"),
    sortSelect: document.getElementById("sortSelect"),
    langFilter: document.getElementById("langFilter"),
    formatFilter: document.getElementById("formatFilter"),
    priceFilter: document.getElementById("priceFilter"),
    collectionFilter: document.getElementById("collectionFilter"),
    collectionWrapper: document.getElementById("collectionFilterWrapper"),
    resetButton: document.getElementById("resetFilters"),
    modalOverlay: document.getElementById("catalogModalOverlay"),
    modalBody: document.getElementById("catalogModalBody"),
    modalClose: document.getElementById("catalogModalClose"),
    scrollSentinel: document.getElementById("scrollSentinel"),
    loadingIndicator: document.getElementById("loadingIndicator"),
    collectionIntro: document.getElementById("collectionIntro"),
    fileFallback: document.getElementById("fileFallback"),
    csvFileInput: document.getElementById("csvFileInput"),
    controlsBar: document.getElementById("controlsBar"),
};

export const BOOKS_PER_PAGE = 12;

// Estado global (compartido entre módulos)
export const state = {
    allBooks: [],
    filteredBooks: [],
    collectionsData: [],
    displayedCount: 0,
    observer: null,
};
