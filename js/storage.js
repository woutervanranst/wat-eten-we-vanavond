// Favorites, cooking history and the week menu, kept in this browser (per device).

const KEY = "wev.v1";

function empty() {
  return { favorites: [], cooked: {}, menu: [], checked: {} };
}

const isObject = (v) => v && typeof v === "object" && !Array.isArray(v);

export function loadUser() {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? "null");
    const user = empty();
    if (!isObject(stored)) return user;
    // Keep only well-formed parts, so a damaged entry can never break the app.
    if (Array.isArray(stored.favorites)) user.favorites = stored.favorites.filter((f) => typeof f === "string");
    if (isObject(stored.cooked)) {
      for (const [id, dates] of Object.entries(stored.cooked)) {
        if (Array.isArray(dates)) user.cooked[id] = dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
      }
    }
    if (Array.isArray(stored.menu)) {
      user.menu = stored.menu.filter((m) => isObject(m) && typeof m.id === "string" && Number(m.amount) > 0)
        .map((m) => ({ id: m.id, amount: Number(m.amount) }));
    }
    if (isObject(stored.checked)) user.checked = stored.checked;
    return user;
  } catch {
    return empty();
  }
}

export function saveUser(user) {
  try {
    localStorage.setItem(KEY, JSON.stringify(user));
  } catch {
    // Private mode or storage blocked: the app keeps working for this visit.
  }
}

export function toggleFavorite(user, id) {
  user.favorites = user.favorites.includes(id) ? user.favorites.filter((f) => f !== id) : [...user.favorites, id];
}

export function markCooked(user, id, date) {
  const dates = user.cooked[id] ?? [];
  if (!dates.includes(date)) user.cooked[id] = [...dates, date].sort();
}

export function unmarkCooked(user, id, date) {
  const dates = (user.cooked[id] ?? []).filter((d) => d !== date);
  if (dates.length) user.cooked[id] = dates;
  else delete user.cooked[id];
}

export function menuEntry(user, id) {
  return user.menu.find((m) => m.id === id);
}

export function toggleMenu(user, id, amount) {
  user.menu = menuEntry(user, id) ? user.menu.filter((m) => m.id !== id) : [...user.menu, { id, amount }];
}

export function setMenuAmount(user, id, amount) {
  const entry = menuEntry(user, id);
  if (entry) entry.amount = amount;
}
