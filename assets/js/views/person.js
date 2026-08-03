// Egy ember nézete. A táblázat mindig egy teljes hetet mutat hétfőtől
// vasárnapig, utána a hét összesítő oszlopával. Belépéskor az aktuális hét
// jön be; a ‹ › gombokkal (vagy oldalra húzással) lehet hetet váltani.
// A havi állás célonként a táblázat alatt látszik.

import {
  addGoal, deleteGoal, deletePerson, getPerson, listCompletions, listGoals,
  setCompletion, updateGoal, updatePerson,
} from '../db.js';
import { ACCENTS, applyAccent, getAccent, setAccent, syncAccent } from '../accent.js';
import { avatarMarkup, fileToAvatar } from '../avatar.js';
import { progressRing } from '../chart.js';
import { isMe } from '../session.js';
import { confirmSheet, openSheet, stateBlock, toast } from '../ui.js';
import {
  HU_DAY_INITIALS, canGoBackWeek, daysInMonth, esc, isBeforeStart, monthElapsed,
  monthLabel, monthlyTarget, pct, shiftWeek, todayYmd,
  weekDaysFrom, weekLabel, weekOwnerMonth, ymd,
} from '../util.js';

// A nézet állapota két rajzolás között (az optimista X-elés miatt kell).
let view = null;

export async function render(root, ctx, personId) {
  const { weekStart } = ctx;
  const { year, month } = weekOwnerMonth(weekStart);
  const days = weekDaysFrom(weekStart);

  root.innerHTML = `${header(ctx, null, false)}<main class="page">${stateBlock({ title: 'Betöltés…' })}</main>`;

  let person; let goals; let completions;
  try {
    // A hét és a hónap is kell: a táblázathoz a hét, az összesítőkhöz a hónap.
    const monthFrom = ymd(new Date(year, month, 1));
    const monthTo = ymd(new Date(year, month, daysInMonth(year, month)));
    const weekTo = ymd(days[6]);
    const from = monthFrom < weekStart ? monthFrom : weekStart;
    const to = monthTo > weekTo ? monthTo : weekTo;

    [person, goals] = await Promise.all([getPerson(personId), listGoals(personId)]);
    if (!person) throw new Error('Ez az ember már nem létezik.');
    completions = await listCompletions(from, to, goals.map((g) => g.id));
  } catch (err) {
    root.querySelector('.page').innerHTML = stateBlock({
      icon: '⚠️',
      title: 'Hiba',
      text: err.message,
      actionLabel: 'Vissza a főoldalra',
      actionId: 'back-home',
    });
    root.querySelector('#back-home')?.addEventListener('click', () => ctx.go('#/'));
    return;
  }

  // Csak a saját profil szerkeszthető — a többieké megtekinthető.
  const own = isMe(person.id);

  // Közvetlen linkről is a saját profil színe legyen érvényben, ne a
  // legutóbb eltárolt — különben a színválasztó rosszat mutatna.
  if (own) syncAccent(person);

  view = {
    ctx, person, goals, year, month, weekStart, days, readOnly: !own,
    done: new Set(completions.map((c) => `${c.goal_id}|${c.day}`)),
  };

  root.innerHTML = `
    ${header(ctx, person, own)}
    <main class="page">
      ${own ? '' : '<p class="viewonly">👁 Csak megtekintés</p>'}
      <div id="summary"></div>
      ${goals.length === 0
        ? stateBlock({ icon: '🎯', title: 'Még nincs cél' })
        : '<div class="tablewrap tablewrap--week" id="tablewrap"></div><div id="goalstats"></div>'}
      ${own ? '<button class="btn btn--ghost btn--block" id="add-goal">+ Új cél</button>' : ''}
    </main>`;

  wireHeader(root, ctx, person, own);
  root.querySelector('#add-goal')?.addEventListener('click', () => goalSheet(null));
  paint();
  wireSwipe(root, ctx);
}

// --- rajzolás --------------------------------------------------------------

