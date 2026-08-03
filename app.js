// Belépési pont: útvonalválasztás, beállító képernyő, élő szinkron.

import { clearCreds, getCreds, ping, saveCreds, subscribeChanges } from './db.js';
import * as dashboard from './views/dashboard.js';
import * as person from './views/person.js';
import * as picker from './views/picker.js';
import { getMe } from './session.js';
import { closeSheet, toast } from './ui.js';
import { currentWeekStart, defaultMonth, esc } from './util.js';
import { SUPABASE_URL } from './config.js';

const root = document.getElementById('app');
const state = { ...defaultMonth(), weekStart: currentWeekStart() };
let stopRealtime = null;
let shownPersonId = null;

const ctx = {
  get year() { return state.year; },
  get month() { return state.month; },
  get weekStart() { return state.weekStart; },
  setMonth(year, month) {
    state.year = year;
    state.month = month;
    route();
  },
  setWeek(weekStart) {
    state.weekStart = weekStart;
    route();
  },
  go(hash) {
    if (location.hash === hash) route();
    else location.hash = hash;
  },
  refresh() { route(); },
};

async function route() {
  if (!getCreds() || location.hash === '#/setup') {
    if (stopRealtime) { stopRealtime(); stopRealtime = null; }
    renderSetup();
    return;
  }

  ensureRealtime();

  // A csupasz cím (hash nélkül) mindig a profilválasztóval indul — így az
  // oldal megnyitása mindig azzal kezdődik, hogy ki használja most. A #/ már
  // a főoldal, ezért az appon belüli „vissza” nem ide jön ki.
  const bareUrl = !location.hash || location.hash === '#';

  // Amíg nincs kiválasztva, hogy ki használja az eszközt, nem megy tovább.
  if (bareUrl || !getMe() || location.hash === '#/valassz') {
    shownPersonId = null;
    await picker.render(root, ctx);
    return;
  }

  const match = (location.hash || '#/').match(/^#\/p\/([^/?]+)/);
  if (match) {
    const id = decodeURIComponent(match[1]);
    // Profilba lépéskor mindig az aktuális hét jön be; hétváltáskor viszont
    // (ugyanaz az ember van nyitva) marad, ahol a lapozás tart.
    if (id !== shownPersonId) {
      state.weekStart = currentWeekStart();
      shownPersonId = id;
    }
    await person.render(root, ctx, id);
  } else {
    shownPersonId = null;
    await dashboard.render(root, ctx);
  }
}

function ensureRealtime() {
  if (stopRealtime) return;
  stopRealtime = subscribeChanges(() => {
    // Nyitott űrlap közben nem rajzolunk újra, hogy ne tűnjön el a gépelés alól.
    if (document.querySelector('.sheet-backdrop')) return;
    route();
  });
}

// --- beállító képernyő -----------------------------------------------------

function renderSetup() {
  const creds = getCreds();
  const hardcoded = Boolean(SUPABASE_URL);

  root.innerHTML = `
    <header class="topbar">
      <div class="topbar__row">
        <h1 class="topbar__title">FIT — beállítás</h1>
      </div>
    </header>
    <main class="page">
      <p class="setup__intro">Supabase → Project Settings → API</p>
      ${hardcoded ? '<p class="setup__intro">A <code>config.js</code> értékét csak ezen az eszközön írja felül.</p>' : ''}
      <form class="form" id="setup-form">
        <label class="field">
          <span class="field__label">Project URL</span>
          <input class="input" name="url" type="url" required autocomplete="off"
                 spellcheck="false" placeholder="https://xxxx.supabase.co"
                 value="${creds ? esc(creds.url) : ''}">
        </label>
        <label class="field">
          <span class="field__label">anon public kulcs</span>
          <textarea class="input input--area" name="key" rows="3" required
                    spellcheck="false" placeholder="eyJhbGciOi…">${creds ? esc(creds.key) : ''}</textarea>
        </label>
        <button type="submit" class="btn btn--primary btn--block">Kapcsolódás</button>
        ${creds ? '<button type="button" class="btn btn--ghost btn--block" id="forget">Mentett adatok törlése</button>' : ''}
      </form>
    </main>`;

  root.querySelector('#forget')?.addEventListener('click', () => {
    clearCreds();
    location.hash = '#/';
    route();
  });

  root.querySelector('#setup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const submit = e.target.querySelector('[type="submit"]');
    submit.disabled = true;
    submit.textContent = 'Ellenőrzés…';
    saveCreds(String(fd.get('url')), String(fd.get('key')));
    try {
      await ping();
      location.hash = '#/';
      route();
    } catch (err) {
      submit.disabled = false;
      submit.textContent = 'Kapcsolódás';
      toast(`Sikertelen kapcsolódás: ${err.message}`, 'error');
    }
  });
}

// --- indulás ---------------------------------------------------------------

window.addEventListener('hashchange', () => {
  closeSheet();
  route();
});

route();
