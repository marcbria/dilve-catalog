import { dom } from './config.js';

export function getURLParams() {
    // Leer parámetros de la query string y del hash (para compatibilidad)
    const params = new URLSearchParams(window.location.search);
    // Si no hay query, leer del hash
    if (params.toString() === '') {
        const hash = window.location.hash;
        if (hash.startsWith('#isbn=')) {
            const isbn = hash.substring(6);
            params.set('isbn', isbn);
        }
    }
    return {
        search: params.get("search") || "",
        sort: params.get("sort") || "date-desc",
        lang: params.get("lang") || "all",
        format: params.get("format") || "all",
        price: params.get("price") || "all",
        collection: params.get("collection") || "all",
        isbn: params.get("isbn") || ""
    };
}

export function updateURL(isbn = null) {
    const url = new URL(window.location.href);
    const currentHash = window.location.hash;

    // Gestionar el hash de forma inteligente
    if (isbn) {
        // Si se proporciona ISBN, establecer el hash
        url.hash = `isbn=${isbn}`;
    } else {
        // Si no se proporciona ISBN, conservar el hash si contiene un ISBN
        if (currentHash.startsWith('#isbn=')) {
            url.hash = currentHash;  // mantener el hash existente
        } else {
            url.hash = '';  // eliminar hash si no es ISBN
        }
    }

    // Construir la query string con los filtros (sin ISBN)
    const params = new URLSearchParams();
    const s = dom.searchInput.value.trim();
    if (s) params.set("search", s);
    if (dom.sortSelect.value !== "date-desc") params.set("sort", dom.sortSelect.value);
    if (dom.langFilter.value !== "all") params.set("lang", dom.langFilter.value);
    if (dom.formatFilter.value !== "all") params.set("format", dom.formatFilter.value);
    if (dom.priceFilter.value !== "all") params.set("price", dom.priceFilter.value);
    if (dom.collectionFilter.value !== "all") params.set("collection", dom.collectionFilter.value);
    
    url.search = params.toString();
    
    history.replaceState(null, '', url.toString());
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
