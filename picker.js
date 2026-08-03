// „Ki vagy?” képernyő — nagy profilcsempék, mint a Netflix profilválasztója.
// Az első megnyitáskor jön elő, utána csak akkor, ha valaki szándékosan vált
// (a főoldal fejlécében lévő névre koppintva).

import { addPerson, listPeople, reorderPeople } from '../db.js';
import { avatarMarkup } from '../avatar.js';
import { enableReorder } from '../reorder.js';
import { setMe } from '../session.js';
import { themeButton, wireThemeButton } from '../theme.js';
import { openSheet, stateBlock, toast } from '../ui.js';
import { esc } from '../util.js';

export async function render(root, ctx) {
  root.innerHTML = `
    <header class="topbar">
      <div class="topbar__row">
        <h1 class="topbar__title">Simahaveros FIT</h1>
        ${themeButton()}
      </div>
    </header>
    <main class="page">${stateBlock({ title: 'Betöltés…' })}</main>`;
  wireThemeButton(root);

  let people;
  try {
    people = await listPeople();
  } catch (err) {
    root.querySelector('.page').innerHTML = stateBlock({
      icon: '⚠️',
      title: 'Nem sikerült betölteni',
      text: err.message,
      actionLabel: 'Újra',
      actionId: 'retry',
    });
    root.querySelector('#retry')?.addEventListener('click', () => ctx.refresh());
    return;
  }

  const main = root.querySelector('.page');
  main.innerHTML = `
    <h2 class="whois-title">Ki vagy?</h2>
    <ul class="whois" id="whois">
      ${people.map(tile).join('')}
      <li>
        <button class="whois__item whois__item--add" id="add-person" aria-label="Új ember">
          <span class="tile-add"><span class="tile-add__plus" aria-hidden="true">+</span></span>
          <span class="whois__name">Új ember</span>
        </button>
      </li>
    </ul>`;

  main.querySelectorAll('[data-person]').forEach((el) => {
    el.addEventListener('click', () => {
      setMe(el.dataset.person);
      ctx.go('#/');
    });
  });

  main.querySelector('#add-person').addEventListener('click', () => addPersonSheet(people, ctx));

  enableReorder(main.querySelector('#whois'), async (ids) => {
    try {
      await reorderPeople(ids);
    } catch (err) {
      toast(`Nem sikerült menteni a sorrendet: ${err.message}`, 'error');
      ctx.refresh();
    }
  });
}

function tile(person) {
  return `
    <li data-id="${esc(person.id)}">
      <button class="whois__item" data-person="${esc(person.id)}">
        ${avatarMarkup(person, { size: 112 })}
        <span class="whois__name">${esc(person.name)}</span>
      </button>
    </li>`;
}

function addPersonSheet(people, ctx) {
  openSheet({
    title: 'Új ember',
    body: `
      <form class="form" id="person-form">
        <label class="field">
          <span class="field__label">Név</span>
          <input class="input" name="name" type="text" autocomplete="off"
                 maxlength="60" required placeholder="pl. Takács Ádám">
        </label>
        <div class="sheet__actions">
          <button type="button" class="btn btn--ghost" data-close>Mégse</button>
          <button type="submit" class="btn btn--primary">Hozzáadás</button>
        </div>
      </form>`,
    onMount(sheet, close) {
      sheet.querySelector('#person-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = String(new FormData(e.target).get('name')).trim();
        if (!name) return;
        const submit = e.target.querySelector('[type="submit"]');
        submit.disabled = true;
        try {
          await addPerson(name, people.length);
          close();
          toast(`${name} hozzáadva`);
          ctx.refresh();
        } catch (err) {
          submit.disabled = false;
          toast(err.message, 'error');
        }
      });
    },
  });
}
