// „Ki vagy?” — jelszó nélküli felhasználóválasztás.
//
// Nem biztonsági funkció: csak azt akadályozza meg, hogy valaki véletlenül
// más profiljába pipáljon be. Az eszközön eltárolt választás alapján a saját
// profil szerkeszthető, a többiek profilja csak megtekinthető.

const KEY = 'fit.me';

export function getMe() {
  return localStorage.getItem(KEY) || null;
}

export function setMe(personId) {
  localStorage.setItem(KEY, personId);
}

export function clearMe() {
  localStorage.removeItem(KEY);
}

export function isMe(personId) {
  const me = getMe();
  return Boolean(me) && me === personId;
}
