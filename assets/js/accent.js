// A felület alapszíne. Minden profilhoz tartozik egy választott szín, ami a
// `people.color` oszlopban él, tehát bármelyik telefonon ugyanaz.
//
// A tényleges árnyalatot a CSS párosítja: minden színhez tartozik egy világos
// és egy sötét lépcső, meg egy hozzá olvasható felirat-szín. Itt csak a kulcs
// utazik ('violet', 'blue', …). A localStorage másolat azért kell, hogy az
// oldal betöltésekor azonnal a jó szín látszódjon, még az adatok megérkezése
// előtt — ugyanezt teszi az index.html fejlécében lévő pici szkript is.

const KEY = 'fit.accent';
const FALLBACK = 'violet';

export const ACCENTS = [
  { key: 'violet', label: 'Lila' },
  { key: 'blue', label: 'Kék' },
  { key: 'teal', label: 'Zöld' },
  { key: 'orange', label: 'Narancs' },
];

function valid(key) {
  return ACCENTS.some((a) => a.key === key) ? key : null;
}

export function getAccent() {
  return valid(localStorage.getItem(KEY)) || FALLBACK;
}

export function applyAccent(key) {
  document.documentElement.dataset.accent = valid(key) || FALLBACK;
}

export function setAccent(key) {
  const next = valid(key) || FALLBACK;
  localStorage.setItem(KEY, next);
  applyAccent(next);
}

/** A bejelentkezett profil színére állítja a felületet. */
export function syncAccent(person) {
  setAccent(valid(person?.color) || FALLBACK);
}
