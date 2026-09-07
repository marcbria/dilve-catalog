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
 * Detect the best matching language from URL, localStorage, or browser.
 */
export function detectLanguage() {
    // 1. URL parameter ?lang=
    const urlParams = new URLSearchParams(window.location.search);
    const urlLang = urlParams.get('lang');
    if (urlLang && SUPPORTED_LANGS.includes(urlLang)) {
        return urlLang;
    }

    // 2. localStorage
    const stored = localStorage.getItem('lang');
    if (stored && SUPPORTED_LANGS.includes(stored)) {
        return stored;
    }

    // 3. navigator.languages
    const browserLangs = navigator.languages || [navigator.language];
    for (const lang of browserLangs) {
        const base = lang.split('-')[0];
        if (SUPPORTED_LANGS.includes(base)) {
            return base;
        }
    }

    // 4. default: Catalan
    return 'ca';
}

/**
 * Set the active language, store in localStorage, and reload with ?lang=.
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
 * Initialize i18n: detect language, load translations, apply to DOM.
 */
export async function initI18n() {
    const lang = detectLanguage();
    currentLang = lang;
    const url = new URL(window.location.href);
    if (!url.searchParams.has('lang')) {
        url.searchParams.set('lang', lang);
        window.history.replaceState(null, '', url.toString());
    }
    await loadTranslations(lang);
    applyTranslations();
    document.dispatchEvent(new CustomEvent('i18n:ready', { detail: { lang } }));
}

window.t = t;
window.i18n = { t, setLanguage, detectLanguage, initI18n };
