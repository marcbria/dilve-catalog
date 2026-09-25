/**
 * i18n - Internationalization module
 * Loads translation JSON files and provides t() function.
 */

const SUPPORTED_LANGS = ['es', 'ca', 'en'];
let currentLang = 'ca';
let translations = {};

/**
 * Load translations for a given language.
 */
export async function loadTranslations(lang) {
    try {
        const response = await fetch(`locales/${lang}.json`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        translations = await response.json();
        currentLang = lang;
        window.translations = translations;
        return translations;
    } catch (e) {
        console.error(`Failed to load translations for ${lang}:`, e);
        translations = {};
        return {};
    }
}

/**
 * Translate a key with optional parameter replacement.
 * @param {string} key - Translation key
 * @param {object} params - {placeholder: value}
 * @returns {string} Translated string
 */
export function t(key, params = {}) {
    let text = translations[key] || key;
    for (const [k, v] of Object.entries(params)) {
        text = text.replace(new RegExp(`{${k}}`, 'g'), v);
    }
    return text;
}

/**
 * Devuelve el código del idioma activo ('ca' | 'es' | 'en').
 * Se usa desde módulos que necesitan resolver contenido multilengua
 * fuera del diccionario de UI (p. ej. collections.js).
 */
export function getCurrentLang() {
    return currentLang;
}

/**
 * Detect the best matching language from URL, localStorage, or browser.
 */
export function detectLanguage() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlLang = urlParams.get('lang');
    if (urlLang && SUPPORTED_LANGS.includes(urlLang)) {
        return urlLang;
    }

    const stored = localStorage.getItem('lang');
    if (stored && SUPPORTED_LANGS.includes(stored)) {
        return stored;
    }

    const browserLangs = navigator.languages || [navigator.language];
    for (const lang of browserLangs) {
        const base = lang.split('-')[0];
        if (SUPPORTED_LANGS.includes(base)) {
            return base;
        }
    }

    return 'ca';
}

/**
 * Set the active language, store in localStorage, and reload with ?lang=.
 *
 * Conserva la URL actual (path, query y hash) y solo cambia el parámetro
 * `lang`. Así, cambiar de idioma desde una ficha de libro mantiene el
 * `#isbn=...` y desde una colección mantiene el `?collection=...`.
 */
export function setLanguage(lang) {
    if (!SUPPORTED_LANGS.includes(lang)) return;
    localStorage.setItem('lang', lang);
    const url = new URL(window.location.href);
    url.searchParams.set('lang', lang);
    window.location.href = url.toString();
}

/**
 * Apply translations to all elements with data-i18n attributes.
 * Also updates document title and handles placeholder/attributes.
 */
export function applyTranslations() {
    document.title = t('app_title');

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const paramsAttr = el.getAttribute('data-i18n-params');
        let params = {};
        if (paramsAttr) {
            try {
                params = JSON.parse(paramsAttr);
            } catch (e) {
                console.warn('Invalid data-i18n-params', paramsAttr);
            }
        }
        el.innerHTML = t(key, params);
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = t(key);
    });

    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        el.title = t(key);
    });
}

/**
 * Marca el idioma activo en el selector de la prenavigation del tema UAB.
 * El <span class="prenav-lang-item"> correspondiente recibe la clase
 * `.active`, que el CSS del tema pinta en verde.
 */
function markActiveLanguage(lang) {
    document.querySelectorAll('.prenav-lang-item').forEach(el => {
        if (el.dataset.lang === lang) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    });
}

/**
 * Intercepta el click en los enlaces del selector de idioma para que la
 * navegación conserve la URL actual (path, query y hash). Sin este
 * listener, los `href` estáticos del header (UAB) apuntan a la home y
 * descartan la página en la que estaba el usuario.
 *
 * Acepta dos patrones habituales:
 *   - `data-lang` en el propio <a>     → footer del tema default
 *   - `data-lang` en un ancestro <span> → header del tema UAB
 *
 * El `href` original se mantiene como respaldo para navegadores sin JS,
 * y el listener se registra una sola vez por enlace.
 */
export function bindLanguageLinks() {
    document.querySelectorAll('[data-lang]').forEach(el => {
        const lang = el.dataset.lang;
        if (!lang) return;
        const link = el.tagName === 'A' ? el : el.querySelector('a');
        if (!link) return;
        if (link.dataset.langBound === '1') return;
        link.dataset.langBound = '1';
        link.addEventListener('click', (e) => {
            e.preventDefault();
            setLanguage(lang);
        });
    });
}

/**
 * Initialize i18n: detect language, load translations, apply to DOM.
 * Ensures the URL lang parameter is valid and overwrites if invalid.
 */
export async function initI18n() {
    const lang = detectLanguage();
    currentLang = lang;
    const url = new URL(window.location.href);
    const currentLangParam = url.searchParams.get('lang');
    if (!currentLangParam || !SUPPORTED_LANGS.includes(currentLangParam)) {
        url.searchParams.set('lang', lang);
        window.history.replaceState(null, '', url.toString());
    }
    await loadTranslations(lang);
    applyTranslations();
    markActiveLanguage(lang);
    bindLanguageLinks();
    document.dispatchEvent(new CustomEvent('i18n:ready', { detail: { lang } }));
}

window.t = t;
window.i18n = { t, setLanguage, detectLanguage, initI18n, getCurrentLang };
