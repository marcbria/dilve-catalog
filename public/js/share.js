// public/js/share.js
// Utilidades para construir y vincular los iconos de compartir.
// Se usan desde el modal de detalle, el banner de colecciones y el de autores.
//
// Orden de iconos: Mail, Instagram, Bluesky, Mastodon, Copy.
// La URL activa se envía siempre que la red lo permita (mail/Mastodon/Bluesky
// vía parámetros del enlace; Instagram vía portapapeles porque no admite
// post prellenado por URL).

import { t } from './i18n.js';

/**
 * Copia un texto al portapapeles con fallback para navegadores antiguos.
 * @param {string} text
 * @returns {Promise<void>}
 */
export function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text);
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* noop */ }
    document.body.removeChild(ta);
    return Promise.resolve();
}

/**
 * Muestra un aviso breve en la parte inferior de la pantalla.
 * Reutiliza el mismo elemento si ya existe.
 * @param {string} msg
 * @param {number} duration
 */
export function showToast(msg, duration = 2500) {
    let toast = document.getElementById('shareToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'shareToast';
        toast.className = 'share-toast';
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    void toast.offsetWidth;
    toast.classList.add('visible');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('visible'), duration);
}

/**
 * Devuelve el HTML de los iconos de compartir.
 *
 * @param {{url:string, title:string, text:string}} opts
 * @returns {string}
 */
export function buildShareHTML({ url, title, text }) {
    const eUrl = encodeURIComponent(url);
    const eTitle = encodeURIComponent(title);
    const eText = encodeURIComponent(text);
    return `
        <a href="mailto:?subject=${eTitle}&body=${eText}%0A%0A${eUrl}" data-share="email" aria-label="Mail">
            <i class="fa-solid fa-envelope"></i>
        </a>
        <a href="#" data-share="instagram" aria-label="Instagram">
            <i class="fa-brands fa-instagram"></i>
        </a>
        <a href="https://bsky.app/intent/compose?text=${eText}%20${eUrl}" data-share="bluesky" target="_blank" rel="noopener" aria-label="Bluesky">
            <i class="fa-brands fa-bluesky"></i>
        </a>
        <a href="https://mastodon.social/share?text=${eText}%20${eUrl}" data-share="mastodon" target="_blank" rel="noopener" aria-label="Mastodon">
            <i class="fa-brands fa-mastodon"></i>
        </a>
        <button type="button" class="copy-url-btn" data-share="copy" aria-label="Copy link" title="Copy link to clipboard">
            <i class="fa-solid fa-link"></i>
        </button>
    `;
}

/**
 * Vincula los handlers de click a los iconos de compartir dentro de un contenedor.
 * @param {HTMLElement|null} container
 * @param {{url:string, title:string, text:string}} opts
 */
export function bindShareContainer(container, { url, title, text }) {
    if (!container) return;
    container.querySelectorAll('[data-share]').forEach(el => {
        el.addEventListener('click', (e) => {
            const net = el.dataset.share;
            if (net === 'instagram') {
                // Instagram no permite prellenar el post vía URL:
                // copiamos la URL activa y abrimos el sitio para que el
                // usuario la pegue.
                e.preventDefault();
                e.stopPropagation();
                copyToClipboard(url).then(() => {
                    showToast(t('share_url_copied'));
                    window.open('https://www.instagram.com/', '_blank', 'noopener');
                });
            } else if (net === 'copy') {
                e.preventDefault();
                e.stopPropagation();
                copyToClipboard(url).then(() => {
                    const icon = el.querySelector('i');
                    if (icon) {
                        const prev = icon.className;
                        icon.className = 'fa-solid fa-check';
                        setTimeout(() => { icon.className = prev; }, 2000);
                    }
                    showToast(t('share_url_copied'));
                });
            }
            // mail, mastodon, bluesky: el href ya incluye la URL activa
            // y el navegador sigue el enlace normalmente.
        });
    });
}
