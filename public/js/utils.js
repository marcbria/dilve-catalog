// ─── Utilitats generals ──────────────────────────────────
export function escapeHTML(str) {
    if (!str) return "";
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
}

export function getCleanIsbn(isbn) {
    return isbn ? isbn.replace(/[^0-9]/g, "") : "";
}
