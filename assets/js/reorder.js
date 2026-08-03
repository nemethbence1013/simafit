// Sorrend átrendezése húzással, telefonon is.
//
// A HTML5 drag-and-drop érintőképernyőn nem működik, ezért pointer eseményekkel
// megy. Hosszú nyomásra indul, hogy a sima koppintás (profilválasztás) és a
// függőleges görgetés érintetlen maradjon: ha az ujj a várakozás alatt elmozdul,
// a húzás el sem kezdődik.

const HOLD_MS = 320;      // ennyi mozdulatlan nyomás után indul a húzás
const MOVE_TOLERANCE = 8; // px — ennél nagyobb elmozdulás görgetésnek számít

/**
 * @param {HTMLElement} list      a lista eleme
 * @param {(ids: string[]) => void} onCommit  az új sorrend elengedéskor
 *
 * A mozgatható elemek a lista közvetlen gyerekei, `data-id` attribútummal.
 * A `data-id` nélküli gyerekek (pl. a „+” csempe) helyben maradnak.
 */
export function enableReorder(list, onCommit) {
  let drag = null;

  list.addEventListener('pointerdown', (e) => {
    if (drag) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const item = e.target.closest('[data-id]');
    if (!item || item.parentElement !== list) return;

    const startX = e.clientX;
    const startY = e.clientY;

    const stopWatching = () => {
      clearTimeout(holdTimer);
      document.removeEventListener('pointermove', watch);
      document.removeEventListener('pointerup', stopWatching);
      document.removeEventListener('pointercancel', stopWatching);
    };
    const watch = (ev) => {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > MOVE_TOLERANCE) stopWatching();
    };
    const holdTimer = setTimeout(() => {
      stopWatching();
      begin(item, startX, startY);
    }, HOLD_MS);

    document.addEventListener('pointermove', watch);
    document.addEventListener('pointerup', stopWatching);
    document.addEventListener('pointercancel', stopWatching);
  });

  function begin(item, startX, startY) {
    const rect = item.getBoundingClientRect();

    // A húzott elem kikerül az elrendezésből, a helyét egy azonos méretű
    // helyőrző tartja — így a rács nem ugrik össze.
    const placeholder = document.createElement(item.tagName);
    placeholder.className = 'reorder-placeholder';
    placeholder.style.height = `${rect.height}px`;
    item.after(placeholder);

    item.classList.add('is-dragging');
    Object.assign(item.style, {
      position: 'fixed',
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      margin: '0',
      zIndex: '70',
      pointerEvents: 'none',
    });

    document.body.classList.add('is-reordering');
    navigator.vibrate?.(12);

    drag = { item, placeholder, dx: startX - rect.left, dy: startY - rect.top };

    document.addEventListener('pointermove', onMove, { passive: false });
    document.addEventListener('touchmove', blockScroll, { passive: false });
    document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', end);
  }

  function onMove(e) {
    e.preventDefault();
    drag.item.style.left = `${e.clientX - drag.dx}px`;
    drag.item.style.top = `${e.clientY - drag.dy}px`;

    for (const other of list.children) {
      if (other === drag.item || other === drag.placeholder || !other.hasAttribute('data-id')) continue;
      const r = other.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) continue;

      const placeholderIsAfter = other.compareDocumentPosition(drag.placeholder)
        & Node.DOCUMENT_POSITION_FOLLOWING;
      if (placeholderIsAfter) other.before(drag.placeholder);
      else other.after(drag.placeholder);
      break;
    }
  }

  function blockScroll(e) {
    e.preventDefault();
  }

  function end() {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('touchmove', blockScroll);
    document.removeEventListener('pointerup', end);
    document.removeEventListener('pointercancel', end);

    const { item, placeholder } = drag;
    drag = null;

    item.classList.remove('is-dragging');
    item.removeAttribute('style');
    placeholder.replaceWith(item);
    document.body.classList.remove('is-reordering');

    // Az elengedést követő kattintás ne válasszon profilt.
    const swallow = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
    document.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => document.removeEventListener('click', swallow, true), 350);

    onCommit([...list.querySelectorAll('[data-id]')].map((el) => el.dataset.id));
  }
}
