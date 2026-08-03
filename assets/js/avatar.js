// Profilkép: megjelenítés és a telefonról választott kép előkészítése.
//
// A képet a böngésző vágja négyzetre és kicsinyíti le, mielőtt elmenne az
// adatbázisba — így egy 4 MB-os telefonfotóból is ~10 kB lesz, és nem kell
// külön fájltároló.

import { esc, initials } from './util.js';

const SIZE = 200;          // a mentett kép oldalhossza pixelben
const MAX_BYTES = 260000;  // a data URL felső korlátja (a séma 300 000-et enged)

/**
 * @param {object} person  { name, avatar }
 * @param {object} opts    { size: px }
 */
export function avatarMarkup(person, { size = 22 } = {}) {
  const style = `--av:${size}px`;

  if (person?.avatar) {
    return `<span class="avatar" style="${style}">
        <img src="${esc(person.avatar)}" alt="" loading="lazy" decoding="async">
      </span>`;
  }
  return `<span class="avatar" style="${style}" aria-hidden="true">${esc(initials(person?.name))}</span>`;
}

async function loadBitmap(file) {
  if ('createImageBitmap' in window) {
    try {
      // A telefonok álló fotói EXIF forgatást hordoznak — ez veszi figyelembe.
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch { /* nem támogatja az opciót — jöhet a tartalék út */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Telefonról választott képfájlból négyzetes, kicsinyített JPEG data URL.
 * @returns {Promise<string>}
 */
export async function fileToAvatar(file) {
  if (!file) throw new Error('Nincs kiválasztva kép.');
  if (!file.type.startsWith('image/')) throw new Error('Csak képfájlt lehet feltölteni.');

  const source = await loadBitmap(file);
  const w = source.width || source.naturalWidth;
  const h = source.height || source.naturalHeight;
  if (!w || !h) throw new Error('Nem sikerült beolvasni a képet.');

  // Középre igazított négyzetes vágás, majd kicsinyítés.
  const side = Math.min(w, h);
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, (w - side) / 2, (h - side) / 2, side, side, 0, 0, SIZE, SIZE);
  if (source.close) source.close();

  // Ha valamiért így is nagy maradna, lejjebb visszük a minőséget.
  for (const quality of [0.72, 0.6, 0.45, 0.3]) {
    const url = canvas.toDataURL('image/jpeg', quality);
    if (url.length <= MAX_BYTES) return url;
  }
  throw new Error('A kép túl nagy maradt, próbálj másikat.');
}
