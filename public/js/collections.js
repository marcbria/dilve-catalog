import { dom, state } from './config.js';
import { parseCSVText } from './csvParser.js';
import { t, getCurrentLang } from './i18n.js';
import { buildShareHTML, bindShareContainer } from './share.js';

// ─── Normalización de títulos de colección ───────────────
//
// DILVE puede emitir el mismo nombre de colección con variantes
// tipográficas (guion vs espacio, en-dash vs em-dash, ligaduras
// `Æ`/`AE`, diacríticos en NFC o NFD, espacios duros...). En el mismo
// catálogo coexisten, por ejemplo, "Aula Aegyptiaca-Studia" y
// "Aula Aegyptiaca Studia" para los mismos libros.
//
// `normalizeTitleKey` produce una clave común que ignora:
//   - mayúsculas / minúsculas
//   - diacríticos (é → e, à → a, …)
//   - ligaduras y caracteres especiales (Æ → ae, ß → ss)
//   - todo tipo de guiones, espacios y puntuación
//
// Ejemplos:
//   "Aula Aegyptiaca-Studia"   → "aulaaegyptiacastudia"
//   "Aula Aegyptiaca Studia"   → "aulaaegyptiacastudia"
//   "Aula Ægyptiaca-Studia"    → "aulaaegyptiacastudia"
export function normalizeTitleKey(s) {
    if (!s) return "";
    let out = String(s);
    out = out
        .replace(/Æ/g, "AE").replace(/æ/g, "ae")
        .replace(/Œ/g, "OE").replace(/œ/g, "oe")
        .replace(/ß/g, "ss");
    out = out.normalize("NFD").replace(/\p{Diacritic}/gu, "");
    out = out.replace(/[^A-Za-z0-9]/g, "");
    return out.toLowerCase();
}

// ─── Carga del CSV de colecciones ────────────────────────
//
// Esquema admitido:
//
//   titulo,titulo_ca,titulo_es,titulo_en,intro,intro_ca,intro_es,intro_en
//
//   - `titulo`        clave canónica. Empareja con el valor `coleccion`
//                     de ONIX (book.collectionTitle) usando una
//                     comparación normalizada. Nunca se traduce: es lo
//                     que viaja en ?collection= y en los filtros.
//   - `titulo_<lang>` variante a mostrar en ese idioma. Opcional. Si
//                     falta o está vacía, se usa `titulo`.
//   - `intro`         intro por defecto (fallback si el idioma activo no
//                     tiene la suya).
//   - `intro_<lang>`  intro en ese idioma. Opcional.

export async function loadCollections(csvText) {
    const raw = parseCSVText(csvText);
    if (raw.length === 0) {
        console.warn("No se encontraron datos en collections.csv");
        state.collectionsData = [];
        return false;
    }

    const firstRow = raw[0];
    const hasTitulo = 'titulo' in firstRow || 'Titulo' in firstRow;

    let collections;
    if (hasTitulo) {
        collections = raw.map(row => {
            const out = {};
            for (const [k, v] of Object.entries(row)) {
                out[k] = v;
            }
            if (!out.titulo && out.Titulo) out.titulo = out.Titulo;
            out._key = normalizeTitleKey(out.titulo);
            return out;
        });
    } else {
        console.warn("No se encontró la columna 'titulo'. Usando la primera columna como título y la segunda como intro.");
        collections = raw.map(row => {
            const keys = Object.keys(row);
            const titulo = keys.length > 0 ? row[keys[0]] : "";
            const intro = keys.length > 1 ? row[keys[1]] : "";
            return {
                titulo,
                intro,
                _key: normalizeTitleKey(titulo),
            };
        });
    }

    state.collectionsData = collections.filter(c => c.titulo && c.titulo.trim() !== "");
    console.log(`Colecciones cargadas: ${state.collectionsData.length}`);
    return state.collectionsData.length > 0;
}

export async function fetchCollectionsCSV() {
    try {
        const resp = await fetch("data/collections.csv");
        if (resp.ok) {
            const text = await resp.text();
            await loadCollections(text);
        } else {
            console.log("collections.csv no encontrado (no es crítico)");
            state.collectionsData = [];
        }
    } catch (e) {
        console.log("collections.csv no accesible (no es crítico)");
        state.collectionsData = [];
    }
}

