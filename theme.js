// Világos / sötét mód. Három állapot: rendszer → világos → sötét → rendszer.
//
// A tényleges témát mindig JS állítja be a <html data-theme="…"> attribútumon,
// hogy a kézi választás felül tudja írni a rendszerbeállítást. Az index.html
// fejlécében egy pici szkript ugyanezt megteszi még az első kirajzolás előtt,
// így nem villan fel a rossz téma.

const KEY = 'fit.theme';
const MODES = ['auto', 'light', 'dark'];

const LABELS = {
  auto: 'Rendszer szerint',
  light: 'Világos',
  dark: 'Sötét',
};

// Vonalas ikonok — az emoji-változatok telefononként másképp néznek ki.
const svg = (inner) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

const ICONS = {
  auto: svg(`<circle cx="12" cy="12" r="8"/>
    <path d="M12 4a8 8 0 0 0 0 16z" fill="currentColor" stroke="none"/>`),
  light: svg(`<circle cx="12" cy="12" r="4.2"/>
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4"/>`),
  dark: svg('<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5z"/>'),
};

const media = window.matchMedia('(prefers-color-scheme: dark)');

export function getTheme() {
  const saved = localStorage.getItem(KEY);
  return MODES.includes(saved) ? saved : 'auto';
}

export function resolvedTheme() {
  const mode = getTheme();
  if (mode === 'auto') return media.matches ? 'dark' : 'light';
  return mode;
}

export function applyTheme() {
  const dark = resolvedTheme() === 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';

  // A telefon állapotsora is kövesse a témát.
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = dark ? '#0d0d0d' : '#f9f9f7';
}

export function setTheme(mode) {
  if (!MODES.includes(mode)) return;
  localStorage.setItem(KEY, mode);
  applyTheme();
}

/** A következő állapotra vált, és visszaadja azt. */
export function cycleTheme() {
  const next = MODES[(MODES.indexOf(getTheme()) + 1) % MODES.length];
  setTheme(next);
  return next;
}

export function themeGlyph() {
  return ICONS[getTheme()];
}

export function themeLabel() {
  return LABELS[getTheme()];
}

/** A téma-váltó gomb HTML-je. */
export function themeButton() {
  return `<button class="icon-btn theme-btn" id="theme-btn"
            title="Megjelenés: ${themeLabel()}"
            aria-label="Megjelenés: ${themeLabel()} — koppints a váltáshoz">${themeGlyph()}</button>`;
}

/** A gomb bekötése. A `onChange` a téma váltása után fut le. */
export function wireThemeButton(root, onChange) {
  const btn = root.querySelector('#theme-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    cycleTheme();
    btn.innerHTML = themeGlyph();
    btn.title = `Megjelenés: ${themeLabel()}`;
    btn.setAttribute('aria-label', `Megjelenés: ${themeLabel()} — koppints a váltáshoz`);
    if (onChange) onChange();
  });
}

// Rendszer szerinti módban kövesse, ha a telefon átvált.
media.addEventListener('change', () => {
  if (getTheme() === 'auto') applyTheme();
});

applyTheme();