function paint() {
  const summary = document.getElementById('summary');
  if (summary) summary.innerHTML = summaryHtml();

  const stats = document.getElementById('goalstats');
  if (stats) stats.innerHTML = goalStatsHtml();

  const wrap = document.getElementById('tablewrap');
  if (!wrap) return;

  wrap.innerHTML = tableHtml();
  if (view.readOnly) return;

  wrap.querySelectorAll('.cell:not(:disabled)').forEach((btn) => {
    btn.addEventListener('click', () => toggle(btn.dataset.goal, btn.dataset.day));
  });
  wrap.querySelectorAll('.rowhead').forEach((th) => {
    th.addEventListener('click', () => {
      const goal = view.goals.find((g) => g.id === th.dataset.goal);
      if (goal) goalSheet(goal);
    });
  });
}

function countFor(goalId, days) {
  let n = 0;
  for (const day of days) if (view.done.has(`${goalId}|${day}`)) n++;
  return n;
}

function monthDayList() {
  const { year, month } = view;
  const out = [];
  for (let d = 1; d <= daysInMonth(year, month); d++) out.push(ymd(new Date(year, month, d)));
  return out;
}

function monthStats() {
  const days = monthDayList();
  let done = 0;
  let target = 0;
  for (const goal of view.goals) {
    const t = monthlyTarget(goal, view.year, view.month);
    target += t;
    done += Math.min(countFor(goal.id, days), t);
  }
  return { done, target, percent: pct(done, target) };
}

function summaryHtml() {
  const { year, month, goals } = view;
  const s = monthStats();
  return `
    <section class="psummary">
      ${progressRing(s.percent, {
        size: 84,
        stroke: 8,
        elapsed: monthElapsed(year, month),
        label: goals.length ? `${s.percent}<span class="ring__pct">%</span>` : '–',
      })}
      <div class="psummary__meta">
        <div class="psummary__label">${esc(monthLabel(year, month))}</div>
        <div class="psummary__value">${s.done} / ${s.target} cél</div>
      </div>
    </section>`;
}

