import { dom, state } from './config.js';
import { parseCSVText } from './csvParser.js';

// ─── Carga de colecciones (opcional) ────────────────────
export async function loadCollections(csvText) {
    const raw = parseCSVText(csvText);
    state.collectionsData = raw
        .map(row => ({
            titulo: row["titulo"] || "",
            intro: row["intro"] || ""
        }))
        .filter(c => c.titulo);
    console.log(`Colecciones cargadas: ${state.collectionsData.length}`);
    return state.collectionsData.length > 0;
}

export async function fetchCollectionsCSV() {
    try {
        const resp = await fetch("data/collections.csv");
        if (resp.ok) {
            const text = await resp.text();
            const hasData = await loadCollections(text);
            dom.collectionWrapper.style.display = hasData ? "block" : "none";
        } else {
            dom.collectionWrapper.style.display = "none";
            console.log("collections.csv no encontrado (no es crítico)");
        }
    } catch (e) {
        dom.collectionWrapper.style.display = "none";
        console.log("collections.csv no accesible (no es crítico)");
    }
}

// ─── Poblar filtro de colección ─────────────────────────
export function populateCollectionFilter() {
    const collections = new Set();
    state.allBooks.forEach(b => { if (b.collectionTitle) collections.add(b.collectionTitle); });
    const sorted = Array.from(collections).sort((a, b) => a.localeCompare(b, "es"));
    dom.collectionFilter.innerHTML = '<option value="all">Todas las colecciones</option>';
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
    const shareUrl = encodeURIComponent(window.location.href);
    const shareTitle = encodeURIComponent(document.title);

    if (selected && selected !== "all" && state.collectionsData.length > 0) {
        const found = state.collectionsData.find(c => 
            c.titulo.toLowerCase() === selected.toLowerCase()
        );
        if (found && found.intro) {
            dom.collectionIntro.innerHTML = `
                <h2>${escapeHTML(found.titulo)}</h2>
                ${found.intro}
                <div class="share-icons">
                    <a href="mailto:?subject=${shareTitle}&body=${shareUrl}" target="_blank" rel="noopener" aria-label="Compartir por email">
                        <i class="fa-solid fa-envelope"></i>
                    </a>
                    <a href="https://mastodon.social/share?text=${shareTitle}%20${shareUrl}" target="_blank" rel="noopener" aria-label="Compartir en Mastodon">
                        <i class="fa-brands fa-mastodon"></i>
                    </a>
                    <a href="https://www.instagram.com/" target="_blank" rel="noopener" aria-label="Compartir en Instagram (copia el enlace)">
                        <i class="fa-brands fa-instagram"></i>
                    </a>
                    <a href="https://bsky.app/intent/compose?text=${shareTitle}%20${shareUrl}" target="_blank" rel="noopener" aria-label="Compartir en Bluesky">
                        <i class="fa-brands fa-bluesky"></i>
                    </a>
                </div>
            `;
            dom.collectionIntro.classList.add("active");
            return;
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
