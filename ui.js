// Apró UI-építőelemek: alsó lap (bottom sheet), megerősítés, buborék-üzenet.

import { esc } from './util.js';

const sheetRoot = () => document.getElementById('sheet-root');
const toastRoot = () => document.getElementById('toast-root');

export function toast(message, kind = 'info') {
  const el = document.createElement('div');
  el.className = `toast toast--${kind}`;
  el.textContent = message;
  toastRoot().appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-in'));
  setTimeout(() => {
    el.classList.remove('is-in');
    setTimeout(() => el.remove(), 250);
  }, kind === 'error' ? 4500 : 2200);
}

/**
 * Alsó lapot nyit. Az `onMount` megkapja a lap elemét és a bezáró függvényt,
 * az `onClose` pedig minden bezáráskor lefut — így vissza lehet vonni azt,
 * amit a lap csak előnézetként állított be.
 */
export function openSheet({ title, body, onMount, onClose }) {
  closeSheet();

  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  backdrop.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="sheet__grip"></div>
      <div class="sheet__head">
        <h2 class="sheet__title">${esc(title)}</h2>
        <button class="icon-btn" data-close aria-label="Bezárás">✕</button>
      </div>
      <div class="sheet__body">${body}</div>
    </div>`;

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    backdrop.classList.remove('is-in');
    setTimeout(() => backdrop.remove(), 200);
    document.body.classList.remove('is-locked');
    if (onClose) onClose();
  };

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop || e.target.closest('[data-close]')) close();
  });
  document.addEventListener('keydown', function onEsc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); }
  });

  sheetRoot().appendChild(backdrop);
  document.body.classList.add('is-locked');
  requestAnimationFrame(() => backdrop.classList.add('is-in'));

  const sheet = backdrop.querySelector('.sheet');
  if (onMount) onMount(sheet, close);

  const firstField = sheet.querySelector('input, select, textarea');
  if (firstField) setTimeout(() => firstField.focus(), 120);

  return close;
}

export function closeSheet() {
  const root = sheetRoot();
  if (root) root.innerHTML = '';
  document.body.classList.remove('is-locked');
}

/** Megerősítő lap. Promise<boolean>-t ad vissza. */
export function confirmSheet({ title, message, confirmLabel = 'Törlés', danger = true }) {
  return new Promise((resolve) => {
    let answered = false;
    const close = openSheet({
      title,
      body: `
        <p class="sheet__text">${esc(message)}</p>
        <div class="sheet__actions">
          <button class="btn btn--ghost" data-no>Mégse</button>
          <button class="btn ${danger ? 'btn--danger' : 'btn--primary'}" data-yes>${esc(confirmLabel)}</button>
        </div>`,
      onMount(sheet, closeFn) {
        sheet.querySelector('[data-no]').addEventListener('click', () => {
          answered = true; resolve(false); closeFn();
        });
        sheet.querySelector('[data-yes]').addEventListener('click', () => {
          answered = true; resolve(true); closeFn();
        });
      },
    });
    // Ha háttérre koppintva zárják be, az „nem”-nek számít.
    const observer = new MutationObserver(() => {
      if (!document.querySelector('.sheet-backdrop') && !answered) {
        answered = true; resolve(false); observer.disconnect();
      }
    });
    observer.observe(sheetRoot(), { childList: true, subtree: true });
    void close;
  });
}

/** Teljes képernyős állapotüzenet (töltés / hiba / üres). */
export function stateBlock({ icon = '', title, text = '', actionLabel = null, actionId = null }) {
  return `
    <div class="state">
      ${icon ? `<div class="state__icon" aria-hidden="true">${icon}</div>` : ''}
      <h2 class="state__title">${esc(title)}</h2>
      ${text ? `<p class="state__text">${esc(text)}</p>` : ''}
      ${actionLabel ? `<button class="btn btn--primary" id="${esc(actionId)}">${esc(actionLabel)}</button>` : ''}
    </div>`;
}
