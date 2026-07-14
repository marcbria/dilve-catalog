import { dom, state, BOOKS_PER_PAGE } from './config.js';
import { parseCSVText } from './csvParser.js';
import { transformBook, mergeBooks } from './bookTransformer.js';
import { fetchCollectionsCSV, populateCollectionFilter, updateCollectionIntro, navigateToCollection } from './collections.js';
import { applyFiltersAndReset, resetAllFilters, navigateToLanguage, navigateToFormat, navigateToAuthor } from './filters.js';
import { loadMoreBooks, setupIntersectionObserver, closeModal, openDetailModal } from './uiRenderer.js';
import { applyInitialURLParams, updateURL } from './urlManager.js';

async function loadCatalog(csvText) {
    const raw = parseCSVText(csvText);
    let books = raw.map(transformBook).filter(b => b.titleText || b.isbn);
    books = mergeBooks(books);
    state.allBooks = books;
    state.allBooks.sort((a, b) => b.sortDate - a.sortDate);
    populateCollectionFilter();
    console.log(`Total llibres: ${state.allBooks.length}`);
    if (state.allBooks.length > 0) console.log("Primer llibre:", state.allBooks[0]);
    applyInitialURLParams();
    applyFiltersAndReset();
}

dom.searchInput.addEventListener('input', applyFiltersAndReset);
dom.sortSelect.addEventListener('change', applyFiltersAndReset);
dom.langFilter.addEventListener('change', applyFiltersAndReset);
dom.formatFilter.addEventListener('change', applyFiltersAndReset);
dom.priceFilter.addEventListener('change', applyFiltersAndReset);
dom.collectionFilter.addEventListener('change', applyFiltersAndReset);
dom.resetButton.addEventListener('click', resetAllFilters);

dom.modalClose.addEventListener('click', closeModal);
dom.modalOverlay.addEventListener('click', function (e) {
    if (e.target === dom.modalOverlay) closeModal();
});
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dom.modalOverlay.classList.contains('active')) closeModal();
});

dom.csvFileInput.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (ev) {
        dom.fileFallback.classList.remove('active');
        loadCatalog(ev.target.result).then(() => {
            setupIntersectionObserver();
        });
    };
    reader.readAsText(file, 'UTF-8');
});

document.getElementById('hamburgerBtn').addEventListener('click', function() {
    document.getElementById('filterGroup').classList.toggle('open');
});

async function init() {
    try {
        const response = await fetch('data/catalog.csv');
        if (!response.ok) throw new Error(`Error en carregar el fitxer: ${response.status} ${response.statusText}`);
        const csvText = await response.text();
        await fetchCollectionsCSV();
        await loadCatalog(csvText);
        setupIntersectionObserver();
    } catch (err) {
        console.error('Error carregant catalog.csv:', err);
        dom.fileFallback.classList.add('active');
        await fetchCollectionsCSV();
        dom.booksGrid.innerHTML =
            '<div class="error-message"><div class="icon">⚠️</div><p>No s\'ha pogut carregar automàticament el catàleg.</p><p style="font-size:0.9rem;">Selecciona el fitxer <strong>catalog.csv</strong> mitjançant el selector superior.</p></div>';
        dom.booksGrid.style.display = 'grid';
        dom.noResults.style.display = 'none';
        dom.resultsCount.textContent = '';
    }
}

init();
