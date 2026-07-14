import { dom, state } from './config.js';
import { parseCSVText } from './csvParser.js';

// ─── Càrrega de coleccions (opcional) ────────────────────
export async function loadCollections(csvText) {
    const raw = parseCSVText(csvText);
    state.collectionsData = raw
        .map(row => ({
            titulo: row["titulo"] || "",
            intro: row["intro"] || ""
        }))
        .filter(c => c.titulo);
    console.log(`Col·leccions carregades: ${state.collectionsData.length}`);
    return state.collectionsData.length > 0;
}

export async function fetchCollectionsCSV() {
    try {
        // UNIFICADO: usamos "collections.csv" (con dos 'l')
        const resp = await fetch("data/collections.csv");
        if (resp.ok) {
            const text = await resp.text();
            const hasData = await loadCollections(text);
            dom.collectionWrapper.style.display = hasData ? "block" : "none";
        } else {
            dom.collectionWrapper.style.display = "none";
            console.log("collections.csv no trobat (no és crític)");
        }
    } catch (e) {
        dom.collectionWrapper.style.display = "none";
        console.log("collections.csv no accessible (no és crític)");
    }
}

// ─── Poblar filtre de col·lecció ─────────────────────────
export function populateCollectionFilter() {
    const collections = new Set();
    state.allBooks.forEach(b => { if (b.collectionTitle) collections.add(b.collectionTitle); });
    const sorted = Array.from(collections).sort((a, b) => a.localeCompare(b, "ca"));
    dom.collectionFilter.innerHTML = '<option value="all">Totes les col·leccions</option>';
    sorted.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c;
        opt.textContent = c;
        dom.collectionFilter.appendChild(opt);
    });
    if (sorted.length === 0) dom.collectionWrapper.style.display = "none";
}

// ─── Mostrar la intro de la colección seleccionada ───────
export function updateCollectionIntro() {
    const selected = dom.collectionFilter.value;
    if (selected && selected !== "all" && state.collectionsData.length > 0) {
        const found = state.collectionsData.find(c => c.titulo.toLowerCase() === selected.toLowerCase());
        if (found && found.intro) {
            dom.collectionIntro.innerHTML = found.intro;
            dom.collectionIntro.classList.add("active");
            return;
        }
    }
    dom.collectionIntro.innerHTML = "";
    dom.collectionIntro.classList.remove("active");
}

export function navigateToCollection(collectionTitle) {
    const exists = Array.from(dom.collectionFilter.options).some(opt => opt.value === collectionTitle);
    if (!exists) {
        const opt = document.createElement("option");
        opt.value = collectionTitle;
        opt.textContent = collectionTitle;
        dom.collectionFilter.appendChild(opt);
    }
    dom.collectionFilter.value = collectionTitle;
    dom.collectionFilter.dispatchEvent(new Event('change'));
}
