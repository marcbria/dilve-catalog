import { dom } from './config.js';
import { applyFiltersAndReset } from './filters.js';

// ─── URL params ──────────────────────────────────────────
export function getURLParams() {
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

export function updateURL() {
    const params = new URLSearchParams();
    const s = dom.searchInput.value.trim();
    if (s) params.set("search", s);
    if (dom.sortSelect.value !== "date-desc") params.set("sort", dom.sortSelect.value);
    if (dom.langFilter.value !== "all") params.set("lang", dom.langFilter.value);
    if (dom.formatFilter.value !== "all") params.set("format", dom.formatFilter.value);
    if (dom.priceFilter.value !== "all") params.set("price", dom.priceFilter.value);
    if (dom.collectionFilter.value !== "all") params.set("collection", dom.collectionFilter.value);
    const qs = params.toString();
    history.replaceState(null, "", window.location.pathname + (qs ? "?" + qs : ""));
}

export function applyInitialURLParams() {
    const p = getURLParams();
    if (p.search) dom.searchInput.value = p.search;
    if (p.sort) dom.sortSelect.value = p.sort;
    if (p.lang) dom.langFilter.value = p.lang;
    if (p.format) dom.formatFilter.value = p.format;
    if (p.price) dom.priceFilter.value = p.price;
    if (p.collection && p.collection !== "all") {
        const exists = Array.from(dom.collectionFilter.options).some(opt => opt.value === p.collection);
        if (!exists) {
            const opt = document.createElement("option");
            opt.value = p.collection;
            opt.textContent = p.collection;
            dom.collectionFilter.appendChild(opt);
        }
        dom.collectionFilter.value = p.collection;
    }
}
