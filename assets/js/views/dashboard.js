// Főnézet: minden ember egy kártyán, havi teljesítés-gyűrűvel.

import { listPeople, listGoals, listCompletions } from '../db.js';
import { syncAccent } from '../accent.js';
import { avatarMarkup } from '../avatar.js';
import { progressRing } from '../chart.js';
import { clearMe, getMe } from '../session.js';
import { themeButton, wireThemeButton } from '../theme.js';
import { stateBlock } from '../ui.js';
import {
  daysInMonth, esc, monthElapsed, monthLabel, monthlyTarget,
  pct, ymd, canGoBack, shiftMonth,
} from '../util.js';

export async function render(root, ctx) {
  const { year, month } = ctx;

  root.innerHTML = `
    ${header(ctx)}
    <main class="page">${stateBlock({ title: 'Betöltés…' })}</main>`;
  wireHeader(root, ctx);

  let people; let goals; let completions;
  try {
    const from = ymd(new Date(year, month, 1));
    const to = ymd(new Date(year, month, daysInMonth(year, month)));
    [people, goals] = await Promise.all([listPeople(), listGoals()]);
    completions = await listCompletions(from, to, goals.map((g) => g.id));
  } catch (err) {
    root.querySelector('.page').innerHTML = stateBlock({
      icon: '⚠️',
      title: 'Nem sikerült betölteni az adatokat',
      text: err.message,
      actionLabel: 'Újra',
      actionId: 'retry',
    });
    root.querySelector('#retry')?.addEventListener('click', () => ctx.refresh());
    return;
  }

  // Ha a kiválasztott embert időközben törölték, újra kell választani.
  const me = people.find((p) => p.id === getMe()) || null;
  if (!me) {
    clearMe();
    ctx.go('#/valassz');
    return;
  }
  syncAccent(me);

  const chipName = root.querySelector('#me-name');
  if (chipName) chipName.textContent = me.name;
  const chipAvatar = root.querySelector('#me-avatar');
  if (chipAvatar) chipAvatar.outerHTML = avatarMarkup(me, { size: 22 });

  const stats = computeStats(people, goals, completions, year, month);
  const totals = stats.reduce(
    (acc, s) => ({ done: acc.done + s.done, target: acc.target + s.target }),
    { done: 0, target: 0 },
  );

  const main = root.querySelector('.page');
  main.innerHTML = `
    ${totals.target ? teamSummary(totals, year, month) : ''}
    <div class="people-grid">${stats.map((s) => card(s, year, month, me.id)).join('')}</div>`;

  main.querySelectorAll('[data-person]').forEach((el) => {
    el.addEventListener('click', () => ctx.go(`#/p/${el.dataset.person}`));
  });
}

// --- számítás --------------------------------------------------------------

function computeStats(people, goals, completions, year, month) {
  const doneByGoal = new Map();
  for (const c of completions) {
    doneByGoal.set(c.goal_id, (doneByGoal.get(c.goal_id) || 0) + 1);
  }

  return people.map((person) => {
    const own = goals.filter((g) => g.person_id === person.id);
    let done = 0;
    let target = 0;
    for (const goal of own) {
      const goalTarget = monthlyTarget(goal, year, month);
      const goalDone = doneByGoal.get(goal.id) || 0;
      target += goalTarget;
      // Célonként legfeljebb a saját darabszámáig számít — egy cél túlteljesítése
      // nem pótolja egy másik elmaradását.
      done += Math.min(goalDone, goalTarget);
    }
    return { person, goalCount: own.length, done, target, percent: pct(done, target) };
  });
}

// --- részletek -------------------------------------------------------------

function header(ctx) {
  const { year, month } = ctx;
  return `
    <header class="topbar">
      <div class="topbar__row">
        <h1 class="topbar__title">Simahaveros FIT</h1>
        ${themeButton()}
        <button class="mechip" id="me-chip" aria-label="Felhasználó váltása">
          <span id="me-avatar"></span>
          <span class="mechip__name" id="me-name">…</span>
          <span class="mechip__caret" aria-hidden="true">▾</span>
        </button>
      </div>
      <div class="topbar__row topbar__row--sub">
        <div class="monthnav monthnav--full">
          <button class="icon-btn" data-month="-1" ${canGoBack(year, month) ? '' : 'disabled'}
                  aria-label="Előző hónap">‹</button>
          <span class="monthnav__label">${esc(monthLabel(year, month))}</span>
          <button class="icon-btn" data-month="1" aria-label="Következő hónap">›</button>
        </div>
      </div>
    </header>`;
}

function wireHeader(root, ctx) {
  root.querySelectorAll('[data-month]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = shiftMonth(ctx.year, ctx.month, Number(btn.dataset.month));
      ctx.setMonth(next.year, next.month);
    });
  });
  root.querySelector('#me-chip')?.addEventListener('click', () => ctx.go('#/valassz'));
  wireThemeButton(root, () => ctx.refresh());
}

function teamSummary(totals, year, month) {
  const percent = pct(totals.done, totals.target);
  return `
    <section class="hero">
      <div class="hero__figure">${percent}<span class="hero__unit">%</span></div>
      <div class="hero__meta">
        <div class="hero__label">Csapat összesen</div>
        <div class="hero__sub">${totals.done} / ${totals.target} cél · ${esc(monthLabel(year, month))}</div>
        <div class="meter" role="img" aria-label="${percent} százalék">
          <div class="meter__fill" style="width:${Math.min(100, percent)}%"></div>
          <div class="meter__marker" style="left:${(monthElapsed(year, month) * 100).toFixed(1)}%"></div>
        </div>
      </div>
    </section>`;
}

function card(stat, year, month, meId) {
  const { person, percent, done, target, goalCount } = stat;
  const sub = goalCount === 0 ? 'nincs cél' : `${done}/${target}`;
  const isMe = person.id === meId;
  return `
    <button class="pcard${isMe ? ' is-me' : ''}" data-person="${esc(person.id)}">
      ${isMe ? '<span class="pcard__you">Te</span>' : ''}
      ${progressRing(percent, {
        size: 104,
        stroke: 9,
        elapsed: monthElapsed(year, month),
        label: goalCount === 0 ? '–' : `${percent}<span class="ring__pct">%</span>`,
        sub,
      })}
      <span class="pcard__name">
        ${avatarMarkup(person, { size: 22 })}
        ${esc(person.name)}
      </span>
    </button>`;
}