// ─── Helpers de resolución multilengua ───────────────────

function findCollectionByCanonicalTitle(tituloOnix) {
    if (!tituloOnix) return null;
    const key = normalizeTitleKey(tituloOnix);
    if (!key) return null;
    return state.collectionsData.find(c => c._key === key) || null;
}

function getCollectionTitle(collection, lang) {
    if (!collection) return "";
    const translated = collection[`titulo_${lang}`];
    if (translated && translated.trim()) return translated.trim();
    return (collection.titulo || "").trim();
}

function getCollectionIntro(collection, lang) {
    if (!collection) return "";
    const translated = collection[`intro_${lang}`];
    if (translated && translated.trim()) return translated.trim();
    return (collection.intro || "").trim();
}

// ─── Filtro de colecciones ───────────────────────────────

export function populateCollectionFilter() {
    // Agrupa las variantes tipográficas del mismo nombre en una sola
    // entrada del desplegable, usando la clave normalizada.
    const groups = new Map(); // key → { variants:Set<string> }
    state.allBooks.forEach(b => {
        const title = b.collectionTitle;
        if (!title) return;
        const key = normalizeTitleKey(title);
        if (!key) return;
        if (!groups.has(key)) {
            groups.set(key, new Set([title]));
        } else {
            groups.get(key).add(title);
        }
    });

    const lang = getCurrentLang();
    const titled = Array.from(groups.entries()).map(([key, variants]) => {
        // Si la colección está en el CSV, usamos su `titulo` como
        // `value` (URL estable, coherente con el CSV). Si no, cogemos
        // la primera variante de ONIX encontrada.
        const entry = state.collectionsData.find(c => c._key === key);
        const canonical = entry ? entry.titulo : Array.from(variants)[0];
        const display = entry
            ? getCollectionTitle(entry, lang) || canonical
            : canonical;
        return { canonical, display };
    });

    titled.sort((a, b) => a.display.localeCompare(b.display, lang));

    dom.collectionFilter.innerHTML = `<option value="all">${t('filter_collection_all')}</option>`;
    titled.forEach(({ canonical, display }) => {
        const opt = document.createElement("option");
        opt.value = canonical;
        opt.textContent = display;
        dom.collectionFilter.appendChild(opt);
    });

    if (dom.collectionWrapper) {
        dom.collectionWrapper.style.display = titled.length > 0 ? "block" : "none";
    } else {
        console.warn("dom.collectionWrapper no encontrado en el DOM");
    }
}

// ─── Banner de introducción ──────────────────────────────

export function updateCollectionIntro() {
    const selected = dom.collectionFilter.value;

    if (selected && selected !== "all") {
        const found = findCollectionByCanonicalTitle(selected);
        if (found) {
            const lang = getCurrentLang();
            const displayTitle = getCollectionTitle(found, lang);
            const intro = getCollectionIntro(found, lang);

            if (intro) {
                const shareURL = window.location.href;
                const shareTitle = displayTitle || selected;
                const shareText = shareTitle;
                dom.collectionIntro.innerHTML = `
                    <h2>${escapeHTML(shareTitle)}</h2>
                    ${intro}
                    <div class="share-icons">
                        ${buildShareHTML({ url: shareURL, title: shareTitle, text: shareText })}
                    </div>
                `;
                dom.collectionIntro.classList.add("active");
                bindShareContainer(dom.collectionIntro.querySelector('.share-icons'), {
                    url: shareURL,
                    title: shareTitle,
                    text: shareText
                });
                return;
            }
        }
    }
    dom.collectionIntro.innerHTML = "";
    dom.collectionIntro.classList.remove("active");
}

function escapeHTML(str) {
    if (!str) return "";
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
}

export function navigateToCollection(collectionTitle) {
    const key = normalizeTitleKey(collectionTitle);
    const existing = Array.from(dom.collectionFilter.options)
        .find(opt => opt.value !== "all" && normalizeTitleKey(opt.value) === key);
    if (existing) {
        dom.collectionFilter.value = existing.value;
    } else {
        const opt = document.createElement("option");
        opt.value = collectionTitle;
        opt.textContent = collectionTitle;
        dom.collectionFilter.appendChild(opt);
        dom.collectionFilter.value = collectionTitle;
    }
    dom.collectionFilter.dispatchEvent(new Event('change'));
}
