// Előrehaladás-gyűrű (radiális mérő).
//
// Egyetlen arányt mutat egy célhoz képest, ezért mérő és nem tortadiagram:
// a sáv és a kitöltés ugyanannak a kék skálának két lépcsője (szekvenciális
// színhasználat — a szín a nagyságot kódolja, az azonosságot a név viszi).
// A vékony szürke jel a gyűrűn azt mutatja, hol tartunk a hónapban időarányosan.

const TAU = Math.PI * 2;

function polar(cx, cy, r, fraction) {
  const angle = fraction * TAU - Math.PI / 2; // 12 óra pozícióból indul
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
}

/**
 * @param {number} percent  0–100
 * @param {object} opts
 * @param {number} opts.size      px
 * @param {number} opts.stroke    a gyűrű vastagsága px-ben
 * @param {number|null} opts.elapsed  0–1, az időarányos jelölő helye (null = nincs)
 * @param {string} opts.label     a gyűrű közepén megjelenő fő szám
 * @param {string} opts.sub       a fő szám alatti kisebb sor
 * @returns {string} HTML
 */
export function progressRing(percent, {
  size = 104,
  stroke = 9,
  elapsed = null,
  label = null,
  sub = null,
} = {}) {
  const cx = 50;
  const cy = 50;
  const r = 50 - (stroke * 50 / size) - 1;
  const circumference = TAU * r;
  const frac = Math.max(0, Math.min(1, percent / 100));
  const dash = circumference * frac;
  const sw = stroke * 100 / size;

  let marker = '';
  if (elapsed !== null && elapsed > 0.001 && elapsed < 0.999) {
    const [x1, y1] = polar(cx, cy, r - sw / 2 - 1.5, elapsed);
    const [x2, y2] = polar(cx, cy, r + sw / 2 + 1.5, elapsed);
    marker = `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}"
        class="ring__marker" stroke-width="1.6" stroke-linecap="round" />`;
  }

  // 0%-nál a lekerekített végződés egy pöttyöt hagyna a gyűrű tetején — ilyenkor
  // egyáltalán nem rajzolunk kitöltést.
  const fill = frac <= 0 ? '' : `
        <circle class="ring__fill" cx="${cx}" cy="${cy}" r="${r.toFixed(2)}"
                fill="none" stroke-width="${sw.toFixed(2)}" stroke-linecap="round"
                stroke-dasharray="${dash.toFixed(2)} ${(circumference - dash).toFixed(2)}"
                transform="rotate(-90 ${cx} ${cy})" />`;

  const text = label === null ? '' : `
    <div class="ring__center">
      <span class="ring__value">${label}</span>
      ${sub ? `<span class="ring__sub">${sub}</span>` : ''}
    </div>`;

  return `
    <div class="ring" style="--ring-size:${size}px">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle class="ring__track" cx="${cx}" cy="${cy}" r="${r.toFixed(2)}"
                fill="none" stroke-width="${sw.toFixed(2)}" />
        ${fill}
        ${marker}
      </svg>
      ${text}
    </div>`;
}