function tableHtml() {
  const { goals, days } = view;
  const today = todayYmd();

  let head = '<tr><th class="corner">Cél</th>';
  for (const day of days) {
    const d = ymd(day);
    const weekend = day.getDay() === 0 || day.getDay() === 6;
    head += `<th class="dayhead${weekend ? ' is-weekend' : ''}${d === today ? ' is-today' : ''}">
        <span class="dayhead__num">${day.getDate()}</span>
        <span class="dayhead__dow">${HU_DAY_INITIALS[day.getDay()]}</span>
      </th>`;
  }
  head += '<th class="sumhead"><span class="sumhead__sig">Σ</span><span class="sumhead__range">hét</span></th></tr>';

  const weekDays = days.map(ymd);
  let body = '';
  for (const goal of goals) {
    body += `<tr>
      <th class="rowhead${view.readOnly ? ' is-static' : ''}" data-goal="${esc(goal.id)}"
          ${view.readOnly ? '' : 'title="Szerkesztés"'}>
        <span class="rowhead__title">${esc(goal.title)}</span>
        <span class="badge">${goal.frequency}×/${goal.period === 'week' ? 'hét' : 'hó'}</span>
      </th>`;

    for (const day of days) {
      const d = ymd(day);
      const isDone = view.done.has(`${goal.id}|${d}`);
      const weekend = day.getDay() === 0 || day.getDay() === 6;
      const outside = isBeforeStart(d);
      const locked = outside || view.readOnly;
      body += `<td class="cellwrap${weekend ? ' is-weekend' : ''}${d === today ? ' is-today' : ''}${outside ? ' is-outside' : ''}">
          <button class="cell${isDone ? ' is-done' : ''}${view.readOnly ? ' is-locked' : ''}" data-goal="${esc(goal.id)}" data-day="${d}"
                  aria-pressed="${isDone}" ${locked ? 'disabled' : ''}
                  aria-label="${outside ? 'A követés kezdete előtti nap' : `${esc(goal.title)} — ${d}`}"
            >${isDone ? '✕' : ''}</button>
        </td>`;
    }

    const n = countFor(goal.id, weekDays);
    if (goal.period === 'week') {
      const hit = n >= goal.frequency;
      body += `<td class="sumcell${hit ? ' is-hit' : ''}">${n}/${goal.frequency}</td>`;
    } else {
      body += `<td class="sumcell is-muted">${n || '–'}</td>`;
    }
    body += '</tr>';
  }

  return `<table class="grid grid--week"><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

function goalStatsHtml() {
  const { goals, year, month } = view;
  if (!goals.length) return '';
  const days = monthDayList();

  const rows = goals.map((goal) => {
    const target = monthlyTarget(goal, year, month);
    const done = countFor(goal.id, days);
    const hit = done >= target;
    return `
      <li class="gstat">
        <span class="gstat__name">${esc(goal.title)}</span>
        <span class="gstat__num">${done}/${target}</span>
        <span class="gstat__meter">
          <span class="gstat__fill${hit ? ' is-hit' : ''}" style="width:${Math.min(100, pct(done, target))}%"></span>
        </span>
      </li>`;
  }).join('');

  return `
    <section class="goalstats">
      <h2 class="goalstats__title">Havi állás — ${esc(monthLabel(year, month))}</h2>
      <ul class="goalstats__list">${rows}</ul>
    </section>`;
}

// --- X-elés ----------------------------------------------------------------

async function toggle(goalId, day) {
  const key = `${goalId}|${day}`;
  const wasDone = view.done.has(key);
  const nowDone = !wasDone;

  if (nowDone) view.done.add(key); else view.done.delete(key);
  paint();

  try {
    await setCompletion(goalId, day, nowDone);
  } catch (err) {
    if (wasDone) view.done.add(key); else view.done.delete(key);
    paint();
    toast(`Nem sikerült menteni: ${err.message}`, 'error');
  }
}

// --- fejléc és hétváltás ---------------------------------------------------

function header(ctx, person, own) {
  const { weekStart } = ctx;
  return `
    <header class="topbar${person ? ' topbar--person' : ''}">
      <div class="topbar__row">
        <button class="icon-btn" id="back" aria-label="Vissza">‹</button>
        <h1 class="topbar__title topbar__title--person">${person ? esc(person.name) : '…'}</h1>
        ${own
    ? '<button class="icon-btn" id="person-menu" aria-label="Beállítások">⋯</button>'
    : '<span class="icon-btn" aria-hidden="true"></span>'}
      </div>
      <div class="topbar__row topbar__row--sub">
        <div class="monthnav monthnav--full">
          <button class="icon-btn" data-week="-1" ${canGoBackWeek(weekStart) ? '' : 'disabled'}
                  aria-label="Előző hét">‹</button>
          <span class="monthnav__label">${esc(weekLabel(weekStart))}</span>
          <button class="icon-btn" data-week="1" aria-label="Következő hét">›</button>
        </div>
      </div>
    </header>`;
}

function wireHeader(root, ctx, person) {
  root.querySelector('#back').addEventListener('click', () => ctx.go('#/'));
  root.querySelectorAll('[data-week]').forEach((btn) => {
    btn.addEventListener('click', () => ctx.setWeek(shiftWeek(ctx.weekStart, Number(btn.dataset.week))));
  });
  root.querySelector('#person-menu')?.addEventListener('click', () => personSheet(person, ctx));
}

/** Vízszintes húzás a táblázaton = hétváltás. */
function wireSwipe(root, ctx) {
  const wrap = root.querySelector('#tablewrap');
  if (!wrap) return;

  let startX = 0;
  let startY = 0;
  wrap.addEventListener('touchstart', (e) => {
    startX = e.changedTouches[0].clientX;
    startY = e.changedTouches[0].clientY;
  }, { passive: true });

  wrap.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const next = shiftWeek(ctx.weekStart, dx < 0 ? 1 : -1);
    if (next !== ctx.weekStart) ctx.setWeek(next);
  }, { passive: true });
}

// --- cél felvétele / szerkesztése -----------------------------------------

function goalSheet(goal) {
  const isEdit = Boolean(goal);
  openSheet({
    title: isEdit ? 'Cél szerkesztése' : 'Új cél',
    body: `
      <form class="form" id="goal-form">
        <label class="field">
          <span class="field__label">Cél megnevezése</span>
          <input class="input" name="title" type="text" maxlength="60" required
                 autocomplete="off" placeholder="pl. Edzés" value="${isEdit ? esc(goal.title) : ''}">
        </label>
        <div class="field-row">
          <label class="field field--sm">
            <span class="field__label">Alkalom</span>
            <input class="input" name="frequency" type="number" inputmode="numeric"
                   min="1" max="99" required value="${isEdit ? goal.frequency : 4}">
          </label>
          <label class="field">
            <span class="field__label">Rendszeresség</span>
            <select class="input" name="period">
              <option value="week" ${!isEdit || goal.period === 'week' ? 'selected' : ''}>hetente</option>
              <option value="month" ${isEdit && goal.period === 'month' ? 'selected' : ''}>havonta</option>
            </select>
          </label>
        </div>
        <p class="field__hint" id="goal-hint"></p>
        <div class="sheet__actions">
          ${isEdit ? '<button type="button" class="btn btn--danger-ghost" data-delete>Törlés</button>' : '<button type="button" class="btn btn--ghost" data-close>Mégse</button>'}
          <button type="submit" class="btn btn--primary">${isEdit ? 'Mentés' : 'Hozzáadás'}</button>
        </div>
      </form>`,
    onMount(sheet, close) {
      const form = sheet.querySelector('#goal-form');
      const hint = sheet.querySelector('#goal-hint');

      const updateHint = () => {
        const freq = Number(form.frequency.value) || 0;
        const period = form.period.value;
        const target = monthlyTarget({ frequency: freq, period }, view.year, view.month);
        hint.textContent = `Havi cél: ${target} alkalom`;
      };
      form.addEventListener('input', updateHint);
      updateHint();

      sheet.querySelector('[data-delete]')?.addEventListener('click', async () => {
        close();
        const ok = await confirmSheet({
          title: 'Cél törlése',
          message: `„${goal.title}” és minden hozzá tartozó pipa véglegesen törlődik.`,
        });
        if (!ok) return;
        try {
          await deleteGoal(goal.id);
          toast('Cél törölve');
          view.ctx.refresh();
        } catch (err) { toast(err.message, 'error'); }
      });

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const payload = {
          title: String(fd.get('title')).trim(),
          frequency: Math.max(1, Math.min(99, Number(fd.get('frequency')) || 1)),
          period: fd.get('period') === 'month' ? 'month' : 'week',
        };
        if (!payload.title) return;
        const submit = form.querySelector('[type="submit"]');
        submit.disabled = true;
        try {
          if (isEdit) await updateGoal(goal.id, payload);
          else await addGoal(view.person.id, payload, view.goals.length);
          close();
          view.ctx.refresh();
        } catch (err) {
          submit.disabled = false;
          toast(err.message, 'error');
        }
      });
    },
  });
}

// --- ember szerkesztése ----------------------------------------------------

function personSheet(person, ctx) {
  // undefined = a kép nem változott, null = törlés, string = új kép
  let pendingAvatar;
  const beforeAccent = getAccent();
  // A kiindulás mindig az adatbázisban tárolt szín, nem az épp érvényes —
  // így a mentés sosem írja felül véletlenül a korábbi választást.
  const initialAccent = ACCENTS.some((a) => a.key === person.color) ? person.color : beforeAccent;
  let chosenAccent = initialAccent;
  let saved = false;

  openSheet({
    title: 'Profil',
    onClose() {
      // Mentés nélkül bezárva az élő színelőnézet visszaáll.
      if (!saved) applyAccent(beforeAccent);
    },
    body: `
      <form class="form" id="person-edit">
        <div class="avatar-edit">
          <span id="avatar-preview">${avatarMarkup(person, { size: 84 })}</span>
          <div class="avatar-edit__actions">
            <button type="button" class="btn btn--ghost btn--sm" id="pick-photo">📷 Profilkép választása</button>
            <button type="button" class="btn btn--danger-ghost btn--sm" id="drop-photo"
                    ${person.avatar ? '' : 'hidden'}>Kép törlése</button>
          </div>
          <input type="file" id="photo-input" class="visually-hidden" accept="image/*">
        </div>
        <label class="field">
          <span class="field__label">Név</span>
          <input class="input" name="name" type="text" maxlength="60" required
                 autocomplete="off" value="${esc(person.name)}">
        </label>
        <div class="field">
          <span class="field__label">Szín</span>
          <div class="swatches" role="radiogroup" aria-label="Szín">
            ${ACCENTS.map((a) => `
              <button type="button" class="swatch${a.key === initialAccent ? ' is-on' : ''}"
                      data-color="${a.key}" role="radio" aria-checked="${a.key === initialAccent}"
                      aria-label="${a.label}" title="${a.label}"
                      style="--sw: var(--c-${a.key}); --sw-ink: var(--on-${a.key})"></button>`).join('')}
          </div>
        </div>
        <div class="sheet__actions">
          <button type="button" class="btn btn--danger-ghost" data-delete>Profil törlése</button>
          <button type="submit" class="btn btn--primary">Mentés</button>
        </div>
      </form>`,
    onMount(sheet, close) {
      const input = sheet.querySelector('#photo-input');
      const preview = sheet.querySelector('#avatar-preview');
      const dropBtn = sheet.querySelector('#drop-photo');

      const showPreview = (avatar) => {
        preview.innerHTML = avatarMarkup({ name: person.name, avatar }, { size: 84 });
        dropBtn.hidden = !avatar;
      };

      sheet.querySelector('#pick-photo').addEventListener('click', () => input.click());

      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        input.value = ''; // ugyanazt a fájlt újra ki lehessen választani
        if (!file) return;
        try {
          pendingAvatar = await fileToAvatar(file);
          showPreview(pendingAvatar);
        } catch (err) { toast(err.message, 'error'); }
      });

      dropBtn.addEventListener('click', () => {
        pendingAvatar = null;
        showPreview(null);
      });

      sheet.querySelectorAll('[data-color]').forEach((btn) => {
        btn.addEventListener('click', () => {
          chosenAccent = btn.dataset.color;
          applyAccent(chosenAccent); // élő előnézet, mentés még nincs
          sheet.querySelectorAll('[data-color]').forEach((other) => {
            const on = other === btn;
            other.classList.toggle('is-on', on);
            other.setAttribute('aria-checked', String(on));
          });
        });
      });

      sheet.querySelector('[data-delete]').addEventListener('click', async () => {
        close();
        const ok = await confirmSheet({
          title: 'Profil törlése',
          message: `${person.name} minden célja és pipája véglegesen törlődik.`,
        });
        if (!ok) return;
        try {
          await deletePerson(person.id);
          toast('Törölve');
          ctx.go('#/');
        } catch (err) { toast(err.message, 'error'); }
      });

      sheet.querySelector('#person-edit').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = String(new FormData(e.target).get('name')).trim();
        if (!name) return;
        const submit = e.target.querySelector('[type="submit"]');
        submit.disabled = true;
        try {
          const patch = { name, color: chosenAccent };
          if (pendingAvatar !== undefined) patch.avatar = pendingAvatar;
          await updatePerson(person.id, patch);
          saved = true;
          setAccent(chosenAccent);
          close();
          ctx.refresh();
        } catch (err) {
          submit.disabled = false;
          toast(err.message, 'error');
        }
      });
    },
  });
}
