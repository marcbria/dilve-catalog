import { dom, state } from './config.js';

function escapeHTML(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

// Construye un mapa { nombreAutor: bio } usando la bio del libro más reciente
export function buildAuthorBioMap(books) {
    const map = new Map();
    books.forEach(book => {
        const authors = book.authors || [];
        const sortDate = book.sortDate || 0;
        const notas = [
            book.nota_biografica_autor1 || '',
            book.nota_biografica_autor2 || '',
            book.nota_biografica_autor3 || ''
        ];
        authors.forEach((author, idx) => {
            if (!author) return;
            const bio = notas[idx] || '';
            if (!bio.trim()) return;
            if (map.has(author)) {
                const existing = map.get(author);
                if (sortDate > existing.sortDate) {
                    map.set(author, { bio, sortDate });
                }
            } else {
                map.set(author, { bio, sortDate });
            }
        });
    });
    const result = {};
    map.forEach((value, key) => {
        result[key] = value.bio;
    });
    return result;
}

// Actualiza el banner con la biografía del autor seleccionado
export function updateAuthorIntro() {
    const author = state.authorFilter;
    const bio = author && state.authorBioMap[author] ? state.authorBioMap[author] : null;
    if (bio) {
        dom.authorIntro.innerHTML = `
            <h2>${escapeHTML(author)}</h2>
            <p>${escapeHTML(bio)}</p>
        `;
        dom.authorIntro.classList.add('active');
        dom.authorIntro.style.display = 'block';
    } else {
        dom.authorIntro.innerHTML = '';
        dom.authorIntro.classList.remove('active');
        dom.authorIntro.style.display = 'none';
    }
}

// Función para limpiar el filtro de autor (se puede usar desde reset)
export function resetAuthorFilter() {
    state.authorFilter = null;
    updateAuthorIntro();
}
