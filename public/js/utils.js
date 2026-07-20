export function escapeHTML(str) {
    if (!str) return "";
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
}

export function getCleanIsbn(isbn) {
    return isbn ? isbn.replace(/[^0-9]/g, "") : "";
}

export function getIsbnFromHash() {
    const hash = window.location.hash;
    if (hash.startsWith('#isbn=')) {
        return hash.substring(6);
    }
    return null;
}

export function getIsbnFromQuery() {
    const params = new URLSearchParams(window.location.search);
    return params.get('isbn');
}
