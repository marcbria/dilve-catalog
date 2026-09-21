import { dom, state } from './config.js';
import { parseCSVText } from './csvParser.js';
import { t, getCurrentLang } from './i18n.js';
import { buildShareHTML, bindShareContainer } from './share.js';

// ─── Carga del CSV de colecciones ────────────────────────
//
// Esquema admitido:
//
//   titulo,titulo_ca,titulo_es,titulo_en,intro,intro_ca,intro_es,intro_en
//
//   - `titulo`        clave canónica. Coincide EXACTAMENTE con el valor
//                     `coleccion` de ONIX (book.collectionTitle). Nunca
//                     se traduce: es lo que usa ?collection=, los filtros
//                     y el emparejamiento libro→fila.
//   - `titulo_<lang>` variante a mostrar en ese idioma. Opcional. Si
//                     falta o está vacía, se usa `titulo`.
//   - `intro`         intro por defecto (fallback si el idioma activo no
//                     tiene la suya).
//   - `intro_<lang>`  intro en ese idioma. Opcional.
//
// Columnas ausentes en el CSV: se accede a ellas como `undefined`, lo que
// el fallback resuelve sin errores. Los CSV monolingües antiguos
// (`titulo,intro`) siguen funcionando porque las variantes por idioma
// caen a los valores por defecto.

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
        // Formato estándar (monolingüe o multilengua). Se preservan
        // TODAS las columnas para que las variantes por idioma lleguen
        // al frontend.
        collections = raw.map(row => {
            const out = {};
            for (const [k, v] of Object.entries(row)) {
                out[k] = v;
            }
            // Normalizar la clave canónica a minúsculas
            if (!out.titulo && out.Titulo) out.titulo = out.Titulo;
            return out;
        });
    } else {
        // Compatibilidad con CSVs antiguos sin cabecera 'titulo': se
        // asume que la primera columna es el título y la segunda la
        // intro. En este modo no se soportan traducciones.
        console.warn("No se encontró la columna 'titulo'. Usando la primera columna como título y la segunda como intro.");
        collections = raw.map(row => {
            const keys = Object.keys(row);
            return {
                titulo: keys.length > 0 ? row[keys[0]] : "",
                intro: keys.length > 1 ? row[keys[1]] : "",
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

/**
 * Busca la fila de colecciones cuya clave canónica (`titulo`) coincide
 * con el título ONIX dado. Comparación case-insensitive y sin espacios
 * extremos, para tolerar diferencias de formato en el CSV.
 */
function findCollectionByCanonicalTitle(tituloOnix) {
    if (!tituloOnix) return null;
    const target = tituloOnix.trim().toLowerCase();
    return state.collectionsData.find(c =>
        (c.titulo || "").trim().toLowerCase() === target
    ) || null;
}

/**
 * Devuelve el título a mostrar para una fila de colección y un idioma.
 * Cadena de fallback: `titulo_<lang>` → `titulo`.
 */
function getCollectionTitle(collection, lang) {
    if (!collection) return "";
    const translated = collection[`titulo_${lang}`];
    if (translated && translated.trim()) return translated.trim();
    return (collection.titulo || "").trim();
}

/**
 * Devuelve la intro a mostrar para una fila de colección y un idioma.
 * Cadena de fallback: `intro_<lang>` → `intro` → "".
 * No cae a otros idiomas: mostrar contenido en el idioma equivocado es
 * peor que no mostrarlo.
 */
function getCollectionIntro(collection, lang) {
    if (!collection) return "";
    const translated = collection[`intro_${lang}`];
    if (translated && translated.trim()) return translated.trim();
    return (collection.intro || "").trim();
}

// ─── Filtro de colecciones ───────────────────────────────

export function populateCollectionFilter() {
    // 1. Recoger los títulos canónicos que aparecen en los libros
    const canonical = new Set();
    state.allBooks.forEach(b => {
        if (b.collectionTitle) canonical.add(b.collectionTitle);
    });

    // 2. Mapear cada título canónico a su título a mostrar en el idioma activo
    const lang = getCurrentLang();
    const titled = Array.from(canonical).map(tituloOnix => {
        const entry = findCollectionByCanonicalTitle(tituloOnix);
        const display = entry
            ? getCollectionTitle(entry, lang) || tituloOnix
            : tituloOnix;
        return { canonical: tituloOnix, display };
    });

    // 3. Ordenar por el título a mostrar, en el idioma activo
    titled.sort((a, b) => a.display.localeCompare(b.display, lang));

    // 4. Poblar el <select>: `value` = título canónico (estable, el que
    //    viaja en la URL), `textContent` = título traducido.
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

            // Solo mostramos el banner si hay intro que mostrar. El
            // título traducido por sí solo no justifica el banner (el
            // propio desplegable ya lo muestra).
            if (intro) {
                const shareURL = window.location.href;
                const shareTitle = displayTitle || selected;
                const shareText = `📚 ${shareTitle}`;
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
