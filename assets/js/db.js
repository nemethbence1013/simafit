// Adatréteg — minden Supabase-hívás itt fut össze.
// A nézetek csak az itt exportált függvényeket hívják.

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const CREDS_KEY = 'fit.supabase';

/** A config.js-ből, vagy — ha az üres — a localStorage-ból. */
export function getCreds() {
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    return { url: SUPABASE_URL.replace(/\/+$/, ''), key: SUPABASE_ANON_KEY };
  }
  try {
    const saved = JSON.parse(localStorage.getItem(CREDS_KEY) || 'null');
    if (saved && saved.url && saved.key) return saved;
  } catch { /* sérült érték — kezeljük hiányzóként */ }
  return null;
}

export function saveCreds(url, key) {
  localStorage.setItem(CREDS_KEY, JSON.stringify({
    url: url.trim().replace(/\/+$/, ''),
    key: key.trim(),
  }));
  client_ = null;
}

export function clearCreds() {
  localStorage.removeItem(CREDS_KEY);
  client_ = null;
}

let client_ = null;

export function sb() {
  if (client_) return client_;
  const creds = getCreds();
  if (!creds) return null;
  client_ = createClient(creds.url, creds.key, {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 5 } },
  });
  return client_;
}

function check({ data, error }) {
  if (error) throw new Error(error.message || 'Ismeretlen adatbázis-hiba');
  return data;
}

// --- emberek ---------------------------------------------------------------

export async function listPeople() {
  return check(await sb().from('people')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true }));
}

export async function getPerson(id) {
  const rows = check(await sb().from('people').select('*').eq('id', id).limit(1));
  return rows[0] || null;
}

export async function addPerson(name, sortOrder) {
  return check(await sb().from('people')
    .insert({ name: name.trim(), sort_order: sortOrder })
    .select()
    .single());
}

export async function updatePerson(id, patch) {
  return check(await sb().from('people').update(patch).eq('id', id).select().single());
}

export async function renamePerson(id, name) {
  return updatePerson(id, { name: name.trim() });
}

export async function deletePerson(id) {
  check(await sb().from('people').delete().eq('id', id));
}

/** Új sorrend mentése: a tömb sorrendje lesz a `sort_order`. */
export async function reorderPeople(ids) {
  const results = await Promise.all(
    ids.map((id, index) => sb().from('people').update({ sort_order: index }).eq('id', id)),
  );
  const failed = results.find((r) => r.error);
  if (failed) throw new Error(failed.error.message);
}

// --- célok -----------------------------------------------------------------

export async function listGoals(personId = null) {
  let q = sb().from('goals').select('*').eq('archived', false);
  if (personId) q = q.eq('person_id', personId);
  return check(await q
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true }));
}

export async function addGoal(personId, { title, frequency, period }, sortOrder) {
  return check(await sb().from('goals')
    .insert({
      person_id: personId,
      title: title.trim(),
      frequency,
      period,
      sort_order: sortOrder,
    })
    .select()
    .single());
}

export async function updateGoal(id, patch) {
  return check(await sb().from('goals').update(patch).eq('id', id).select().single());
}

export async function deleteGoal(id) {
  check(await sb().from('goals').delete().eq('id', id));
}

// --- teljesítések ----------------------------------------------------------

/**
 * Egy dátumtartomány összes pipája.
 * @returns {Promise<Array<{goal_id:string, day:string}>>}
 */
export async function listCompletions(fromDay, toDay, goalIds = null) {
  let q = sb().from('completions').select('goal_id, day').gte('day', fromDay).lte('day', toDay);
  if (goalIds && goalIds.length) q = q.in('goal_id', goalIds);
  if (goalIds && goalIds.length === 0) return [];
  return check(await q);
}

export async function setCompletion(goalId, day, done) {
  if (done) {
    check(await sb().from('completions')
      .upsert({ goal_id: goalId, day }, { onConflict: 'goal_id,day', ignoreDuplicates: true }));
  } else {
    check(await sb().from('completions').delete().eq('goal_id', goalId).eq('day', day));
  }
}

// --- élő szinkron ----------------------------------------------------------

let channel = null;

/**
 * Feliratkozás minden táblaváltozásra. A callback kb. 300 ms-os késleltetéssel,
 * összevonva fut le, hogy egy sorozatnyi módosítás egyszer rajzoljon újra.
 */
export function subscribeChanges(onChange) {
  const supabase = sb();
  if (!supabase) return () => {};
  if (channel) supabase.removeChannel(channel);

  let timer = null;
  const fire = () => {
    clearTimeout(timer);
    timer = setTimeout(onChange, 300);
  };

  channel = supabase.channel('fit-changes');
  for (const table of ['people', 'goals', 'completions']) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, fire);
  }
  channel.subscribe();

  return () => {
    clearTimeout(timer);
    if (channel) { supabase.removeChannel(channel); channel = null; }
  };
}

/** Gyors kapcsolat-ellenőrzés, hogy a hibaüzenet érthető legyen. */
export async function ping() {
  const supabase = sb();
  if (!supabase) throw new Error('Nincs beállítva a Supabase kapcsolat.');
  const { error } = await supabase.from('people').select('id').limit(1);
  if (error) throw new Error(error.message);
  return true;
}
