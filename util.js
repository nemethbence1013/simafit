// Dátum- és számítási segédfüggvények.

export const HU_MONTHS = [
  'január', 'február', 'március', 'április', 'május', 'június',
  'július', 'augusztus', 'szeptember', 'október', 'november', 'december',
];

export const HU_MONTHS_SHORT = [
  'jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.',
  'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.',
];

// getDay(): 0 = vasárnap … 6 = szombat
export const HU_DAY_INITIALS = ['V', 'H', 'K', 'Sz', 'Cs', 'P', 'Sz'];

// A követés kezdete: 2026. augusztus 1. Ennél korábbi hónapra nem lehet lapozni.
export const START_YEAR = 2026;
export const START_MONTH = 7; // 0-alapú → augusztus

/** Date → 'YYYY-MM-DD' (helyi idő szerint, nem UTC). */
export function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 'YYYY-MM-DD' → Date (helyi dél, hogy a nyári időszámítás ne csússzon el). */
export function parseYmd(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

export function todayYmd() {
  return ymd(new Date());
}

export function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

/** A hónap összes napja Date-ként. */
export function monthDays(year, month) {
  const n = daysInMonth(year, month);
  const out = [];
  for (let d = 1; d <= n; d++) out.push(new Date(year, month, d, 12, 0, 0));
  return out;
}

/**
 * A hónap napjai hetekre bontva. Egy hét vasárnappal zárul (hétfő–vasárnap),
 * a hónap első és utolsó hete lehet csonka.
 */
export function weeksOfMonth(year, month) {
  const weeks = [];
  let current = [];
  for (const day of monthDays(year, month)) {
    current.push(day);
    if (day.getDay() === 0) { // vasárnap → hét vége
      weeks.push(current);
      current = [];
    }
  }
  if (current.length) weeks.push(current);
  return weeks;
}

/**
 * Egy cél havi darabszáma.
 *   heti gyakoriság → gyakoriság × a hónap hetei (napok / 7, kerekítve)
 *   havi gyakoriság → maga a gyakoriság
 * Pl. augusztus (31 nap): heti 4 edzés → 4 × 4 = 16, havi 4 úszás → 4.
 */
export function monthlyTarget(goal, year, month) {
  if (goal.period === 'month') return goal.frequency;
  const weeks = Math.round(daysInMonth(year, month) / 7);
  return goal.frequency * weeks;
}

/** Egy hét célszáma (csak heti céloknál értelmezett). */
export function weeklyTarget(goal) {
  return goal.period === 'week' ? goal.frequency : null;
}

/** Hány százalékban telt el a hónap (0–1). Múltbeli hónapra 1, jövőbelire 0. */
export function monthElapsed(year, month) {
  const now = new Date();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 1);
  if (now >= end) return 1;
  if (now < start) return 0;
  return (now - start) / (end - start);
}

export function isSameMonth(dateStr, year, month) {
  const d = parseYmd(dateStr);
  return d.getFullYear() === year && d.getMonth() === month;
}

export function monthLabel(year, month) {
  return `${year}. ${HU_MONTHS[month]}`;
}

/** Előző/következő hónap, a 2026. augusztusi alsó korláttal. */
export function shiftMonth(year, month, delta) {
  let y = year;
  let m = month + delta;
  while (m < 0) { m += 12; y -= 1; }
  while (m > 11) { m -= 12; y += 1; }
  if (y < START_YEAR || (y === START_YEAR && m < START_MONTH)) {
    return { year: START_YEAR, month: START_MONTH };
  }
  return { year: y, month: m };
}

export function canGoBack(year, month) {
  return !(year === START_YEAR && month === START_MONTH);
}

/** Az aktuális hónap, de sosem korábbi, mint 2026. augusztus. */
export function defaultMonth() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (y < START_YEAR || (y === START_YEAR && m < START_MONTH)) {
    return { year: START_YEAR, month: START_MONTH };
  }
  return { year: y, month: m };
}

export function pct(done, target) {
  if (!target) return 0;
  return Math.round((done / target) * 100);
}

/** Egyszerű, XSS-biztos szövegbeszúrás. */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// --- hetek -----------------------------------------------------------------
// A profilnézet hetente lapoz: mindig hétfőtől vasárnapig látszanak a napok.

/** A követés első napja. Ennél korábbi cellát nem lehet kipipálni. */
export const START_DAY = `${START_YEAR}-${String(START_MONTH + 1).padStart(2, '0')}-01`;

/** A dátumot tartalmazó hét hétfője. */
export function startOfWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // getDay(): 1 = hétfő
  return d;
}

/** A legkorábban megnyitható hét hétfője (a követés első napjáé). */
function earliestWeek() {
  return ymd(startOfWeek(parseYmd(START_DAY)));
}

/** A mai hét hétfője, de sosem korábbi az első követett hétnél. */
export function currentWeekStart() {
  const now = ymd(startOfWeek(new Date()));
  const min = earliestWeek();
  return now < min ? min : now;
}

/** A hét hét napja Date-ként, hétfőtől vasárnapig. */
export function weekDaysFrom(weekStart) {
  const start = parseYmd(weekStart);
  const out = [];
  for (let i = 0; i < 7; i++) {
    out.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i, 12));
  }
  return out;
}

export function shiftWeek(weekStart, delta) {
  const d = parseYmd(weekStart);
  d.setDate(d.getDate() + delta * 7);
  const min = earliestWeek();
  return ymd(d) < min ? min : ymd(d);
}

export function canGoBackWeek(weekStart) {
  return weekStart > earliestWeek();
}

/** „aug. 3–9.” vagy hónapfordulón „aug. 31. – szept. 6.” */
export function weekLabel(weekStart) {
  const days = weekDaysFrom(weekStart);
  const [first] = days;
  const last = days[6];
  if (first.getMonth() === last.getMonth()) {
    return `${HU_MONTHS_SHORT[first.getMonth()]} ${first.getDate()}–${last.getDate()}.`;
  }
  return `${HU_MONTHS_SHORT[first.getMonth()]} ${first.getDate()}. – ${HU_MONTHS_SHORT[last.getMonth()]} ${last.getDate()}.`;
}

/**
 * Melyik hónap havi statisztikáját mutatjuk egy héthez? A hét vasárnapjáét —
 * így a hónapfordulós hét ahhoz a hónaphoz tartozik, amelyikben véget ér.
 */
export function weekOwnerMonth(weekStart) {
  const sunday = weekDaysFrom(weekStart)[6];
  return { year: sunday.getFullYear(), month: sunday.getMonth() };
}

export function isBeforeStart(day) {
  return day < START_DAY;
}

