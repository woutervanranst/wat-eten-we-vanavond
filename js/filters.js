// Pure filtering, faceting and ranking of recipes. No DOM access.

import { fold, matcher } from "./text.js";

/** Precompute folded search text once per recipe. */
export function prepare(data) {
  const bookOrder = new Map(data.books.map((b, i) => [b.id, i]));
  for (const recipe of data.recipes) {
    const names = new Set();
    const pantry = new Set();
    for (const group of recipe.ingredients) {
      for (const item of group.items) {
        for (const name of item.n ?? []) {
          names.add(fold(name));
          if (item.p) pantry.add(fold(name));
        }
      }
    }
    recipe._names = [...names];
    recipe._pantry = pantry;
    recipe._title = fold(`${recipe.title} ${recipe.subtitle ?? ""}`);
    recipe._books = recipe.refs.map((r) => r.book);
    recipe._sections = recipe.refs.map((r) => `${r.book}|${r.section}`);
    recipe._order = [bookOrder.get(recipe.refs[0].book), recipe.refs[0].page];
  }
  return data;
}

function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function lastCooked(user, id) {
  const dates = user.cooked?.[id];
  return dates?.length ? dates[dates.length - 1] : "";
}

const any = (selected, values) => !selected.length || values.some((v) => selected.includes(v));

/**
 * Apply the filter state. Returns { results, facets } where results are
 * [{ recipe, matched, missing }] in display order and facets count, per filter
 * group, how many recipes each value would give (ignoring that group's own filter).
 */
export function apply(recipes, state, user = {}, today = "") {
  const withTerms = state.terms.filter((t) => !t.without).map((t) => ({ ...t, test: matcher(t.text) }));
  const withoutTerms = state.terms.filter((t) => t.without).map((t) => ({ ...t, test: matcher(t.text) }));
  const ranking = state.pantryMode && withTerms.length >= 2;
  const favorites = new Set(user.favorites ?? []);

  const rows = recipes.map((recipe) => {
    const matched = withTerms.filter((t) => recipe._names.some(t.test) || t.test(recipe._title));
    const excluded = withoutTerms.some((t) => recipe._names.some(t.test));
    const appliances = Object.entries(state.appliances).every(([name, mode]) =>
      mode === "met" ? recipe.appliances.includes(name) : !recipe.appliances.includes(name),
    );
    const pass = {
      terms: !excluded && (ranking ? matched.length > 0 : matched.length === withTerms.length),
      diet: any(state.diet, recipe.diet),
      course: any(state.course, recipe.course),
      books: any(state.books, recipe._books),
      sections: any(state.sections, recipe._sections),
      tags: any(state.tags, recipe.tags),
      appliances,
      time: !state.max || recipe.time.total <= state.max,
      ahead: !state.noAhead || !recipe.time.ahead,
      favorites: !state.favorites || favorites.has(recipe.id),
      never: !state.never || !lastCooked(user, recipe.id),
    };
    const missing = recipe._names.filter(
      (n) => !recipe._pantry.has(n) && !matched.some((t) => t.test(n)),
    ).length;
    return { recipe, pass, matched: matched.length, missing };
  });

  const passesExcept = (row, group) =>
    Object.entries(row.pass).every(([key, ok]) => ok || key === group);

  const facets = { diet: {}, course: {}, books: {}, sections: {}, tags: {}, appliances: {} };
  const count = (bucket, values) => {
    for (const v of new Set(values)) bucket[v] = (bucket[v] ?? 0) + 1;
  };
  for (const row of rows) {
    const r = row.recipe;
    if (passesExcept(row, "diet")) count(facets.diet, r.diet);
    if (passesExcept(row, "course")) count(facets.course, r.course);
    if (passesExcept(row, "books")) count(facets.books, r._books);
    if (passesExcept(row, "sections")) count(facets.sections, r._sections);
    if (passesExcept(row, "tags")) count(facets.tags, r.tags);
    if (passesExcept(row, "appliances")) count(facets.appliances, r.appliances);
  }

  const results = rows.filter((row) => Object.values(row.pass).every(Boolean));
  const order = {
    verrassend: (a, b) => hash(a.recipe.id + today) - hash(b.recipe.id + today),
    snelst: (a, b) => a.recipe.time.total - b.recipe.time.total || a.recipe.title.localeCompare(b.recipe.title, "nl"),
    lang: (a, b) => lastCooked(user, a.recipe.id).localeCompare(lastCooked(user, b.recipe.id)),
    boek: (a, b) => a.recipe._order[0] - b.recipe._order[0] || a.recipe._order[1] - b.recipe._order[1],
  }[state.sort] ?? (() => 0);
  results.sort((a, b) => (ranking ? b.matched - a.matched || a.missing - b.missing : 0) || order(a, b));
  return { results, facets, ranking, termCount: withTerms.length };
}

/** Ingredient names for autocomplete: [{ name, count }] matching the typed text. */
export function suggestions(recipes, text, limit = 8) {
  const folded = fold(text);
  if (folded.length < 2) return [];
  const test = matcher(folded);
  const counts = new Map();
  for (const recipe of recipes) {
    for (const group of recipe.ingredients) {
      for (const item of group.items) {
        for (const name of item.n ?? []) {
          if (test(fold(name))) counts.set(name, (counts.get(name) ?? new Set()).add(recipe.id));
        }
      }
    }
  }
  return [...counts]
    .map(([name, ids]) => ({ name, count: ids.size }))
    .sort((a, b) => {
      const aStarts = fold(a.name).startsWith(folded) ? 0 : 1;
      const bStarts = fold(b.name).startsWith(folded) ? 0 : 1;
      return aStarts - bStarts || b.count - a.count || a.name.length - b.name.length;
    })
    .slice(0, limit);
}
